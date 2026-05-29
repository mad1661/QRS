import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { CLASSES } from "./classes";
import type { AccountStatus } from "./constants";
import type {
  EntryDoc,
  EventDoc,
  NewEntry,
  NewEvent,
  NewRun,
  RunDoc,
  UserDoc,
} from "./types";

const DEFAULT_SESSIONS = 4;

function eventsCol() {
  return collection(db, "events");
}

function entriesCol(eventId: string) {
  return collection(db, "events", eventId, "entries");
}

function runsCol(eventId: string) {
  return collection(db, "events", eventId, "runs");
}

/** Stable, idempotent run id: one run per car per session per class. */
export function runId(run: Pick<NewRun, "classCode" | "session" | "carNumber">) {
  const car = (run.carNumber || "x").replace(/[/]/g, "-");
  return `${run.classCode}_${run.session}_${car}`;
}

function mapEvent(id: string, data: Record<string, unknown>): EventDoc {
  return {
    id,
    name: (data.name as string) ?? "",
    eventCode: (data.eventCode as string) ?? "",
    year: (data.year as number) ?? new Date().getFullYear(),
    ownerUid: (data.ownerUid as string) ?? "",
    ownerEmail: (data.ownerEmail as string) ?? "",
    editors: (data.editors as string[]) ?? [],
    viewers: (data.viewers as string[]) ?? [],
    enabledClasses: (data.enabledClasses as string[]) ?? [],
    sessionsByClass: (data.sessionsByClass as Record<string, number>) ?? {},
    categoryOverrides:
      (data.categoryOverrides as Record<string, string>) ?? undefined,
    createdAt: (data.createdAt as EventDoc["createdAt"]) ?? null,
    updatedAt: (data.updatedAt as EventDoc["updatedAt"]) ?? null,
  };
}

function mapEntry(id: string, data: Record<string, unknown>): EntryDoc {
  return {
    id,
    classCode: (data.classCode as string) ?? "",
    carNumber: (data.carNumber as string) ?? "",
    driverName: (data.driverName as string) ?? "",
    points: (data.points as number | null) ?? null,
    seed: (data.seed as number | null) ?? null,
    createdAt: (data.createdAt as EntryDoc["createdAt"]) ?? null,
    updatedAt: (data.updatedAt as EntryDoc["updatedAt"]) ?? null,
  };
}

// ---------- Events ----------

export async function createEvent(
  owner: { uid: string; email: string },
  input: NewEvent,
): Promise<string> {
  const enabledClasses = input.enabledClasses ?? CLASSES.map((c) => c.code);
  const sessionsByClass =
    input.sessionsByClass ??
    Object.fromEntries(enabledClasses.map((code) => [code, DEFAULT_SESSIONS]));

  const ref = await addDoc(eventsCol(), {
    name: input.name.trim(),
    eventCode: input.eventCode.trim(),
    year: input.year,
    ownerUid: owner.uid,
    ownerEmail: owner.email,
    editors: [owner.email],
    viewers: [],
    enabledClasses,
    sessionsByClass,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getEvent(eventId: string): Promise<EventDoc | null> {
  const snap = await getDoc(doc(db, "events", eventId));
  return snap.exists() ? mapEvent(snap.id, snap.data()) : null;
}

export function subscribeEvent(
  eventId: string,
  cb: (event: EventDoc | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, "events", eventId), (snap) => {
    cb(snap.exists() ? mapEvent(snap.id, snap.data()) : null);
  });
}

export function subscribeEvents(
  cb: (events: EventDoc[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  // No server-side ordering (avoids a composite index); callers sort client-side.
  return onSnapshot(
    eventsCol(),
    (snap) => cb(snap.docs.map((d) => mapEvent(d.id, d.data()))),
    (err) => onError?.(err),
  );
}

export async function updateEvent(
  eventId: string,
  patch: Partial<Omit<EventDoc, "id" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(db, "events", eventId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function renameEvent(eventId: string, name: string): Promise<void> {
  await updateEvent(eventId, { name: name.trim() });
}

export async function deleteEvent(eventId: string): Promise<void> {
  // Delete entries first so we don't orphan the subcollection.
  const entries = await getDocs(entriesCol(eventId));
  await Promise.all(entries.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "events", eventId));
}

// ---------- Entries ----------

export function subscribeEntries(
  eventId: string,
  cb: (entries: EntryDoc[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    entriesCol(eventId),
    (snap) => cb(snap.docs.map((d) => mapEntry(d.id, d.data()))),
    (err) => onError?.(err),
  );
}

export function subscribeClassEntries(
  eventId: string,
  classCode: string,
  cb: (entries: EntryDoc[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(entriesCol(eventId), where("classCode", "==", classCode));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => mapEntry(d.id, d.data()))),
    (err) => onError?.(err),
  );
}

export async function addEntry(
  eventId: string,
  input: NewEntry,
): Promise<string> {
  const ref = await addDoc(entriesCol(eventId), {
    classCode: input.classCode,
    carNumber: input.carNumber.trim(),
    driverName: input.driverName.trim(),
    points: input.points ?? null,
    seed: input.seed ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEntry(
  eventId: string,
  entryId: string,
  patch: Partial<Omit<EntryDoc, "id" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(db, "events", eventId, "entries", entryId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEntry(
  eventId: string,
  entryId: string,
): Promise<void> {
  await deleteDoc(doc(db, "events", eventId, "entries", entryId));
}

/** Bulk insert entries (used by xlsx/CSV import). Returns count written. */
export async function addEntries(
  eventId: string,
  entries: NewEntry[],
): Promise<number> {
  await Promise.all(entries.map((e) => addEntry(eventId, e)));
  return entries.length;
}

/** Replace all entries for a class with the provided set (idempotent import). */
export async function replaceClassEntries(
  eventId: string,
  classCode: string,
  entries: NewEntry[],
): Promise<void> {
  const existing = await getDocs(
    query(entriesCol(eventId), where("classCode", "==", classCode)),
  );
  await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)));
  await addEntries(eventId, entries);
}

// ---------- Runs (results) ----------

function mapRun(id: string, data: Record<string, unknown>): RunDoc {
  const num = (k: string) => (data[k] as number | null) ?? null;
  return {
    id,
    classCode: (data.classCode as string) ?? "",
    session: (data.session as number) ?? 1,
    carNumber: (data.carNumber as string) ?? "",
    driverName: (data.driverName as string) ?? "",
    lane: (data.lane as string) ?? "",
    rt: num("rt"),
    ft60: num("ft60"),
    ft330: num("ft330"),
    ft660: num("ft660"),
    mph660: num("mph660"),
    ft1000: num("ft1000"),
    mph1000: num("mph1000"),
    ft1320: num("ft1320"),
    mph1320: num("mph1320"),
    dialIn: num("dialIn"),
    isDQ: (data.isDQ as boolean) ?? false,
    source: (data.source as string) ?? "scraped",
    category: (data.category as string) ?? "",
    timestamp: (data.timestamp as string) ?? "",
    createdAt: (data.createdAt as RunDoc["createdAt"]) ?? null,
    updatedAt: (data.updatedAt as RunDoc["updatedAt"]) ?? null,
  };
}

export function subscribeClassRuns(
  eventId: string,
  classCode: string,
  cb: (runs: RunDoc[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(runsCol(eventId), where("classCode", "==", classCode));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => mapRun(d.id, d.data()))),
    (err) => onError?.(err),
  );
}

export async function upsertRun(
  eventId: string,
  run: NewRun,
): Promise<void> {
  const id = runId(run);
  await setDoc(
    doc(db, "events", eventId, "runs", id),
    { ...run, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true },
  );
}

/** Bulk upsert scraped runs (idempotent by car/session/class). */
export async function upsertRuns(
  eventId: string,
  runs: NewRun[],
): Promise<number> {
  await Promise.all(runs.map((r) => upsertRun(eventId, r)));
  return runs.length;
}

export async function deleteRun(eventId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "events", eventId, "runs", id));
}

// ---------- Users (superadmin approval) ----------

export function subscribeUsers(
  cb: (users: UserDoc[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, "users"),
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            email: (data.email as string | null) ?? null,
            displayName: (data.displayName as string | null) ?? null,
            status: (data.status as AccountStatus) ?? "pending",
            createdAt: (data.createdAt as UserDoc["createdAt"]) ?? null,
          };
        }),
      ),
    (err) => onError?.(err),
  );
}

export async function setUserStatus(
  uid: string,
  status: AccountStatus,
): Promise<void> {
  await updateDoc(doc(db, "users", uid), { status });
}

/** Used by event creation when a custom id is desired (e.g. seeding/tests). */
export async function setEvent(
  eventId: string,
  data: Partial<EventDoc>,
): Promise<void> {
  await setDoc(
    doc(db, "events", eventId),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
