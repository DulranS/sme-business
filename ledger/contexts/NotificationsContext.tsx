"use client";

// Split out of DataContext.tsx. Notifications are generated on their own
// clock (a background effect below fires whenever receivables/payables/stock
// cross a threshold) and previously lived as just another field on the
// giant DataContext value object. That meant every notification write
// produced a new DataContext value and re-rendered every screen reading
// *any* piece of DataContext — dashboard, sales, products, all of it —
// even though only the notifications page and the bell icon actually care
// about notifications. Moving this state into its own context/provider
// means a notification change now only re-renders components that call
// useNotifications().
//
// This provider is nested inside DataProvider (see app/layout.tsx) so it
// can read the business data (receivables aging, stock levels, etc.) it
// needs to generate reminders from via useData(), without duplicating any
// of that logic or state.

import {
  createContext,
  useContext,
  useEffect,
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
  query,
  orderBy,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import { useData } from "./DataContext";
import type { Notification } from "@/lib/types";
import { can } from "@/lib/permissions";
import { generateAllNotifications } from "@/lib/notification-automation";
import { computeProjectBudgetAlerts } from "@/lib/calculations";

interface NotificationsContextValue {
  notifications: Notification[];
  notificationsLoading: boolean;
  addNotification: (n: Omit<Notification, "id" | "createdAt">) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, businessId, role, memberName } = useAuth();
  const uid = user?.uid ?? null;
  const {
    loading: coreDataLoading,
    products,
    ledgers,
    eoqByProduct,
    expenses,
    loans,
    receivablesAging,
    payablesAging,
    projects,
    projectFinancials,
  } = useData();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [subscribed, setSubscribed] = useState(false);

  const isOwnerOrManager = role === "owner" || role === "manager";

  // Subscribe to notifications independently of the core-data subscriptions
  // in DataContext.
  useEffect(() => {
    if (!businessId || !uid || !isOwnerOrManager) {
      setNotifications([]);
      setSubscribed(false);
      return;
    }
    const { db } = getFirebase();
    const unsub = onSnapshot(
      query(collection(db, "users", businessId, "notifications"), orderBy("createdAt", "desc")),
      (snap) => {
        setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification)));
        setSubscribed(true);
      }
    );
    return () => unsub();
  }, [businessId, uid, isOwnerOrManager]);

  function requireBusiness(): { businessId: string; uid: string } {
    if (!businessId || !uid) throw new Error("Not signed in");
    return { businessId, uid };
  }

  function requirePermission(permission: Parameters<typeof can>[1]) {
    if (!can(role, permission)) {
      throw new Error("Your role doesn't have permission to do that.");
    }
  }

  // Best-effort audit trail — same fire-and-forget behavior as the rest of
  // the app (see the AuditLogEntry doc comment in lib/types.ts).
  function logAudit(entity: string, entityId: string, action: "create", summary: string) {
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

  // Auto-generate notifications based on business state. Gated on the core
  // DataContext finishing its own load (coreDataLoading) plus this
  // provider's own notifications subscription (subscribed), so it never
  // runs against partial data and never double-creates notifications before
  // it knows what already exists.
  useEffect(() => {
    if (!isOwnerOrManager || !businessId) return;
    if (coreDataLoading || !subscribed) return;

    const generated = generateAllNotifications({
      receivables: receivablesAging.lines,
      payables: payablesAging.lines,
      products,
      ledgers,
      eoqByProduct,
      expenses,
      loans,
      projectBudgetAlerts: computeProjectBudgetAlerts(projects, projectFinancials),
    });

    const existingKeys = new Set(notifications.map((n) => `${n.type}-${n.entityId}-${n.entityType}`));
    const newNotifications = generated.filter(
      (n) => !existingKeys.has(`${n.type}-${n.entityId}-${n.entityType}`)
    );

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
    isOwnerOrManager,
    businessId,
    coreDataLoading,
    subscribed,
    receivablesAging.lines,
    payablesAging.lines,
    products,
    ledgers,
    eoqByProduct,
    expenses,
    loans,
    projects,
    projectFinancials,
    notifications,
  ]);

  const value: NotificationsContextValue = {
    notifications,
    notificationsLoading: isOwnerOrManager && !subscribed,

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
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationsProvider");
  return ctx;
}
