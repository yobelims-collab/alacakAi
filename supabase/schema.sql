-- Alacore — PostgreSQL schema for Supabase.
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- Every organization-scoped table carries organization_id and is protected by Row Level Security:
-- a user can only touch rows whose organization_id equals the organization on their own profile.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enumerated types (kept as text + check constraints so the app's TS unions stay the source of truth)
-- ---------------------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  logo_url text,
  address text,
  tax_number text,
  default_currency text not null default 'TRY',
  reporting_currency text not null default 'TRY',
  fx_rates jsonb not null default '{"TRY":1}'::jsonb,
  default_payment_terms_days int not null default 30,
  language text not null default 'tr' check (language in ('tr','en')),
  is_demo boolean not null default false,
  ai_auto_send boolean not null default false,
  ai_confidence_threshold numeric not null default 0.75,
  ai_default_tone text not null default 'PROFESSIONAL' check (ai_default_tone in ('POLITE','PROFESSIONAL','FIRM')),
  ai_signature text,
  sender_name text,
  sender_email text,
  whatsapp_number text,
  grade_rules jsonb not null default '{}'::jsonb,
  approval_amount_threshold numeric not null default 250000
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'OWNER' check (role in ('OWNER','ADMIN','FINANCE','SALES','VIEWER'))
);
create index if not exists profiles_org_idx on public.profiles(organization_id);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_name text not null,
  contact_person text,
  email text,
  phone text,
  whatsapp_number text,
  country text,
  preferred_language text not null default 'tr' check (preferred_language in ('tr','en')),
  payment_terms_days int not null default 30,
  credit_limit numeric,
  currency text not null default 'TRY',
  notes text,
  account_manager_id uuid,
  shipments_on_hold boolean not null default false
);
create index if not exists customers_org_idx on public.customers(organization_id);

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text,
  is_primary boolean not null default false
);
create index if not exists customer_contacts_org_idx on public.customer_contacts(organization_id);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  invoice_number text not null,
  invoice_date date not null,
  due_date date not null,
  currency text not null,
  amount numeric not null check (amount >= 0),
  paid_amount numeric not null default 0 check (paid_amount >= 0),
  status text not null default 'SENT' check (status in ('DRAFT','SENT','DUE_SOON','DUE_TODAY','OVERDUE','PAYMENT_PROMISED','PARTIALLY_PAID','PAID','DISPUTED','ESCALATED')),
  collection_stage text not null default 'NONE' check (collection_stage in ('NONE','PRE_DUE','DUE_TODAY','OVERDUE_EARLY','OVERDUE_MID','ESCALATED')),
  assigned_user_id uuid,
  description text,
  last_reminder_stage text,
  last_reminder_at timestamptz,
  updated_at timestamptz not null default now(),
  document_path text,
  document_name text,
  external_ref text,
  source text not null default 'MANUAL',
  unique (organization_id, invoice_number)
);
create index if not exists invoices_org_idx on public.invoices(organization_id);
create index if not exists invoices_customer_idx on public.invoices(customer_id);
create index if not exists invoices_due_idx on public.invoices(organization_id, due_date);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  payment_date date not null,
  amount numeric not null,
  currency text not null,
  reference text,
  matched_invoice_id uuid references public.invoices(id) on delete set null,
  status text not null default 'UNMATCHED' check (status in ('UNMATCHED','MATCHED','PARTIAL','REFUND')),
  source text not null default 'MANUAL' check (source in ('MANUAL','BANK_IMPORT','DEMO')),
  bank_transaction_id uuid,
  suggested_invoice_id uuid,
  suggested_confidence numeric,
  suggestion_reasons jsonb
);
create index if not exists payments_org_idx on public.payments(organization_id);

create table if not exists public.payment_promises (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  promised_date date not null,
  amount numeric,
  currency text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','KEPT','BROKEN','CANCELLED')),
  source_communication_id uuid,
  notes text,
  resolved_at timestamptz
);
create index if not exists payment_promises_org_idx on public.payment_promises(organization_id);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  channel text not null check (channel in ('EMAIL','WHATSAPP')),
  direction text not null check (direction in ('OUTBOUND','INBOUND')),
  subject text,
  body text not null,
  language text not null default 'tr',
  stage text,
  tone text,
  status text not null check (status in ('DRAFT','PENDING_APPROVAL','SENT_SIMULATED','SENT','RECEIVED','REJECTED','FAILED')),
  classification jsonb,
  ai_generated boolean not null default false,
  generator text,
  sent_at timestamptz,
  provider_message_id text,
  next_action_at date,
  next_action_note text,
  in_reply_to uuid,
  alternatives jsonb,
  snoozed_until date,
  routed_to text,
  approval_reason text
);
create index if not exists communications_org_idx on public.communications(organization_id);
create index if not exists communications_customer_idx on public.communications(customer_id);

create table if not exists public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  communication_id uuid references public.communications(id) on delete set null,
  type text not null,
  status text not null check (status in ('COMPLETED','PENDING_APPROVAL','NEEDS_HUMAN','RESOLVED','REJECTED')),
  severity text not null check (severity in ('INFO','SUCCESS','WARNING','CRITICAL')),
  title text not null,
  description text,
  recommended_action text,
  payload jsonb,
  resolved_at timestamptz,
  resolved_by uuid,
  routed_to text,
  decision text
);
create index if not exists ai_actions_org_idx on public.ai_actions(organization_id, created_at desc);

create table if not exists public.risk_scores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  score int not null check (score between 0 and 100),
  level text not null check (level in ('LOW','MEDIUM','HIGH','CRITICAL')),
  reasons jsonb not null default '[]'::jsonb,
  recommendation text not null default '',
  factors jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  grade text not null default 'C' check (grade in ('A','B','C','D','E')),
  facts jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  unique (organization_id, customer_id)
);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pre_due_enabled boolean not null default true,
  pre_due_days int not null default 3,
  due_date_enabled boolean not null default true,
  overdue_enabled boolean not null default true,
  first_reminder_days int not null default 1,
  second_reminder_days int not null default 7,
  escalation_days int not null default 30,
  channels jsonb not null default '["EMAIL"]'::jsonb,
  require_approval boolean not null default true,
  auto_send_pre_due boolean not null default true,
  sales_involved_after_days int not null default 14
);
create index if not exists automation_rules_org_idx on public.automation_rules(organization_id);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_date date not null,
  description text,
  reference text,
  amount numeric not null,
  currency text not null,
  status text not null default 'UNMATCHED' check (status in ('UNMATCHED','MATCHED','IGNORED')),
  matched_invoice_id uuid,
  payment_id uuid
);
create index if not exists bank_transactions_org_idx on public.bank_transactions(organization_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb
);
create index if not exists audit_logs_org_idx on public.audit_logs(organization_id, created_at desc);

-- Upgrades for databases created before these columns existed (idempotent).
alter table public.organizations add column if not exists grade_rules jsonb not null default '{}'::jsonb;
alter table public.organizations add column if not exists approval_amount_threshold numeric not null default 250000;
alter table public.customers add column if not exists shipments_on_hold boolean not null default false;
alter table public.communications add column if not exists in_reply_to uuid;
alter table public.communications add column if not exists alternatives jsonb;
alter table public.communications add column if not exists snoozed_until date;
alter table public.communications add column if not exists routed_to text;
alter table public.communications add column if not exists approval_reason text;
alter table public.ai_actions add column if not exists routed_to text;
alter table public.ai_actions add column if not exists decision text;
alter table public.risk_scores add column if not exists grade text not null default 'C';
alter table public.risk_scores add column if not exists facts jsonb not null default '[]'::jsonb;
alter table public.risk_scores add column if not exists history jsonb not null default '[]'::jsonb;
alter table public.automation_rules add column if not exists auto_send_pre_due boolean not null default true;
alter table public.automation_rules add column if not exists sales_involved_after_days int not null default 14;
alter table public.invoices add column if not exists document_path text;
alter table public.invoices add column if not exists document_name text;
alter table public.invoices add column if not exists external_ref text;
alter table public.invoices add column if not exists source text not null default 'MANUAL';

-- Private bucket for invoice PDFs (accessed only server-side with the service role key).
insert into storage.buckets (id, name, public) values ('invoice-docs', 'invoice-docs', false) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Tenant helper + organization creation (the only way a user obtains an organization)
-- ---------------------------------------------------------------------------

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.create_organization(
  p_name text,
  p_default_currency text default 'TRY',
  p_payment_terms int default 30,
  p_language text default 'tr',
  p_full_name text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'user already belongs to an organization';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into public.organizations (name, default_currency, reporting_currency, default_payment_terms_days, language)
  values (p_name, p_default_currency, p_default_currency, p_payment_terms, p_language)
  returning id into v_org;
  insert into public.profiles (id, organization_id, email, full_name, role)
  values (auth.uid(), v_org, coalesce(v_email, ''), coalesce(p_full_name, ''), 'OWNER');
  insert into public.automation_rules (organization_id) values (v_org);
  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, int, text, text) from public;
grant execute on function public.create_organization(text, text, int, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to authenticated using (id = public.current_org_id());
drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations for update to authenticated using (id = public.current_org_id()) with check (id = public.current_org_id());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (organization_id = public.current_org_id() or id = auth.uid());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and organization_id = public.current_org_id());

do $$
declare
  t text;
begin
  foreach t in array array['customers','customer_contacts','invoices','payments','payment_promises','communications','ai_actions','risk_scores','automation_rules','bank_transactions','audit_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (organization_id = public.current_org_id())', t || '_tenant_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (organization_id = public.current_org_id())', t || '_tenant_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id())', t || '_tenant_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (organization_id = public.current_org_id())', t || '_tenant_delete', t);
  end loop;
end $$;

-- Service role (used only by server-side cron/webhooks with the secret key) bypasses RLS by design.
