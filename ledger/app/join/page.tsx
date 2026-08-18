"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Input, Label } from "@/components/ui";
import type { Invite } from "@/lib/types";

// Reached via a link an owner shares out-of-band (WhatsApp, in person,
// whatever) after inviting someone from the Team page: /join?biz=...&invite=...
// The invited person creates their OWN login here — this deliberately isn't
// something the owner does on the employee's behalf, since firebase/auth's
// client SDK can only ever have one signed-in session at a time and
// creating a second account would sign the owner out of their own.
function JoinInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, businessId: myBusinessId } = useAuth();
  const bizId = params.get("biz") ?? "";
  const inviteId = params.get("invite") ?? "";

  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!bizId || !inviteId) {
    return (
      <Centered>
        <div className="text-sm text-bad">This invite link looks incomplete. Ask whoever invited you to resend it.</div>
      </Centered>
    );
  }

  if (user && myBusinessId) {
    return (
      <Centered>
        <div className="text-sm text-fg">
          You&apos;re already signed in and part of a team. Sign out first if you meant to accept this invite with a different account.
        </div>
        <Button variant="ghost" className="mt-4" onClick={() => fbSignOut(getFirebase().auth)}>
          Sign out
        </Button>
      </Centered>
    );
  }

  if (done) {
    return (
      <Centered>
        <div className="text-sm text-good font-medium">You&apos;re in.</div>
        <div className="text-sm text-muted mt-1">Redirecting…</div>
      </Centered>
    );
  }

  async function acceptInvite(uid: string, byEmail: string) {
    const { db } = getFirebase();
    const inviteRef = doc(db, "users", bizId, "invites", inviteId);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) throw new Error("This invite no longer exists — ask for a new link.");
    const invite = inviteSnap.data() as Omit<Invite, "id">;
    if (invite.status !== "pending") throw new Error("This invite has already been used or was revoked.");
    if (invite.email.toLowerCase() !== byEmail.toLowerCase()) {
      throw new Error(`This invite was sent to ${invite.email} — sign in with that email address instead.`);
    }

    const batch = writeBatch(db);
    // `inviteId` on both new docs is only there so firestore.rules can look
    // up the exact invite being claimed and check it's pending, belongs to
    // this email, and offers this role — it isn't part of the app-facing
    // Member/MembershipPointer shape and nothing in the UI reads it back.
    batch.set(doc(db, "memberships", uid), { businessId: bizId, inviteId });
    batch.set(doc(db, "users", bizId, "members", uid), {
      role: invite.role,
      name: name || invite.name || byEmail.split("@")[0],
      email: byEmail.toLowerCase(),
      active: true,
      invitedBy: invite.invitedBy,
      createdAt: Date.now(),
      inviteId,
    });
    batch.update(inviteRef, { status: "accepted", acceptedAt: Date.now(), acceptedByUid: uid });
    await batch.commit();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { auth } = getFirebase();
      const cred =
        mode === "signup"
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);
      await acceptInvite(cred.user.uid, cred.user.email ?? email);
      setDone(true);
      setTimeout(() => router.replace("/dashboard"), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Centered>
      <div className="mb-6 text-center">
        <div className="font-display text-xl font-bold">You&apos;ve been invited</div>
        <div className="text-sm text-muted mt-1">Create your login to join the team.</div>
      </div>
      <div className="bg-panel border border-line rounded-lg p-6 w-full">
        <div className="flex gap-1 mb-5 bg-panel2 rounded-md p-1">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 text-sm py-1.5 rounded ${mode === "signup" ? "bg-amber text-ink font-medium" : "text-muted"}`}
          >
            First time here
          </button>
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 text-sm py-1.5 rounded ${mode === "signin" ? "bg-amber text-ink font-medium" : "text-muted"}`}
          >
            I already have a login
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <Label>Your name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="How your entries should show up" />
            </div>
          )}
          <div>
            <Label>Email (must match the email you were invited with)</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <div className="text-xs text-bad bg-bad/10 border border-bad/30 rounded-md px-3 py-2">{error}</div>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Please wait…" : "Join the team"}
          </Button>
        </form>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">{children}</div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<Centered>Loading…</Centered>}>
      <JoinInner />
    </Suspense>
  );
}
