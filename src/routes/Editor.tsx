import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.tsx";
import { CenteredMessage } from "../components/CenteredMessage.tsx";
import { ClassPanel } from "../components/ClassPanel.tsx";
import { CLASS_BY_CODE, CLASSES } from "../lib/classes.ts";
import { subscribeEvent, updateEvent } from "../lib/store.ts";
import { ResultsPanel } from "../components/ResultsPanel.tsx";
import type { EventDoc } from "../lib/types.ts";

export function Editor() {
  const { eventId } = useParams();
  const [event, setEvent] = useState<EventDoc | null | undefined>(undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [mode, setMode] = useState<"setup" | "results">("setup");

  async function toggleClass(code: string, on: boolean) {
    if (!eventId || !event) return;
    const next = on
      ? CLASSES.filter(
          (c) => event.enabledClasses.includes(c.code) || c.code === code,
        ).map((c) => c.code)
      : event.enabledClasses.filter((c) => c !== code);
    if (!on && selected === code) {
      setSelected(next[0] ?? null);
    }
    await updateEvent(eventId, { enabledClasses: next });
  }

  useEffect(() => {
    if (!eventId) return;
    const unsub = subscribeEvent(eventId, (ev) => {
      setEvent(ev);
      setSelected((prev) => prev ?? ev?.enabledClasses[0] ?? null);
    });
    return unsub;
  }, [eventId]);

  if (event === undefined) {
    return <CenteredMessage>Loading event…</CenteredMessage>;
  }

  if (!event || !eventId) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <Link to="/" className="text-sm text-sky-400 hover:text-sky-300">
            ← Back to events
          </Link>
          <p className="mt-6 text-sm text-slate-400">Event not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link to="/" className="text-sm text-sky-400 hover:text-sky-300">
          ← Back to events
        </Link>
        <div className="mt-3 mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">{event.name}</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {event.eventCode ? `${event.eventCode} · ` : ""}
              {event.year} · {event.enabledClasses.length} classes
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-700 text-sm">
              {(["setup", "results"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 capitalize ${
                    mode === m
                      ? "bg-sky-600 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {mode === "setup" && (
              <button
                type="button"
                onClick={() => setManageOpen((v) => !v)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              >
                {manageOpen ? "Done" : "Manage classes"}
              </button>
            )}
          </div>
        </div>

        {mode === "results" ? (
          <ResultsPanel eventId={eventId} event={event} />
        ) : (
          <>
        {manageOpen && (
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="mb-3 text-xs text-slate-400">
              Enable the classes running at this event.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {CLASSES.map((c) => {
                const on = event.enabledClasses.includes(c.code);
                return (
                  <label
                    key={c.code}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 hover:border-slate-600"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => toggleClass(c.code, e.target.checked)}
                      className="accent-sky-500"
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[200px_1fr]">
          <nav className="space-y-1">
            {event.enabledClasses.map((code) => {
              const cfg = CLASS_BY_CODE[code];
              if (!cfg) return null;
              const active = selected === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setSelected(code)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                    active
                      ? "bg-sky-600 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span className="truncate">{cfg.name}</span>
                  <span
                    className={`ml-2 shrink-0 text-xs ${active ? "text-sky-100" : "text-slate-500"}`}
                  >
                    {code}
                  </span>
                </button>
              );
            })}
          </nav>

          {selected ? (
            <ClassPanel
              key={selected}
              eventId={eventId}
              event={event}
              classCode={selected}
            />
          ) : (
            <p className="text-sm text-slate-400">
              No classes enabled for this event.
            </p>
          )}
        </div>
          </>
        )}
      </main>
    </div>
  );
}
