import type { Timestamp } from "firebase/firestore";
import type { AccountStatus } from "./constants";

/** A timestamp that may be a Firestore Timestamp (read) or undefined (pre-write). */
export type Stamp = Timestamp | null;

/** A user profile / approval record at `users/{uid}`. */
export interface UserDoc {
  uid: string;
  email: string | null;
  displayName: string | null;
  status: AccountStatus;
  createdAt: Stamp;
}

/** One driver's standing row, parsed from NHRA.com. */
export interface StandingRow {
  position: number;
  driver: string;
  points: number;
  vehicle: string;
  /** Car/bike number from the driver's nhra.com profile ("" if unavailable). */
  carNumber?: string;
}

/** A scraped standings doc at `standings/{year}_{classCode}`. */
export interface StandingsDoc {
  year: number;
  classCode: string;
  rows: StandingRow[];
  source: string;
  scrapedAt: Stamp;
}

/**
 * An event = one race weekend. Document at `events/{eventId}`.
 * Entries live in the `events/{eventId}/entries` subcollection.
 */
export interface EventDoc {
  id: string;
  name: string;
  /** NHRA event code, e.g. "01-GF1". Optional/freeform. */
  eventCode: string;
  /** Season year, e.g. 2026. */
  year: number;
  ownerUid: string;
  ownerEmail: string;
  /** Emails allowed to edit. */
  editors: string[];
  /** Emails allowed to view. */
  viewers: string[];
  /** Class codes that run at this event (subset of CLASSES). */
  enabledClasses: string[];
  /** Number of qualifying sessions per class code (defaults applied in UI). */
  sessionsByClass: Record<string, number>;
  /**
   * Overrides for routing portal categories to a class, keyed by the UPPERCASE
   * portal category name. Value is a class code, or "" to ignore the category.
   * Used for "race within a race" (e.g. a shootout category counts for FC).
   */
  categoryOverrides?: Record<string, string>;
  createdAt: Stamp;
  updatedAt: Stamp;
}

/** Payload for creating an event (server fills the rest). */
export type NewEvent = Pick<EventDoc, "name" | "eventCode" | "year"> &
  Partial<Pick<EventDoc, "enabledClasses" | "sessionsByClass">>;

/**
 * A single competitor entry in a class for an event.
 * Document at `events/{eventId}/entries/{entryId}`.
 */
export interface EntryDoc {
  id: string;
  classCode: string;
  /** Car / bike number as shown on the vehicle. */
  carNumber: string;
  driverName: string;
  /** Season points used to seed the Session 1 order (from standings scrape or manual). */
  points: number | null;
  /** Optional manual override of the seed position; otherwise derived from points. */
  seed: number | null;
  createdAt: Stamp;
  updatedAt: Stamp;
}

export type NewEntry = Pick<EntryDoc, "classCode" | "carNumber" | "driverName"> &
  Partial<Pick<EntryDoc, "points" | "seed">>;

/**
 * A single run result, at `events/{eventId}/runs/{runId}`.
 * Doc id is `${classCode}_${session}_${carNumber}` so re-imports are idempotent.
 */
export interface RunDoc {
  id: string;
  classCode: string;
  /** Session number (Q1 -> 1, Q2 -> 2, ...). */
  session: number;
  carNumber: string;
  driverName: string;
  lane: string;
  /** Reaction time. */
  rt: number | null;
  ft60: number | null;
  ft330: number | null;
  ft660: number | null;
  mph660: number | null;
  ft1000: number | null;
  mph1000: number | null;
  ft1320: number | null;
  mph1320: number | null;
  dialIn: number | null;
  isDQ: boolean;
  /** Source: 'scraped' | 'manual'. */
  source: string;
  /** Original portal category label. */
  category: string;
  timestamp: string;
  createdAt: Stamp;
  updatedAt: Stamp;
}

export type NewRun = Omit<RunDoc, "id" | "createdAt" | "updatedAt">;
