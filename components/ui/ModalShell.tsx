"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalShellRenderArgs = {
  requestClose: (afterClose?: () => void) => void;
};

type ModalShellProps = {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  panelClassName?: string;
  children: ReactNode | ((args: ModalShellRenderArgs) => ReactNode);
};

const CLOSE_ANIMATION_MS = 180;
const BODY_SCROLL_LOCK_KEY = "__lifeosModalScrollLock";

type BodyScrollLockState = {
  count: number;
  previousOverflow: string;
  previousPaddingRight: string;
};

export function ModalShell({ open, onClose, ariaLabel, panelClassName, children }: ModalShellProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const restoreTargetRef = useRef<HTMLElement | null>(null);

  const requestClose = useCallback(
    (afterClose?: () => void) => {
      if (isClosing) return;
      setIsClosing(true);
      window.setTimeout(() => {
        setIsClosing(false);
        afterClose?.();
        onClose();
      }, CLOSE_ANIMATION_MS);
    },
    [isClosing, onClose]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    restoreTargetRef.current = active instanceof HTMLElement ? active : null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const lockStore = window as Window & {
      [BODY_SCROLL_LOCK_KEY]?: BodyScrollLockState;
    };
    const current =
      lockStore[BODY_SCROLL_LOCK_KEY] ??
      ({
        count: 0,
        previousOverflow: "",
        previousPaddingRight: "",
      } satisfies BodyScrollLockState);

    if (current.count === 0) {
      current.previousOverflow = body.style.overflow;
      current.previousPaddingRight = body.style.paddingRight;

      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      const existingPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight || "0") || 0;

      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${existingPaddingRight + scrollbarWidth}px`;
      }
    }

    current.count += 1;
    lockStore[BODY_SCROLL_LOCK_KEY] = current;

    return () => {
      const active = lockStore[BODY_SCROLL_LOCK_KEY];
      if (!active) return;

      active.count = Math.max(0, active.count - 1);
      if (active.count === 0) {
        body.style.overflow = active.previousOverflow;
        body.style.paddingRight = active.previousPaddingRight;
        delete lockStore[BODY_SCROLL_LOCK_KEY];
      } else {
        lockStore[BODY_SCROLL_LOCK_KEY] = active;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const getFocusable = () => {
      if (!panelRef.current) return [] as HTMLElement[];
      const nodes = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      return Array.from(nodes).filter((node) => !node.hasAttribute("disabled") && node.getAttribute("aria-hidden") !== "true");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, requestClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const focusable = panelRef.current.querySelector<HTMLElement>(
      '[data-autofocus], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const frame = window.requestAnimationFrame(() => {
      (focusable ?? panelRef.current)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (open) return;
    const restoreTarget = restoreTargetRef.current;
    if (!restoreTarget) return;
    if (document.contains(restoreTarget)) {
      window.requestAnimationFrame(() => restoreTarget.focus());
    }
  }, [open]);

  if (!open || !isMounted) return null;

  const content =
    typeof children === "function"
      ? (children as (args: ModalShellRenderArgs) => ReactNode)({ requestClose })
      : children;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close modal"
        onClick={() => requestClose()}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${
          isClosing ? "animate-[overlayOut_180ms_ease-in_forwards]" : "animate-[overlayIn_180ms_ease-out]"
        }`}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        ref={panelRef}
        className={`relative w-full max-h-[90vh] overflow-hidden rounded-2xl border border-cyan-400/25 bg-zinc-900/90 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_24px_60px_rgba(0,0,0,0.55)] ${
          isClosing ? "animate-[modalOut_180ms_ease-in_forwards]" : "animate-[modalIn_180ms_ease-out]"
        } ${panelClassName ?? "max-w-2xl p-4 sm:p-6"}`}
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.12),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(14,116,144,0.2),transparent_40%)]" />
        <div className="relative max-h-[90vh] overflow-y-auto">{content}</div>
      </section>
    </div>,
    document.body
  );
}
