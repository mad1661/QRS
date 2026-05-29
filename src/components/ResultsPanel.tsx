import { useEffect, useMemo, useState } from "react";
import {
  scrapeResults,
  type PortalOption,
  type ScrapeResultsResult,
} from "../lib/functions.ts";
import { rowToRun, portalCategoryName } from "../lib/results.ts";
import { categoryToCode, CLASSES } from "../lib/classes.ts";
import { upsertRuns, updateEvent } from "../lib/store.ts";
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
  const [bulkBusy, setBulkBusy] = useState(false);
  const [seenCats, setSeenCats] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>(
    event.categoryOverrides ?? {},
  );

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
      .map((r) => rowToRun(r, fallbackCategory, overrides))
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

  async function importEntireEvent() {
    if (!eventVal) return;
    setBulkBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await scrapeResults({ year, eventType, event: eventVal, mode: "all" });
      setSeenCats(res.categoriesSeen ?? []);
      const rows = res.allRows ?? [];
      const runs = rows
        .map((r) => rowToRun(r, "", overrides))
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (runs.length === 0) {
        setError("No runs found for this event (or all categories are ignored).");
        return;
      }
      const n = await upsertRuns(eventId, runs);
      const byClass: Record<string, number> = {};
      for (const r of runs) byClass[r.classCode] = (byClass[r.classCode] ?? 0) + 1;
      const summary = Object.entries(byClass)
        .map(([c, count]) => `${c} ${count}`)
        .join(" · ");
      setStatus(`Imported ${n} runs from ${rows.length} rows — ${summary}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk import failed");
    } finally {
      setBulkBusy(false);
    }
  }

  async function setOverride(category: string, value: string) {
    const key = category.toUpperCase();
    const next = { ...overrides };
    if (value === "__auto__") delete next[key];
    else next[key] = value === "__ignore__" ? "" : value;
    setOverrides(next);
    try {
      await updateEvent(eventId, { categoryOverrides: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save mapping");
    }
  }

  // All portal categories we know about, for the mapping table.
  const discoveredCategories = useMemo(() => {
    const s = new Set<string>();
    for (const c of data?.categories ?? []) {
      const n = portalCategoryName(c.value);
      if (n) s.add(n.toUpperCase());
    }
    for (const n of seenCats) s.add(n);
    for (const k of Object.keys(overrides)) s.add(k);
    return [...s].sort();
  }, [data, seenCats, overrides]);

  const catLabel = data?.categories.find((c) => c.value === category)?.label ?? "";
  const catName = portalCategoryName(category);
  const mappedCode = catName
    ? overrides[catName.toUpperCase()] || categoryToCode(catName)
    : undefined;

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

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={importEntireEvent}
            disabled={!eventVal || bulkBusy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {bulkBusy ? "Importing entire event…" : "Import entire event"}
          </button>
          <span className="text-xs text-slate-500">
            Pulls every day &amp; category at once — just click again to refresh.
          </span>
        </div>
      </div>

      {discoveredCategories.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="mb-1 text-sm font-medium text-slate-200">
            Category mapping
          </p>
          <p className="mb-3 text-xs text-slate-500">
            Choose which class each portal category counts toward. Use this for a
            “race within a race” (e.g. point a shootout category at its class), or
            “Ignore” to skip one. Saved with the event.
          </p>
          <div className="space-y-2">
            {discoveredCategories.map((cat) => {
              const key = cat.toUpperCase();
              const auto = categoryToCode(cat);
              const current =
                key in overrides
                  ? overrides[key] === ""
                    ? "__ignore__"
                    : overrides[key]
                  : "__auto__";
              return (
                <div key={cat} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-300">{cat}</span>
                  <select
                    value={current}
                    onChange={(e) => setOverride(cat, e.target.value)}
                    className="w-44 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="__auto__">
                      Auto {auto ? `(→ ${auto})` : "(unmapped)"}
                    </option>
                    {CLASSES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                    <option value="__ignore__">Ignore</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
