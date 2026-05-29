import { useEffect, useMemo, useState } from "react";
import {
  addEntry,
  deleteEntry,
  subscribeClassEntries,
  subscribeClassRuns,
  updateEntry,
  updateEvent,
} from "../lib/store.ts";
import { CLASS_BY_CODE, laneRotation } from "../lib/classes.ts";
import { STANDINGS_CLASSES } from "../lib/functions.ts";
import { computeLiveOrder } from "../lib/results.ts";
import type { EntryDoc, EventDoc, RunDoc } from "../lib/types.ts";
import { ImportEntries } from "./ImportEntries.tsx";
import { SequenceView } from "./SequenceView.tsx";
import { LiveOrder } from "./LiveOrder.tsx";
import { SeedFromStandings } from "./SeedFromStandings.tsx";

interface Props {
  eventId: string;
  event: EventDoc;
  classCode: string;
}

function sortEntries(entries: EntryDoc[]): EntryDoc[] {
  return [...entries].sort((a, b) => {
    // Manual seed wins, then higher points, then driver name.
    if (a.seed != null && b.seed != null) return a.seed - b.seed;
    if (a.seed != null) return -1;
    if (b.seed != null) return 1;
    const ap = a.points ?? -Infinity;
    const bp = b.points ?? -Infinity;
    if (ap !== bp) return bp - ap;
    return a.driverName.localeCompare(b.driverName);
  });
}

export function ClassPanel({ eventId, event, classCode }: Props) {
  const cfg = CLASS_BY_CODE[classCode];
  const [entries, setEntries] = useState<EntryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [carNumber, setCarNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [points, setPoints] = useState("");
  const [showSeed, setShowSeed] = useState(false);
  const [view, setView] = useState<"entries" | "sequence">("entries");
  const [runs, setRuns] = useState<RunDoc[]>([]);

  useEffect(() => {
    const unsub = subscribeClassRuns(eventId, classCode, setRuns);
    return unsub;
  }, [eventId, classCode]);

  const canSeed = (STANDINGS_CLASSES as readonly string[]).includes(classCode);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeClassEntries(
      eventId,
      classCode,
      (next) => {
        setEntries(sortEntries(next));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [eventId, classCode]);

  const sessions = event.sessionsByClass[classCode] ?? 4;
  const rotation = useMemo(
    () => (cfg ? laneRotation(cfg.laneGroup, sessions) : undefined),
    [cfg, sessions],
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!driverName.trim() && !carNumber.trim()) return;
    setError(null);
    try {
      await addEntry(eventId, {
        classCode,
        carNumber,
        driverName,
        points: points.trim() === "" ? null : Number(points),
      });
      setCarNumber("");
      setDriverName("");
      setPoints("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add entry");
    }
  }

  async function patch(entry: EntryDoc, field: keyof EntryDoc, value: unknown) {
    try {
      await updateEntry(eventId, entry.id, { [field]: value });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function setSessions(n: number) {
    try {
      await updateEvent(eventId, {
        sessionsByClass: { ...event.sessionsByClass, [classCode]: n },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function reseedFromLive() {
    if (!cfg) return;
    const order = computeLiveOrder(runs, cfg.finishDistance);
    const byCar = new Map(entries.map((e) => [e.carNumber, e]));
    await Promise.all(
      order.map((row, i) => {
        const entry = byCar.get(row.carNumber);
        if (!entry || entry.seed === i + 1) return Promise.resolve();
        return updateEntry(eventId, entry.id, { seed: i + 1 });
      }),
    );
  }

  if (!cfg) return <p className="text-sm text-slate-400">Unknown class.</p>;

  const sessionOptions = cfg.laneGroup === "A" ? [2, 3, 4, 5] : [2, 3];
  const liveOrder = computeLiveOrder(runs, cfg.finishDistance);

  return (
    <div className="space-y-5">
      {showSeed && (
        <SeedFromStandings
          eventId={eventId}
          classCode={classCode}
          year={event.year}
          existingCount={entries.length}
          onClose={() => setShowSeed(false)}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{cfg.name}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {cfg.finishDistance} ft · lane group {cfg.laneGroup} · {entries.length}{" "}
            entries
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canSeed && (
            <button
              type="button"
              onClick={() => setShowSeed(true)}
              className="rounded-lg border border-sky-700 bg-sky-600/20 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-600/30"
            >
              Seed from standings
            </button>
          )}
          <label className="text-xs text-slate-400">
            Sessions
            <select
              value={sessions}
              onChange={(e) => setSessions(Number(e.target.value))}
              className="ml-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
            >
              {sessionOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs text-slate-400">
            Rotation:{" "}
            <span className="font-mono text-slate-200">
              {rotation
                ? rotation.map((l) => (l === "?" ? "?" : l)).join("-")
                : "—"}
            </span>
            {rotation?.includes("?") && (
              <span className="ml-1 text-slate-500">(Q3 by time)</span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="inline-flex overflow-hidden rounded-lg border border-slate-700 text-sm">
        {(["entries", "sequence"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`px-4 py-1.5 capitalize ${
              view === v
                ? "bg-sky-600 text-white"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {v === "sequence" ? "Run sequence" : "Entries"}
          </button>
        ))}
      </div>

      {runs.length > 0 && (
        <LiveOrder
          rows={liveOrder}
          finishDistance={cfg.finishDistance}
          onReseed={reseedFromLive}
        />
      )}

      {view === "sequence" ? (
        <SequenceView
          entries={entries}
          group={cfg.laneGroup}
          sessions={sessions}
          classCode={classCode}
          finishDistance={cfg.finishDistance}
          runs={runs}
        />
      ) : (
        <>
      <form
        onSubmit={handleAdd}
        className="grid gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-[100px_1fr_110px_auto]"
      >
        <input
          value={carNumber}
          onChange={(e) => setCarNumber(e.target.value)}
          placeholder="Car #"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
        />
        <input
          value={driverName}
          onChange={(e) => setDriverName(e.target.value)}
          placeholder="Driver name"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
        />
        <input
          type="number"
          step="any"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          placeholder="Points"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          Add
        </button>
      </form>

      <ImportEntries eventId={eventId} classCode={classCode} />

      {loading ? (
        <p className="text-sm text-slate-400">Loading entries…</p>
      ) : entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
          No entries yet. Add competitors above, import a file, or use
          {canSeed ? " “Seed from standings”" : " a results import"} to pick who's racing.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-3 py-2">#</th>
                <th className="w-20 px-3 py-2">Car</th>
                <th className="px-3 py-2">Driver</th>
                <th className="w-24 px-3 py-2">Points</th>
                <th className="w-16 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {entries.map((entry, idx) => (
                <tr key={entry.id} className="hover:bg-slate-900">
                  <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <input
                      defaultValue={entry.carNumber}
                      onBlur={(e) =>
                        e.target.value !== entry.carNumber &&
                        patch(entry, "carNumber", e.target.value.trim())
                      }
                      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-slate-100 hover:border-slate-700 focus:border-sky-500 focus:bg-slate-950 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      defaultValue={entry.driverName}
                      onBlur={(e) =>
                        e.target.value !== entry.driverName &&
                        patch(entry, "driverName", e.target.value.trim())
                      }
                      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-slate-100 hover:border-slate-700 focus:border-sky-500 focus:bg-slate-950 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="any"
                      defaultValue={entry.points ?? ""}
                      onBlur={(e) => {
                        const v =
                          e.target.value.trim() === ""
                            ? null
                            : Number(e.target.value);
                        if (v !== entry.points) patch(entry, "points", v);
                      }}
                      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-slate-100 hover:border-slate-700 focus:border-sky-500 focus:bg-slate-950 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => deleteEntry(eventId, entry.id)}
                      className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-950/60 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </div>
  );
}
