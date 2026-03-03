"use client";

import type { ReactNode } from "react";

type SmoothScrollButtonProps = {
  targetId: string;
  headingId?: string;
  highlightClassName?: string;
  highlightDurationMs?: number;
  className?: string;
  children: ReactNode;
};

export function SmoothScrollButton({
  targetId,
  headingId,
  highlightClassName = "landing-section-highlight",
  highlightDurationMs = 720,
  className,
  children,
}: SmoothScrollButtonProps) {
  const handleScroll = () => {
    const section = document.getElementById(targetId);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (section) {
      section.classList.add(highlightClassName);
      window.setTimeout(() => {
        section.classList.remove(highlightClassName);
      }, highlightDurationMs);
    }

    if (headingId) {
      window.setTimeout(() => {
        const heading = document.getElementById(headingId);
        if (heading instanceof HTMLElement) {
          heading.focus({ preventScroll: true });
        }
      }, 320);
    }
  };

  return (
    <button type="button" onClick={handleScroll} className={className}>
      {children}
    </button>
  );
}
