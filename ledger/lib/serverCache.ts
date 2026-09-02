// Server-only. A deliberately tiny in-process (per warm Node.js instance)
// TTL cache — no Redis/Upstash, no extra monthly bill, no new moving part
// to operate. For a bootstrapped SME app this is the right trade: it's
// free, and it captures the case that actually matters for cost — a shop
// owner firing off several AI Assistant messages or receipt photos in a
// row within the same warm serverless instance, where re-fetching
// business settings and the product catalog from Firestore on every
// single turn is pure waste (that data changes maybe a few times a week,
// not every message).
//
// What this is NOT: a substitute for correctness or a cross-instance/
// cross-region cache. Entries expire fast (see TTL constants where this
// is used) specifically so a business that edits settings or adds a
// product mid-conversation sees it reflected within seconds, not minutes.
// If this app ever grows to the point of running many concurrent
// serverless instances where the in-process hit rate stops mattering,
// the next step is a shared cache (Redis/Upstash) — a real infra cost
// that isn't justified at bootstrapped SME scale yet.

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

// Cheap housekeeping so a long-lived warm instance handling many
// different businesses doesn't quietly accumulate expired entries forever
// — called opportunistically from cacheSet rather than on a timer, since
// serverless instances don't get a reliable background clock.
let opsSinceSweep = 0;
export function maybeSweep(): void {
  opsSinceSweep += 1;
  if (opsSinceSweep < 200) return;
  opsSinceSweep = 0;
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key);
  }
}
