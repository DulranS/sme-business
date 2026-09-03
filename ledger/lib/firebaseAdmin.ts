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
import { cacheGet, cacheSet, cacheDelete, maybeSweep } from "./serverCache";

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

let adminDb: Firestore | undefined;

// Mirrors lib/firebase.ts's client-side `ignoreUndefinedProperties: true` —
// see the comment there for why. Every optional field on a ProposedEntry
// (matchedProductId, customer, supplier, paymentMethod, notes...) is a
// literal `undefined` whenever the model doesn't fill it in — routine, not
// an edge case: a proposed sale/purchase for a product name that didn't
// match anything in the catalog always comes through with
// matchedProductId undefined. The Admin SDK rejects that outright by
// default ("Cannot use \"undefined\" as a Firestore value"), which crashed
// the whole chat turn on the appendMessage write in app/api/ai/chat/route.ts
// instead of just... not writing that one field. The client SDK's init
// already had this covered; the Admin SDK instance the AI routes use never
// did. `settings()` can only be called once per Firestore instance and
// before any other method runs on it, hence the module-level cache below
// instead of calling it fresh on every getAdminDb() invocation.
export function getAdminDb(): Firestore {
  if (adminDb) return adminDb;
  adminDb = getFirestore(getAdminApp());
  adminDb.settings({ ignoreUndefinedProperties: true });
  return adminDb;
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

// Settings and the active product catalog are read on *every* AI Assistant
// chat turn but change rarely — a currency setting or a new product gets
// added maybe a few times a week, not every message. A 30s in-process
// cache means a burst of messages in one conversation costs one Firestore
// read of each instead of one per turn, while staying short enough that an
// edit made mid-session shows up well within the same conversation. See
// lib/serverCache.ts for why this is a plain in-memory cache rather than a
// hosted one.
const BUSINESS_CONTEXT_TTL_MS = 30_000;

export async function loadBusinessContext(
  db: Firestore,
  businessId: string
): Promise<{ settings: Settings; products: CompactProduct[] }> {
  const cacheKey = `businessContext:${businessId}`;
  const cached = cacheGet<{ settings: Settings; products: CompactProduct[] }>(cacheKey);
  if (cached) return cached;

  const [settingsSnap, productsSnap] = await Promise.all([
    db.doc(`users/${businessId}/meta/settings`).get(),
    db.collection(`users/${businessId}/products`).where("active", "==", true).get(),
  ]);

  const settings = { ...DEFAULT_SETTINGS, ...(settingsSnap.data() as Partial<Settings> | undefined) };
  const products: CompactProduct[] = productsSnap.docs.map((d) => {
    const data = d.data() as Product;
    return { id: d.id, name: data.name, sku: data.sku, type: data.type };
  });

  const result = { settings, products };
  cacheSet(cacheKey, result, BUSINESS_CONTEXT_TTL_MS);
  maybeSweep();
  return result;
}

// ---------------------------------------------------------------------------
// Long-term memory — a small, capped, fully user-visible list of durable
// facts (see lib/aiTypes.ts). Oldest note is dropped once the cap is hit,
// so this can never grow into an unbounded (and unboundedly expensive)
// context block.
// ---------------------------------------------------------------------------

// Same in-process TTL cache as loadBusinessContext, for the same reason:
// memory notes are read every chat turn but only ever written by the
// remember_note tool, which is used sparingly (see aiChat's REMEMBER_TOOL
// description). Explicitly invalidated in addMemoryNote below rather than
// left to expire, so a note saved mid-conversation is visible to the very
// next turn instead of waiting out the TTL.
const MEMORY_NOTES_TTL_MS = 30_000;

export async function loadMemoryNotes(db: Firestore, businessId: string): Promise<AiMemoryNote[]> {
  const cacheKey = `memoryNotes:${businessId}`;
  const cached = cacheGet<AiMemoryNote[]>(cacheKey);
  if (cached) return cached;

  const snap = await db.collection(`users/${businessId}/aiMemory`).orderBy("createdAt", "asc").get();
  const notes = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AiMemoryNote, "id">) }));
  cacheSet(cacheKey, notes, MEMORY_NOTES_TTL_MS);
  maybeSweep();
  return notes;
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
  cacheDelete(`memoryNotes:${businessId}`);
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
