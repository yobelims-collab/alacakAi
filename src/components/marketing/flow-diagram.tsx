"use client";

import { forwardRef, useRef, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { Building2, FileText, Inbox, Landmark, Mail, MessageCircle } from "lucide-react";
import { LogoMark } from "@/components/app/logo";
import { AnimatedBeam } from "@/components/magicui/animated-beam";
import { cn } from "@/lib/utils";
import type { LandingCopy } from "./copy";

const Node = forwardRef<HTMLDivElement, { children: ReactNode; label: string; className?: string }>(({ children, label, className }, ref) => (
  <div className="flex flex-col items-center gap-1.5">
    <div ref={ref} className={cn("z-10 grid size-12 place-items-center rounded-xl border bg-card shadow-sm", className)}>
      {children}
    </div>
    <span className="text-center text-[11px] font-medium text-muted-foreground">{label}</span>
  </div>
));
Node.displayName = "FlowNode";

/** Invoices and bank data flow into the AI, which drafts messages that a human approves. */
export function FlowDiagram({ flow }: { flow: LandingCopy["how"]["flow"] }) {
  const reduce = useReducedMotion();
  const container = useRef<HTMLDivElement>(null);
  const engine = useRef<HTMLDivElement>(null);
  const s0 = useRef<HTMLDivElement>(null);
  const s1 = useRef<HTMLDivElement>(null);
  const s2 = useRef<HTMLDivElement>(null);
  const o0 = useRef<HTMLDivElement>(null);
  const o1 = useRef<HTMLDivElement>(null);
  const o2 = useRef<HTMLDivElement>(null);
  const beam = { containerRef: container, duration: 4, gradientStartColor: "var(--logo-from)", gradientStopColor: "var(--logo-to)" };
  const [src0, src1, src2] = flow.sources;
  const [out0, out1, out2] = flow.outputs;

  return (
    <div ref={container} className="relative mx-auto flex w-full max-w-3xl items-center justify-between gap-6 overflow-hidden rounded-2xl border bg-card/60 px-6 py-10 sm:px-12">
      <div className="flex flex-col gap-6">
        <Node ref={s0} label={src0}><Building2 className="size-5 text-foreground/80" aria-hidden /></Node>
        <Node ref={s1} label={src1}><FileText className="size-5 text-foreground/80" aria-hidden /></Node>
        <Node ref={s2} label={src2}><Landmark className="size-5 text-foreground/80" aria-hidden /></Node>
      </div>
      <Node ref={engine} label={flow.engine} className="size-16 rounded-2xl border-transparent bg-transparent shadow-lg shadow-cta-to/20">
        <LogoMark className="size-16" />
      </Node>
      <div className="flex flex-col gap-6">
        <Node ref={o0} label={out0}><Mail className="size-5 text-foreground/80" aria-hidden /></Node>
        <Node ref={o1} label={out1}><MessageCircle className="size-5 text-foreground/80" aria-hidden /></Node>
        <Node ref={o2} label={out2} className="border-brand/40"><Inbox className="size-5 text-brand" aria-hidden /></Node>
      </div>
      {!reduce && (
        <>
          <AnimatedBeam {...beam} fromRef={s0} toRef={engine} curvature={40} />
          <AnimatedBeam {...beam} fromRef={s1} toRef={engine} delay={0.4} />
          <AnimatedBeam {...beam} fromRef={s2} toRef={engine} curvature={-40} delay={0.8} />
          <AnimatedBeam {...beam} fromRef={engine} toRef={o0} curvature={40} delay={1.2} />
          <AnimatedBeam {...beam} fromRef={engine} toRef={o1} delay={1.6} />
          <AnimatedBeam {...beam} fromRef={engine} toRef={o2} curvature={-40} delay={2} />
        </>
      )}
    </div>
  );
}
