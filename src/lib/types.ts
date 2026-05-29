import type { Timestamp } from "firebase/firestore";

/** A timestamp that may be a Firestore Timestamp (read) or undefined (pre-write). */
export type Stamp = Timestamp | null;

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
