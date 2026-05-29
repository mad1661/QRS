import { useEffect, useState } from "react";
import { scrapePoints } from "../lib/functions.ts";
import { addEntries, replaceClassEntries } from "../lib/store.ts";
import { CLASS_BY_CODE } from "../lib/classes.ts";
import type { StandingRow } from "../lib/types.ts";

interface Props {
  eventId: string;
  classCode: string;
  year: number;
  existingCount: number;
  onClose: () => void;
}

interface Pick extends StandingRow {
  selected: boolean;
  carNumber: string;
}

/**
 * Scrapes the NHRA.com standings for one class and lets the user choose which
 * drivers are actually racing this weekend (with an editable car #), then adds
 * only the selected drivers as entries — re-seeded 1..N in standings order.
 */
export function SeedFromStandings({
  eventId,
  classCode,
  year,
  existingCount,
  onClose,
}: Props) {
  const cfg = CLASS_BY_CODE[classCode];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Pick[]>([]);
  const [replace, setReplace] = useState(existingCount > 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    scrapePoints(year, [classCode])
      .then(({ results }) => {
        if (cancelled) return;
        const standings = results[classCode] ?? [];
        if (standings.length === 0) {
          setError("Standings returned no drivers for this class.");
        }
        setRows(
          standings.map((r) => ({
            ...r,
            selected: true,
            carNumber: r.carNumber ?? "",
          })),
        );
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Scrape failed.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [year, classCode]);

  const selectedCount = rows.filter((r) => r.selected).length;

  function toggle(i: number) {
    setRows((rs) =>
      rs.map((r, idx) => (idx === i ? { ...r, selected: !r.selected } : r)),
    );
  }

  function setAll(selected: boolean) {
    setRows((rs) => rs.map((r) => ({ ...r, selected })));
  }

  function setCar(i: number, carNumber: string) {
    setRows((rs) =>
      rs.map((r, idx) => (idx === i ? { ...r, carNumber } : r)),
    );
  }

  async function handleAdd() {
    const picks = rows.filter((r) => r.selected);
    if (picks.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      // Re-seed 1..N in the (standings) order the rows are displayed.
      const entries = picks.map((r, i) => ({
        classCode,
        carNumber: r.carNumber.trim(),
        driverName: r.driver,
        points: r.points,
        seed: i + 1,
      }));
      if (replace) {
        await replaceClassEntries(eventId, classCode, entries);
      } else {
        await addEntries(eventId, entries);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add entries.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Who's racing — {cfg?.name ?? classCode}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {year} NHRA standings · check the drivers entered this weekend
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="border-b border-red-900 bg-red-950/50 px-5 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-2 text-xs text-slate-400">
          <span>
            {loading
              ? "Loading standings…"
              : `${selectedCount} of ${rows.length} selected`}
          </span>
          {!loading && rows.length > 0 && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setAll(true)}
                className="text-sky-400 hover:text-sky-300"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setAll(false)}
                className="text-sky-400 hover:text-sky-300"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              Scraping nhra.com…
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="w-12 px-3 py-2">Pos</th>
                  <th className="px-3 py-2">Driver</th>
                  <th className="w-20 px-3 py-2">Points</th>
                  <th className="w-24 px-3 py-2">Car #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((r, i) => (
                  <tr
                    key={`${r.position}-${r.driver}`}
                    className={r.selected ? "bg-slate-900/40" : "opacity-50"}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={r.selected}
                        onChange={() => toggle(i)}
                        className="h-4 w-4 accent-sky-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-500">{r.position}</td>
                    <td className="px-3 py-2">
                      <span className="text-slate-100">{r.driver}</span>
                      {r.vehicle && (
                        <span className="ml-2 text-xs text-slate-500">
                          {r.vehicle}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{r.points}</td>
                    <td className="px-3 py-2">
                      <input
                        value={r.carNumber}
                        onChange={(e) => setCar(i, e.target.value)}
                        placeholder="—"
                        className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-5 py-4">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
              className="h-4 w-4 accent-sky-500"
            />
            Replace existing {existingCount > 0 ? `(${existingCount})` : ""} entries
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || loading || selectedCount === 0}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saving
                ? "Adding…"
                : `${replace ? "Replace with" : "Add"} ${selectedCount} selected`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
