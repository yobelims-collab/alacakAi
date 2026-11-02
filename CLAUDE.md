# Alacore — rules for AI agents

Read `docs/CONVENTIONS.md` (how to add a page) and `docs/ARCHITECTURE.md` (how it works) first.
This is Next.js 16: read `node_modules/next/dist/docs/` before assuming an API (proxy.ts, async params).

- Product decisions: honest AI (never claim a message was delivered or a payment received without proof), no
  threats/legal claims/invented terms in customer messages, monetization is a placeholder, lucide icons only.
- Invariants: every org table goes through the org-scoped `DataStore`; financial state changes only from
  Zod-validated objects; single points of change: `runCollectionCycle`, `processInboundReply`,
  `matchPayment` — do not add parallel paths. New AI outputs get a Zod schema in `src/lib/ai/schemas.ts` and a test.
- Verify with `npm run check` before committing. Pure logic → `src/lib` + a test in `src/lib/__tests__`.
- Secrets only in `.env.local`; `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
