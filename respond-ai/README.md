This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


# AutoParts AI 🔧
### AI-powered automotive parts inventory & WhatsApp customer inquiry system

Built with: **Next.js 14 · Supabase · OpenAI GPT-4o · WhatsApp Business API · Vercel**

---

## What This Does

**For customers (via WhatsApp):**
- Ask about parts in natural language: *"Do you have brake pads for a 2019 Honda Civic?"*
- Get instant AI responses with availability, prices, and part numbers
- Check order status: *"What's the status of order ORD-12345678?"*
- AI automatically escalates complex requests to human staff

**For you (via Dashboard):**
- Full inventory management — add, update, search parts
- Real-time low stock alerts
- View all WhatsApp conversations
- Track and update order statuses
- Dashboard stats — revenue, inquiries, AI resolution rate

---

## Setup (30 minutes)

### 1. Clone and Install
```bash
git clone <your-repo>
cd autoparts-ai
npm install
```

### 2. Supabase Setup
1. Go to [supabase.com](https://supabase.com) → New Project
2. Go to SQL Editor → paste contents of `supabase/schema.sql` → Run
3. Go to Settings → API → copy URL and keys

### 3. OpenAI Setup
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create API key
3. **Model used:** `gpt-4o` (best reasoning for parts identification)

### 4. WhatsApp Business API Setup
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create App → Add WhatsApp product
3. Get a test phone number (free in sandbox)
4. Copy Access Token and Phone Number ID
5. Set up webhook URL: `https://your-app.vercel.app/api/whatsapp`
6. Set Verify Token to any string you choose
7. Subscribe to `messages` webhook field

### 5. Environment Variables
```bash
cp .env.local.example .env.local
# Fill in all values
```

### 6. Deploy to Vercel
```bash
npx vercel
# Add environment variables in Vercel dashboard
```

---

## Architecture

```
Customer WhatsApp Message
        ↓
WhatsApp Business API (Meta)
        ↓
/api/whatsapp (webhook)
        ↓
AI Agent (GPT-4o)
  ├── search_inventory() → Supabase
  ├── check_part_availability() → Supabase  
  └── get_order_status() → Supabase
        ↓
Response sent back to customer via WhatsApp API
        ↓
Conversation saved to Supabase
```

---

## AI Agent Capabilities

The AI agent uses **OpenAI GPT-4o with function calling** (agentic workflow):

1. **Part Search** — natural language → inventory lookup → formatted response
2. **Compatibility Check** — customer mentions vehicle → filters compatible parts
3. **Price Inquiry** — instant price + availability
4. **Order Tracking** — order number → status update
5. **Escalation Detection** — automatically flags frustrated customers for human follow-up
6. **Conversation Memory** — maintains context across messages (last 20 messages)

---

## Key Files

```
/lib/ai-agent.ts      — Core AI agent with GPT-4o + tool calling
/lib/whatsapp.ts      — WhatsApp Business API helpers
/lib/supabase.ts      — Database client + types
/app/api/whatsapp/    — Webhook handler (GET=verify, POST=messages)
/app/api/inventory/   — CRUD for inventory
/app/api/dashboard/   — Stats aggregation
/app/api/orders/      — Order management
/app/api/conversations/ — Conversation viewer
/app/page.tsx         — Dashboard UI
/supabase/schema.sql  — Complete database schema + seed data
```

---

## WhatsApp Test Messages

Once connected, test with:
- *"Do you have oil filters for Toyota Corolla?"*
- *"What's the price of brake pads?"*
- *"Check part number BRK-001"*
- *"Status of order ORD-12345678"*
- *"I need spark plugs for a 2018 Nissan X-Trail"*

---

## Dashboard Access

After deploying: `https://your-app.vercel.app`

Tabs:
- **Overview** — stats, alerts, recent activity
- **Inventory** — full parts management
- **Conversations** — WhatsApp message history
- **Orders** — order tracking and status updates

---

## Adding to Your CV

**Project: AutoParts AI — Agentic AI Customer System**
Built a production-grade automotive parts inventory system with an AI agent powered by GPT-4o function calling. Integrated WhatsApp Business API for automated customer inquiry handling, with real-time inventory lookup, compatibility checking, and order tracking. Deployed on Vercel with Supabase backend. Stack: Next.js, Supabase, OpenAI GPT-4o, WhatsApp Business API.