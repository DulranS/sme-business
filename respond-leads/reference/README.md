# Reference Material (Non-Production)

This folder archives non-production reference material that is **not** part of the
canonical RespondLeadz TypeScript/Next.js application and is **not** imported by any
code under `app/`, `lib/`, or `components/`. It is preserved for historical/design
reference only.

## Contents

### Make.com blueprints
- `WhatsApp AI Inventory Support V11 — Inbound + Close Detection.blueprint.json`
- `WhatsApp Post-Close Lifecycle Runner.blueprint.json`
- `v9-clean-blueprint.json`
- `whatsapp-ai-inventory-v10.json`

These describe the original Make.com automation flows the canonical pipeline replaced.

### `python/`
A separate, standalone Python application (Discord/RAG bot). It is unrelated to the
production Next.js build and is kept here for reference.

## Notes
- Nothing in the canonical app imports from this folder.
- Do not add production code here.

_Archived as part of consolidation task 20.2 (Requirement 11.3)._
