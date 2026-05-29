import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.tsx";

export function Editor() {
  const { eventId } = useParams();

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link to="/" className="text-sm text-sky-400 hover:text-sky-300">
          ← Back to events
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-slate-100">
          Event {eventId}
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Run-sequence editor, entries, sessions, and results land in upcoming
          phases.
        </p>
      </main>
    </div>
  );
}
