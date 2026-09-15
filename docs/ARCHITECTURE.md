# AlacakAI — architecture

AlacakAI is an AI-assisted accounts-receivable workflow, **not** a chatbot. Every AI capability is a pure,
testable function whose output is validated with Zod before it can change financial state.

## Layers

```
src/app                 Next.js 16 App Router — thin pages, server actions wired to services
  (app)/…               authenticated product (dashboard, customers, invoices, payments, communications, ai-actions, attention, settings)
  (auth)/…, onboarding  sign in / sign up / create company
  api/cron/collection   daily sweep (CRON_SECRET)           api/inbound/[channel]  provider-agnostic reply webhook
src/components/ui       shadcn-style primitives (radix-ui)   src/components/app  shell + shared app widgets
src/lib/actions         "use server" entry points (Zod-validate → service → revalidate)
src/lib/services        orchestration that mutates the store: collection, payments, imports, risk, messaging, audit
src/lib/ai              pure AI modules: collection-agent (planner), message-generator, response-classifier,
                        escalation-rules, risk-analyzer, payment-matcher, templates, schemas, system-prompt
src/lib/domain          pure business math: dates, money, invoice derivations, dashboard/customer metrics
src/lib/db              DataStore interface + MemoryStore (demo/tests) + SupabaseStore (RLS) + demo seed
src/lib/auth            session resolution (Supabase Auth or signed demo cookie) + auth server actions
src/lib/i18n            tr/en chrome dictionary, locale cookie
supabase/schema.sql     normalized schema, RLS on every tenant table, create_organization() RPC
```

## Tenant boundary
`requireContext()` resolves the user, their `organization_id`, and returns an **org-scoped `DataStore`**.
Application code never filters by organization; the store does. In Supabase mode the store uses the user's
session client so PostgreSQL RLS is a second, independent guard.

## Demo mode
No Supabase env → `MemoryStore` on `globalThis` + HMAC-signed demo cookie. "Demo Teknoloji A.Ş." is seeded on
first request (10 customers, 30 invoices, 20 payments, promises, history, risk scores). Sign-up, company
creation, imports and the full collection flow all work in memory. Anything external (OpenAI, email, WhatsApp,
bank) is optional and, when missing, is either rule-based or explicitly labelled *simulated*.

## Collection engine (the core loop)
1. `runCollectionCycle` refreshes date-driven statuses and stages (`deriveStatus`, `stageForInvoice`).
2. `planCollectionCycle` (pure) decides per open invoice: REMINDER (stage not yet handled, no pending draft),
   PROMISE_FOLLOW_UP (promised date reached), PROMISE_BROKEN (grace passed), ESCALATE (≥ escalation days).
   While a promise is active and not due, the AI stays silent.
3. `draftReminder` → `generateMessage`: reviewed template per stage×language×tone; if OpenAI is configured the
   model may rewrite it, but the output must parse (Zod), contain the invoice number and amount, and contain no
   forbidden phrase (legal threats, interest, penalties, risk scores…). Otherwise the template is used.
4. Drafts wait in **PENDING_APPROVAL** unless auto-send is enabled; `dispatchCommunication` sends via a provider
   or records `SENT_SIMULATED`.
5. Replies (`processInboundReply`) → `classifyReply` (model with Zod validation, rules fallback) →
   `evaluateEscalation` (disputes, refusals, large extensions, legal language, discounts, credit increase,
   broken promises, low confidence) → structured `payment_promises`, invoice status, `ai_actions`
   (NEEDS_HUMAN when escalated), risk recompute.
6. Payments: `suggestMatches` scores reference/amount/currency/customer; a human confirms → invoice
   paid/partially paid, promises kept, escalations closed.

## Data model
See `supabase/schema.sql` (organizations, profiles, customers, customer_contacts, invoices, payments,
payment_promises, communications, ai_actions, risk_scores, automation_rules, bank_transactions, audit_logs).
Row types in `src/lib/types` mirror the columns 1:1 so both stores share one shape.

## Security
Supabase Auth; RLS; Zod on every action/route; server-only API keys (`server-only` imports); proxy.ts auth
gate; rate-limited webhooks; audit_logs on every mutation; security headers in next.config.ts.
