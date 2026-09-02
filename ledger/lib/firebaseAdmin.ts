// Server-only. Route handlers under app/api/ai/* use this to (a) verify
// the Firebase ID token the client sends instead of trusting a
// client-supplied businessId, and (b) read/write the same
// users/{businessId}/... tree the client SDK uses, via the Admin SDK's
// elevated (rules-bypassing) access. This mirrors exactly what
// contexts/AuthContext.tsx does client-side (memberships/{uid} →
// businessId → users/{businessId}/members/{uid} → role), so a request can
// never see or act on a different business than the signed-in user
// actually belongs to.

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import type { Role, Settings, Product } from "./types";
import type { AiChatMessage, AiChatSession, AiMemoryNote } from "./aiTypes";
import { AI_MEMORY_MAX_NOTES } from "./aiTypes";
import { DEFAULT_SETTINGS } from "./types";

let app: App | undefined;

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Private keys are usually stored as an env var with literal "\n"
  // sequences (most hosts don't allow real newlines in env values) — this
  // un-escapes them back into a real PEM before handing it to the SDK.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin isn't configured: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY " +
        "(a service account key — Firebase Console → Project settings → Service accounts → Generate new private key) " +
        "as server-side environment variables. These are separate from the NEXT_PUBLIC_FIREBASE_* client config and " +
        "must never be exposed to the browser."
    );
  }

  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

// ---------------------------------------------------------------------------
// Auth + business resolution
// ---------------------------------------------------------------------------

export class AiAuthError extends Error {
  constructor(message: string, public status: 401 | 403) {
    super(message);
    this.name = "AiAuthError";
  }
}

export interface AiRequestContext {
  db: Firestore;
  uid: string;
  businessId: string;
  role: Role;
  memberName: string | null;
}

// The AI Assistant is scoped to Owner/Manager, the same line drawn for
// Reports/Profitability/Statements elsewhere in this app (see
// lib/permissions.ts). Staff never has read access to cost prices or
// margins, and the assistant can answer questions and propose entries that
// touch both — so rather than build a second, narrower permission surface
// just for this feature, it stays behind the same trust boundary the rest
// of the app already uses for financial visibility.
const ALLOWED_ROLES: Role[] = ["owner", "manager"];

export async function requireAiContext(req: Request): Promise<AiRequestContext> {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) throw new AiAuthError("Missing Authorization header.", 401);

  let uid: string;
  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    throw new AiAuthError("Your session has expired — please sign in again.", 401);
  }

  const db = getAdminDb();
  const membershipSnap = await db.collection("memberships").doc(uid).get();
  const businessId = (membershipSnap.data()?.businessId as string | undefined) ?? undefined;
  if (!businessId) throw new AiAuthError("No business found for this account.", 403);

  const memberSnap = await db.collection("users").doc(businessId).collection("members").doc(uid).get();
  const member = memberSnap.data() as { role?: Role; active?: boolean; name?: string } | undefined;
  if (!member || member.active === false || !member.role) {
    throw new AiAuthError("Your account no longer has access to this business.", 403);
  }
  if (!ALLOWED_ROLES.includes(member.role)) {
    throw new AiAuthError("The AI Assistant is available to Owners and Managers.", 403);
  }

  return { db, uid, businessId, role: member.role, memberName: member.name ?? null };
}

// ---------------------------------------------------------------------------
// Business context — a compact snapshot handed to the model as part of the
// (cached) system prompt. Deliberately small: id/name/sku/type only, never
// full ledger rows, so the fixed per-turn cost of "what can this business
// sell/buy" stays tiny regardless of how many products exist.
// ---------------------------------------------------------------------------

export interface CompactProduct {
  id: string;
  name: string;
  sku: string;
  type: Product["type"];
}

export async function loadBusinessContext(
  db: Firestore,
  businessId: string
): Promise<{ settings: Settings; products: CompactProduct[] }> {
  const [settingsSnap, productsSnap] = await Promise.all([
    db.doc(`users/${businessId}/meta/settings`).get(),
    db.collection(`users/${businessId}/products`).where("active", "==", true).get(),
  ]);

  const settings = { ...DEFAULT_SETTINGS, ...(settingsSnap.data() as Partial<Settings> | undefined) };
  const products: CompactProduct[] = productsSnap.docs.map((d) => {
    const data = d.data() as Product;
    return { id: d.id, name: data.name, sku: data.sku, type: data.type };
  });

  return { settings, products };
}

// ---------------------------------------------------------------------------
// Long-term memory — a small, capped, fully user-visible list of durable
// facts (see lib/aiTypes.ts). Oldest note is dropped once the cap is hit,
// so this can never grow into an unbounded (and unboundedly expensive)
// context block.
// ---------------------------------------------------------------------------

export async function loadMemoryNotes(db: Firestore, businessId: string): Promise<AiMemoryNote[]> {
  const snap = await db.collection(`users/${businessId}/aiMemory`).orderBy("createdAt", "asc").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AiMemoryNote, "id">) }));
}

export async function addMemoryNote(db: Firestore, businessId: string, text: string): Promise<void> {
  const trimmed = text.trim().slice(0, 240);
  if (!trimmed) return;
  const col = db.collection(`users/${businessId}/aiMemory`);
  await col.add({ text: trimmed, createdAt: Date.now() });

  const snap = await col.orderBy("createdAt", "asc").get();
  if (snap.size > AI_MEMORY_MAX_NOTES) {
    const excess = snap.docs.slice(0, snap.size - AI_MEMORY_MAX_NOTES);
    await Promise.all(excess.map((d) => d.ref.delete()));
  }
}

// ---------------------------------------------------------------------------
// Chat sessions — server-authoritative history. The client only ever sends
// the newest message; the server reads back the recent tail of the same
// session from Firestore rather than trusting a client-supplied transcript,
// so history can't be tampered with and survives across devices/reloads.
// ---------------------------------------------------------------------------

const RECENT_MESSAGE_LIMIT = 16; // how many prior turns get sent back to the model, for cost/latency control — full history still lives in Firestore for the user to scroll

export async function loadRecentMessages(
  db: Firestore,
  businessId: string,
  sessionId: string
): Promise<AiChatMessage[]> {
  const snap = await db
    .collection(`users/${businessId}/aiChatSessions/${sessionId}/messages`)
    .orderBy("createdAt", "desc")
    .limit(RECENT_MESSAGE_LIMIT)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AiChatMessage, "id">) })).reverse();
}

export async function ensureSession(
  db: Firestore,
  businessId: string,
  sessionId: string,
  uid: string,
  memberName: string | null,
  firstMessageText: string
): Promise<void> {
  const ref = db.doc(`users/${businessId}/aiChatSessions/${sessionId}`);
  const snap = await ref.get();
  if (snap.exists) return;
  const title = firstMessageText.trim().slice(0, 60) || "New conversation";
  const session: Omit<AiChatSession, "id"> = {
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdByUid: uid,
    createdByName: memberName ?? undefined,
  };
  await ref.set(session);
}

export async function appendMessage(
  db: Firestore,
  businessId: string,
  sessionId: string,
  message: AiChatMessage
): Promise<void> {
  const { id, ...rest } = message;
  await db.doc(`users/${businessId}/aiChatSessions/${sessionId}/messages/${id}`).set(rest);
  await db.doc(`users/${businessId}/aiChatSessions/${sessionId}`).update({
    updatedAt: Date.now(),
    lastMessagePreview: message.text.slice(0, 120),
  });
}
