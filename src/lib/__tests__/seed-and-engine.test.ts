import { describe, expect, it } from "vitest";
import { createMemoryDatabase, MemoryStore } from "@/lib/db/memory-store";
import { demoOrganizationDefaults, seedDemoData } from "@/lib/db/demo-seed";
import { planCollectionCycle } from "@/lib/ai/collection-agent";
import { computeDashboardMetrics } from "@/lib/domain/metrics";
import { today } from "@/lib/domain/dates";
import { daysOverdue, isOpen } from "@/lib/domain/invoices";

async function seeded() {
  const db = createMemoryDatabase();
  const orgId = "org-1";
  db.organizations.set(orgId, { id: orgId, created_at: new Date().toISOString(), ...demoOrganizationDefaults("Test Org", { is_demo: true }) });
  const store = new MemoryStore(orgId, db);
  await seedDemoData(store, { ownerUserId: "u1" });
  return { store, db };
}

describe("demo seed", () => {
  it("creates the promised dataset shape", async () => {
    const { store } = await seeded();
    const [customers, invoices, payments, promises, comms, actions, risks] = await Promise.all([
      store.list("customers"),
      store.list("invoices"),
      store.list("payments"),
      store.list("payment_promises"),
      store.list("communications"),
      store.list("ai_actions"),
      store.list("risk_scores"),
    ]);
    expect(customers).toHaveLength(10);
    expect(invoices).toHaveLength(30);
    expect(payments).toHaveLength(20);
    expect(promises.length).toBeGreaterThanOrEqual(3);
    expect(comms.length).toBeGreaterThan(5);
    expect(actions.length).toBeGreaterThan(5);
    expect(risks).toHaveLength(10);
    const asOf = today();
    const overdue = invoices.filter((i) => isOpen(i) && daysOverdue(i, asOf) > 0);
    expect(overdue.length).toBeGreaterThanOrEqual(5);
    expect(actions.filter((a) => a.status === "NEEDS_HUMAN").length).toBeGreaterThanOrEqual(2);
  });

  it("isolates organizations", async () => {
    const { store, db } = await seeded();
    const other = new MemoryStore("org-2", db);
    expect(await other.list("invoices")).toHaveLength(0);
    const inv = (await store.list("invoices"))[0];
    expect(await other.get("invoices", inv.id)).toBeNull();
    await expect(other.update("invoices", inv.id, { amount: 1 })).rejects.toThrow();
  });

  it("computes dashboard metrics in the reporting currency", async () => {
    const { store } = await seeded();
    const org = await store.getOrganization();
    const m = computeDashboardMetrics(await store.list("invoices"), await store.list("payments"), org, today());
    expect(m.totalReceivables).toBeGreaterThan(m.overdue);
    expect(m.overdue).toBeGreaterThan(0);
    expect(m.collectionRate).toBeGreaterThan(0);
    expect(m.collectionRate).toBeLessThanOrEqual(100);
    expect(m.aging.map((a) => a.bucket)).toEqual(["0-7", "8-30", "31-60", "61-90", "90+"]);
    expect(m.receivablesSeries).toHaveLength(12);
  });
});

describe("collection planner", () => {
  it("does not draft twice for the same stage and respects active promises", async () => {
    const { store } = await seeded();
    const rules = (await store.list("automation_rules"))[0];
    const input = { invoices: await store.list("invoices"), communications: await store.list("communications"), promises: await store.list("payment_promises"), rules, asOf: today() };
    const plan = planCollectionCycle(input);
    const kinds = plan.map((p) => p.kind);
    // Invoices with an active promise (not yet due) get no reminder
    const promised = input.promises.filter((p) => p.status === "ACTIVE").map((p) => p.invoice_id);
    for (const a of plan) if (a.kind === "REMINDER") expect(promised).not.toContain(a.invoice.id);
    // Escalation for the 48-day overdue Karadeniz invoice is already ESCALATED, so no new ESCALATE for it
    const escalated = plan.filter((a) => a.kind === "ESCALATE").map((a) => a.invoice.invoice_number);
    expect(escalated).not.toContain("INV-2026-00148");
    expect(kinds.length).toBeGreaterThan(0);
    // Running again with drafts recorded would be idempotent: simulate by marking last_reminder_stage
    const second = planCollectionCycle({ ...input, invoices: input.invoices.map((i) => ({ ...i, last_reminder_stage: plan.find((p) => p.kind === "REMINDER" && p.invoice.id === i.id)?.kind === "REMINDER" ? (plan.find((p) => p.kind === "REMINDER" && p.invoice.id === i.id) as { stage: import("@/lib/types").CollectionStage }).stage : i.last_reminder_stage })) });
    expect(second.filter((p) => p.kind === "REMINDER")).toHaveLength(0);
  });
});
