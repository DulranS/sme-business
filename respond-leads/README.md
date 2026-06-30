# RespondLeadz

RespondLeadz is the **sales & conversion engine** of an SME operations stack. It answers inbound
**WhatsApp** messages with AI, grounds every reply in **live inventory**, remembers each
conversation, detects when a **deal closes**, and runs an automated **post-close follow-up**
lifecycle — all **multi-tenant** with strict per-business data isolation.

> Built on Next.js (App Router) + TypeScript, Supabase/Postgres with Row Level Security, the
> WhatsApp Business Cloud API, and Anthropic Claude Haiku.

---

## 1. What it does (in plain words)

A customer messages your WhatsApp number. RespondLeadz:

1. **Receives** the message (webhook), verifies it really came from Meta (HMAC signature).
2. **Finds the right business** (tenant) from the receiving phone number.
3. **Skips duplicates** so a customer is never replied to twice.
4. **Understands intent** — the LLM extracts what product the customer is asking about.
5. **Looks up inventory** for that tenant (price + quantity, capped to 5 results).
6. **Writes a grounded reply** that only mentions items that actually exist, including price and
   stock — and a safe fallback message if the AI is unavailable.
7. **Sends** the reply back over WhatsApp (with retries).
8. **Remembers** the exchange (trimmed conversation history).
9. **Detects a closed deal** and records it (value + currency), then **schedules follow-ups**
   (delivery check, review ask, re-order nudge…) that a daily job sends — but only to customers who
   consented and haven't opted out.

It also talks to sibling systems: **CashFlow** (money tracking), **AutoDealz** (supply feed), and
**Mails2Leadz** (lead hand-off) — using the phone number as the shared customer identifier. If a
sibling is down, inbound handling keeps working.

---

## 2. Architecture

```
                         WhatsApp Business Cloud API
                                   │  (webhook POST, HMAC-signed)
                                   ▼
            ┌──────────────────────────────────────────────┐
            │  app/api/webhook/whatsapp/route.ts            │  ← the ONE production endpoint
            │            delegates to                       │
            │  lib/pipeline/inbound-handler.ts              │
            └──────────────────────────────────────────────┘
                                   │  per message, independently
   ┌───────────────┬──────────────┼───────────────┬───────────────┬────────────────┐
   ▼               ▼              ▼               ▼               ▼                ▼
 signature      parser        tenant         rate-limiter   conversation-     close-detector
 (verify)    (extract msgs) (resolve+RLS)   (burst queue)   engine (memory)   (record close)
                                   │                               │                │
                                   ▼                               ▼                ▼
                            inventory (search)            ai-responder        lifecycle (cron)
                                   │                    (Claude Haiku +       follow-ups
                                   ▼                     fallback)            (consent-gated)
                            outbound-sender ── reply ──▶ WhatsApp
                                   │
                                   ▼
                       Supabase / Postgres (RLS-enforced, per tenant)
```

Everything tenant-scoped goes through `withTenantContext()`, which opens a transaction, sets
`app.current_tenant`, and runs on a **non-superuser** Postgres role so **Row Level Security** is
always enforced. The dashboard (`app/page.tsx`) is a separate admin UI over the same data.

---

## 3. Project structure

```
respond-leads/
├─ app/
│  ├─ page.tsx                         # Admin dashboard (inventory + conversations UI)
│  └─ api/
│     ├─ webhook/whatsapp/route.ts     # CANONICAL webhook (GET verify, POST pipeline)
│     ├─ health/route.ts               # Health check (DB + WhatsApp reachability)
│     └─ cron/lifecycle/route.ts       # Daily post-close follow-up runner
├─ lib/
│  ├─ pipeline/                        # ← the canonical pipeline (this spec)
│  │  ├─ inbound-handler.ts            #   webhook verify + POST orchestration
│  │  ├─ signature.ts                  #   HMAC-SHA256 verify (constant-time)
│  │  ├─ parser.ts                     #   payload → messages (cap 100, truncate 4096)
│  │  ├─ tenant.ts                     #   tenant resolution + RLS context + probe
│  │  ├─ inventory.ts                  #   tenant-scoped search (≤5, active only)
│  │  ├─ llm-provider.ts               #   single Claude Haiku provider
│  │  ├─ ai-responder.ts               #   intent extract + grounded reply + fallback
│  │  ├─ outbound-sender.ts            #   WhatsApp send w/ 3-attempt retry
│  │  ├─ conversation-engine.ts        #   history fetch/trim, dedup, commit
│  │  ├─ close-detector.ts             #   close evaluation + idempotent record
│  │  ├─ consent.ts                    #   consent / opt-out / data deletion
│  │  ├─ rate-limiter.ts               #   burst queue + spaced draining
│  │  ├─ lifecycle.ts                  #   follow-up scheduling + sending
│  │  ├─ types.ts / errors.ts          #   shared domain types + typed errors
│  ├─ integrations/                    # CashFlow, Mails2Leadz, AutoDealz adapters
│  ├─ config.ts                        # ConfigValidator (startup env gate)
│  ├─ logger.ts                        # Structured logger w/ credential redaction
│  └─ supabase.ts                      # Dashboard Supabase clients
├─ supabase/migrations/                # 001–007 SQL migrations (007 = RLS policies)
├─ tests/                              # Jest + fast-check property tests (32 properties)
├─ reference/                          # Archived non-production material (blueprints, python/)
├─ proxy.ts                            # Edge proxy: request logging, rate limit, security headers
├─ .env.example                        # Documented environment template
└─ vercel.json                         # Cron schedule (lifecycle daily @ 09:00)
```

---

## 4. Prerequisites

- **Node.js 18+** and npm
- A **Supabase**/Postgres project (migrations `001`–`007` applied)
- A **WhatsApp Business Cloud API** app (Meta Developer account)
- An **Anthropic** API key (optional — without it the AI falls back to a safe canned reply)

---

## 5. Setup & run (local)

```bash
# from the repo
cd respond-leads
npm install

# create your local env and fill in real values (see section 6)
cp .env.example .env.local      # then edit .env.local

# run the dashboard + API
npm run dev                     # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build (must pass before deploy)
npm start          # run the production build
npm run lint       # eslint
npm test           # full Jest + fast-check suite
npm run test:watch # watch mode
```

> **Note (Windows):** run long-lived commands like `npm run dev` in your own terminal — they don't
> exit on their own.

### Database setup

Apply the migrations in `supabase/migrations/` in order (`001` → `007`). The important ones for this
pipeline:

- `006_multi_tenant_schema.sql` — adds `tenant_id` + the `tenants`, `close_events`,
  `follow_up_actions`, `customer_consent`, `inbound_queue` tables.
- `007_tenant_rls_policies.sql` — **enables and FORCES** Row Level Security on every tenant table and
  creates the non-superuser `respondleadz_tenant` role used by the pipeline.

The pipeline connects with **two** roles:
- `TENANT_DATABASE_URL` → the **non-superuser** `respondleadz_tenant` role (RLS enforced). This is
  the only path for tenant business data.
- `ADMIN_DATABASE_URL` (or `DATABASE_URL`) → a role that can read the `tenants` table, used only for
  routing inbound messages and the startup RLS probe.

---

## 6. Environment variables

Copy `.env.example` → `.env.local` and fill these in. The webhook **refuses inbound traffic** until
every REQUIRED value is present (enforced by `ConfigValidator`).

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL (dashboard + data) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | ◻ | Server-side privileged key |
| `TENANT_DATABASE_URL` | ✅ | Postgres conn as `respondleadz_tenant` (RLS enforced) |
| `ADMIN_DATABASE_URL` / `DATABASE_URL` | ✅ | Routing + RLS probe connection |
| `WHATSAPP_PHONE_NUMBER_ID` | ✅ | From Meta WhatsApp config |
| `WHATSAPP_ACCESS_TOKEN` | ✅ | WhatsApp Cloud API token |
| `WHATSAPP_APP_SECRET` | ✅ | Used to verify webhook signatures |
| `WHATSAPP_VERIFY_TOKEN` | ✅ | Must match the token entered in Meta webhook setup |
| `ANTHROPIC_API_KEY` | ◻ | Claude Haiku; absent → fallback replies |
| `CRON_SECRET` | ◻ (recommended) | Bearer token guarding the lifecycle cron |
| `CASHFLOW_WEBHOOK_URL` | ◻ | CashFlow close-event sink |
| `AUTODEALZ_FEED_URL` | ◻ | AutoDealz supply feed |
| `NEXT_PUBLIC_APP_URL` | ◻ | App base URL (default `http://localhost:3000`) |

---

## 7. Connecting WhatsApp (Meta)

1. In the [Meta Developer](https://developers.facebook.com/) console, create an app and add
   **WhatsApp**. Note the **Phone Number ID**, **Access Token**, and **App Secret**.
2. Choose any **Verify Token** string and put the same value in `WHATSAPP_VERIFY_TOKEN`.
3. Set the webhook callback URL to `https://<your-domain>/api/webhook/whatsapp` and subscribe to the
   **`messages`** field.
4. Meta sends a GET verification request → the handler echoes the challenge only when the token
   matches (returns 403 otherwise).
5. Send a test message to your number; watch it get a reply. Use `/api/health` to confirm the app
   can reach the DB and WhatsApp.

For local testing, expose `localhost:3000` with a tunnel (e.g. ngrok) and use that HTTPS URL as the
webhook.

---

## 8. Testing

```bash
npm test
```

The suite is **Jest + fast-check** (property-based testing): 32 correctness properties plus unit
tests, ~139 cases, fully hermetic (the database layer is mocked, so no DB is needed). Tagged like
`// Feature: respond-leadz, Property N: ...`.

The true **RLS isolation** tests (`tests/tenant.test.ts`) require a live Postgres and are **skipped
by default**. To run them, apply migrations `001`–`007`, create the `respondleadz_tenant` role, then:

```bash
# PowerShell example
$env:RESPONDLEADZ_TEST_DATABASE="1"
$env:ADMIN_DATABASE_URL="postgres://admin:...@host:5432/db"
$env:TENANT_DATABASE_URL="postgres://respondleadz_tenant:...@host:5432/db"
npx jest tests/tenant.test.ts
```

---

## 9. Deployment (Vercel)

1. Push the repo and import it in Vercel.
2. Add every REQUIRED env var (section 6) in **Project Settings → Environment Variables**, plus
   `CRON_SECRET`.
3. Deploy. `vercel.json` registers the daily crons (lifecycle at 09:00) — Vercel Hobby allows **one
   run per day per job**, which the lifecycle runner respects.
4. Point the Meta webhook at `https://<your-vercel-domain>/api/webhook/whatsapp`.

`npm run build` must be green before deploying (it is).

---

## 10. Security & compliance notes

- **Signature verification** (HMAC-SHA256, constant-time) on every webhook POST → 401 on mismatch.
- **Startup config gate** refuses webhooks until required secrets are present.
- **Credential redaction** in logs — values are never written, only names.
- **Row Level Security** forced on all tenant tables; the pipeline uses a non-superuser role.
- **Consent & GDPR** — follow-ups are consent-gated; opt-out and data-deletion are supported.
- **Cron auth** — set `CRON_SECRET` so only Vercel Cron can trigger the customer-facing lifecycle.

---

## 11. Spec & docs

This app was built from a formal spec in `.kiro/specs/respond-leadz/`
(`requirements.md`, `design.md`, `tasks.md`). The `reference/` folder holds archived, non-production
material (Make.com blueprints, the Python RAG prototype) kept for historical context only.
