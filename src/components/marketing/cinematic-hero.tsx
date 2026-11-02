import { DotPattern } from "@/components/magicui/dot-pattern";
import type { LandingCopy } from "./copy";

/**
 * Optional looping background video. Point it at a clip you own (e.g. /brand/hero.mp4 in
 * `public/`) via NEXT_PUBLIC_HERO_VIDEO_URL; without it the animated backdrop is shown.
 */
const HERO_VIDEO = process.env.NEXT_PUBLIC_HERO_VIDEO_URL ?? "";

function Backdrop() {
  if (HERO_VIDEO) {
    return <video className="absolute inset-0 h-full w-full object-cover opacity-70" src={HERO_VIDEO} autoPlay loop muted playsInline aria-hidden />;
  }
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="aurora-a absolute -left-[15%] top-[5%] h-[70vh] w-[70vw] rounded-full bg-[radial-gradient(closest-side,rgba(45,199,138,0.38),transparent)] blur-3xl" />
      <div className="aurora-b absolute -right-[10%] bottom-[0%] h-[75vh] w-[65vw] rounded-full bg-[radial-gradient(closest-side,rgba(11,165,196,0.34),transparent)] blur-3xl" />
      <DotPattern width={26} height={26} cr={1} className="fill-white/[0.07] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_45%,#000_30%,transparent_100%)]" />
    </div>
  );
}

function Stat({ value, label, align, divider }: { value: string; label: string; align: "left" | "right"; divider: "rotate-[20deg]" | "rotate-[-20deg]" }) {
  const line = <span aria-hidden className={`hidden h-px w-24 bg-white/40 md:block ${divider}`} />;
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className={`flex items-center gap-3 ${align === "right" ? "justify-end" : ""}`}>
        {align === "right" && line}
        <span className="text-4xl font-medium tracking-tight md:text-5xl">{value}</span>
        {align === "left" && line}
      </div>
      <p className={`mt-1 max-w-[150px] text-xs text-white/70 md:max-w-[220px] md:text-sm ${align === "right" ? "ml-auto" : ""}`}>{label}</p>
    </div>
  );
}

/** Full-screen opening section: giant staggered words, a short line and three product facts. */
export function CinematicHero({ copy }: { copy: LandingCopy["hero"] }) {
  const [w1, w2, w3] = copy.words;
  const [s1, s2, s3] = copy.stats;
  return (
    <section className="relative h-screen min-h-[620px] w-full overflow-hidden bg-[#07111f] text-white">
      <Backdrop />

      <div className="relative h-full w-full">
        <h1 className="sr-only">{copy.headline}</h1>
        <p aria-hidden className="hero-title absolute left-4 top-[18%] text-[14vw] font-medium md:left-10 md:text-[13vw]">{w1}</p>
        <p aria-hidden className="hero-title absolute right-4 top-[38%] text-[14vw] font-medium md:right-10 md:text-[13vw]">{w2}</p>
        <p aria-hidden className="hero-title text-logo-gradient absolute left-[18%] top-[58%] pb-[0.08em] text-[14vw] font-medium md:left-[28%] md:text-[13vw]">{w3}</p>

        <p className="absolute left-6 top-[46%] max-w-[250px] text-[15px] leading-snug text-white/90 md:left-10">{copy.short}</p>

        <div className="absolute right-6 top-[14%] md:right-24">
          <Stat value={s1.value} label={s1.label} align="right" divider="rotate-[20deg]" />
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-b from-transparent to-[#07111f]" />

        <div className="absolute bottom-20 left-6 md:bottom-24 md:left-20">
          <Stat value={s2.value} label={s2.label} align="left" divider="rotate-[-20deg]" />
        </div>
        <div className="absolute bottom-16 right-6 md:bottom-20 md:right-20">
          <Stat value={s3.value} label={s3.label} align="right" divider="rotate-[-20deg]" />
        </div>
      </div>
    </section>
  );
}

export { PillNav } from "./pill-nav";
