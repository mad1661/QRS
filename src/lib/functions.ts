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

export interface PortalOption {
  value: string;
  label: string;
}

export interface ScrapeResultsSelection {
  year?: string;
  eventType?: string;
  event?: string;
  date?: string;
  category?: string;
  /** "all" walks every date × category for the event and returns all rows. */
  mode?: "all";
}

export interface ScrapeResultsResult {
  years: PortalOption[];
  eventTypes: PortalOption[];
  events: PortalOption[];
  dates: PortalOption[];
  categories: PortalOption[];
  grid?: { headers: string[]; rows: Record<string, string>[] };
  /** Bulk mode: every run row across all dates/categories for the event. */
  allRows?: Record<string, string>[];
  /** Bulk mode: distinct UPPERCASE category names found. */
  categoriesSeen?: string[];
  selection: ScrapeResultsSelection;
}

export async function scrapeResults(
  params: ScrapeResultsSelection,
): Promise<ScrapeResultsResult> {
  const fn = httpsCallable<ScrapeResultsSelection, ScrapeResultsResult>(
    functions,
    "scrapeResults",
  );
  const res = await fn(params);
  return res.data;
}
