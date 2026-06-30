/**
 * WhatsApp webhook route — the Next.js app-router entry point for Meta's
 * WhatsApp Business Cloud API.
 *
 * This route is a thin framework adapter: it reads request inputs and delegates
 * all behavior to the framework-agnostic Inbound_Handler in
 * `lib/pipeline/inbound-handler.ts`.
 *
 *  - `GET`  → Meta webhook verification challenge. Returns the unmodified
 *    challenge with HTTP 200 only on a valid `subscribe` request whose verify
 *    token matches; otherwise HTTP 403 with no challenge echo (Requirements
 *    1.2–1.4).
 *  - `POST` → signature verification (401 on failure), payload parsing, tenant
 *    resolution, rate limiting, and independent per-message dispatch. Always
 *    acknowledges with HTTP 200 within the response window, including on
 *    processing errors (Requirements 2.1, 3.2, 15.1, 15.2, 17.3).
 *
 * Feature: respond-leadz
 * Requirements: 1.2, 1.3, 1.4, 2.1, 3.2, 15.1, 15.2, 17.3
 */

import { NextResponse, type NextRequest } from 'next/server'
import { verifyChallenge, handlePost } from '@/lib/pipeline/inbound-handler'

/** This route performs live signature checks, database, and network work. */
export const dynamic = 'force-dynamic'

/** Header carrying Meta's HMAC-SHA256 request signature. */
const SIGNATURE_HEADER = 'x-hub-signature-256'

/**
 * GET /api/webhook/whatsapp — Meta verification challenge.
 *
 * Delegates to {@link verifyChallenge}, echoing the unmodified challenge as a
 * plain-text body on success (HTTP 200) and returning HTTP 403 with an empty
 * body on any failure (Requirements 1.2–1.4).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams
  const result = verifyChallenge(
    params.get('hub.mode'),
    params.get('hub.verify_token'),
    params.get('hub.challenge')
  )
  return new NextResponse(result.body, {
    status: result.status,
    headers: { 'Content-Type': 'text/plain' },
  })
}

/**
 * POST /api/webhook/whatsapp — inbound message webhook.
 *
 * Reads the raw, unmodified request body (required for byte-exact signature
 * verification) and the signature header, then delegates to {@link handlePost}.
 * The handler authenticates, parses, resolves the tenant, and dispatches each
 * message independently, returning the HTTP status and acknowledgement body to
 * relay back to Meta (Requirements 2.1, 3.2, 15.1, 15.2, 17.3).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text()
  const signature = request.headers.get(SIGNATURE_HEADER)
  const result = await handlePost(rawBody, signature)
  return NextResponse.json(result.body, { status: result.status })
}
