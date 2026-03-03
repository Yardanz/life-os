import { Suspense } from "react";
import { DailyCheckinForm } from "@/components/checkin/DailyCheckinForm";
import { LifeOSBackground } from "@/components/layout/LifeOSBackground";

export default function CheckinPage() {
  return (
    <LifeOSBackground>
      <main className="min-h-screen px-4 py-10 text-zinc-100 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Life OS</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-100 sm:text-3xl">Daily Check-In</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Enter today&apos;s metrics and update the control room state.
            </p>
          </div>

          <section className="rounded-2xl border border-cyan-400/20 bg-zinc-900/65 p-4 shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_24px_48px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-6">
            <Suspense fallback={<div className="text-sm text-zinc-300">Loading check-in...</div>}>
              <DailyCheckinForm />
            </Suspense>
          </section>
        </div>
      </main>
    </LifeOSBackground>
  );
}
