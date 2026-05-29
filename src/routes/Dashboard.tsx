import { AppHeader } from "../components/AppHeader.tsx";

export function Dashboard() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-100">Events</h1>
          <button
            type="button"
            disabled
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white opacity-50"
          >
            New event
          </button>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center">
          <p className="text-sm text-slate-400">
            No events yet. Event management arrives in the next phase
            (Events &amp; Entries).
          </p>
        </div>
      </main>
    </div>
  );
}
