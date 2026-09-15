import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgTableName, Organization } from "@/lib/types";
import { ORG_TABLES, type DataStore, type ListOptions, type NewRow, type Row } from "./store";

/**
 * Supabase-backed store. The client is the *user's* session client, so PostgreSQL
 * Row Level Security enforces the tenant boundary even if application code forgets a filter.
 * We still filter by organization_id explicitly for clarity and for the service-role client.
 */
export class SupabaseStore implements DataStore {
  readonly kind = "supabase" as const;
  constructor(
    readonly organizationId: string,
    private readonly client: SupabaseClient,
  ) {}

  async getOrganization(): Promise<Organization> {
    const { data, error } = await this.client
      .from("organizations")
      .select("*")
      .eq("id", this.organizationId)
      .single();
    if (error) throw new Error(`organizations: ${error.message}`);
    return data as Organization;
  }

  async updateOrganization(patch: Partial<Organization>): Promise<Organization> {
    const { id: _id, created_at: _c, ...safe } = patch;
    void _id;
    void _c;
    const { data, error } = await this.client
      .from("organizations")
      .update(safe)
      .eq("id", this.organizationId)
      .select("*")
      .single();
    if (error) throw new Error(`organizations: ${error.message}`);
    return data as Organization;
  }

  async list<T extends OrgTableName>(table: T, options: ListOptions<T> = {}): Promise<Row<T>[]> {
    let q = this.client.from(table).select("*").eq("organization_id", this.organizationId);
    for (const [k, v] of Object.entries(options.where ?? {})) {
      if (v === undefined) continue;
      q = v === null ? q.is(k, null) : q.eq(k, v as never);
    }
    q = q.order(options.orderBy ?? "created_at", { ascending: options.ascending ?? false });
    if (options.limit) q = q.limit(options.limit);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []) as Row<T>[];
  }

  async get<T extends OrgTableName>(table: T, id: string): Promise<Row<T> | null> {
    const { data, error } = await this.client
      .from(table)
      .select("*")
      .eq("organization_id", this.organizationId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data as Row<T>) ?? null;
  }

  async insert<T extends OrgTableName>(table: T, row: NewRow<T>): Promise<Row<T>> {
    const [out] = await this.insertMany(table, [row]);
    return out;
  }

  async insertMany<T extends OrgTableName>(table: T, rows: NewRow<T>[]): Promise<Row<T>[]> {
    if (rows.length === 0) return [];
    const payload = rows.map((r) => ({ ...r, organization_id: this.organizationId }));
    const { data, error } = await this.client.from(table).insert(payload).select("*");
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []) as Row<T>[];
  }

  async update<T extends OrgTableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    const { id: _id, organization_id: _o, created_at: _c, ...safe } = patch as Record<string, unknown>;
    void _id;
    void _o;
    void _c;
    const { data, error } = await this.client
      .from(table)
      .update(safe)
      .eq("organization_id", this.organizationId)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(`${table}: ${error.message}`);
    return data as Row<T>;
  }

  async remove<T extends OrgTableName>(table: T, id: string): Promise<void> {
    const { error } = await this.client
      .from(table)
      .delete()
      .eq("organization_id", this.organizationId)
      .eq("id", id);
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  async clearAll(): Promise<void> {
    // Reverse order so FK children go first.
    for (const t of [...ORG_TABLES].reverse()) {
      if (t === "profiles") continue;
      const { error } = await this.client.from(t).delete().eq("organization_id", this.organizationId);
      if (error) throw new Error(`${t}: ${error.message}`);
    }
  }
}
