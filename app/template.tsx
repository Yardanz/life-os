"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

type TemplateProps = {
  children: ReactNode;
};

export default function Template({ children }: TemplateProps) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const disableTransformForRoute = pathname.startsWith("/app/settings");
  const useTransformTransition = !prefersReducedMotion && !disableTransformForRoute;

  const initial = prefersReducedMotion ? false : useTransformTransition ? { opacity: 0, y: 6 } : { opacity: 0 };
  const animate = useTransformTransition ? { opacity: 1, y: 0 } : { opacity: 1 };
  const exit = prefersReducedMotion ? undefined : useTransformTransition ? { opacity: 0, y: -4 } : { opacity: 0 };
  const transition = prefersReducedMotion
    ? undefined
    : {
        duration: 0.2,
        ease: "easeOut" as const,
      };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={initial}
        animate={animate}
        exit={exit}
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
