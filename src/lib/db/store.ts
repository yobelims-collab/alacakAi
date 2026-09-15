import type { OrgTableName, Organization, TableMap } from "@/lib/types";

export type Row<T extends OrgTableName> = TableMap[T];
export type NewRow<T extends OrgTableName> = Omit<
  Row<T>,
  "id" | "created_at" | "organization_id"
> & { id?: string; created_at?: string };

export interface ListOptions<T extends OrgTableName> {
  where?: Partial<Row<T>>;
  /** Column to order by, default `created_at`. */
  orderBy?: keyof Row<T> & string;
  ascending?: boolean;
  limit?: number;
}

/**
 * Organization-scoped data access. Every call is implicitly filtered by `organizationId`,
 * which is the only tenant boundary the application code has to respect. Implementations:
 * - `MemoryStore`  – demo mode / tests, process-local.
 * - `SupabaseStore` – production, backed by PostgreSQL with Row Level Security.
 */
export interface DataStore {
  readonly organizationId: string;
  readonly kind: "memory" | "supabase";

  getOrganization(): Promise<Organization>;
  updateOrganization(patch: Partial<Organization>): Promise<Organization>;

  list<T extends OrgTableName>(table: T, options?: ListOptions<T>): Promise<Row<T>[]>;
  get<T extends OrgTableName>(table: T, id: string): Promise<Row<T> | null>;
  insert<T extends OrgTableName>(table: T, row: NewRow<T>): Promise<Row<T>>;
  insertMany<T extends OrgTableName>(table: T, rows: NewRow<T>[]): Promise<Row<T>[]>;
  update<T extends OrgTableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>;
  remove<T extends OrgTableName>(table: T, id: string): Promise<void>;
  /** Danger: wipes every org-scoped row. Used by "reset demo data". */
  clearAll(): Promise<void>;
}

export const ORG_TABLES: OrgTableName[] = [
  "profiles",
  "customers",
  "customer_contacts",
  "invoices",
  "payments",
  "payment_promises",
  "communications",
  "ai_actions",
  "risk_scores",
  "automation_rules",
  "bank_transactions",
  "audit_logs",
];

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
