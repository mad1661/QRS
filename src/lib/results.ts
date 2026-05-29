import { categoryToCode } from "./classes";
import type { NewRun } from "./types";

function num(v: string | undefined): number | null {
  if (v == null) return null;
  const t = v.trim();
  if (t === "" || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function sessionFromRound(round: string): number {
  const m = /(\d+)/.exec(round ?? "");
  return m ? Number(m[1]) : 1;
}

/**
 * The category/round dropdown values are objects like
 * `{ 'Category' : 'FUNNY CAR', 'Round' : 'Q1' }`. The dropdown *label*
 * ("FUNNY CAR Q1") includes the round, so it can't be mapped directly — pull
 * the bare category name out of the value instead.
 */
export function portalCategoryName(value: string): string {
  return /'Category'\s*:\s*'([^']*)'/.exec(value ?? "")?.[1]?.trim() ?? "";
}

export function portalRound(value: string): string {
  return /'Round'\s*:\s*'([^']*)'/.exec(value ?? "")?.[1]?.trim() ?? "";
}

/** Convert a scraped grid row (portal column names) into a NewRun. */
export function rowToRun(
  row: Record<string, string>,
  fallbackCategory: string,
): NewRun | null {
  const category = row["Category"] || fallbackCategory;
  const classCode = categoryToCode(category);
  if (!classCode) return null;
  const carNumber = (row["CarNumber"] ?? "").trim();
  if (!carNumber) return null;

  return {
    classCode,
    session: sessionFromRound(row["Round"]),
    carNumber,
    driverName: (row["Name"] ?? "").trim(),
    lane: (row["Lane"] ?? "").trim(),
    rt: num(row["RT"]),
    ft60: num(row["ft60"]),
    ft330: num(row["ft330"]),
    ft660: num(row["ft660"]),
    mph660: num(row["660mph"]),
    ft1000: num(row["ft1000"]),
    mph1000: num(row["1000mph"]),
    ft1320: num(row["ft1320"]),
    mph1320: num(row["1320mph"]),
    dialIn: num(row["DialIn"]),
    isDQ: /^(true|1|y)/i.test((row["IsDQ"] ?? "").trim()),
    source: "scraped",
    category,
    timestamp: (row["Timestamp"] ?? "").trim(),
  };
}

export interface LiveOrderRow {
  carNumber: string;
  driverName: string;
  bestEt: number | null;
  bestMph: number | null;
  bestSession: number | null;
  runs: number;
}

/**
 * Live qualifying order: each car's best (lowest) finish ET across sessions.
 * `finishDistance` picks the ET/mph column (1000 ft vs 1320 ft). DQ'd runs are
 * ignored. Cars with no valid ET sort to the bottom.
 */
export function computeLiveOrder(
  runs: {
    carNumber: string;
    driverName: string;
    session: number;
    isDQ: boolean;
    ft1000: number | null;
    mph1000: number | null;
    ft1320: number | null;
    mph1320: number | null;
  }[],
  _finishDistance: 1000 | 1320,
): LiveOrderRow[] {
  // The portal records the finish in ft1320 for every class (the ft1000 column
  // is empty even for the 1000-ft nitro classes), so prefer it and fall back.
  const byCar = new Map<string, LiveOrderRow>();
  for (const r of runs) {
    if (r.isDQ) continue;
    const et =
      r.ft1320 != null && r.ft1320 > 0
        ? r.ft1320
        : r.ft1000 != null && r.ft1000 > 0
          ? r.ft1000
          : null;
    const mph = r.ft1320 != null && r.ft1320 > 0 ? r.mph1320 : r.mph1000;
    const key = r.carNumber;
    const cur =
      byCar.get(key) ??
      {
        carNumber: r.carNumber,
        driverName: r.driverName,
        bestEt: null,
        bestMph: null,
        bestSession: null,
        runs: 0,
      };
    cur.runs += 1;
    if (r.driverName && !cur.driverName) cur.driverName = r.driverName;
    if (et != null && et > 0 && (cur.bestEt == null || et < cur.bestEt)) {
      cur.bestEt = et;
      cur.bestMph = mph ?? null;
      cur.bestSession = r.session;
    }
    byCar.set(key, cur);
  }

  return [...byCar.values()].sort((a, b) => {
    if (a.bestEt == null && b.bestEt == null) return 0;
    if (a.bestEt == null) return 1;
    if (b.bestEt == null) return -1;
    return a.bestEt - b.bestEt;
  });
}
