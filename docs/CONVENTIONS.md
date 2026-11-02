# Alacore — engineering conventions

Read this before adding a page. It is the contract between the foundation (`src/lib`) and the UI.

## Stack facts
- Next.js 16 App Router (`src/app`), React 19, TypeScript strict, Tailwind v4, hand-written shadcn-style UI in `src/components/ui`, `lucide-react` icons, `recharts` charts, `sonner` toasts.
- `middleware` is called `proxy.ts` in Next 16. `params`/`searchParams` are **Promises** in pages (`const { id } = await params`).
- Server Components by default. Add `"use client"` only for interactivity (forms with `useActionState`, buttons calling server actions with `useTransition`).

## Getting data (server components)
```ts
import { requireContext } from "@/lib/db";      // { user, store, org, locale, t, demo } — redirects if not signed in / no org
const ctx = await requireContext();
const invoices = await ctx.store.list("invoices", { where: { customer_id }, orderBy: "due_date", ascending: true });
```
- `ctx.store` is org-scoped (`DataStore` in `src/lib/db/store.ts`): `list/get/insert/update/remove`. Never filter by organization yourself.
- `ctx.t` is the dictionary (`src/lib/i18n/dictionaries.ts`) for the current locale (`ctx.locale` = "tr" | "en"). Use `t.status[...]`, `t.stage[...]`, `t.intent[...]`, `t.risk[...]`, `t.actionType[...]`, `t.channel[...]` for enums.
- Read-model helpers in `src/lib/queries.ts`: `loadCustomers`, `loadCustomerDetail`, `loadDashboard`.
- Derived invoice fields: `toInvoiceView(inv, today())` from `src/lib/domain/invoices.ts` → `outstanding`, `days_overdue`, `effective_status`, `aging`.
- Money: `formatMoney(amount, currency, locale)` (`src/lib/domain/money.ts`). Dates: `formatDate(dateStr, locale)`, `formatDateTime(iso, locale)`, `today()` (`src/lib/domain/dates.ts`).

## Mutations
Server actions live in `src/lib/actions/*.ts` (`"use server"`):
- `collection.ts`: `runCycleAction`, `approveCommunicationAction({id, subject?, body?})`, `rejectCommunicationAction(id)`, `simulateReplyAction({customerId, invoiceId?, channel?, body})`, `resolveActionAction(id)`, `draftReminderAction({invoiceId, stage?, tone?, channel?})`, `setInvoiceStatusAction(id, "PAID"|"DISPUTED"|"ESCALATED"|"SENT")`, `resetDemoAction()`. All return `{ ok, error?, data? }`.
- `customers.ts`: `createCustomerAction(prev, formData)`, `updateCustomerAction(id, prev, formData)` — `useActionState` style, return `{ error?, success? }`.
- `invoices.ts`: `createInvoiceAction(prev, formData)`, `validateInvoiceCsvAction(text)`, `importInvoicesAction(text)`.
- `payments.ts`: `createPaymentAction(prev, formData)`, `matchPaymentAction(paymentId, invoiceId)`, `rejectSuggestionAction(paymentId)`, `validateBankCsvAction(text)`, `importBankCsvAction(text)`.
- `settings.ts`: `updateCompanyAction`, `updateAiSettingsAction`, `updateCommunicationSettingsAction`, `updateAutomationAction` (all `(prev, formData)`).
- Auth (`src/lib/auth/actions.ts`): `signInAction`, `signUpAction`, `demoLoginAction`, `signOutAction`, `createOrganizationAction`, `setLocaleAction`.

Client pattern for result-returning actions:
```tsx
const [pending, start] = useTransition(); const router = useRouter();
start(async () => { const r = await matchPaymentAction(p, i); r.ok ? toast.success(...) : toast.error(r.error); router.refresh(); });
```
Form pattern: `<form action={formAction}>` with `const [state, formAction] = useActionState(createCustomerAction, {})`, `<SubmitButton>` from `components/ui/submit-button`.

## UI kit (`src/components/ui`)
`Button` (variants: default | brand | outline | secondary | ghost | destructive | link; sizes sm/default/lg/icon), `Card/CardHeader/CardTitle/CardDescription/CardContent`, `Badge`, `Input`, `Textarea`, `Select` (native), `Label`, `Field` (label+hint+error wrapper), `Table*`, `Tabs*`, `Dialog*`, `Switch` (submits hidden "on"/"off" when `name` is set), `DropdownMenu*`, `Separator`, `SubmitButton`.
Shared app components (`src/components/app`): `PageHeader`, `EmptyState`, `StatCard`, `DescriptionList`, status badges (`InvoiceStatusBadge`, `PaymentStatusBadge`, `PromiseStatusBadge`, `CommStatusBadge`, `ActionStatusBadge`, `StageBadge`, `RiskBadge`, `SeverityIcon`), `RunCycleButton`, `ResetDemoButton`, `AttentionList`.

## Look & feel
Premium B2B SaaS (Stripe/Linear/Ramp feel): white/neutral background, subtle borders, rounded cards, compact tables (`text-sm`), tabular numbers (`tabular` class), clear status badges, generous spacing, **no emoji in chrome** (lucide icons only), no gradients/illustrations. Desktop-first, responsive. See `src/app/(app)/dashboard/page.tsx` as the reference page.

## Rules
- Never trust client input: validate with Zod in the server action (`src/lib/validation`).
- Never change financial state from unvalidated AI output; the services already enforce this.
- Every message send that has no provider is shown as "Simulated" — never claim delivery.
- Do not edit `src/lib/**`, `src/components/ui/**`, `src/components/app/**` or `dictionaries.ts` when working in parallel on pages; if a label is missing from the dictionary, use a small page-local `{ tr: "...", en: "..." }[locale]` map.
