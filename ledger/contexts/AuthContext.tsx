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
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { doc, onSnapshot, writeBatch } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import type { Member, MembershipPointer, Role } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  // True while auth is resolving, or while an authenticated user's
  // business/role is still being looked up. Every page should wait on this
  // before making any permission decision — role starts out null and only
  // becomes trustworthy once this flips false.
  loading: boolean;
  businessId: string | null; // the uid of the business's owner — every Firestore path is rooted at users/{businessId}
  role: Role | null;
  memberName: string | null;
  memberActive: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  // Creates a brand-new business, owned by the newly created account.
  signUp: (email: string, password: string, ownerName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [memberActive, setMemberActive] = useState(true);

  useEffect(() => {
    const { auth } = getFirebase();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) {
        setBusinessId(null);
        setRole(null);
        setMemberName(null);
        setMembershipLoading(false);
      } else {
        setMembershipLoading(true);
      }
    });
    return () => unsub();
  }, []);

  // Step 1: given a signed-in uid, find which business they belong to. This
  // pointer doc is written once, at signup or at invite-acceptance time, and
  // never updated — see lib/types.ts's MembershipPointer for why.
  useEffect(() => {
    if (!user) return;
    const { db } = getFirebase();
    const unsub = onSnapshot(
      doc(db, "memberships", user.uid),
      (snap) => {
        if (snap.exists()) {
          setBusinessId((snap.data() as MembershipPointer).businessId);
        } else {
          setBusinessId(null);
          setRole(null);
          setMemberName(null);
          setMembershipLoading(false);
        }
      },
      () => {
        setBusinessId(null);
        setMembershipLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  // Step 2: given the business, look up this uid's current role, name and
  // active status — the same doc firestore.rules checks for every
  // permission decision, so what the UI shows always matches what the
  // database will actually allow. Live-subscribed, not a one-time read, so
  // an owner deactivating someone or changing their role takes effect in
  // that person's open tab immediately, not on next login.
  useEffect(() => {
    if (!user || !businessId) return;
    const { db } = getFirebase();
    const unsub = onSnapshot(
      doc(db, "users", businessId, "members", user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<Member, "id">;
          setRole(data.role);
          setMemberName(data.name);
          setMemberActive(data.active);
        } else {
          setRole(null);
          setMemberName(null);
        }
        setMembershipLoading(false);
      },
      () => setMembershipLoading(false)
    );
    return () => unsub();
  }, [user, businessId]);

  const loading = authLoading || (!!user && membershipLoading);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      businessId,
      role,
      memberName,
      memberActive,
      signIn: async (email, password) => {
        const { auth } = getFirebase();
        await signInWithEmailAndPassword(auth, email, password);
      },
      signUp: async (email, password, ownerName) => {
        const { auth, db } = getFirebase();
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = cred.user.uid;
        const batch = writeBatch(db);
        batch.set(doc(db, "memberships", uid), { businessId: uid });
        batch.set(doc(db, "users", uid, "members", uid), {
          role: "owner",
          name: ownerName || email.split("@")[0],
          email: email.toLowerCase(),
          active: true,
          createdAt: Date.now(),
        });
        await batch.commit();
      },
      signOut: async () => {
        const { auth } = getFirebase();
        await fbSignOut(auth);
      },
    }),
    [user, loading, businessId, role, memberName, memberActive]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
