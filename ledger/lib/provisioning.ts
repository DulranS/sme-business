"use client";

// Admin-side business-owner provisioning — the only way a new top-level
// account (a new business, owned by a fresh login) gets created. There is
// deliberately no public self-serve signup anymore (see app/login/page.tsx
// and app/admin/new-business/page.tsx): every account is created here, by
// whoever runs the business, and handed to the customer as an email
// address with a "set your password" link — never a password an admin
// typed in on someone else's behalf.
//
// Why a *second* Firebase App instance: creating a user with
// createUserWithEmailAndPassword immediately signs that user in on
// whichever Auth instance made the call. If we used the app's normal
// `getFirebase().auth`, running this from the admin route would sign the
// admin out of their own session the moment a new account is created —
// exactly the constraint app/join/page.tsx documents for the same reason.
// A second, throwaway FirebaseApp (same project, its own isolated Auth +
// Firestore) lets the new user's account get created and its bootstrap
// documents get written — which firestore.rules require to happen while
// signed in AS that uid, see memberships/{uid}'s create rule — without
// ever touching the admin's own signed-in session in the primary app. The
// secondary app is torn down again as soon as the job is done.
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
} from "firebase/auth";
import { getFirestore, doc, writeBatch } from "firebase/firestore";
import { firebaseConfig } from "@/lib/firebase";
import { DEFAULT_SETTINGS } from "@/lib/types";

export interface ProvisionInput {
  email: string;
  ownerName: string;
  businessName?: string;
}

export interface ProvisionResult {
  uid: string;
  email: string;
}

export async function provisionBusinessOwner({
  email,
  ownerName,
  businessName,
}: ProvisionInput): Promise<ProvisionResult> {
  const normalizedEmail = email.trim().toLowerCase();
  // Unique app name per call so two provisioning attempts in the same tab
  // (e.g. retrying after a mistyped email) never collide with each other's
  // leftover state.
  const secondaryApp = initializeApp(firebaseConfig, `admin-provision-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const secondaryDb = getFirestore(secondaryApp);

    // A random password the owner never sees and nobody types twice — the
    // account is only ever accessed after they set their own via the
    // password-reset email sent below, through the same "forgot password"
    // flow as everyone else.
    const throwawayPassword = crypto.randomUUID();
    const cred = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, throwawayPassword);
    const uid = cred.user.uid;

    const batch = writeBatch(secondaryDb);
    batch.set(doc(secondaryDb, "memberships", uid), { businessId: uid });
    batch.set(doc(secondaryDb, "users", uid, "members", uid), {
      role: "owner",
      name: ownerName.trim() || normalizedEmail.split("@")[0],
      email: normalizedEmail,
      active: true,
      createdAt: Date.now(),
    });
    if (businessName?.trim()) {
      batch.set(doc(secondaryDb, "users", uid, "meta", "settings"), {
        ...DEFAULT_SETTINGS,
        businessName: businessName.trim(),
      });
    }
    await batch.commit();

    await sendPasswordResetEmail(secondaryAuth, normalizedEmail);
    await fbSignOut(secondaryAuth);

    return { uid, email: normalizedEmail };
  } finally {
    // Always torn down, success or failure — never leaves a signed-in
    // stray session or a lingering app instance behind.
    await deleteApp(secondaryApp);
  }
}
