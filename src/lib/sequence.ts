import type { Lane, LaneGroup } from "./classes";
import { laneRotation } from "./classes";
import type { EntryDoc } from "./types";

/**
 * Pure run-sequence generator.
 *
 * Mirrors the QRS workbook's structure (confirmed by reverse-engineering the
 * class tabs), without its formula-grid quirks:
 *   1. Entries are placed in a seeded running order (Q1 = championship points;
 *      later sessions can be re-seeded from results).
 *   2. The running order is split into consecutive pairs that run together.
 *   3. A per-session lane rotation (e.g. L-R-R-L) decides which lane the first
 *      car of each pair occupies; lanes swap between sessions accordingly.
 *   4. An odd field produces a single (bye) run for the top seed, who runs in
 *      the lane opposite the session's "first" lane (matching the workbook).
 */

export interface SeqCompetitor {
  entryId: string;
  carNumber: string;
  driverName: string;
  /** 1-based running-order position within the class. */
  order: number;
}

export interface Pairing {
  /** 1-based pair number within the session (running order). */
  pair: number;
  left: SeqCompetitor | null;
  right: SeqCompetitor | null;
  /** True when only one car runs (odd field). */
  bye: boolean;
}

export interface SessionPlan {
  /** 1-based session number (Q1, Q2, ...). */
  session: number;
  /** Lane the first car of each pair starts in. */
  firstLane: Lane;
  pairings: Pairing[];
}

/**
 * Order entries into the seeded running order:
 *   - explicit `seed` first (ascending),
 *   - then higher `points`,
 *   - then driver name as a stable tiebreak.
 * Entries with neither seed nor points fall to the bottom.
 */
export function orderEntries(entries: EntryDoc[]): SeqCompetitor[] {
  const sorted = [...entries].sort((a, b) => {
    if (a.seed != null && b.seed != null) return a.seed - b.seed;
    if (a.seed != null) return -1;
    if (b.seed != null) return 1;
    const ap = a.points ?? -Infinity;
    const bp = b.points ?? -Infinity;
    if (ap !== bp) return bp - ap;
    return a.driverName.localeCompare(b.driverName);
  });
  return sorted.map((e, i) => ({
    entryId: e.id,
    carNumber: e.carNumber,
    driverName: e.driverName,
    order: i + 1,
  }));
}

/** Build pairings for one session given the ordered field and the session lane. */
export function pairSession(
  order: SeqCompetitor[],
  firstLane: Lane,
): Pairing[] {
  const pairings: Pairing[] = [];
  let idx = 0;
  let pairNo = 1;

  // Odd field: the top seed runs solo in the lane opposite the first lane.
  if (order.length % 2 === 1) {
    const solo = order[0];
    pairings.push({
      pair: pairNo++,
      left: firstLane === "L" ? null : solo,
      right: firstLane === "L" ? solo : null,
      bye: true,
    });
    idx = 1;
  }

  for (; idx + 1 < order.length; idx += 2) {
    const a = order[idx];
    const b = order[idx + 1];
    pairings.push({
      pair: pairNo++,
      left: firstLane === "L" ? a : b,
      right: firstLane === "L" ? b : a,
      bye: false,
    });
  }

  return pairings;
}

/**
 * Resolve the lane rotation for a class group and session count into concrete
 * lanes. Group B's conditional third session ("?") defaults to the value in
 * `conditionalThird` (the workbook decides it from Q1/Q3 times at the track).
 */
export function resolveRotation(
  group: LaneGroup,
  sessions: number,
  conditionalThird: Lane = "L",
): Lane[] {
  const raw = laneRotation(group, sessions);
  if (!raw) {
    // Fallback: simple alternation starting Left.
    return Array.from({ length: sessions }, (_, i) =>
      i % 2 === 0 ? "L" : "R",
    );
  }
  return raw.map((l) => (l === "?" ? conditionalThird : l));
}

export interface GenerateOptions {
  group: LaneGroup;
  sessions: number;
  conditionalThird?: Lane;
}

/** Generate the full Q1..Qn sequence for a class. */
export function generateSequence(
  entries: EntryDoc[],
  { group, sessions, conditionalThird = "L" }: GenerateOptions,
): SessionPlan[] {
  const order = orderEntries(entries);
  const rotation = resolveRotation(group, sessions, conditionalThird);
  return rotation.map((firstLane, i) => ({
    session: i + 1,
    firstLane,
    pairings: pairSession(order, firstLane),
  }));
}
