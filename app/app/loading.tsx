import { LifeOSBackground } from "@/components/layout/LifeOSBackground";

export default function AppControlRoomLoading() {
  return (
    <LifeOSBackground>
      <main id="main-content" className="min-h-screen overflow-x-hidden bg-transparent px-3 py-10 text-zinc-100 sm:px-6">
        <div className="mx-auto max-w-4xl animate-pulse space-y-4">
          <div className="h-40 rounded-2xl bg-zinc-900" />
          <div className="h-44 rounded-2xl bg-zinc-900" />
          <div className="h-44 rounded-2xl bg-zinc-900" />
        </div>
      </main>
    </LifeOSBackground>
  );
}
