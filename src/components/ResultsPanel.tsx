import { useEffect, useState } from "react";
import {
  scrapeResults,
  type PortalOption,
  type ScrapeResultsResult,
} from "../lib/functions.ts";
import { rowToRun, portalCategoryName } from "../lib/results.ts";
import { categoryToCode } from "../lib/classes.ts";
import { upsertRuns } from "../lib/store.ts";
import type { EventDoc } from "../lib/types.ts";

interface Props {
  eventId: string;
  event: EventDoc;
}

function Picker({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: PortalOption[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <select
        value={value}
        disabled={disabled || options.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none disabled:opacity-50"
      >
        <option value="">— select —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ResultsPanel({ eventId, event }: Props) {
  const [data, setData] = useState<ScrapeResultsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [year, setYear] = useState(String(event.year));
  const [eventType, setEventType] = useState("N");
  const [eventVal, setEventVal] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");

  async function fetchLevel(sel: {
    year?: string;
    eventType?: string;
    event?: string;
    date?: string;
    category?: string;
  }) {
    setLoading(true);
    setError(null);
    try {
      const res = await scrapeResults(sel);
      setData(res);
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal request failed");
      return null;
    } finally {
      setLoading(false);
    }
  }

  // Initial load: years/eventTypes/events for the event's year.
  useEffect(() => {
    void fetchLevel({ year: String(event.year), eventType: "N" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.year]);

  async function onYear(v: string) {
    setYear(v);
    setEventVal("");
    setDate("");
    setCategory("");
    await fetchLevel({ year: v, eventType });
  }
  async function onEventType(v: string) {
    setEventType(v);
    setEventVal("");
    setDate("");
    setCategory("");
    await fetchLevel({ year, eventType: v });
  }
  async function onEvent(v: string) {
    setEventVal(v);
    setDate("");
    setCategory("");
    await fetchLevel({ year, eventType, event: v });
  }
  async function onDate(v: string) {
    setDate(v);
    setCategory("");
    await fetchLevel({ year, eventType, event: eventVal, date: v });
  }
  async function onCategory(v: string) {
    setCategory(v);
    await fetchLevel({ year, eventType, event: eventVal, date: v ? v : date, category: v });
  }

  async function importRuns() {
    if (!data?.grid) return;
    const fallbackCategory = portalCategoryName(category);
    const runs = data.grid.rows
      .map((r) => rowToRun(r, fallbackCategory))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (runs.length === 0) {
      setError("No rows mapped to a known class (check the category).");
      return;
    }
    setLoading(true);
    try {
      const n = await upsertRuns(eventId, runs);
      const code = runs[0].classCode;
      setStatus(`Imported ${n} runs into ${code}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  const catLabel = data?.categories.find((c) => c.value === category)?.label ?? "";
  const catName = portalCategoryName(category);
  const mappedCode = catName ? categoryToCode(catName) : undefined;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="mb-3 text-sm text-slate-300">
          Pull results from getresults.nhradata.com. Runs route to the matching
          class automatically.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Picker label="Year" value={year} options={data?.years ?? []} onChange={onYear} />
          <Picker
            label="Event type"
            value={eventType}
            options={data?.eventTypes ?? []}
            onChange={onEventType}
          />
          <Picker label="Event" value={eventVal} options={data?.events ?? []} onChange={onEvent} />
          <Picker
            label="Day"
            value={date}
            options={data?.dates ?? []}
            onChange={onDate}
            disabled={!eventVal}
          />
          <Picker
            label="Category / round"
            value={category}
            options={data?.categories ?? []}
            onChange={onCategory}
            disabled={!date}
          />
        </div>
        {loading && <p className="mt-3 text-xs text-slate-500">Talking to portal…</p>}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {status && <p className="mt-3 text-sm text-emerald-400">{status}</p>}
      </div>

      {data?.grid && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-300">
              {data.grid.rows.length} rows
              {catLabel && (
                <>
                  {" "}
                  · {catLabel}{" "}
                  {mappedCode ? (
                    <span className="text-emerald-400">→ {mappedCode}</span>
                  ) : (
                    <span className="text-amber-400">(no class match)</span>
                  )}
                </>
              )}
            </p>
            <button
              type="button"
              onClick={importRuns}
              disabled={loading || !mappedCode}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              Import runs
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-left uppercase tracking-wide text-slate-500">
                <tr>
                  {data.grid.headers.map((h) => (
                    <th key={h} className="whitespace-nowrap px-2 py-1.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                {data.grid.rows.slice(0, 60).map((r, i) => (
                  <tr key={i}>
                    {data.grid!.headers.map((h) => (
                      <td key={h} className="whitespace-nowrap px-2 py-1 text-slate-300">
                        {r[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
