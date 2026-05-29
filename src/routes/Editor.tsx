import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.tsx";
import { CenteredMessage } from "../components/CenteredMessage.tsx";
import { ClassPanel } from "../components/ClassPanel.tsx";
import { CLASS_BY_CODE } from "../lib/classes.ts";
import { subscribeEvent } from "../lib/store.ts";
import type { EventDoc } from "../lib/types.ts";

export function Editor() {
  const { eventId } = useParams();
  const [event, setEvent] = useState<EventDoc | null | undefined>(undefined);
  const [selected, setSelected] = useState<string | null>(null);

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
        <div className="mt-3 mb-6">
          <h1 className="text-xl font-semibold text-slate-100">{event.name}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {event.eventCode ? `${event.eventCode} · ` : ""}
            {event.year}
          </p>
        </div>

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
      </main>
    </div>
  );
}
