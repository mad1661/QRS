import { useMemo, useState } from "react";
import type { Lane, LaneGroup } from "../lib/classes.ts";
import {
  STRICT_ALTERNATION,
  generateSequence,
  type SeqCompetitor,
} from "../lib/sequence.ts";
import type { EntryDoc, RunDoc } from "../lib/types.ts";

interface Props {
  entries: EntryDoc[];
  group: LaneGroup;
  sessions: number;
  classCode: string;
  finishDistance: number;
  runs: RunDoc[];
}

function Car({ c, lane }: { c: SeqCompetitor | null; lane: Lane }) {
  if (!c) return <span className="text-slate-600">— bye —</span>;
  return (
    <span>
      {c.qpos != null && (
        <span
          className="mr-2 inline-block min-w-5 rounded bg-slate-800 px-1 text-center font-mono text-xs text-sky-300"
          title="Qualifying position (1 = quickest)"
        >
          {c.qpos}
        </span>
      )}
      <span
        className={`mr-2 inline-block w-4 text-center font-mono text-xs ${
          lane === "L" ? "text-emerald-400" : "text-amber-400"
        }`}
      >
        {lane}
      </span>
      <span className="font-mono text-slate-400">{c.carNumber || "?"}</span>{" "}
      <span className="text-slate-100">{c.driverName || "(unnamed)"}</span>
    </span>
  );
}

export function SequenceView({
  entries,
  group,
  sessions,
  classCode,
  finishDistance,
  runs,
}: Props) {
  const strict = STRICT_ALTERNATION.has(classCode);
  const [conditionalThird, setConditionalThird] = useState<Lane>("L");
  const [q1LeaderLane, setQ1LeaderLane] = useState<Lane>("R");
  const showThirdToggle = !strict && group === "B" && sessions === 3;

  // Only show sessions that have been run, plus the next one to generate.
  const maxRun = runs.reduce((m, r) => (r.session > m ? r.session : m), 0);
  const visibleCount = Math.max(1, Math.min(sessions, maxRun + 1));

  const plans = useMemo(
    () =>
      generateSequence(entries, runs, {
        classCode,
        group,
        sessions,
        finishDistance: finishDistance === 1000 ? 1000 : 1320,
        q1LeaderLane,
        conditionalThird,
      }).slice(0, visibleCount),
    [
      entries,
      runs,
      classCode,
      group,
      sessions,
      finishDistance,
      q1LeaderLane,
      conditionalThird,
      visibleCount,
    ],
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
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        {strict && (
          <div className="flex items-center gap-2">
            Q1 leader lane:
            <div className="inline-flex overflow-hidden rounded-md border border-slate-700">
              {(["L", "R"] as Lane[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setQ1LeaderLane(l)}
                  className={`px-3 py-1 ${
                    q1LeaderLane === l
                      ? "bg-sky-600 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <span className="text-slate-500">
              (each car alternates {q1LeaderLane === "L" ? "L,R,L,R" : "R,L,R,L"})
            </span>
          </div>
        )}
        {showThirdToggle && (
          <div className="flex items-center gap-2">
            Q3 lane:
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
      </div>

      <p className="text-xs text-slate-500">
        Cars are ranked by the basis session (blue # = qualifying position, 1 =
        quickest) and paired in order (#1+#2, #3+#4, …); the quickest pair runs
        last.
      </p>

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
                ordered by{" "}
                <span className="text-slate-300">{plan.basis}</span>
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
                      <Car c={p.left} lane="L" />
                    </td>
                    <td className="px-3 py-1.5">
                      <Car c={p.right} lane="R" />
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
