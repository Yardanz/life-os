"use client";

import { useState } from "react";

type ErrorIdNoticeProps = {
  message: string;
  errorId: string;
  className?: string;
};

export function ErrorIdNotice({ message, errorId, className }: ErrorIdNoticeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(errorId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={className ?? "rounded-md border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200"}>
      <p>{message}</p>
      <div className="mt-1 flex items-center gap-2">
        <span>Error ID: {errorId}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-rose-400/40 px-1.5 py-0.5 text-[10px] text-rose-100 hover:border-rose-300"
        >
          Copy
        </button>
        {copied ? <span className="text-[10px] text-emerald-300">Copied</span> : null}
      </div>
    </div>
  );
}
