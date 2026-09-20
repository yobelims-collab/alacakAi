"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";

/** Subtle entrance for a block; keep motion restrained (this is a finance product). */
export function FadeIn({ children, delay = 0, className, ...rest }: { children: ReactNode; delay?: number; className?: string } & HTMLMotionProps<"div">) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay, ease: "easeOut" }} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

/** Animated number for stat tiles: counts from 0 to the formatted value on mount. */
export function CountUp({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0.3 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {format(value)}
    </motion.span>
  );
}
