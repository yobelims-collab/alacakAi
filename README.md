# AlacakAI

AI-powered B2B accounts-receivable and payment-collection platform for Turkish companies.
The AI monitors invoices, drafts stage-based reminders, classifies customer replies, records payment
promises, escalates what it should not decide, matches incoming payments and shows management which
customers are risky. Turkish first, English supported.

## Install

```bash
git clone https://github.com/yobelims-collab/alacakai.git
cd alacakai
npm install
cp .env.example .env.local   # optional — the app runs without it
npm run dev                  # http://localhost:3000
```

Without any environment variables the app starts in **Demo Mode**: an in-memory database seeded with
"Demo Teknoloji A.Ş." (10 customers, 30 invoices, 20 payments, promises, communication history, risk scores,
AI actions). Open `/login` and click **Demo hesabıyla gir** (`demo@alacakai.app` / `demo1234`), or sign up and
create your own (empty or demo-seeded) company. Demo data lives in the Node process and resets on restart.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for real DB/auth | Supabase project. Missing ⇒ demo mode. |
| `SUPABASE_SERVICE_ROLE_KEY` | for cron/webhooks | Server-only key used by `/api/cron/collection` and `/api/inbound/*`. |
| `DEMO_MODE` | no | `true` forces demo mode even with Supabase configured. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | no | Model-written messages and reply classification (Zod-validated). Missing ⇒ rule-based engines. |
| `CRON_SECRET` | for cron | Bearer token for the daily sweep. |
| `INBOUND_WEBHOOK_SECRET` | for webhooks | `x-webhook-secret` header for inbound replies. |
| `SESSION_SECRET` | recommended | Signs the demo-mode session cookie. |
| `RESEND_API_KEY` | no | Real email sending. Missing ⇒ messages recorded as *simulated*. |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | no | WhatsApp Cloud API sending. Missing ⇒ simulated. |

Never put secrets in `NEXT_PUBLIC_*` variables; the OpenAI key is only read on the server.

## Configure Supabase

1. Create a project, copy the URL and anon key into `.env.local`.
2. Open the SQL editor and run `supabase/schema.sql` (idempotent; re-run after schema changes). It creates all
   tables, Row Level Security policies and the `create_organization()` function used by onboarding.
3. Authentication → Providers → Email: enable. For local development you may disable "Confirm email" so
   sign-up lands directly in onboarding; otherwise users confirm by email first and then sign in.
4. Restart `npm run dev`. Sign up → create company (optionally tick "Load demo data") → dashboard.

## Run locally

```bash
npm run dev        # development server
npm run check      # tsc → eslint → vitest → next build (what CI should run)
npm test           # unit tests (src/lib/__tests__)
```

## Demo mode walkthrough (the core flow)

1. **Login → Demo hesabıyla gir.** Dashboard shows totals, aging, overdue invoices and *Human attention required*.
2. **Run AI cycle** (dashboard button or `/api/cron/collection`): the engine scans due dates and drafts stage-based
   reminders (pre-due → due today → 1–7 days → 8–30 days → escalation at 30+ days).
3. **Communication Center**: approve/edit a draft → it is "sent" (marked *Simulated* when no provider is set).
4. **Simulate customer reply**: e.g. `Ödemeyi önümüzdeki cuma yapacağız.` → classified `PAYMENT_DATE_PROMISED`,
   a payment promise is recorded, invoice becomes `PAYMENT_PROMISED`. Try `30 gün ek süre verebilir misiniz?` to
   see an escalation appear under *Human attention*.
5. **Payments → Import bank CSV** (sample in the page) or *Add payment*: the matcher suggests the invoice with a
   confidence and reasons → **Match** → invoice becomes `PAID`, promise `KEPT`, dashboard updates.

## How the AI works

- `src/lib/ai/collection-agent.ts` — pure planner: decides reminders, follow-ups, broken promises, escalations.
- `src/lib/ai/message-generator.ts` — reviewed templates per stage/language/tone; optional model rewrite that must
  pass Zod + fact/forbidden-phrase checks (no legal threats, penalties, interest, risk scores).
- `src/lib/ai/response-classifier.ts` — intent + extraction (promised date, extension days, disputed amount…);
  model output validated with Zod, deterministic rules as fallback.
- `src/lib/ai/escalation-rules.ts` — when the AI must *not* act (disputes, refusals, large extensions, legal
  language, discounts, credit requests, broken promises, low confidence).
- `src/lib/ai/risk-analyzer.ts` — explainable 0–100 score (delay, overdue count, broken promises, exposure,
  disputes, recency). Internal prioritisation only, not a credit rating.
- `src/lib/ai/payment-matcher.ts` — deterministic reference/amount/currency/customer scoring with reasons.
- `src/lib/ai/system-prompt.ts` — the 15 agent rules, shown in Settings → AI and injected into every model call.

Financial state only ever changes from validated structured objects, never from free-form model text.

## Deploy to Vercel

1. Import the repo on vercel.com (no special root directory needed).
2. Add the environment variables above (at least the Supabase pair; `SUPABASE_SERVICE_ROLE_KEY` + `CRON_SECRET`
   for the daily sweep defined in `vercel.json`).
3. Deploy. `next build` runs without any env (demo mode), so previews work out of the box.

## Production integrations (what to plug in)

| Integration | Today | To go live |
|---|---|---|
| Email | Resend via `RESEND_API_KEY` (else simulated) | Verify a sending domain; set `sender_email` in Settings → Communication. |
| WhatsApp | Meta Cloud API via token + phone id (else simulated) | Approved templates for outbound; point the webhook to `/api/inbound/whatsapp`. |
| Inbound replies | `/api/inbound/email` & `/api/inbound/whatsapp` (JSON: organization_id, from, text, invoice_number?) | Add a provider adapter that maps the provider payload to this shape. |
| Bank | CSV import + matcher (`bank_transactions`) | Add an adapter that writes `bank_transactions`, then reuse `importBankTransactions`. |
| AI | OpenAI (optional) | Set `OPENAI_API_KEY`; outputs are validated identically. |
| Cron | Vercel Cron → `/api/cron/collection` | Any scheduler with the bearer secret works. |

Not in the MVP by design: real bank connections, factoring/lending, automatic credit decisions, legal debt
collection or notices, real billing (pricing is a placeholder).
