import { useState } from "react";
import type { LiveOrderRow } from "../lib/results.ts";

interface Props {
  rows: LiveOrderRow[];
  finishDistance: 1000 | 1320;
  onReseed: () => Promise<void>;
}

export function LiveOrder({ rows, finishDistance, onReseed }: Props) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  async function reseed() {
    setBusy(true);
    try {
      await onReseed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm font-semibold text-emerald-300"
        >
          {open ? "▾" : "▸"} Live qualifying order ({rows.length})
        </button>
        <button
          type="button"
          onClick={reseed}
          disabled={busy}
          className="rounded-md border border-emerald-700 bg-emerald-600/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-600/30 disabled:opacity-50"
        >
          {busy ? "Re-seeding…" : "Re-seed entries from results"}
        </button>
      </div>

      {open && (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-3 py-2">Pos</th>
                <th className="w-20 px-3 py-2">Car</th>
                <th className="px-3 py-2">Driver</th>
                <th className="w-28 px-3 py-2">Best ET ({finishDistance}ft)</th>
                <th className="w-24 px-3 py-2">MPH</th>
                <th className="w-16 px-3 py-2">Sess</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {rows.map((r, i) => (
                <tr key={r.carNumber}>
                  <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-400">
                    {r.carNumber}
                  </td>
                  <td className="px-3 py-1.5 text-slate-100">{r.driverName}</td>
                  <td className="px-3 py-1.5 text-slate-200">
                    {r.bestEt != null ? r.bestEt.toFixed(3) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-slate-300">
                    {r.bestMph != null ? r.bestMph.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-slate-500">
                    {r.bestSession ? `Q${r.bestSession}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
