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
  where,
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
  Member,
  Invite,
  Role,
  AuditAction,
  AuditLogEntry,
  CashCount,
  ReceivablePayment,
  PayablePayment,
  CatalogItem,
  Notification,
  TimeEntry,
  FixedAsset,
} from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { can } from "@/lib/permissions";
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
  computeReceivablesAging,
  computePayablesAging,
  type ProductLedgerResult,
  type SaleEconomics,
  type MonthlyPnL,
  type EoqResult,
  type BreakEvenResult,
  type CapitalSummary,
  type OpenOrderValue,
  type LoanPortfolioSummary,
  type BalanceSheet,
  type ReceivablesAging,
  type PayablesAging,
} from "@/lib/calculations";
import { generateAllNotifications } from "@/lib/notification-automation";
import { todayIso } from "@/lib/format";

interface DataContextValue {
  loading: boolean;
  role: Role | null;
  memberName: string | null;

  products: Product[];
  catalog: CatalogItem[]; // cost-stripped product mirror; populated for Staff, empty otherwise (use `products` instead)
  purchases: Purchase[];
  purchaseOrders: PurchaseOrder[];
  sales: Sale[]; // all sales for Owner/Manager; only the signed-in person's own for Staff
  expenses: Expense[];
  variableCosts: VariableCost[];
  capitalEntries: CapitalEntry[];
  employees: Employee[];
  loans: Loan[];
  settings: Settings;
  members: Member[];
  invites: Invite[];
  auditLog: AuditLogEntry[];
  cashCounts: CashCount[]; // all for Owner/Manager, own-only for Staff
  receivablePayments: ReceivablePayment[];
  payablePayments: PayablePayment[];
  notifications: Notification[];
  timeEntries: TimeEntry[]; // all for Owner/Manager, own-only for Staff
  fixedAssets: FixedAsset[];

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
  receivablesAging: ReceivablesAging;
  payablesAging: PayablesAging;
  avgDailyCashSales: number; // trailing 30-day average of cash/card/bank-transfer sales, for cash-runway projections

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

  addSale: (s: Omit<Sale, "id" | "createdAt" | "createdByUid" | "createdByName">) => Promise<void>;
  updateSale: (id: string, s: Partial<Sale>) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  bulkAddSales: (rows: Omit<Sale, "id" | "createdAt">[]) => Promise<void>;

  addExpense: (e: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  updateExpense: (id: string, e: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  bulkAddExpenses: (rows: Omit<Expense, "id" | "createdAt">[]) => Promise<void>;

  addVariableCost: (v: Omit<VariableCost, "id" | "createdAt">) => Promise<void>;
  updateVariableCost: (id: string, v: Partial<VariableCost>) => Promise<void>;
  deleteVariableCost: (id: string) => Promise<void>;

  addCapitalEntry: (c: Omit<CapitalEntry, "id" | "createdAt">) => Promise<void>;
  updateCapitalEntry: (id: string, c: Partial<CapitalEntry>) => Promise<void>;
  deleteCapitalEntry: (id: string) => Promise<void>;

  addEmployee: (e: Omit<Employee, "id" | "createdAt" | "linkedExpenseId">) => Promise<void>;
  updateEmployee: (id: string, e: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;

  addLoan: (l: Omit<Loan, "id" | "createdAt">) => Promise<void>;
  updateLoan: (id: string, l: Partial<Loan>) => Promise<void>;
  deleteLoan: (id: string) => Promise<void>;
  bulkAddLoans: (rows: Omit<Loan, "id" | "createdAt">[]) => Promise<void>;

  updateSettings: (s: Partial<Settings>) => Promise<void>;

  // Team management (Owner only — enforced both here and in firestore.rules)
  createInvite: (email: string, name: string, role: Role) => Promise<string>;
  revokeInvite: (id: string) => Promise<void>;
  changeMemberRole: (uid: string, role: Role) => Promise<void>;
  setMemberActive: (uid: string, active: boolean) => Promise<void>;

  // Cash reconciliation & receivables — the two anti-theft/collections tools
  addCashCount: (c: {
    date: string;
    openingFloat: number;
    countedCash: number;
    notes?: string;
  }) => Promise<void>;
  // Owner-only correction path for a cash count entered wrong — see the
  // comment on the implementation below for why this is deliberately
  // narrower than every other "edit" in the app.
  updateCashCount: (
    id: string,
    c: { date?: string; openingFloat?: number; countedCash?: number; notes?: string }
  ) => Promise<void>;
  deleteCashCount: (id: string) => Promise<void>;
  addReceivablePayment: (p: Omit<ReceivablePayment, "id" | "createdAt" | "createdByUid" | "createdByName">) => Promise<void>;
  updateReceivablePayment: (id: string, p: Partial<Pick<ReceivablePayment, "amount" | "date" | "method" | "note">>) => Promise<void>;
  deleteReceivablePayment: (id: string) => Promise<void>;

  // Notifications & reminders
  addNotification: (n: Omit<Notification, "id" | "createdAt">) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;

  // Payable payments
  addPayablePayment: (p: Omit<PayablePayment, "id" | "createdAt" | "createdByUid" | "createdByName">) => Promise<void>;
  updatePayablePayment: (id: string, p: Partial<Pick<PayablePayment, "amount" | "date" | "method" | "note">>) => Promise<void>;
  deletePayablePayment: (id: string) => Promise<void>;

  // Fixed assets
  addFixedAsset: (a: Omit<FixedAsset, "id" | "createdAt">) => Promise<void>;
  updateFixedAsset: (id: string, a: Partial<FixedAsset>) => Promise<void>;
  deleteFixedAsset: (id: string) => Promise<void>;

  // Time tracking — every active role clocks itself in/out; Owner/Manager
  // can also log or correct an entry on someone else's behalf and delete
  // mistakes. See the TimeEntry doc comment in lib/types.ts for why more
  // than one entry can be open for the same person at once.
  clockIn: (jobLabel: string, opts?: { billable?: boolean; hourlyRate?: number }) => Promise<void>;
  clockOut: (id: string) => Promise<void>;
  addTimeEntry: (
    e: Omit<TimeEntry, "id" | "createdAt" | "createdByUid" | "createdByName">
  ) => Promise<void>;
  updateTimeEntry: (id: string, e: Partial<TimeEntry>) => Promise<void>;
  deleteTimeEntry: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

// Batches of 400 to stay safely under Firestore's 500-writes-per-batch limit.
const BATCH_SIZE = 400;

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, businessId, role, memberName } = useAuth();
  const uid = user?.uid ?? null;

  const [products, setProducts] = useState<Product[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [variableCosts, setVariableCosts] = useState<VariableCost[]>([]);
  const [capitalEntries, setCapitalEntries] = useState<CapitalEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [cashCounts, setCashCounts] = useState<CashCount[]>([]);
  const [receivablePayments, setReceivablePayments] = useState<ReceivablePayment[]>([]);
  const [payablePayments, setPayablePayments] = useState<PayablePayment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [loadedFlags, setLoadedFlags] = useState<Record<string, boolean>>({});

  // Which collections this role actually needs — and, just as importantly,
  // the ones it must never even attempt to subscribe to. A Staff account
  // has no read access to `products`/`purchases`/etc at the database level
  // (see firestore.rules), so opening a listener on them wouldn't just come
  // back empty — it would fail with a permission-denied error and never
  // resolve, leaving the app stuck on a loading screen. Scoping the
  // subscription list by role up front avoids ever making that request.
  const requiredKeys = useMemo((): string[] => {
    if (role === "owner")
      return [
        "products", "purchases", "purchaseOrders", "sales", "expenses", "variableCosts",
        "capitalEntries", "employees", "loans", "settings", "members", "invites",
        "auditLog", "cashCounts", "receivablePayments", "payablePayments", "notifications", "timeEntries", "fixedAssets",
      ];
    if (role === "manager")
      return [
        "products", "purchases", "purchaseOrders", "sales", "expenses", "variableCosts",
        "capitalEntries", "loans", "settings", "cashCounts", "receivablePayments", "payablePayments", "notifications", "timeEntries", "fixedAssets",
      ];
    if (role === "staff") return ["catalog", "sales", "settings", "cashCounts", "receivablePayments", "timeEntries"];
    return [];
  }, [role]);

  useEffect(() => {
    if (!businessId || !uid || !role) {
      setProducts([]);
      setCatalog([]);
      setPurchases([]);
      setPurchaseOrders([]);
      setSales([]);
      setExpenses([]);
      setVariableCosts([]);
      setCapitalEntries([]);
      setEmployees([]);
      setLoans([]);
      setSettings(DEFAULT_SETTINGS);
      setMembers([]);
      setInvites([]);
      setAuditLog([]);
      setCashCounts([]);
      setReceivablePayments([]);
      setPayablePayments([]);
      setNotifications([]);
      setTimeEntries([]);
      setFixedAssets([]);
      setLoadedFlags({});
      return;
    }
    const { db } = getFirebase();
    const bump = (key: string) => setLoadedFlags((f) => ({ ...f, [key]: true }));
    const isOwnerOrManager = role === "owner" || role === "manager";
    const unsubs: (() => void)[] = [];

    if (isOwnerOrManager) {
      unsubs.push(
        onSnapshot(collection(db, "users", businessId, "products"), (snap) => {
          setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
          bump("products");
        }),
        onSnapshot(query(collection(db, "users", businessId, "purchases"), orderBy("date", "desc")), (snap) => {
          setPurchases(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Purchase)));
          bump("purchases");
        }),
        onSnapshot(
          query(collection(db, "users", businessId, "purchaseOrders"), orderBy("orderDate", "desc")),
          (snap) => {
            setPurchaseOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PurchaseOrder)));
            bump("purchaseOrders");
          }
        ),
        onSnapshot(query(collection(db, "users", businessId, "sales"), orderBy("date", "desc")), (snap) => {
          setSales(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale)));
          bump("sales");
        }),
        onSnapshot(collection(db, "users", businessId, "expenses"), (snap) => {
          setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense)));
          bump("expenses");
        }),
        onSnapshot(collection(db, "users", businessId, "variableCosts"), (snap) => {
          setVariableCosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VariableCost)));
          bump("variableCosts");
        }),
        onSnapshot(
          query(collection(db, "users", businessId, "capitalEntries"), orderBy("date", "desc")),
          (snap) => {
            setCapitalEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CapitalEntry)));
            bump("capitalEntries");
          }
        ),
        onSnapshot(query(collection(db, "users", businessId, "loans"), orderBy("startDate", "desc")), (snap) => {
          setLoans(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Loan)));
          bump("loans");
        }),
        onSnapshot(collection(db, "users", businessId, "cashCounts"), (snap) => {
          setCashCounts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CashCount)));
          bump("cashCounts");
        }),
        onSnapshot(collection(db, "users", businessId, "receivablePayments"), (snap) => {
          setReceivablePayments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReceivablePayment)));
          bump("receivablePayments");
        }),
        onSnapshot(query(collection(db, "users", businessId, "payablePayments"), orderBy("date", "desc")), (snap) => {
          setPayablePayments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PayablePayment)));
          bump("payablePayments");
        }),
        onSnapshot(query(collection(db, "users", businessId, "notifications"), orderBy("createdAt", "desc")), (snap) => {
          setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification)));
          bump("notifications");
        }),
        onSnapshot(
          query(collection(db, "users", businessId, "timeEntries"), orderBy("clockIn", "desc")),
          (snap) => {
            setTimeEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimeEntry)));
            bump("timeEntries");
          }
        ),
        onSnapshot(query(collection(db, "users", businessId, "fixedAssets"), orderBy("purchaseDate", "desc")), (snap) => {
          setFixedAssets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FixedAsset)));
          bump("fixedAssets");
        })
      );
    }

    if (role === "owner") {
      unsubs.push(
        onSnapshot(collection(db, "users", businessId, "employees"), (snap) => {
          setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee)));
          bump("employees");
        }),
        onSnapshot(collection(db, "users", businessId, "members"), (snap) => {
          setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Member)));
          bump("members");
        }),
        onSnapshot(collection(db, "users", businessId, "invites"), (snap) => {
          setInvites(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invite)));
          bump("invites");
        }),
        onSnapshot(
          query(collection(db, "users", businessId, "auditLog"), orderBy("at", "desc")),
          (snap) => {
            setAuditLog(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLogEntry)));
            bump("auditLog");
          }
        )
      );
    }

    if (role === "staff") {
      unsubs.push(
        onSnapshot(collection(db, "users", businessId, "catalog"), (snap) => {
          setCatalog(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CatalogItem)));
          bump("catalog");
        }),
        onSnapshot(
          query(collection(db, "users", businessId, "sales"), where("createdByUid", "==", uid), orderBy("date", "desc")),
          (snap) => {
            setSales(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sale)));
            bump("sales");
          }
        ),
        onSnapshot(
          query(collection(db, "users", businessId, "cashCounts"), where("createdByUid", "==", uid)),
          (snap) => {
            setCashCounts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CashCount)));
            bump("cashCounts");
          }
        ),
        onSnapshot(
          query(collection(db, "users", businessId, "receivablePayments"), where("createdByUid", "==", uid)),
          (snap) => {
            setReceivablePayments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReceivablePayment)));
            bump("receivablePayments");
          }
        ),
        onSnapshot(
          query(collection(db, "users", businessId, "timeEntries"), where("memberUid", "==", uid)),
          (snap) => {
            setTimeEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimeEntry)));
            bump("timeEntries");
          }
        )
      );
    }

    // Every active role can read settings (currency, credit-term defaults) —
    // only Owner can write them.
    unsubs.push(
      onSnapshot(doc(db, "users", businessId, "meta", "settings"), (snap) => {
        if (snap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as Settings) });
        bump("settings");
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [businessId, uid, role]);

  const loading = !businessId || !role || !requiredKeys.every((k) => loadedFlags[k]);

  // Derived calculations are memoized off the raw arrays' identities, which
  // only change when a snapshot actually delivers new data. For Staff these
  // run over partial/empty arrays and yield harmless zeroed results — no
  // page a Staff account can reach actually renders them (see AppShell nav
  // + per-page role guards), so this is dead-but-safe computation for that
  // role, not a data leak.
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
  const receivablesAging = useMemo(
    () => computeReceivablesAging(products, sales, saleEconomics, receivablePayments, todayIso()),
    [products, sales, saleEconomics, receivablePayments]
  );
  const payablesAging = useMemo(
    () => computePayablesAging(products, purchases, payablePayments, todayIso()),
    [products, purchases, payablePayments]
  );
  const avgDailyCashSales = useMemo(() => {
    const since = todayIso();
    const from = new Date(since);
    from.setUTCDate(from.getUTCDate() - 30);
    const fromIso = from.toISOString().slice(0, 10);
    const econBySale = new Map(saleEconomics.map((e) => [e.saleId, e]));
    let total = 0;
    for (const s of sales) {
      if (s.date < fromIso) continue;
      if (s.paymentMethod === "credit") continue;
      total += econBySale.get(s.id)?.revenue ?? s.qty * s.unitPrice;
    }
    return total / 30;
  }, [sales, saleEconomics]);

  // Auto-generate notifications based on business state
  useEffect(() => {
    if (role !== "owner" && role !== "manager") return;
    if (!businessId) return;
    // Guard on the actual snapshot-loaded keys this effect depends on. This
    // used to check a key ("receivables") that's never bumped anywhere —
    // requiredKeys/onSnapshot only ever set "receivablePayments",
    // "payablePayments", "products", "purchases", "sales", "expenses" and
    // "loans" — so the check was permanently false and this effect quietly
    // never ran: reorder/overdue/low-stock notifications never
    // auto-generated for anyone, no matter how long the app was open.
    if (
      !loadedFlags["receivablePayments"] ||
      !loadedFlags["payablePayments"] ||
      !loadedFlags["products"] ||
      !loadedFlags["purchases"] ||
      !loadedFlags["sales"] ||
      !loadedFlags["expenses"] ||
      !loadedFlags["loans"]
    )
      return;

    const generated = generateAllNotifications({
      receivables: receivablesAging.lines,
      payables: payablesAging.lines,
      products,
      ledgers,
      eoqByProduct,
      expenses,
      loans,
    });

    // Deduplicate: only add notifications that don't already exist
    const existingKeys = new Set(notifications.map((n) => `${n.type}-${n.entityId}-${n.entityType}`));
    const newNotifications = generated.filter(
      (n) => !existingKeys.has(`${n.type}-${n.entityId}-${n.entityType}`)
    );

    // Add new notifications to Firestore
    newNotifications.forEach(async (n) => {
      try {
        const { db } = getFirebase();
        await addDoc(collection(db, "users", businessId, "notifications"), {
          ...n,
          createdAt: Date.now(),
        });
      } catch (err) {
        console.error("Failed to create notification:", err);
      }
    });
  }, [
    role,
    businessId,
    loadedFlags,
    receivablesAging.lines,
    payablesAging.lines,
    products,
    ledgers,
    eoqByProduct,
    expenses,
    loans,
    notifications,
  ]);

  function requireBusiness(): { businessId: string; uid: string } {
    if (!businessId || !uid) throw new Error("Not signed in");
    return { businessId, uid };
  }

  function requirePermission(permission: Parameters<typeof can>[1]) {
    if (!can(role, permission)) {
      throw new Error("Your role doesn't have permission to do that.");
    }
  }

  // Best-effort, app-triggered audit trail — see the AuditLogEntry doc
  // comment in lib/types.ts for exactly what this does and doesn't
  // guarantee. Fire-and-forget on purpose: a slow/failed audit write should
  // never block or fail the actual business transaction it's describing.
  function logAudit(entity: string, entityId: string, action: AuditAction, summary: string) {
    if (!businessId || !uid || !role) return;
    const { db } = getFirebase();
    addDoc(collection(db, "users", businessId, "auditLog"), {
      at: Date.now(),
      byUid: uid,
      byName: memberName ?? user?.email ?? "Unknown",
      byRole: role,
      action,
      entity,
      entityId,
      summary,
    }).catch(() => {
      /* deliberately swallowed — see comment above */
    });
  }

  async function chunkedBatchAdd<T extends Record<string, unknown>>(
    colName: string,
    rows: T[]
  ) {
    const { businessId: bizId } = requireBusiness();
    const { db } = getFirebase();
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const row of chunk) {
        const ref = doc(collection(db, "users", bizId, colName));
        batch.set(ref, { ...row, createdAt: Date.now() });
      }
      await batch.commit();
    }
  }

  const value: DataContextValue = {
    loading,
    role,
    memberName,
    products,
    catalog,
    purchases,
    purchaseOrders,
    sales,
    expenses,
    variableCosts,
    capitalEntries,
    employees,
    loans,
    settings,
    members,
    invites,
    auditLog,
    cashCounts,
    receivablePayments,
    payablePayments,
    notifications,
    timeEntries,
    fixedAssets,
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
    receivablesAging,
    payablesAging,
    avgDailyCashSales,

    addProduct: async (p) => {
      requirePermission("manage:products");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const batch = writeBatch(db);
      const productRef = doc(collection(db, "users", bizId, "products"));
      const catalogRef = doc(db, "users", bizId, "catalog", productRef.id);
      batch.set(productRef, { ...p, createdAt: Date.now() });
      batch.set(catalogRef, {
        name: p.name, sku: p.sku, category: p.category, type: p.type, active: p.active,
        sellPrice: p.defaultSellPrice ?? null,
      });
      await batch.commit();
      logAudit("product", productRef.id, "create", `Product added: ${p.name}`);
    },
    updateProduct: async (docId, p) => {
      requirePermission("manage:products");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const batch = writeBatch(db);
      batch.update(doc(db, "users", bizId, "products", docId), p);
      const catalogPatch: Record<string, unknown> = {};
      if (p.name !== undefined) catalogPatch.name = p.name;
      if (p.sku !== undefined) catalogPatch.sku = p.sku;
      if (p.category !== undefined) catalogPatch.category = p.category;
      if (p.type !== undefined) catalogPatch.type = p.type;
      if (p.active !== undefined) catalogPatch.active = p.active;
      if (p.defaultSellPrice !== undefined) catalogPatch.sellPrice = p.defaultSellPrice;
      if (Object.keys(catalogPatch).length > 0) {
        batch.update(doc(db, "users", bizId, "catalog", docId), catalogPatch);
      }
      await batch.commit();
      logAudit("product", docId, "update", `Product updated${p.name ? `: ${p.name}` : ""}`);
    },
    deleteProduct: async (docId) => {
      requirePermission("delete:records");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const existing = products.find((pr) => pr.id === docId);
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", bizId, "products", docId));
      batch.delete(doc(db, "users", bizId, "catalog", docId));
      await batch.commit();
      logAudit("product", docId, "delete", `Product deleted: ${existing?.name ?? docId}`);
    },
    bulkAddProducts: (rows) => chunkedBatchAdd("products", rows),

    addPurchase: async (p) => {
      requirePermission("manage:products");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const ref = await addDoc(collection(db, "users", bizId, "purchases"), { ...p, createdAt: Date.now() });
      logAudit("purchase", ref.id, "create", `Purchase: ${p.qty} × ${formatMoneyPlain(p.unitCost)}`);
    },
    updatePurchase: async (docId, p) => {
      requirePermission("manage:products");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", bizId, "purchases", docId), p);
      logAudit("purchase", docId, "update", "Purchase edited");
    },
    deletePurchase: async (docId) => {
      requirePermission("delete:records");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", bizId, "purchases", docId));
      logAudit("purchase", docId, "delete", "Purchase deleted");
    },
    bulkAddPurchases: (rows) => chunkedBatchAdd("purchases", rows),

    addPurchaseOrder: async (po) => {
      requirePermission("manage:products");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const ref = await addDoc(collection(db, "users", bizId, "purchaseOrders"), {
        ...po,
        status: "ordered",
        createdAt: Date.now(),
      });
      logAudit("purchaseOrder", ref.id, "create", `Order placed: ${po.qtyOrdered} units`);
    },
    updatePurchaseOrder: async (docId, po) => {
      requirePermission("manage:products");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", bizId, "purchaseOrders", docId), po);
      logAudit("purchaseOrder", docId, "update", "Order edited");
    },
    cancelPurchaseOrder: async (docId) => {
      requirePermission("manage:products");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", bizId, "purchaseOrders", docId), { status: "cancelled" });
      logAudit("purchaseOrder", docId, "update", "Order cancelled");
    },
    deletePurchaseOrder: async (docId) => {
      requirePermission("delete:records");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", bizId, "purchaseOrders", docId));
      logAudit("purchaseOrder", docId, "delete", "Order deleted");
    },
    receivePurchaseOrder: async (docId, receipt) => {
      requirePermission("manage:products");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const po = purchaseOrders.find((p) => p.id === docId);
      if (!po) throw new Error("Purchase order not found");

      const batch = writeBatch(db);
      const purchaseRef = doc(collection(db, "users", bizId, "purchases"));
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
      const poRef = doc(db, "users", bizId, "purchaseOrders", docId);
      batch.update(poRef, {
        status: "received",
        receivedDate: receipt.receivedDate,
        qtyReceived: receipt.qtyReceived,
        receivedUnitCost: receipt.receivedUnitCost,
      });
      await batch.commit();
      logAudit("purchaseOrder", docId, "update", `Order received: ${receipt.qtyReceived} units`);
    },
    bulkAddPurchaseOrders: (rows) => chunkedBatchAdd("purchaseOrders", rows),

    addSale: async (s) => {
      requirePermission("manage:sales");
      const { businessId: bizId, uid: myUid } = requireBusiness();
      const { db } = getFirebase();
      const dueDate =
        s.paymentMethod === "credit"
          ? addDaysToDate(s.date, s.creditTermDays ?? settings.defaultCreditTermDays)
          : undefined;
      const payload = {
        ...s,
        paymentMethod: s.paymentMethod ?? "cash",
        dueDate,
        createdByUid: myUid,
        createdByName: memberName ?? user?.email ?? "Unknown",
        createdAt: Date.now(),
      };
      const ref = await addDoc(collection(db, "users", bizId, "sales"), payload);
      logAudit("sale", ref.id, "create", `Sale: ${s.qty} × ${formatMoneyPlain(s.unitPrice)}${s.paymentMethod === "credit" ? " (credit)" : ""}`);
    },
    updateSale: async (docId, s) => {
      requirePermission("delete:sales"); // editing a past sale is treated the same as delete — Owner/Manager territory, never Staff
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const before = sales.find((x) => x.id === docId);
      const patch = { ...s };
      if (s.paymentMethod === "credit" && (s.date || before?.date)) {
        patch.dueDate = addDaysToDate(s.date ?? before!.date, s.creditTermDays ?? before?.creditTermDays ?? settings.defaultCreditTermDays);
      }
      await updateDoc(doc(db, "users", bizId, "sales", docId), patch);
      const beforeSummary = before ? `${before.qty} × ${formatMoneyPlain(before.unitPrice)}` : "?";
      const afterSummary = `${s.qty ?? before?.qty} × ${formatMoneyPlain(s.unitPrice ?? before?.unitPrice ?? 0)}`;
      logAudit("sale", docId, "update", `Sale edited: ${beforeSummary} → ${afterSummary}`);
    },
    deleteSale: async (docId) => {
      requirePermission("delete:sales");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const existing = sales.find((s) => s.id === docId);
      await deleteDoc(doc(db, "users", bizId, "sales", docId));
      logAudit("sale", docId, "delete", existing ? `Sale deleted: ${existing.qty} × ${formatMoneyPlain(existing.unitPrice)}` : "Sale deleted");
    },
    bulkAddSales: async (rows) => {
      requirePermission("manage:sales");
      const { businessId: bizId, uid: myUid } = requireBusiness();
      const { db } = getFirebase();
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const row of chunk) {
          const ref = doc(collection(db, "users", bizId, "sales"));
          batch.set(ref, {
            ...row,
            paymentMethod: row.paymentMethod ?? "cash",
            createdByUid: myUid,
            createdByName: memberName ?? user?.email ?? "Unknown",
            createdAt: Date.now(),
          });
        }
        await batch.commit();
      }
    },

    addExpense: async (e) => {
      requirePermission("manage:expenses");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const ref = await addDoc(collection(db, "users", bizId, "expenses"), { ...e, createdAt: Date.now() });
      logAudit("expense", ref.id, "create", `Expense: ${e.name}, ${formatMoneyPlain(e.amount)}`);
    },
    updateExpense: async (docId, e) => {
      requirePermission("manage:expenses");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const before = expenses.find((x) => x.id === docId);
      await updateDoc(doc(db, "users", bizId, "expenses", docId), e);
      logAudit(
        "expense",
        docId,
        "update",
        `Expense edited: ${before?.name ?? "?"} ${formatMoneyPlain(before?.amount ?? 0)} → ${formatMoneyPlain(e.amount ?? before?.amount ?? 0)}`
      );
    },
    deleteExpense: async (docId) => {
      requirePermission("delete:records");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const existing = expenses.find((x) => x.id === docId);
      await deleteDoc(doc(db, "users", bizId, "expenses", docId));
      logAudit("expense", docId, "delete", existing ? `Expense deleted: ${existing.name}` : "Expense deleted");
    },
    bulkAddExpenses: (rows) => chunkedBatchAdd("expenses", rows),

    addVariableCost: async (v) => {
      requirePermission("manage:products");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await addDoc(collection(db, "users", bizId, "variableCosts"), { ...v, createdAt: Date.now() });
    },
    updateVariableCost: async (docId, v) => {
      requirePermission("manage:products");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", bizId, "variableCosts", docId), v);
    },
    deleteVariableCost: async (docId) => {
      requirePermission("delete:records");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", bizId, "variableCosts", docId));
    },

    addCapitalEntry: async (c) => {
      requirePermission("manage:capital");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const ref = await addDoc(collection(db, "users", bizId, "capitalEntries"), { ...c, createdAt: Date.now() });
      logAudit("capitalEntry", ref.id, "create", `${c.kind}: ${formatMoneyPlain(c.amount)}`);
    },
    updateCapitalEntry: async (docId, c) => {
      requirePermission("manage:capital");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", bizId, "capitalEntries", docId), c);
      logAudit("capitalEntry", docId, "update", "Capital entry edited");
    },
    deleteCapitalEntry: async (docId) => {
      requirePermission("delete:records");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", bizId, "capitalEntries", docId));
      logAudit("capitalEntry", docId, "delete", "Capital entry deleted");
    },

    addEmployee: async (e) => {
      requirePermission("manage:employees");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const batch = writeBatch(db);
      const employeeRef = doc(collection(db, "users", bizId, "employees"));
      const expenseRef = doc(collection(db, "users", bizId, "expenses"));
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
      logAudit("employee", employeeRef.id, "create", `Employee added: ${e.name}`);
    },
    updateEmployee: async (docId, e) => {
      requirePermission("manage:employees");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const existing = employees.find((emp) => emp.id === docId);
      const employeeRef = doc(db, "users", bizId, "employees", docId);
      const batch = writeBatch(db);
      batch.update(employeeRef, e);

      if (existing?.linkedExpenseId) {
        const merged = { ...existing, ...e };
        const expenseRef = doc(db, "users", bizId, "expenses", existing.linkedExpenseId);
        batch.update(expenseRef, {
          name: `Payroll — ${merged.name}`,
          amount: merged.payRate,
          recurrence: merged.payFrequency,
          startDate: merged.startDate,
          endDate: merged.active ? undefined : merged.endDate ?? todayIso(),
        });
      }
      await batch.commit();
      logAudit("employee", docId, "update", `Employee edited${e.name ? `: ${e.name}` : ""}`);
    },
    deleteEmployee: async (docId) => {
      requirePermission("manage:employees");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const existing = employees.find((emp) => emp.id === docId);
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", bizId, "employees", docId));
      if (existing?.linkedExpenseId) {
        batch.delete(doc(db, "users", bizId, "expenses", existing.linkedExpenseId));
      }
      await batch.commit();
      logAudit("employee", docId, "delete", existing ? `Employee removed: ${existing.name}` : "Employee removed");
    },

    addLoan: async (l) => {
      requirePermission("manage:loans");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const ref = await addDoc(collection(db, "users", bizId, "loans"), { ...l, createdAt: Date.now() });
      logAudit("loan", ref.id, "create", `Loan added: ${l.name}, ${formatMoneyPlain(l.principal)}`);
    },
    updateLoan: async (docId, l) => {
      requirePermission("manage:loans");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", bizId, "loans", docId), l);
      logAudit("loan", docId, "update", "Loan edited");
    },
    deleteLoan: async (docId) => {
      requirePermission("delete:records");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", bizId, "loans", docId));
      logAudit("loan", docId, "delete", "Loan deleted");
    },
    bulkAddLoans: (rows) => chunkedBatchAdd("loans", rows),

    updateSettings: async (s) => {
      requirePermission("manage:settings");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const ref = doc(db, "users", bizId, "meta", "settings");
      const snap = await getDoc(ref);
      if (snap.exists()) await updateDoc(ref, s);
      else await setDoc(ref, { ...DEFAULT_SETTINGS, ...s });
    },

    createInvite: async (email, name, inviteRole) => {
      requirePermission("manage:team");
      const { businessId: bizId, uid: myUid } = requireBusiness();
      const { db } = getFirebase();
      const ref = await addDoc(collection(db, "users", bizId, "invites"), {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        role: inviteRole,
        status: "pending",
        invitedBy: myUid,
        invitedByName: memberName ?? user?.email ?? "Owner",
        createdAt: Date.now(),
      });
      logAudit("invite", ref.id, "create", `Invited ${email} as ${inviteRole}`);
      return ref.id;
    },
    revokeInvite: async (id) => {
      requirePermission("manage:team");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", bizId, "invites", id), { status: "revoked" });
      logAudit("invite", id, "update", "Invite revoked");
    },
    changeMemberRole: async (memberUid, newRole) => {
      requirePermission("manage:team");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", bizId, "members", memberUid), { role: newRole });
      logAudit("member", memberUid, "update", `Role changed to ${newRole}`);
    },
    setMemberActive: async (memberUid, active) => {
      requirePermission("manage:team");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", bizId, "members", memberUid), { active });
      logAudit("member", memberUid, "update", active ? "Member reactivated" : "Member deactivated");
    },

    addCashCount: async ({ date, openingFloat, countedCash, notes }) => {
      requirePermission("create:cashCount");
      const { businessId: bizId, uid: myUid } = requireBusiness();
      const { db } = getFirebase();
      // Expected cash is snapshotted right now, from cash-collected sales
      // and cash-paid expenses/purchases dated on the covered day — see the
      // CashCount doc comment in lib/types.ts for why this is never
      // recomputed later. `sales`/`purchases`/`expenses` are already
      // scoped by role upstream (Staff's `sales` only ever contains their
      // own — see the Firestore query in the subscription effect above),
      // so no further filtering by who's submitting the count is needed
      // here. One real limitation worth knowing: because Staff has no
      // visibility into `purchases`/`expenses`, a cash count they submit
      // can't account for petty cash spent out of the till on something
      // like a delivery fee — that will show as an unexplained shortfall
      // even though nothing was actually taken. Owner/Manager counts don't
      // have this gap, since they see the full picture.
      const econBySale = new Map(saleEconomics.map((e) => [e.saleId, e]));
      const cashSalesToday = sales
        .filter((s) => s.date === date && (s.paymentMethod ?? "cash") !== "credit")
        .reduce((sum, s) => sum + (econBySale.get(s.id)?.revenue ?? s.qty * s.unitPrice), 0);
      const receivableCashToday = receivablePayments
        .filter((p) => p.date === date && p.method === "cash")
        .reduce((sum, p) => sum + p.amount, 0);
      const cashOutToday = [...purchases, ...expenses]
        .filter((x) => "date" in x && x.date === date)
        .reduce((sum, x) => sum + ("qty" in x ? x.qty * x.unitCost : x.amount), 0);
      const expectedCash = openingFloat + cashSalesToday + receivableCashToday - cashOutToday;
      const variance = countedCash - expectedCash;

      const ref = await addDoc(collection(db, "users", bizId, "cashCounts"), {
        date,
        openingFloat,
        expectedCash,
        countedCash,
        variance,
        notes: notes || undefined,
        createdByUid: myUid,
        createdByName: memberName ?? user?.email ?? "Unknown",
        createdAt: Date.now(),
      });
      logAudit("cashCount", ref.id, "create", `Cash count ${date}: variance ${formatMoneyPlain(variance)}`);
    },

    // Deliberately Owner-only, and deliberately not exposed to Staff even
    // for their own counts — the whole anti-theft value of a cash count is
    // that whoever counted the till can't quietly correct it afterward
    // (see the addCashCount comment above, and the copy on the Cash Count
    // page). This exists purely so an Owner can fix a genuine slip — a typo
    // in the counted amount, the wrong date picked — without deleting and
    // losing the record entirely. expectedCash/variance are recomputed from
    // the edited fields so they stay consistent with what's actually saved.
    updateCashCount: async (docId, patch) => {
      requirePermission("correct:ledgerEntries");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const existing = cashCounts.find((c) => c.id === docId);
      if (!existing) throw new Error("Cash count not found");
      const openingFloat = patch.openingFloat ?? existing.openingFloat;
      const countedCash = patch.countedCash ?? existing.countedCash;
      // expectedCash itself isn't recomputed here (it's a point-in-time
      // snapshot of cash sales/payments/outflows as of when it was
      // originally saved — see the CashCount doc comment in lib/types.ts);
      // only variance is re-derived, against the corrected counted amount.
      const recomputedVariance = countedCash - existing.expectedCash;
      await updateDoc(doc(db, "users", bizId, "cashCounts", docId), {
        ...(patch.date !== undefined ? { date: patch.date } : {}),
        ...(patch.openingFloat !== undefined ? { openingFloat } : {}),
        ...(patch.countedCash !== undefined ? { countedCash, variance: recomputedVariance } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes || undefined } : {}),
      });
      logAudit("cashCount", docId, "update", `Cash count corrected (was variance ${formatMoneyPlain(existing.variance)})`);
    },
    deleteCashCount: async (docId) => {
      requirePermission("correct:ledgerEntries");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", bizId, "cashCounts", docId));
      logAudit("cashCount", docId, "delete", "Cash count deleted");
    },

    addReceivablePayment: async (p) => {
      requirePermission("create:receivablePayment");
      const { businessId: bizId, uid: myUid } = requireBusiness();
      const { db } = getFirebase();
      const ref = await addDoc(collection(db, "users", bizId, "receivablePayments"), {
        ...p,
        createdByUid: myUid,
        createdByName: memberName ?? user?.email ?? "Unknown",
        createdAt: Date.now(),
      });
      logAudit("receivablePayment", ref.id, "create", `Payment collected: ${formatMoneyPlain(p.amount)}`);
    },
    // Owner-only, same reasoning as updateCashCount: Staff (and Manager) can
    // record a payment, but only the Owner can go back and fix a mis-keyed
    // amount, date, or method on one afterward.
    updateReceivablePayment: async (docId, patch) => {
      requirePermission("correct:ledgerEntries");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", bizId, "receivablePayments", docId), patch);
      logAudit("receivablePayment", docId, "update", "Payment corrected");
    },
    deleteReceivablePayment: async (docId) => {
      requirePermission("correct:ledgerEntries");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", bizId, "receivablePayments", docId));
      logAudit("receivablePayment", docId, "delete", "Payment deleted");
    },

    addPayablePayment: async (p) => {
      requirePermission("create:receivablePayment");
      const { businessId: bizId, uid: myUid } = requireBusiness();
      const { db } = getFirebase();
      const ref = await addDoc(collection(db, "users", bizId, "payablePayments"), {
        ...p,
        createdByUid: myUid,
        createdByName: memberName ?? user?.email ?? "Unknown",
        createdAt: Date.now(),
      });
      logAudit("payablePayment", ref.id, "create", `Supplier payment: ${formatMoneyPlain(p.amount)}`);
    },
    updatePayablePayment: async (docId, patch) => {
      requirePermission("correct:ledgerEntries");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", bizId, "payablePayments", docId), patch);
      logAudit("payablePayment", docId, "update", "Supplier payment corrected");
    },
    deletePayablePayment: async (docId) => {
      requirePermission("correct:ledgerEntries");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", bizId, "payablePayments", docId));
      logAudit("payablePayment", docId, "delete", "Supplier payment deleted");
    },

    addFixedAsset: async (a) => {
      requirePermission("manage:fixedAssets");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const ref = await addDoc(collection(db, "users", bizId, "fixedAssets"), {
        ...a,
        createdAt: Date.now(),
      });
      logAudit("fixedAsset", ref.id, "create", `Asset added: ${a.name}`);
    },

    updateFixedAsset: async (id, a) => {
      requirePermission("manage:fixedAssets");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", bizId, "fixedAssets", id), a);
      logAudit("fixedAsset", id, "update", `Asset updated`);
    },

    deleteFixedAsset: async (id) => {
      requirePermission("manage:fixedAssets");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", bizId, "fixedAssets", id));
      logAudit("fixedAsset", id, "delete", `Asset deleted`);
    },

    addNotification: async (n) => {
      requirePermission("manage:notifications");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      const ref = await addDoc(collection(db, "users", bizId, "notifications"), {
        ...n,
        createdAt: Date.now(),
      });
      logAudit("notification", ref.id, "create", `Notification: ${n.title}`);
    },
    markNotificationRead: async (id) => {
      requirePermission("manage:notifications");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", bizId, "notifications", id), {
        isRead: true,
        dismissedAt: Date.now(),
      });
    },
    deleteNotification: async (id) => {
      requirePermission("manage:notifications");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", bizId, "notifications", id));
    },

    clockIn: async (jobLabel, opts) => {
      requirePermission("create:timeEntry");
      const { businessId: bizId, uid: myUid } = requireBusiness();
      const { db } = getFirebase();
      const ref = await addDoc(collection(db, "users", bizId, "timeEntries"), {
        memberUid: myUid,
        memberName: memberName ?? user?.email ?? "Unknown",
        jobLabel,
        billable: opts?.billable ?? true,
        ...(opts?.hourlyRate != null ? { hourlyRate: opts.hourlyRate } : {}),
        clockIn: Date.now(),
        createdByUid: myUid,
        createdByName: memberName ?? user?.email ?? "Unknown",
        createdAt: Date.now(),
      });
      logAudit("timeEntry", ref.id, "create", `Clocked in: ${jobLabel}`);
    },
    clockOut: async (id) => {
      requirePermission("create:timeEntry");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      // Firestore rules only allow the creator's own update to touch the
      // `clockOut` field, and only once — see the timeEntries block in
      // firestore.rules. This is intentionally the one field a Staff
      // member can ever change after saving, same as a cash count is
      // create-only: no going back to edit the hours themselves.
      await updateDoc(doc(db, "users", bizId, "timeEntries", id), { clockOut: Date.now() });
      logAudit("timeEntry", id, "update", "Clocked out");
    },
    addTimeEntry: async (e) => {
      // Backfilling or logging on someone else's behalf is an Owner/Manager
      // action — a Staff member can only ever create their own via clockIn.
      requirePermission("manage:timeEntries");
      const { businessId: bizId, uid: myUid } = requireBusiness();
      const { db } = getFirebase();
      const ref = await addDoc(collection(db, "users", bizId, "timeEntries"), {
        ...e,
        createdByUid: myUid,
        createdByName: memberName ?? user?.email ?? "Unknown",
        createdAt: Date.now(),
      });
      logAudit("timeEntry", ref.id, "create", `Time entry added for ${e.memberName}: ${e.jobLabel}`);
    },
    updateTimeEntry: async (id, e) => {
      requirePermission("manage:timeEntries");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await updateDoc(doc(db, "users", bizId, "timeEntries", id), e);
      logAudit("timeEntry", id, "update", "Time entry corrected");
    },
    deleteTimeEntry: async (id) => {
      requirePermission("manage:timeEntries");
      const { businessId: bizId } = requireBusiness();
      const { db } = getFirebase();
      await deleteDoc(doc(db, "users", bizId, "timeEntries", id));
      logAudit("timeEntry", id, "delete", "Time entry deleted");
    },
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

function addDaysToDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

// A currency-agnostic, symbol-free number format for audit-log summaries —
// the audit log is a plain trail of what happened, not a formatted report,
// so it doesn't need Settings.currency threaded all the way down into this
// module just to write "4,500" instead of "Rs 4,500".
function formatMoneyPlain(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
