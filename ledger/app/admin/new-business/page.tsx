"use client";

// ---------------------------------------------------------------------------
// PRIVATE — account provisioning for admins only.
//
// This is the only place a new business (and its owner login) gets
// created. There's no public "Create account" anymore (see app/login) —
// letting anyone with the URL sign themselves up would mean any random
// visitor could spin up a business and start poking at the app, which is
// exactly the kind of noise/support-load/abuse surface a business selling
// seats to real SME customers wants zero of. Instead: an admin creates the
// account here, the new owner gets an email with a link to set their own
// password, and that's their first and only "signup" step.
//
// This route is deliberately:
//   - not linked anywhere in the app's own nav (see components/AppShell.tsx)
//   - excluded from search indexing (see layout.tsx + public/robots.txt)
//   - gated behind a shared passcode, checked entirely client-side
//
// Be honest with yourself about what that last point does and doesn't
// buy you: this is a Firebase project with no server of its own (no
// Cloud Functions — see firebase.json), so the client always ends up
// holding the real Firebase Web API key regardless, and Firebase Auth's
// REST API would accept a createUser call from anyone who had it, gate or
// no gate. The passcode below is a business/UX control — it stops a
// random visitor from finding a "Create account" button and using it, and
// stops this URL from being casually stumbled into — it is NOT a
// cryptographic security boundary. If that stronger guarantee ever
// matters (e.g. once this is worth attacking), the fix is to add Firebase
// App Check plus a Cloud Function that performs the actual account
// creation server-side, and have this page call that function instead of
// touching Firebase Auth directly.
//
// The passcode itself is read from NEXT_PUBLIC_ADMIN_PASSCODE (see
// .env.local.example), not hardcoded here. It still ends up in the
// client bundle either way — see the paragraph above — so this is about
// not shipping the same literal string in source control to every
// customer/reseller of this codebase, and letting each deployment set
// its own value without touching code. Rotate it by changing the env var
// and redeploying; it does not need to be, and should not be, the same
// value across different customers' deployments.
// ---------------------------------------------------------------------------

import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Label } from "@/components/ui";
import { provisionBusinessOwner } from "@/lib/provisioning";

const PASSCODE = process.env.NEXT_PUBLIC_ADMIN_PASSCODE ?? "";
const LOCK_KEY = "admin-provision-lock";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

interface LockState {
  attempts: number;
  lockedUntil: number | null;
}

function readLock(): LockState {
  if (typeof window === "undefined") return { attempts: 0, lockedUntil: null };
  try {
    const raw = window.sessionStorage.getItem(LOCK_KEY);
    if (!raw) return { attempts: 0, lockedUntil: null };
    return JSON.parse(raw) as LockState;
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

function writeLock(state: LockState) {
  window.sessionStorage.setItem(LOCK_KEY, JSON.stringify(state));
}

export default function NewBusinessAdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [lock, setLock] = useState<LockState>({ attempts: 0, lockedUntil: null });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setLock(readLock());
  }, []);

  // Tick while locked out so the "try again in Xs" message counts down and
  // re-enables the form on its own once the lockout expires.
  useEffect(() => {
    if (!lock.lockedUntil) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lock.lockedUntil]);

  const isLocked = !!lock.lockedUntil && lock.lockedUntil > now;
  const lockSecondsLeft = isLocked ? Math.ceil((lock.lockedUntil! - now) / 1000) : 0;

  function handlePasscodeSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLocked) return;
    if (PASSCODE && passcodeInput === PASSCODE) {
      writeLock({ attempts: 0, lockedUntil: null });
      setLock({ attempts: 0, lockedUntil: null });
      setUnlocked(true);
      setPasscodeError(null);
      return;
    }
    const attempts = lock.attempts + 1;
    const lockedUntil = attempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null;
    const next = { attempts, lockedUntil };
    writeLock(next);
    setLock(next);
    setPasscodeInput("");
    setPasscodeError(
      lockedUntil ? "Too many attempts. Try again in a few minutes." : "That's not the passcode."
    );
  }

  if (!unlocked) {
    return (
      <Centered>
        <div className="mb-6 text-center">
          <div className="font-display text-xl font-bold">Admin access</div>
          <div className="text-sm text-muted mt-1">Enter the passcode to continue.</div>
        </div>
        <div className="bg-panel border border-line rounded-lg p-6 w-full">
          <form onSubmit={handlePasscodeSubmit} className="space-y-4">
            <div>
              <Label>Passcode</Label>
              <Input
                type="password"
                required
                autoFocus
                disabled={isLocked}
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>
            {passcodeError && (
              <div className="text-xs text-bad bg-bad/10 border border-bad/30 rounded-md px-3 py-2">
                {passcodeError}
                {isLocked ? ` (${lockSecondsLeft}s)` : ""}
              </div>
            )}
            <Button type="submit" disabled={isLocked} className="w-full">
              Continue
            </Button>
          </form>
        </div>
      </Centered>
    );
  }

  return (
    <Centered>
      <ProvisionForm />
    </Centered>
  );
}

function ProvisionForm() {
  const [email, setEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await provisionBusinessOwner({ email, ownerName, businessName });
      setCreated(result.email);
      setEmail("");
      setOwnerName("");
      setBusinessName("");
    } catch (err) {
      setError(readableProvisionError(err));
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="w-full">
        <div className="mb-6 text-center">
          <div className="font-display text-xl font-bold">Account created</div>
        </div>
        <div className="bg-panel border border-line rounded-lg p-6 text-sm text-fg leading-relaxed">
          <p>
            <span className="text-good font-medium">{created}</span> can now sign in. A
            password-reset email has been sent to that address — they&apos;ll use it to set their
            own password on the login page. Nothing else to hand them except that they should
            check spam if it doesn&apos;t show up in a minute or two.
          </p>
        </div>
        <Button variant="ghost" className="w-full mt-4" onClick={() => setCreated(null)}>
          Create another account
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <div className="font-display text-xl font-bold">Create a business account</div>
        <div className="text-sm text-muted mt-1">
          Provisions a new business, owned by the email below. They&apos;ll get a link to set
          their own password.
        </div>
      </div>
      <div className="bg-panel border border-line rounded-lg p-6 w-full">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Owner&apos;s email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="them@theirbusiness.com"
            />
          </div>
          <div>
            <Label>Owner&apos;s name</Label>
            <Input
              type="text"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="e.g. Kamal Perera"
            />
          </div>
          <div>
            <Label>Business name (optional — shows on their printed quotes/invoices)</Label>
            <Input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Perera Hardware"
            />
          </div>
          {error && <div className="text-xs text-bad bg-bad/10 border border-bad/30 rounded-md px-3 py-2">{error}</div>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function readableProvisionError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/email-already-in-use": "An account already exists for that email.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
