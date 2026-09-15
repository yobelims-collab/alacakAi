import type { OrgTableName, Organization } from "@/lib/types";
import { ORG_TABLES, newId, nowIso, type DataStore, type ListOptions, type NewRow, type Row } from "./store";

/**
 * Process-local database used in demo mode and in tests.
 * Rows are kept per table in insertion order; every query is filtered by organization.
 * The container is stored on `globalThis` so it survives Next.js hot reloads in development.
 */
export interface MemoryDatabase {
  organizations: Map<string, Organization>;
  tables: { [K in OrgTableName]: Row<K>[] };
  /** Demo auth: email -> { id, password, ... } */
  users: Map<string, { id: string; email: string; password: string; full_name: string }>;
  seededAt: string | null;
}

declare global {
  var __alacakaiMemoryDb: MemoryDatabase | undefined;
}

export function createMemoryDatabase(): MemoryDatabase {
  const tables = Object.fromEntries(ORG_TABLES.map((t) => [t, []])) as unknown as MemoryDatabase["tables"];
  return { organizations: new Map(), tables, users: new Map(), seededAt: null };
}

export function getMemoryDatabase(): MemoryDatabase {
  if (!globalThis.__alacakaiMemoryDb) globalThis.__alacakaiMemoryDb = createMemoryDatabase();
  return globalThis.__alacakaiMemoryDb;
}

export function resetMemoryDatabase(): MemoryDatabase {
  globalThis.__alacakaiMemoryDb = createMemoryDatabase();
  return globalThis.__alacakaiMemoryDb;
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

export class MemoryStore implements DataStore {
  readonly kind = "memory" as const;
  constructor(
    readonly organizationId: string,
    private readonly db: MemoryDatabase = getMemoryDatabase(),
  ) {}

  async getOrganization(): Promise<Organization> {
    const org = this.db.organizations.get(this.organizationId);
    if (!org) throw new Error(`Organization ${this.organizationId} not found`);
    return clone(org);
  }

  async updateOrganization(patch: Partial<Organization>): Promise<Organization> {
    const org = await this.getOrganization();
    const next = { ...org, ...patch, id: org.id };
    this.db.organizations.set(org.id, next);
    return clone(next);
  }

  private rows<T extends OrgTableName>(table: T): Row<T>[] {
    return this.db.tables[table] as Row<T>[];
  }

  async list<T extends OrgTableName>(table: T, options: ListOptions<T> = {}): Promise<Row<T>[]> {
    const where = options.where ?? {};
    let out = this.rows(table).filter((r) => r.organization_id === this.organizationId);
    for (const [k, v] of Object.entries(where)) {
      if (v === undefined) continue;
      out = out.filter((r) => (r as unknown as Record<string, unknown>)[k] === v);
    }
    const key = (options.orderBy ?? "created_at") as string;
    const dir = options.ascending ? 1 : -1;
    out = [...out].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[key] as string | number | null;
      const bv = (b as unknown as Record<string, unknown>)[key] as string | number | null;
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return av < bv ? -dir : dir;
    });
    if (options.limit) out = out.slice(0, options.limit);
    return clone(out);
  }

  async get<T extends OrgTableName>(table: T, id: string): Promise<Row<T> | null> {
    const row = this.rows(table).find((r) => r.id === id && r.organization_id === this.organizationId);
    return row ? clone(row) : null;
  }

  async insert<T extends OrgTableName>(table: T, row: NewRow<T>): Promise<Row<T>> {
    const full = {
      ...row,
      id: row.id ?? newId(),
      created_at: row.created_at ?? nowIso(),
      organization_id: this.organizationId,
    } as unknown as Row<T>;
    this.rows(table).push(full);
    return clone(full);
  }

  async insertMany<T extends OrgTableName>(table: T, rows: NewRow<T>[]): Promise<Row<T>[]> {
    const out: Row<T>[] = [];
    for (const r of rows) out.push(await this.insert(table, r));
    return out;
  }

  async update<T extends OrgTableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    const list = this.rows(table);
    const idx = list.findIndex((r) => r.id === id && r.organization_id === this.organizationId);
    if (idx < 0) throw new Error(`${table}/${id} not found`);
    const next = { ...list[idx], ...patch, id, organization_id: this.organizationId } as Row<T>;
    list[idx] = next;
    return clone(next);
  }

  async remove<T extends OrgTableName>(table: T, id: string): Promise<void> {
    const list = this.rows(table);
    const idx = list.findIndex((r) => r.id === id && r.organization_id === this.organizationId);
    if (idx >= 0) list.splice(idx, 1);
  }

  async clearAll(): Promise<void> {
    for (const t of ORG_TABLES) {
      const list = this.db.tables[t] as { organization_id: string }[];
      this.db.tables[t] = list.filter((r) => r.organization_id !== this.organizationId) as never;
    }
  }
}
