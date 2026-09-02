// Shared by app/api/ai/* route handlers. Without this, any exception that
// isn't the one specific error type each route happened to catch (a
// missing Firebase Admin env var, a second/follow-up model call failing, a
// transient Firestore error) escapes the handler entirely — Next.js then
// returns a bare platform 500 with no body the client can read, which is
// what AiAssistantContext.sendMessage's `res.json().catch(() => ({}))`
// falls back on, surfacing only "The assistant didn't respond — try again."
// with nothing for the owner to act on.
//
// Routing every failure through this one function instead means: (a) the
// client always gets a JSON body with a real message, even for bugs no one
// anticticipated, and (b) the server log always gets one line to grep for.
// This is a single-owner tool, not a multi-tenant SaaS with adversarial
// users, so surfacing the actual error message (e.g. "FIREBASE_PROJECT_ID
// isn't set") is more valuable than a generic "Internal Server Error" —
// it's the difference between the owner fixing their Vercel env vars in
// two minutes versus filing a support ticket that never comes.

import { AiAuthError } from "./firebaseAdmin";
import { AnthropicApiError } from "./anthropic";

export function aiErrorResponse(err: unknown, context: string): Response {
  if (err instanceof AiAuthError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof AnthropicApiError) {
    return Response.json({ error: err.message }, { status: err.status ?? 502 });
  }
  // Anything else (Firebase Admin misconfiguration, a Firestore hiccup, a
  // genuine bug) — log server-side with the calling route's name for
  // grepability, and hand the client a real message instead of nothing.
  console.error(`[${context}]`, err);
  const message = err instanceof Error ? err.message : "Something went wrong.";
  return Response.json({ error: message }, { status: 500 });
}
