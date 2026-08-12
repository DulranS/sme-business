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
  Sale,
  Expense,
  VariableCost,
  CapitalEntry,
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
  type ProductLedgerResult,
  type SaleEconomics,
  type MonthlyPnL,
  type EoqResult,
  type BreakEvenResult,
  type CapitalSummary,
} from "@/lib/calculations";
import { todayIso } from "@/lib/format";

interface DataContextValue {
  loading: boolean;
  products: Product[];
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  variableCosts: VariableCost[];
  capitalEntries: CapitalEntry[];
  settings: Settings;

  ledgers: Map<string, ProductLedgerResult>;
  saleEconomics: SaleEconomics[];
  monthlyPnL: MonthlyPnL[];
  inventoryValue: number;
  inventoryUnits: number;
  eoqByProduct: Map<string, EoqResult>;
  breakEven: BreakEvenResult;
  capitalSummary: CapitalSummary;

  addProduct: (p: Omit<Product, "id" | "createdAt">) => Promise<void>;
  updateProduct: (id: string, p: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  bulkAddProducts: (rows: Omit<Product, "id" | "createdAt">[]) => Promise<void>;

  addPurchase: (p: Omit<Purchase, "id" | "createdAt">) => Promise<void>;
  updatePurchase: (id: string, p: Partial<Purchase>) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;
  bulkAddPurchases: (rows: Omit<Purchase, "id" | "createdAt">[]) => Promise<void>;

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
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [variableCosts, setVariableCosts] = useState<VariableCost[]>([]);
  const [capitalEntries, setCapitalEntries] = useState<CapitalEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loadedFlags, setLoadedFlags] = useState({
    products: false,
    purchases: false,
    sales: false,
    expenses: false,
    variableCosts: false,
    capitalEntries: false,
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
      setSales([]);
      setExpenses([]);
      setVariableCosts([]);
      setCapitalEntries([]);
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
    () => computeMonthlyPnL(sales, saleEconomics, expenses, settings.taxRatePct),
    [sales, saleEconomics, expenses, settings.taxRatePct]
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
    sales,
    expenses,
    variableCosts,
    capitalEntries,
    settings,
    ledgers,
    saleEconomics,
    monthlyPnL,
    inventoryValue,
    inventoryUnits,
    eoqByProduct,
    breakEven,
    capitalSummary,

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
