import type { Lane, LaneGroup } from "./classes";
import { laneRotation } from "./classes";
import type { EntryDoc } from "./types";

/**
 * Pure run-sequence generator.
 *
 * Per-session running order:
 *   - Q1: championship points (seed).
 *   - Q2: best ET from Q1, quickest → slowest.
 *   - Q3: best ET from Q2, quickest → slowest.
 *   - Final session (e.g. Q4): each car's best ET across all prior sessions.
 * In every session the quickest pair runs LAST (the field is reversed so the
 * top of the order is the final pair, and the slowest/bye runs first).
 *
 * Lanes:
 *   - TF / FC / PS / PSM: strict per-car alternation (L,R,L,R or R,L,R,L).
 *     Q1 lanes alternate down the seeded order; each later session a car flips
 *     to the opposite of the lane it ran last. When re-pairing puts two cars
 *     that are both "due" the same lane together, the lower-ranked (slower) car
 *     is flipped so the pairing stays one-Left / one-Right.
 *   - Other classes: a per-session "first lane" pattern (from the LANES table),
 *     applied to the first car of each consecutive pair.
 */

export interface SeqCompetitor {
  entryId: string;
  carNumber: string;
  driverName: string;
  /** 1-based running-order position (1 = quickest / top seed) this session. */
  order: number;
}

export interface Pairing {
  /** 1-based pair number within the session (1 = first to run). */
  pair: number;
  left: SeqCompetitor | null;
  right: SeqCompetitor | null;
  /** True when only one car runs (odd field). */
  bye: boolean;
}

export interface SessionPlan {
  /** 1-based session number (Q1, Q2, ...). */
  session: number;
  /** Lane the #1 car (top of the order) runs in this session. */
  firstLane: Lane;
  /** Human label for what the order is based on (e.g. "points", "Q1"). */
  basis: string;
  pairings: Pairing[];
}

/** Subset of a run needed to re-seed later sessions. */
export interface SeqRun {
  carNumber: string;
  driverName: string;
  session: number;
  isDQ: boolean;
  ft1000: number | null;
  mph1000: number | null;
  ft1320: number | null;
  mph1320: number | null;
}

/** Classes that use strict per-car lane alternation. */
export const STRICT_ALTERNATION = new Set(["TF", "FC", "PS", "PSM"]);

const opposite = (l: Lane): Lane => (l === "L" ? "R" : "L");

/** Seed/points comparator (Q1 order and the fallback for cars without a time). */
function seedCompare(a: EntryDoc, b: EntryDoc): number {
  if (a.seed != null && b.seed != null) return a.seed - b.seed;
  if (a.seed != null) return -1;
  if (b.seed != null) return 1;
  const ap = a.points ?? -Infinity;
  const bp = b.points ?? -Infinity;
  if (ap !== bp) return bp - ap;
  return a.driverName.localeCompare(b.driverName);
}

function toCompetitors(entries: EntryDoc[]): SeqCompetitor[] {
  return entries.map((e, i) => ({
    entryId: e.id,
    carNumber: e.carNumber,
    driverName: e.driverName,
    order: i + 1,
  }));
}

/** Q1 order: explicit seed, then points, then name. */
export function orderEntries(entries: EntryDoc[]): SeqCompetitor[] {
  return toCompetitors([...entries].sort(seedCompare));
}

/** Normalize a driver name for matching (handles "Last, First", case, punctuation). */
export function normalizeName(s: string): string {
  let t = (s || "").trim().toLowerCase();
  if (t.includes(",")) {
    const [last, first] = t.split(",");
    t = `${(first ?? "").trim()} ${(last ?? "").trim()}`;
  }
  return t.replace(/[^a-z0-9]+/g, " ").trim();
}

/** Best (lowest) ET per car number and per driver name within a set of runs. */
function bestEtMaps(
  runs: SeqRun[],
  finishDistance: 1000 | 1320,
): { byCar: Map<string, number>; byName: Map<string, number> } {
  const etKey = finishDistance === 1000 ? "ft1000" : "ft1320";
  const byCar = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const r of runs) {
    if (r.isDQ) continue;
    const et = r[etKey] as number | null;
    if (et == null || !(et > 0)) continue;
    const car = (r.carNumber || "").trim();
    if (car) {
      const cur = byCar.get(car);
      if (cur == null || et < cur) byCar.set(car, et);
    }
    const nm = normalizeName(r.driverName);
    if (nm) {
      const cur = byName.get(nm);
      if (cur == null || et < cur) byName.set(nm, et);
    }
  }
  return { byCar, byName };
}

/**
 * Order entries by their best ET within `runsSubset` (quickest first). Runs are
 * matched to entries by car number, then by driver name (entries seeded from
 * standings often have no car number). Cars with no valid time fall to the
 * bottom in seed/points order.
 */
function orderByResults(
  entries: EntryDoc[],
  runsSubset: SeqRun[],
  finishDistance: 1000 | 1320,
): SeqCompetitor[] {
  const { byCar, byName } = bestEtMaps(runsSubset, finishDistance);
  const etFor = (e: EntryDoc): number | undefined => {
    const car = (e.carNumber || "").trim();
    if (car && byCar.has(car)) return byCar.get(car);
    const nm = normalizeName(e.driverName);
    if (nm && byName.has(nm)) return byName.get(nm);
    return undefined;
  };

  const sorted = [...entries].sort((a, b) => {
    const ea = etFor(a);
    const eb = etFor(b);
    if (ea != null && eb != null) return ea - eb;
    if (ea != null) return -1;
    if (eb != null) return 1;
    return seedCompare(a, b);
  });
  return toCompetitors(sorted);
}

/**
 * Resolve the lane-pattern for non-strict classes. Group B's conditional third
 * session ("?") uses `conditionalThird`.
 */
export function resolveRotation(
  group: LaneGroup,
  sessions: number,
  conditionalThird: Lane = "L",
): Lane[] {
  const raw = laneRotation(group, sessions);
  if (!raw) {
    return Array.from({ length: sessions }, (_, i) => (i % 2 === 0 ? "L" : "R"));
  }
  return raw.map((l) => (l === "?" ? conditionalThird : l));
}

export interface GenerateOptions {
  classCode: string;
  group: LaneGroup;
  sessions: number;
  finishDistance: 1000 | 1320;
  /** Lane the points leader runs in Q1 for strict-alternation classes. */
  q1LeaderLane?: Lane;
  /** Group B's trackside-decided 3rd-session lane (non-strict classes). */
  conditionalThird?: Lane;
}

/** Build the running order (pairs) for a session from an order + lane map. */
function buildPairings(
  order: SeqCompetitor[],
  laneByEntry: Map<string, Lane>,
): Pairing[] {
  const n = order.length;
  const pairCount = Math.floor(n / 2);
  const built: Pairing[] = [];

  for (let p = 0; p < pairCount; p++) {
    const a = order[2 * p];
    const b = order[2 * p + 1];
    const aLeft = laneByEntry.get(a.entryId) === "L";
    built.push({
      pair: 0,
      left: aLeft ? a : b,
      right: aLeft ? b : a,
      bye: false,
    });
  }
  if (n % 2 === 1) {
    const solo = order[n - 1];
    const left = laneByEntry.get(solo.entryId) === "L";
    built.push({ pair: 0, left: left ? solo : null, right: left ? null : solo, bye: true });
  }

  // Quickest pair (built first) runs LAST; slowest / bye runs first.
  return built.reverse().map((pp, i) => ({ ...pp, pair: i + 1 }));
}

/** Generate the full Q1..Qn sequence for a class. */
export function generateSequence(
  entries: EntryDoc[],
  runs: SeqRun[],
  opts: GenerateOptions,
): SessionPlan[] {
  const {
    classCode,
    group,
    sessions,
    finishDistance,
    q1LeaderLane = "R",
    conditionalThird = "L",
  } = opts;
  const strict = STRICT_ALTERNATION.has(classCode);
  const pattern = resolveRotation(group, sessions, conditionalThird);

  const plans: SessionPlan[] = [];
  const prevLane = new Map<string, Lane>();

  for (let s = 1; s <= sessions; s++) {
    // 1. Running order for this session.
    let order: SeqCompetitor[];
    let basis: string;
    if (s === 1) {
      order = orderEntries(entries);
      basis = "points";
    } else if (s === sessions) {
      order = orderByResults(
        entries,
        runs.filter((r) => r.session >= 1 && r.session < s),
        finishDistance,
      );
      basis = `best of Q1–Q${s - 1}`;
    } else {
      order = orderByResults(
        entries,
        runs.filter((r) => r.session === s - 1),
        finishDistance,
      );
      basis = `Q${s - 1}`;
    }

    // 2. Lane per car.
    const laneByEntry = new Map<string, Lane>();
    if (strict) {
      if (s === 1) {
        order.forEach((c, i) =>
          laneByEntry.set(c.entryId, i % 2 === 0 ? q1LeaderLane : opposite(q1LeaderLane)),
        );
      } else {
        const intended = (c: SeqCompetitor): Lane =>
          opposite(prevLane.get(c.entryId) ?? q1LeaderLane);
        for (let i = 0; i + 1 < order.length; i += 2) {
          const a = order[i];
          const b = order[i + 1];
          const la = intended(a);
          let lb = intended(b);
          if (la === lb) lb = opposite(la); // flip the lower-ranked car
          laneByEntry.set(a.entryId, la);
          laneByEntry.set(b.entryId, lb);
        }
        if (order.length % 2 === 1) {
          const solo = order[order.length - 1];
          laneByEntry.set(solo.entryId, intended(solo));
        }
      }
    } else {
      const firstLane = pattern[s - 1] ?? "L";
      for (let i = 0; i + 1 < order.length; i += 2) {
        laneByEntry.set(order[i].entryId, firstLane);
        laneByEntry.set(order[i + 1].entryId, opposite(firstLane));
      }
      if (order.length % 2 === 1) {
        laneByEntry.set(order[order.length - 1].entryId, firstLane);
      }
    }
    for (const c of order) prevLane.set(c.entryId, laneByEntry.get(c.entryId)!);

    // 3. Pairs (quickest pair last).
    const pairings = buildPairings(order, laneByEntry);
    const firstLane = order.length ? laneByEntry.get(order[0].entryId)! : "L";
    plans.push({ session: s, firstLane, basis, pairings });
  }

  return plans;
}
