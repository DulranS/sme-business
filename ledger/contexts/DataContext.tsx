"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  writeBatch,
  query,
  orderBy,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import type {
  Product,
  Purchase,
  PurchaseOrder,
  Sale,
  Expense,
  VariableCost,
  CapitalEntry,
  Employee,
  Loan,
  Settings,
} from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import {
  computeAllLedgers,
  computeSaleEconomics,
  computeMonthlyPnL,
  currentInventoryValue,
  currentInventoryUnits,
  estimateAnnualDemand,
  computeEOQ,
  computeBreakEven,
  computeCapitalSummary,
  computeOnOrderByProduct,
  computeOpenOrderValue,
  monthlyPayrollCost,
  computeLoanPortfolio,
  computeBalanceSheet,
  type ProductLedgerResult,
  type SaleEconomics,
  type MonthlyPnL,
  type EoqResult,
  type BreakEvenResult,
  type CapitalSummary,
  type OpenOrderValue,
  type LoanPortfolioSummary,
  type BalanceSheet,
} from "@/lib/calculations";
import { todayIso } from "@/lib/format";

interface DataContextValue {
  loading: boolean;
  products: Product[];
  purchases: Purchase[];
  purchaseOrders: PurchaseOrder[];
  sales: Sale[];
  expenses: Expense[];
  variableCosts: VariableCost[];
  capitalEntries: CapitalEntry[];
  employees: Employee[];
  loans: Loan[];
  settings: Settings;

  ledgers: Map<string, ProductLedgerResult>;
  saleEconomics: SaleEconomics[];
  monthlyPnL: MonthlyPnL[];
  inventoryValue: number;
  inventoryUnits: number;
  eoqByProduct: Map<string, EoqResult>;
  breakEven: BreakEvenResult;
  capitalSummary: CapitalSummary;
  onOrderByProduct: Map<string, number>;
  openOrders: OpenOrderValue;
  monthlyPayroll: number;
  loanPortfolio: LoanPortfolioSummary;
  balanceSheet: BalanceSheet;

  addProduct: (p: Omit<Product, "id" | "createdAt">) => Promise<void>;
  updateProduct: (id: string, p: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  bulkAddProducts: (rows: Omit<Product, "id" | "createdAt">[]) => Promise<void>;

  addPurchase: (p: Omit<Purchase, "id" | "createdAt">) => Promise<void>;
  updatePurchase: (id: string, p: Partial<Purchase>) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;
  bulkAddPurchases: (rows: Omit<Purchase, "id" | "createdAt">[]) => Promise<void>;

  addPurchaseOrder: (po: Omit<PurchaseOrder, "id" | "createdAt" | "status">) => Promise<void>;
  updatePurchaseOrder: (id: string, po: Partial<PurchaseOrder>) => Promise<void>;
  cancelPurchaseOrder: (id: string) => Promise<void>;
  deletePurchaseOrder: (id: string) => Promise<void>;
  receivePurchaseOrder: (
    id: string,
    receipt: { qtyReceived: number; receivedUnitCost: number; receivedDate: string }
  ) => Promise<void>;
  bulkAddPurchaseOrders: (
    rows: Omit<PurchaseOrder, "id" | "createdAt">[]
  ) => Promise<void>;

  addSale: (s: Omit<Sale, "id" | "createdAt">) => Promise<void>;
  updateSale: (id: string, s: Partial<Sale>) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  bulkAddSales: (rows: Omit<Sale, "id" | "createdAt">[]) => Promise<void>;

  addExpense: (e: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  updateExpense: (id: string, e: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  bulkAddExpenses: (rows: Omit<Expense, "id" | "createdAt">[]) => Promise<void>;

  addVariableCost: (v: Omit<VariableCost, "id" | "createdAt">) => Promise<void>;
  deleteVariableCost: (id: string) => Promise<void>;

  addCapitalEntry: (c: Omit<CapitalEntry, "id" | "createdAt">) => Promise<void>;
  deleteCapitalEntry: (id: string) => Promise<void>;

  // Adding/updating/deleting an employee also creates/updates/removes their
  // linked recurring "Payroll & labor" Expense in the same batch — payroll
  // is always booked as a recurring bill, never a second source of truth.
  addEmployee: (e: Omit<Employee, "id" | "createdAt" | "linkedExpenseId">) => Promise<void>;
  updateEmployee: (id: string, e: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;

  addLoan: (l: Omit<Loan, "id" | "createdAt">) => Promise<void>;
  updateLoan: (id: string, l: Partial<Loan>) => Promise<void>;
  deleteLoan: (id: string) => Promise<void>;

  updateSettings: (s: Partial<Settings>) => Promise<void>;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

// Batches of 400 to stay safely under Firestore's 500-writes-per-batch limit.
const BATCH_SIZE = 400;

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [variableCosts, setVariableCosts] = useState<VariableCost[]>([]);
  const [capitalEntries, setCapitalEntries] = useState<CapitalEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loadedFlags, setLoadedFlags] = useState({
    products: false,
    purchases: false,
    purchaseOrders: false,
    sales: false,
    expenses: false,
    variableCosts: false,
    capitalEntries: false,
    employees: false,
    loans: false,
    settings: false,
  });

  // Single set of onSnapshot listeners for the whole app (mounted once at the
  // root via layout), rather than each page opening its own — this is the
  // main "memory optimized" lever available with a client-only Firestore SPA:
  // one live cache in memory + IndexedDB, shared by every page, instead of N
  // duplicate listeners each re-fetching the same collections.
  useEffect(() => {
    if (!uid) {
      setProducts([]);
      setPurchases([]);
      setPurchaseOrders([]);
      setSales([]);
      setExpenses([]);
      setVariableCosts([]);
      setCapitalEntries([]);
      setEmployees([]);
      setLoans([]);
      setSettings(DEFAULT_SETTINGS);
      return;
    }
    const { db } = getFirebase();

    const unsubs = [
      onSnapshot(collection(db, "users", uid, "products"), (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
        setLoadedFlags((f) => ({ ...f, products: true }));
      }),
      onSnapshot(
        query(collection(db, "users", uid, "purchases"), orderBy("date", "desc")),
        (snap) => {
          setPurchases(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Purchase)));
          setLoadedFlags((f) => ({ ...f, purchases: true }));
        }
      ),
      onSnapshot(
        query(collection(db, "users", uid, "purchaseOrders"), orderBy("orderDate", "desc")),
        (snap) => {
          setPurchaseOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PurchaseOrder)));
          setLoadedFlags((f) => ({ ...f, purchaseOrders: true }));
        }
      ),
      onSnapshot(query(collection(db, "users", uid, "sales"), orderBy("date", "desc")), (snap) => {
        setSales(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale)));
        setLoadedFlags((f) => ({ ...f, sales: true }));
      }),
      onSnapshot(collection(db, "users", uid, "expenses"), (snap) => {
        setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense)));
        setLoadedFlags((f) => ({ ...f, expenses: true }));
      }),
      onSnapshot(collection(db, "users", uid, "variableCosts"), (snap) => {
        setVariableCosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VariableCost)));
        setLoadedFlags((f) => ({ ...f, variableCosts: true }));
      }),
      onSnapshot(
        query(collection(db, "users", uid, "capitalEntries"), orderBy("date", "desc")),
        (snap) => {
          setCapitalEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CapitalEntry)));
          setLoadedFlags((f) => ({ ...f, capitalEntries: true }));
        }
      ),
      onSnapshot(collection(db, "users", uid, "employees"), (snap) => {
        setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee)));
        setLoadedFlags((f) => ({ ...f, employees: true }));
      }),
      onSnapshot(
        query(collection(db, "users", uid, "loans"), orderBy("startDate", "desc")),
        (snap) => {
          setLoans(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Loan)));
          setLoadedFlags((f) => ({ ...f, loans: true }));
        }
      ),
      onSnapshot(doc(db, "users", uid, "meta", "settings"), (snap) => {
        if (snap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as Settings) });
        setLoadedFlags((f) => ({ ...f, settings: true }));
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const loading = !Object.values(loadedFlags).every(Boolean);

  // Derived calculations are memoized off the raw arrays' identities, which
  // only change when a snapshot actually delivers new data — so switching
  // pages never re-runs the WAC/P&L/forecast/EOQ math.
  const ledgers = useMemo(
    () => computeAllLedgers(products, purchases, sales),
    [products, purchases, sales]
  );
  const saleEconomics = useMemo(
    () => computeSaleEconomics(sales, ledgers, variableCosts),
    [sales, ledgers, variableCosts]
  );
  const monthlyPnL = useMemo(
    () =>
      computeMonthlyPnL(
        sales,
        saleEconomics,
        expenses,
        purchases,
        loans,
        capitalEntries,
        settings.taxRatePct,
        settings.monthlyOwnerDraw ?? 0
      ),
    [sales, saleEconomics, expenses, purchases, loans, capitalEntries, settings.taxRatePct, settings.monthlyOwnerDraw]
  );
  const inventoryValue = useMemo(() => currentInventoryValue(ledgers), [ledgers]);
  const inventoryUnits = useMemo(() => currentInventoryUnits(ledgers), [ledgers]);

  const eoqByProduct = useMemo(() => {
    const map = new Map<string, EoqResult>();
    const asOf = todayIso();
    for (const p of products) {
      if (p.type !== "product") continue;
      const ledger = ledgers.get(p.id);
      const demand = estimateAnnualDemand(sales, p.id, asOf);
      map.set(p.id, computeEOQ(p, ledger?.wac ?? 0, demand, settings));
    }
    return map;
  }, [products, sales, ledgers, settings]);

  const breakEven = useMemo(
    () => computeBreakEven(monthlyPnL[monthlyPnL.length - 1], monthlyPnL),
    [monthlyPnL]
  );
  const capitalSummary = useMemo(
    () => computeCapitalSummary(capitalEntries, monthlyPnL),
    [capitalEntries, monthlyPnL]
  );
  const onOrderByProduct = useMemo(() => computeOnOrderByProduct(purchaseOrders), [purchaseOrders]);
  const openOrders = useMemo(() => computeOpenOrderValue(purchaseOrders), [purchaseOrders]);
  const monthlyPayroll = useMemo(() => monthlyPayrollCost(employees), [employees]);
  const loanPortfolio = useMemo(() => computeLoanPortfolio(loans, todayIso()), [loans]);
  const balanceSheet = useMemo(
    () => computeBalanceSheet(monthlyPnL, inventoryValue, loans, capitalSummary, todayIso()),
    [monthlyPnL, inventoryValue, loans, capitalSummary]
  );

  function requireUid(): string {
    if (!uid) throw new Error("Not signed in");
    return uid;
  }

  async function chunkedBatchAdd<T extends Record<string, unknown>>(
    colName: string,
    rows: T[]
  ) {
    const id = requireUid();
    const { db } = getFirebase();
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const row of chunk) {
        const ref = doc(collection(db, "users", id, colName));
        batch.set(ref, { ...row, createdAt: Date.now() });
      }
      await batch.commit();
    }
  }

  const value: DataContextValue = {
    loading,
    products,
    purchases,
    purchaseOrders,
    sales,
    expenses,
    variableCosts,
    capitalEntries,
    employees,
    loans,
    settings,
    ledgers,
    saleEconomics,
    monthlyPnL,
    inventoryValue,
    inventoryUnits,
    eoqByProduct,
    breakEven,
    capitalSummary,
    onOrderByProduct,
    openOrders,
    monthlyPayroll,
    loanPortfolio,
    balanceSheet,

    addProduct: async (p) => {
      const id = requireUid();
      const { db } = getFirebase();
      await addDoc(collection(db, "users", id, "products"), { ...p, createdAt: Date.now() });
    },
    updateProduct: async (docId, p) => {
      const id = requireUid();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", id, "products", docId), p);
    },
    deleteProduct: async (docId) => {
      const id = requireUid();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", id, "products", docId));
    },
    bulkAddProducts: (rows) => chunkedBatchAdd("products", rows),

    addPurchase: async (p) => {
      const id = requireUid();
      const { db } = getFirebase();
      await addDoc(collection(db, "users", id, "purchases"), { ...p, createdAt: Date.now() });
    },
    updatePurchase: async (docId, p) => {
      const id = requireUid();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", id, "purchases", docId), p);
    },
    deletePurchase: async (docId) => {
      const id = requireUid();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", id, "purchases", docId));
    },
    bulkAddPurchases: (rows) => chunkedBatchAdd("purchases", rows),

    addPurchaseOrder: async (po) => {
      const id = requireUid();
      const { db } = getFirebase();
      await addDoc(collection(db, "users", id, "purchaseOrders"), {
        ...po,
        status: "ordered",
        createdAt: Date.now(),
      });
    },
    updatePurchaseOrder: async (docId, po) => {
      const id = requireUid();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", id, "purchaseOrders", docId), po);
    },
    cancelPurchaseOrder: async (docId) => {
      const id = requireUid();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", id, "purchaseOrders", docId), { status: "cancelled" });
    },
    deletePurchaseOrder: async (docId) => {
      const id = requireUid();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", id, "purchaseOrders", docId));
    },
    // Receiving an order does two things atomically-in-intent: creates the
    // Purchase entry (which is what actually feeds the WAC/inventory ledger)
    // using the ACTUAL received qty/cost, and marks the order "received" so
    // it drops out of "on order". This is the one moment ordered stock
    // becomes on-hand stock.
    receivePurchaseOrder: async (docId, receipt) => {
      const id = requireUid();
      const { db } = getFirebase();
      const po = purchaseOrders.find((p) => p.id === docId);
      if (!po) throw new Error("Purchase order not found");

      const batch = writeBatch(db);
      const purchaseRef = doc(collection(db, "users", id, "purchases"));
      batch.set(purchaseRef, {
        productId: po.productId,
        qty: receipt.qtyReceived,
        unitCost: receipt.receivedUnitCost,
        date: receipt.receivedDate,
        supplier: po.supplier ?? "",
        notes: po.notes ?? "",
        purchaseOrderId: po.id,
        createdAt: Date.now(),
      });
      const poRef = doc(db, "users", id, "purchaseOrders", docId);
      batch.update(poRef, {
        status: "received",
        receivedDate: receipt.receivedDate,
        qtyReceived: receipt.qtyReceived,
        receivedUnitCost: receipt.receivedUnitCost,
      });
      await batch.commit();
    },
    bulkAddPurchaseOrders: (rows) => chunkedBatchAdd("purchaseOrders", rows),

    addSale: async (s) => {
      const id = requireUid();
      const { db } = getFirebase();
      await addDoc(collection(db, "users", id, "sales"), { ...s, createdAt: Date.now() });
    },
    updateSale: async (docId, s) => {
      const id = requireUid();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", id, "sales", docId), s);
    },
    deleteSale: async (docId) => {
      const id = requireUid();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", id, "sales", docId));
    },
    bulkAddSales: (rows) => chunkedBatchAdd("sales", rows),

    addExpense: async (e) => {
      const id = requireUid();
      const { db } = getFirebase();
      await addDoc(collection(db, "users", id, "expenses"), { ...e, createdAt: Date.now() });
    },
    updateExpense: async (docId, e) => {
      const id = requireUid();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", id, "expenses", docId), e);
    },
    deleteExpense: async (docId) => {
      const id = requireUid();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", id, "expenses", docId));
    },
    bulkAddExpenses: (rows) => chunkedBatchAdd("expenses", rows),

    addVariableCost: async (v) => {
      const id = requireUid();
      const { db } = getFirebase();
      await addDoc(collection(db, "users", id, "variableCosts"), { ...v, createdAt: Date.now() });
    },
    deleteVariableCost: async (docId) => {
      const id = requireUid();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", id, "variableCosts", docId));
    },

    addCapitalEntry: async (c) => {
      const id = requireUid();
      const { db } = getFirebase();
      await addDoc(collection(db, "users", id, "capitalEntries"), { ...c, createdAt: Date.now() });
    },
    deleteCapitalEntry: async (docId) => {
      const id = requireUid();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", id, "capitalEntries", docId));
    },

    // Employee pay is booked as a normal recurring Expense (category
    // "Payroll & labor") so it flows through MRR/monthly P&L exactly like
    // rent or a subscription. The employee doc just carries the linkedExpenseId
    // so future edits (raise, frequency change, termination) keep both in sync.
    addEmployee: async (e) => {
      const id = requireUid();
      const { db } = getFirebase();
      const batch = writeBatch(db);
      const employeeRef = doc(collection(db, "users", id, "employees"));
      const expenseRef = doc(collection(db, "users", id, "expenses"));
      batch.set(employeeRef, { ...e, linkedExpenseId: expenseRef.id, createdAt: Date.now() });
      batch.set(expenseRef, {
        name: `Payroll — ${e.name}`,
        amount: e.payRate,
        category: "Payroll & labor",
        kind: "expense",
        isRecurring: true,
        recurrence: e.payFrequency,
        startDate: e.startDate,
        endDate: e.active ? undefined : e.endDate,
        employeeId: employeeRef.id,
        createdAt: Date.now(),
      });
      await batch.commit();
    },
    updateEmployee: async (docId, e) => {
      const id = requireUid();
      const { db } = getFirebase();
      const existing = employees.find((emp) => emp.id === docId);
      const employeeRef = doc(db, "users", id, "employees", docId);
      const batch = writeBatch(db);
      batch.update(employeeRef, e);

      if (existing?.linkedExpenseId) {
        const merged = { ...existing, ...e };
        const expenseRef = doc(db, "users", id, "expenses", existing.linkedExpenseId);
        batch.update(expenseRef, {
          name: `Payroll — ${merged.name}`,
          amount: merged.payRate,
          recurrence: merged.payFrequency,
          startDate: merged.startDate,
          // Deactivating an employee stops the recurring cost going forward
          // without deleting the historical expense record.
          endDate: merged.active ? undefined : merged.endDate ?? todayIso(),
        });
      }
      await batch.commit();
    },
    deleteEmployee: async (docId) => {
      const id = requireUid();
      const { db } = getFirebase();
      const existing = employees.find((emp) => emp.id === docId);
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", id, "employees", docId));
      if (existing?.linkedExpenseId) {
        batch.delete(doc(db, "users", id, "expenses", existing.linkedExpenseId));
      }
      await batch.commit();
    },

    addLoan: async (l) => {
      const id = requireUid();
      const { db } = getFirebase();
      await addDoc(collection(db, "users", id, "loans"), { ...l, createdAt: Date.now() });
    },
    updateLoan: async (docId, l) => {
      const id = requireUid();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", id, "loans", docId), l);
    },
    deleteLoan: async (docId) => {
      const id = requireUid();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", id, "loans", docId));
    },

    updateSettings: async (s) => {
      const id = requireUid();
      const { db } = getFirebase();
      const ref = doc(db, "users", id, "meta", "settings");
      const snap = await getDoc(ref);
      if (snap.exists()) await updateDoc(ref, s);
      else await setDoc(ref, { ...DEFAULT_SETTINGS, ...s });
    },
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
