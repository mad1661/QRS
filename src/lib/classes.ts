export type Lane = "L" | "R";

/**
 * Lane-rotation groups, derived from the QRS spreadsheet "LANES" sheet.
 *
 * - Group A classes use a fixed lane pattern keyed by the number of qualifying
 *   sessions (2-5).
 * - Group B classes use a fixed pattern for 2 sessions; for 3 sessions the
 *   third session's lane is decided at run time ("L-R-L OR L-R-R based on the
 *   times of Q1 and Q3"), so it is left conditional here.
 */
export type LaneGroup = "A" | "B";

export const LANE_PATTERNS_A: Record<number, Lane[]> = {
  2: ["L", "R"],
  3: ["L", "L", "R"],
  4: ["L", "R", "R", "L"],
  5: ["L", "L", "R", "R", "L"],
};

/** Group B: fixed first two sessions; 3rd session lane is conditional. */
export const LANE_PATTERNS_B: Record<number, (Lane | "?")[]> = {
  2: ["L", "R"],
  3: ["L", "R", "?"],
};

export interface ClassConfig {
  /** Short code used as the Firestore key and in the spreadsheet. */
  code: string;
  /** Display name. */
  name: string;
  /** Finish-line distance in feet (1000 for nitro classes, else 1320). */
  finishDistance: 1000 | 1320;
  /** Lane-rotation group. */
  laneGroup: LaneGroup;
}

/** All 14 classes, in the order used by the QRS workbook. */
export const CLASSES: readonly ClassConfig[] = [
  { code: "TF", name: "Top Fuel", finishDistance: 1000, laneGroup: "A" },
  { code: "FC", name: "Funny Car", finishDistance: 1000, laneGroup: "A" },
  { code: "PS", name: "Pro Stock", finishDistance: 1320, laneGroup: "A" },
  { code: "PSM", name: "Pro Stock Motorcycle", finishDistance: 1320, laneGroup: "A" },
  { code: "PM", name: "Pro Mod", finishDistance: 1320, laneGroup: "A" },
  { code: "FX", name: "Factory X", finishDistance: 1320, laneGroup: "B" },
  { code: "TAD", name: "Top Alcohol Dragster", finishDistance: 1320, laneGroup: "B" },
  { code: "TAFC", name: "Top Alcohol Funny Car", finishDistance: 1320, laneGroup: "B" },
  { code: "COMP", name: "Competition Eliminator", finishDistance: 1320, laneGroup: "B" },
  { code: "TD", name: "Top Dragster", finishDistance: 1320, laneGroup: "B" },
  { code: "TS", name: "Top Sportsman", finishDistance: 1320, laneGroup: "B" },
  { code: "FSS", name: "Factory Stock Showdown", finishDistance: 1320, laneGroup: "B" },
  { code: "TFM", name: "Top Fuel Motorcycle", finishDistance: 1320, laneGroup: "B" },
  { code: "MMPS", name: "Mountain Motor Pro Stock", finishDistance: 1320, laneGroup: "B" },
];

export const CLASS_BY_CODE: Record<string, ClassConfig> = Object.fromEntries(
  CLASSES.map((c) => [c.code, c]),
);

export function laneRotation(
  group: LaneGroup,
  sessions: number,
): (Lane | "?")[] | undefined {
  return group === "A" ? LANE_PATTERNS_A[sessions] : LANE_PATTERNS_B[sessions];
}
