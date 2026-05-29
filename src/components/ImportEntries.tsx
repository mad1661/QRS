import { useRef, useState } from "react";
import { addEntries, replaceClassEntries } from "../lib/store.ts";
import type { NewEntry } from "../lib/types.ts";

interface Props {
  eventId: string;
  classCode: string;
}

interface Parsed {
  fileName: string;
  rows: NewEntry[];
}

/** Find the first object key whose lowercased name matches any candidate substring. */
function findKey(keys: string[], candidates: string[]): string | undefined {
  for (const cand of candidates) {
    const hit = keys.find((k) => k.toLowerCase().trim().includes(cand));
    if (hit) return hit;
  }
  return undefined;
}

async function parseWorkbook(
  data: ArrayBuffer,
  classCode: string,
): Promise<NewEntry[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(data, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  if (json.length === 0) return [];

  const keys = Object.keys(json[0]);
  const carKey = findKey(keys, ["car", "number", "no", "#"]);
  const driverKey = findKey(keys, ["driver", "name", "racer"]);
  const pointsKey = findKey(keys, ["point"]);

  const rows: NewEntry[] = [];
  for (const r of json) {
    const carNumber = carKey ? String(r[carKey] ?? "").trim() : "";
    const driverName = driverKey ? String(r[driverKey] ?? "").trim() : "";
    if (!carNumber && !driverName) continue;
    const ptsRaw = pointsKey ? String(r[pointsKey] ?? "").trim() : "";
    const points = ptsRaw === "" ? null : Number(ptsRaw);
    rows.push({
      classCode,
      carNumber,
      driverName,
      points: Number.isFinite(points as number) ? points : null,
    });
  }
  return rows;
}

export function ImportEntries({ eventId, classCode }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const rows = await parseWorkbook(buf, classCode);
      if (rows.length === 0) {
        setError("No rows found (need a Car/Driver column).");
        setParsed(null);
      } else {
        setParsed({ fileName: file.name, rows });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read file");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function commit(replace: boolean) {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      if (replace) {
        await replaceClassEntries(eventId, classCode, parsed.rows);
      } else {
        await addEntries(eventId, parsed.rows);
      }
      setParsed(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800">
          Import .xlsx / .csv
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFile}
            className="hidden"
          />
        </label>
        <span className="text-xs text-slate-500">
          Auto-detects Car #, Driver, and Points columns.
        </span>
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {parsed && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
          <span className="text-sm text-slate-300">
            {parsed.fileName}: <strong>{parsed.rows.length}</strong> entries
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => commit(false)}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Append
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => commit(true)}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            Replace class
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setParsed(null)}
            className="rounded-md px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
