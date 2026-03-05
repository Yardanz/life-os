"use client";

type UnlockNoticeProps = {
  message: string | null;
  onClose: () => void;
};

export function UnlockNotice({ message, onClose }: UnlockNoticeProps) {
  if (!message) return null;

  return (
    <section className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-cyan-100">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 transition hover:border-zinc-500"
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}
