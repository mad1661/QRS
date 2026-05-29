import { useMemo, useState } from "react";
import type { Lane, LaneGroup } from "../lib/classes.ts";
import { generateSequence, type SeqCompetitor } from "../lib/sequence.ts";
import type { EntryDoc } from "../lib/types.ts";

interface Props {
  entries: EntryDoc[];
  group: LaneGroup;
  sessions: number;
}

function Car({ c }: { c: SeqCompetitor | null }) {
  if (!c) {
    return <span className="text-slate-600">— bye —</span>;
  }
  return (
    <span>
      <span className="font-mono text-slate-400">
        {c.carNumber || "?"}
      </span>{" "}
      <span className="text-slate-100">{c.driverName || "(unnamed)"}</span>
    </span>
  );
}

export function SequenceView({ entries, group, sessions }: Props) {
  // Group B's 3rd session lane is decided trackside; let the user flip it.
  const [conditionalThird, setConditionalThird] = useState<Lane>("L");
  const showThirdToggle = group === "B" && sessions === 3;

  const plans = useMemo(
    () => generateSequence(entries, { group, sessions, conditionalThird }),
    [entries, group, sessions, conditionalThird],
  );

  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
        Add entries to generate the run sequence.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {showThirdToggle && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          Q3 lane (decided by Q1/Q3 times at the track):
          <div className="inline-flex overflow-hidden rounded-md border border-slate-700">
            {(["L", "R"] as Lane[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setConditionalThird(l)}
                className={`px-3 py-1 ${
                  conditionalThird === l
                    ? "bg-sky-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {l === "L" ? "L-R-L" : "L-R-R"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <div
            key={plan.session}
            className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Q{plan.session}
              </h3>
              <span className="text-xs text-slate-500">
                first lane{" "}
                <span className="font-mono text-slate-300">
                  {plan.firstLane}
                </span>
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-1.5">#</th>
                  <th className="px-3 py-1.5">Left lane</th>
                  <th className="px-3 py-1.5">Right lane</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {plan.pairings.map((p) => (
                  <tr key={p.pair} className={p.bye ? "bg-slate-900/40" : ""}>
                    <td className="px-3 py-1.5 text-slate-500">{p.pair}</td>
                    <td className="px-3 py-1.5">
                      <Car c={p.left} />
                    </td>
                    <td className="px-3 py-1.5">
                      <Car c={p.right} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
