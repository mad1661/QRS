import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { StandingRow } from "./types";

/** Classes published on nhra.com that scrapePoints can seed. */
export const STANDINGS_CLASSES = ["TF", "FC", "PS", "PSM"] as const;

interface ScrapePointsResult {
  year: number;
  results: Record<string, StandingRow[]>;
}

export async function scrapePoints(
  year: number,
  classCodes: string[],
): Promise<ScrapePointsResult> {
  const fn = httpsCallable<
    { year: number; classCodes: string[] },
    ScrapePointsResult
  >(functions, "scrapePoints");
  const res = await fn({ year, classCodes });
  return res.data;
}

interface ScrapeResultsResult {
  loggedIn: boolean;
  landingUrl: string;
  dropdowns: Record<string, { value: string; label: string }[]>;
  grid: { headers: string[]; rows: Record<string, string>[] };
}

export async function scrapeResults(params: {
  year?: number;
  eventCode?: string;
  category?: string;
}): Promise<ScrapeResultsResult> {
  const fn = httpsCallable<typeof params, ScrapeResultsResult>(
    functions,
    "scrapeResults",
  );
  const res = await fn(params);
  return res.data;
}
