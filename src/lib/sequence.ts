import type { Lane, LaneGroup } from "./classes";
import { laneRotation } from "./classes";
import type { EntryDoc } from "./types";

/**
 * Pure run-sequence generator, validated against official NHRA Funny Car sheets.
 *
 * Running order per session:
 *   - Q1: championship points (seed).
 *   - Q2: best ET from Q1, quickest → slowest.
 *   - Q3: best ET from Q2.
 *   - Final session: each car's best ET across all prior sessions.
 *   In every session the quickest pair runs LAST (slowest / bye runs first).
 *
 * Lanes:
 *   - TF / FC / PS / PSM (strict alternation): Q1 splits the field into two
 *     fixed groups by points parity (the leader's lane, then alternating). Each
 *     group swaps lanes every session, so every car runs L,R,L,R or R,L,R,L.
 *     Within a session each group is sorted by the basis-session best ET and
 *     paired across (Left[i] vs Right[i]) — this is how re-pairing stays valid.
 *   - Other classes: a per-session "first lane" pattern from the LANES table,
 *     applied to the first car of each consecutive pair.
 *
 * Finish ET is read from ft1320 first (the portal records the finish there for
 * every class, including the 1000-ft nitro classes), then ft1000 as a fallback.
 */

export interface SeqCompetitor {
  entryId: string;
  carNumber: string;
  driverName: string;
  /** 1-based points/seed rank within the class (stable across sessions). */
  order: number;
  /** 1-based qualifying rank for this session (1 = quickest on the basis ET). */
  qpos?: number;
}

export interface Pairing {
  pair: number;
  left: SeqCompetitor | null;
  right: SeqCompetitor | null;
  bye: boolean;
}

export interface SessionPlan {
  session: number;
  firstLane: Lane;
  basis: string;
  pairings: Pairing[];
}

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

export const STRICT_ALTERNATION = new Set(["TF", "FC", "PS", "PSM"]);

function seedCompare(a: EntryDoc, b: EntryDoc): number {
  if (a.seed != null && b.seed != null) return a.seed - b.seed;
  if (a.seed != null) return -1;
  if (b.seed != null) return 1;
  const ap = a.points ?? -Infinity;
  const bp = b.points ?? -Infinity;
  if (ap !== bp) return bp - ap;
  return a.driverName.localeCompare(b.driverName);
}

/** Q1 order: explicit seed, then points, then name. order = 1-based rank. */
export function orderEntries(entries: EntryDoc[]): SeqCompetitor[] {
  return [...entries].sort(seedCompare).map((e, i) => ({
    entryId: e.id,
    carNumber: e.carNumber,
    driverName: e.driverName,
    order: i + 1,
  }));
}

/** Normalize a driver name for matching ("Last, First", case, punctuation). */
export function normalizeName(s: string): string {
  let t = (s || "").trim().toLowerCase();
  if (t.includes(",")) {
    const [last, first] = t.split(",");
    t = `${(first ?? "").trim()} ${(last ?? "").trim()}`;
  }
  return t.replace(/[^a-z0-9]+/g, " ").trim();
}

/** Finish ET for a run: ft1320 if present (portal default), else ft1000. */
function finishEt(r: SeqRun): number | null {
  if (r.ft1320 != null && r.ft1320 > 0) return r.ft1320;
  if (r.ft1000 != null && r.ft1000 > 0) return r.ft1000;
  return null;
}

/** Best (lowest) finish ET per car number and per driver name. */
function bestEtMaps(runs: SeqRun[]): {
  byCar: Map<string, number>;
  byName: Map<string, number>;
} {
  const byCar = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const r of runs) {
    if (r.isDQ) continue;
    const et = finishEt(r);
    if (et == null) continue;
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
  q1LeaderLane?: Lane;
  conditionalThird?: Lane;
}

/** What each session's order is based on, and which runs feed it. */
function sessionBasis(
  s: number,
  sessions: number,
): { label: string; relevant: (r: SeqRun) => boolean } {
  if (s === 1) return { label: "points", relevant: () => false };
  if (s === sessions) {
    return {
      label: `best of Q1–Q${s - 1}`,
      relevant: (r) => r.session >= 1 && r.session < s,
    };
  }
  return { label: `Q${s - 1}`, relevant: (r) => r.session === s - 1 };
}

export function generateSequence(
  entries: EntryDoc[],
  runs: SeqRun[],
  opts: GenerateOptions,
): SessionPlan[] {
  const {
    classCode,
    group,
    sessions,
    q1LeaderLane = "R",
    conditionalThird = "L",
  } = opts;
  const strict = STRICT_ALTERNATION.has(classCode);
  const pattern = resolveRotation(group, sessions, conditionalThird);
  const base = orderEntries(entries);

  const plans: SessionPlan[] = [];

  for (let s = 1; s <= sessions; s++) {
    const basis = sessionBasis(s, sessions);
    const maps = s === 1 ? null : bestEtMaps(runs.filter(basis.relevant));
    const etOf = (c: SeqCompetitor): number | undefined => {
      if (!maps) return undefined;
      const car = (c.carNumber || "").trim();
      if (car && maps.byCar.has(car)) return maps.byCar.get(car);
      const nm = normalizeName(c.driverName);
      if (nm && maps.byName.has(nm)) return maps.byName.get(nm);
      return undefined;
    };
    // Lower metric = quicker. Q1 uses points; later sessions use the basis ET.
    const metric = (c: SeqCompetitor): number =>
      s === 1 ? c.order : etOf(c) ?? Infinity;

    // Rank the whole field 1..N (1 = quickest / best on the basis).
    const ranked: SeqCompetitor[] = [...base]
      .sort((a, b) => metric(a) - metric(b) || a.order - b.order)
      .map((c, i) => ({ ...c, qpos: i + 1 }));

    // The quicker car of each pair takes the "first lane"; strict-alternation
    // classes anchor that to the Q1 leader lane (default R), others follow the
    // class lane pattern for the session.
    const firstLane: Lane = strict ? q1LeaderLane : pattern[s - 1] ?? "L";

    // Pair consecutively by rank: (#1,#2), (#3,#4) … so the quickest two are a
    // pair. Build best-first, then reverse so the quickest pair runs LAST and
    // the slowest pair (or the bye) runs first.
    const built: Pairing[] = [];
    for (let k = 0; k * 2 + 1 < ranked.length; k++) {
      const quick = ranked[2 * k];
      const slow = ranked[2 * k + 1];
      built.push({
        pair: 0,
        left: firstLane === "L" ? quick : slow,
        right: firstLane === "L" ? slow : quick,
        bye: false,
      });
    }
    if (ranked.length % 2 === 1) {
      const solo = ranked[ranked.length - 1];
      built.push({
        pair: 0,
        left: firstLane === "L" ? solo : null,
        right: firstLane === "L" ? null : solo,
        bye: true,
      });
    }
    const pairings = built.reverse().map((p, i) => ({ ...p, pair: i + 1 }));

    plans.push({ session: s, firstLane, basis: basis.label, pairings });
  }

  return plans;
}
