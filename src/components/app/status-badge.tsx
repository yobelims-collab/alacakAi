import { AlertTriangle, CheckCircle2, CircleAlert, CircleDot, Clock, XCircle } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { AiActionStatus, CollectionStage, CommunicationStatus, InvoiceStatus, PaymentStatus, PromiseStatus, RiskLevel, Severity } from "@/lib/types";

const INVOICE_VARIANT: Record<InvoiceStatus, BadgeVariant> = {
  DRAFT: "neutral",
  SENT: "info",
  DUE_SOON: "warning",
  DUE_TODAY: "warning",
  OVERDUE: "critical",
  PAYMENT_PROMISED: "violet",
  PARTIALLY_PAID: "info",
  PAID: "success",
  DISPUTED: "serious",
  ESCALATED: "critical",
};

const PAYMENT_VARIANT: Record<PaymentStatus | "IGNORED", BadgeVariant> = { UNMATCHED: "warning", MATCHED: "success", PARTIAL: "info", REFUND: "neutral", IGNORED: "neutral" };
const PROMISE_VARIANT: Record<PromiseStatus, BadgeVariant> = { ACTIVE: "violet", KEPT: "success", BROKEN: "critical", CANCELLED: "neutral" };
const COMM_VARIANT: Record<CommunicationStatus, BadgeVariant> = { DRAFT: "neutral", PENDING_APPROVAL: "warning", SENT_SIMULATED: "info", SENT: "success", RECEIVED: "violet", REJECTED: "neutral", FAILED: "critical" };
const ACTION_VARIANT: Record<AiActionStatus, BadgeVariant> = { COMPLETED: "success", PENDING_APPROVAL: "warning", NEEDS_HUMAN: "critical", RESOLVED: "neutral", REJECTED: "neutral" };
const RISK_VARIANT: Record<RiskLevel, BadgeVariant> = { LOW: "success", MEDIUM: "warning", HIGH: "serious", CRITICAL: "critical" };
const STAGE_VARIANT: Record<CollectionStage, BadgeVariant> = { NONE: "neutral", PRE_DUE: "info", DUE_TODAY: "warning", OVERDUE_EARLY: "warning", OVERDUE_MID: "serious", ESCALATED: "critical" };

export function InvoiceStatusBadge({ status, t }: { status: InvoiceStatus; t: Dictionary }) {
  return <Badge variant={INVOICE_VARIANT[status]}>{t.status[status]}</Badge>;
}
export function PaymentStatusBadge({ status, t }: { status: PaymentStatus | "IGNORED"; t: Dictionary }) {
  return <Badge variant={PAYMENT_VARIANT[status]}>{t.status[status]}</Badge>;
}
export function PromiseStatusBadge({ status, t }: { status: PromiseStatus; t: Dictionary }) {
  return <Badge variant={PROMISE_VARIANT[status]}>{t.status[status]}</Badge>;
}
export function CommStatusBadge({ status, t }: { status: CommunicationStatus; t: Dictionary }) {
  return <Badge variant={COMM_VARIANT[status]}>{t.status[status]}</Badge>;
}
export function ActionStatusBadge({ status, t }: { status: AiActionStatus; t: Dictionary }) {
  return <Badge variant={ACTION_VARIANT[status]}>{t.status[status]}</Badge>;
}
export function StageBadge({ stage, t }: { stage: CollectionStage; t: Dictionary }) {
  if (stage === "NONE") return <span className="text-muted-foreground">—</span>;
  return <Badge variant={STAGE_VARIANT[stage]}>{t.stage[stage]}</Badge>;
}
export function RiskBadge({ level, score, t }: { level: RiskLevel; score?: number; t: Dictionary }) {
  const Icon = level === "LOW" ? CheckCircle2 : level === "MEDIUM" ? Clock : level === "HIGH" ? CircleAlert : AlertTriangle;
  return (
    <Badge variant={RISK_VARIANT[level]}>
      <Icon />
      {t.risk[level]}
      {score !== undefined && <span className="tabular opacity-70">{score}</span>}
    </Badge>
  );
}

export function SeverityIcon({ severity, className }: { severity: Severity; className?: string }) {
  const base = `size-4 shrink-0 ${className ?? ""}`;
  switch (severity) {
    case "SUCCESS":
      return <CheckCircle2 className={`${base} text-emerald-600`} />;
    case "WARNING":
      return <AlertTriangle className={`${base} text-amber-600`} />;
    case "CRITICAL":
      return <XCircle className={`${base} text-red-600`} />;
    default:
      return <CircleDot className={`${base} text-blue-600`} />;
  }
}
