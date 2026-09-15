import type { DataStore } from "@/lib/db/store";

export async function audit(
  store: DataStore,
  entry: { user_id: string | null; action: string; entity_type: string; entity_id?: string | null; details?: Record<string, unknown> | null },
): Promise<void> {
  try {
    await store.insert("audit_logs", {
      user_id: entry.user_id,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      details: entry.details ?? null,
    });
  } catch (err) {
    // Audit logging must never break the business operation.
    console.error("audit log failed", err);
  }
}
