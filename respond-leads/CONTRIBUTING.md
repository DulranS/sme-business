# Contributing & development guidelines

Practical conventions for working on RespondLeadz. Keep changes small, typed, and tested.

## Golden rules

1. **The canonical pipeline lives in `lib/pipeline/`.** There is exactly **one** production webhook
   route (`app/api/webhook/whatsapp/route.ts`) and **one** LLM provider. Do not reintroduce
   competing variants (v9/v10/blueprint). Archived material stays in `reference/`.
2. **All tenant data access goes through `withTenantContext()`** (in `lib/pipeline/tenant.ts`). Never
   query tenant tables on the admin/superuser pool — RLS must always apply.
3. **Never log secret values.** Use the `logger`; pass credentials by name, not value. The logger
   redacts known patterns and registered secrets, but don't rely on it as a license to log secrets.
4. **Read env via `process.env` only** (no secrets in source). Add new required vars to
   `ConfigValidator.REQUIRED_ENV_KEYS`, `.env.example`, and the README table.

## Definition of done

A change is done when **all** of these pass from `respond-leads/`:

```bash
npx tsc --noEmit     # types clean
npm run lint         # (at least: the files you touched are clean)
npm test             # full property + unit suite green
npm run build        # production build succeeds
```

## Coding conventions

- **TypeScript strict**; avoid `any` (use `unknown` + narrowing). The pipeline is `any`-free.
- **Pure where possible.** Keep DB/network at the edges so logic is unit-testable. Pipeline modules
  expose pure helpers (e.g. `appendAndTrim`, `evaluate`, `renderInventoryContext`) plus thin DB
  wrappers.
- **Typed errors** from `lib/pipeline/errors.ts` (`PayloadParseError`, `SignatureError`,
  `ConfigError`, `LlmError`, `DeliveryError`, `TenantContextError`).
- **Parameterized SQL** only — never string-interpolate user input into queries.
- **Per-message isolation:** one message's failure must never block its siblings; the webhook always
  acknowledges 200 on processing errors (signature/config failures are the documented exceptions).

## Adding a pipeline module

1. Create `lib/pipeline/<name>.ts`. Keep it framework-agnostic (no Next.js imports) so it's testable.
2. Use `withTenantContext` for any tenant data; take injectable deps (e.g. `fetchImpl`, `now`) so
   tests stay hermetic.
3. Add a test `tests/<name>.test.ts` using **Jest + fast-check**. Tag properties:
   `// Feature: respond-leadz, Property N: <text>` and run ≥ 100 cases (`{ numRuns: 100 }`).
4. Wire it into `inbound-handler.ts` (or the relevant route) last.

## Testing conventions

- Property tests use `fast-check`; mock the DB by `jest.mock('@/lib/pipeline/tenant')` with an
  in-memory fake `ctx.query` that mirrors the real SQL contract (including `ON CONFLICT`/RLS
  semantics).
- Tests must be **hermetic** by default (no DB/network). Integration tests that need Postgres must be
  gated behind an env var (see `tests/tenant.test.ts`) and **skip** — never fail — when it's unset.
- Don't modify source to make a test pass unless you've found a genuine defect; if you do, call it
  out in the PR.

## Database / migrations

- New schema goes in a new numbered file under `supabase/migrations/` (don't edit applied ones).
- Any new tenant-scoped table must get `ENABLE` + `FORCE ROW LEVEL SECURITY` and a `tenant_isolation`
  policy keyed on `current_setting('app.current_tenant', true)::uuid`, plus grants to
  `respondleadz_tenant` (mirror `007_tenant_rls_policies.sql`).

## Git / PR workflow

- Branch off `main`; never commit directly to `main`.
- Keep PRs focused. Title < 70 chars. Describe what changed, what you tested, and any follow-ups.
- Don't commit `.env*` (only `.env.example` is tracked).
- Commits are created only when explicitly requested.

## Known tech debt

- The legacy dashboard UI (`components/`, `lib/slices/`, `lib/validation.ts`, some `lib/*.ts`
  services, `types/`) predates this spec and still has `no-explicit-any` lint errors. These are not
  build-blocking (Next 16 doesn't lint during build) and are outside the pipeline. Clean them
  module-by-module if you touch them; keep the build/tests green.
