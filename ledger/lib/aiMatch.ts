// Resolves a free-text name (what the model understood from a prompt or a
// receipt photo — "cement", "50kg bag of flour", "Cocacola 1.5L") against
// the business's real product/category list. Deliberately done here in
// plain TypeScript rather than trusted from the model: an LLM asked to
// return a Firestore document id will sometimes invent a plausible-looking
// one, and a wrong id silently attached to a purchase is much worse than a
// low-confidence match that asks the user to pick from a dropdown instead.
// No dependency — small enough to inline, and used both server-side
// (app/api/ai/*) and client-side (components/ai/*), so it can't pull in
// anything environment-specific.

export interface MatchCandidate {
  id: string;
  name: string;
}

export interface MatchResult {
  id: string | undefined;
  name: string | undefined;
  confidence: number; // 0-1
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Classic edit-distance, used to catch typos/plurals ("cements" vs "cement")
// that token overlap alone would miss. Candidate lists in this app are
// small (a few hundred products at most), so the O(n*m) cost per pair is
// irrelevant.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = new Array(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = temp;
    }
  }
  return row[n];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

// Token-overlap score (handles word reordering / extra descriptors like
// qty or brand) blended with whole-string edit-distance similarity
// (handles typos on short single-word names where token overlap is
// all-or-nothing).
function scoreMatch(query: string, candidate: string): number {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;

  const qTokens = q.split(" ");
  const cTokens = c.split(" ");
  const overlap = qTokens.filter((t) => cTokens.includes(t)).length;
  const tokenScore = overlap / Math.max(qTokens.length, cTokens.length);

  const wholeScore = similarity(q, c);

  // A candidate name fully contained in the query (or vice versa) — e.g.
  // "50kg bag of cement" contains "cement" — is a strong signal even when
  // token/edit-distance scores are mediocre.
  const containment = q.includes(c) || c.includes(q) ? 0.85 : 0;

  return Math.max(tokenScore * 0.9, wholeScore, containment);
}

// Returns the best match above a usable threshold, or an empty result if
// nothing is close enough to trust — callers should fall back to letting
// the user pick manually rather than attaching a low-confidence id.
export function bestMatch(query: string, candidates: MatchCandidate[]): MatchResult {
  let best: MatchCandidate | undefined;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = scoreMatch(query, candidate.name);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  if (!best || bestScore < 0.45) return { id: undefined, name: undefined, confidence: 0 };
  return { id: best.id, name: best.name, confidence: Math.min(1, bestScore) };
}
