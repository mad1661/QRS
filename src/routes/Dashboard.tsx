import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.tsx";
import { useAuth } from "../lib/auth.tsx";
import {
  createEvent,
  deleteEvent,
  renameEvent,
  subscribeEvents,
} from "../lib/store.ts";
import { NHRA_2025_SCHEDULE, SCHEDULE_BY_CODE } from "../lib/schedule.ts";
import type { EventDoc } from "../lib/types.ts";

function formatStamp(stamp: EventDoc["updatedAt"]): string {
  if (!stamp) return "—";
  try {
    return stamp.toDate().toLocaleDateString();
  } catch {
    return "—";
  }
}

export function Dashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = subscribeEvents(
      (next) => {
        setEvents(next);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const currentYear = new Date().getFullYear();
  const [name, setName] = useState("");
  const [eventCode, setEventCode] = useState("");
  const [year, setYear] = useState(currentYear);

  function pickScheduled(code: string) {
    setEventCode(code);
    const sched = SCHEDULE_BY_CODE[code];
    if (sched) setName(sched.name);
  }

  const grouped = useMemo(() => {
    const byYear = new Map<number, EventDoc[]>();
    for (const e of events) {
      const list = byYear.get(e.year) ?? [];
      list.push(e);
      byYear.set(e.year, list);
    }
    return [...byYear.entries()].sort((a, b) => b[0] - a[0]);
  }, [events]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createEvent(
        { uid: user.uid, email: user.email },
        { name, eventCode, year },
      );
      setName("");
      setEventCode("");
      setYear(currentYear);
      setShowNew(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(ev: EventDoc) {
    const next = window.prompt("Rename event", ev.name);
    if (next == null || !next.trim() || next.trim() === ev.name) return;
    try {
      await renameEvent(ev.id, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed");
    }
  }

  async function handleDelete(ev: EventDoc) {
    if (!window.confirm(`Delete "${ev.name}" and all of its entries?`)) return;
    try {
      await deleteEvent(ev.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-100">Events</h1>
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            {showNew ? "Cancel" : "New event"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {showNew && (
          <form
            onSubmit={handleCreate}
            className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
          >
            <label className="mb-3 block">
              <span className="mb-1 block text-xs text-slate-400">
                Pick from 2025 schedule (optional)
              </span>
              <select
                value={SCHEDULE_BY_CODE[eventCode] ? eventCode : ""}
                onChange={(e) => pickScheduled(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
              >
                <option value="">— Custom event —</option>
                {NHRA_2025_SCHEDULE.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-[1fr_140px_120px_auto]">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Event name (e.g. NHRA Gatornationals)"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
              />
              <input
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value)}
                placeholder="Code (01-GF1)"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
              />
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Loading events…</p>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center">
            <p className="text-sm text-slate-400">
              No events yet. Click <span className="text-slate-200">New event</span> to
              create your first race weekend.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(([yr, list]) => (
              <section key={yr}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {yr}
                </h2>
                <ul className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
                  {list.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-900"
                    >
                      <Link to={`/events/${ev.id}`} className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-100">
                          {ev.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {ev.eventCode ? `${ev.eventCode} · ` : ""}
                          {ev.enabledClasses.length} classes · updated{" "}
                          {formatStamp(ev.updatedAt)}
                        </p>
                      </Link>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRename(ev)}
                          className="rounded-md px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(ev)}
                          className="rounded-md px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-950/60 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
