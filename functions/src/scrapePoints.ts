import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as cheerio from "cheerio";
import { isSuperAdminEmail } from "./constants.js";

/** NHRA.com only publishes the four pro categories. */
const NHRA_TAB_BY_CODE: Record<string, string> = {
  TF: "top-fuel",
  FC: "funny-car",
  PS: "pro-stock",
  PSM: "pro-stock-motorcycle",
};

const SERIES_SLUG = "nhra-mission-foods-drag-racing-series";

export interface StandingRow {
  position: number;
  driver: string;
  points: number;
  vehicle: string;
}

function standingsUrl(year: number, tab: string): string {
  return `https://www.nhra.com/standings/${year}/${SERIES_SLUG}/${SERIES_SLUG}?tab=${tab}`;
}

function parseStandings(html: string): StandingRow[] {
  const $ = cheerio.load(html);
  const rows: StandingRow[] = [];

  $("table.table--standings tbody tr").each((_, tr) => {
    const cells = $(tr).children("th, td");
    if (cells.length < 3) return;

    // Position lives in the leading <th> (may include a "clinched" image).
    const posText = $(cells[0]).text().replace(/\D+/g, "").trim();
    const driver = $(cells[1]).find("a").first().text().trim() ||
      $(cells[1]).text().trim();
    const pointsText = $(cells[2]).text().replace(/[^\d.-]/g, "").trim();
    // Vehicle is the last left-aligned cell.
    const vehicle = $(cells[cells.length - 1]).text().trim();

    if (!driver) return;
    const position = Number(posText);
    const points = Number(pointsText);
    rows.push({
      position: Number.isFinite(position) ? position : rows.length + 1,
      driver,
      points: Number.isFinite(points) ? points : 0,
      vehicle: vehicle === driver ? "" : vehicle,
    });
  });

  return rows;
}

async function fetchClassStandings(
  year: number,
  classCode: string,
): Promise<StandingRow[]> {
  const tab = NHRA_TAB_BY_CODE[classCode];
  if (!tab) {
    throw new HttpsError(
      "invalid-argument",
      `Class ${classCode} is not published on nhra.com (only TF, FC, PS, PSM).`,
    );
  }
  const res = await fetch(standingsUrl(year, tab), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; QRS/1.0)" },
  });
  if (!res.ok) {
    throw new HttpsError("unavailable", `NHRA returned ${res.status}`);
  }
  return parseStandings(await res.text());
}

export async function assertApproved(
  uid: string | undefined,
  email: string | undefined,
) {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  if (isSuperAdminEmail(email)) return;
  const snap = await getFirestore().doc(`users/${uid}`).get();
  const status = snap.exists ? (snap.data()?.status as string) : undefined;
  if (status !== "approved") {
    throw new HttpsError("permission-denied", "Account not approved.");
  }
}

/**
 * scrapePoints({ year, classCodes }): fetches NHRA standings for the requested
 * pro classes, stores each at `standings/{year}_{classCode}`, and returns them.
 */
export const scrapePoints = onCall(
  { region: "us-central1", timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    await assertApproved(request.auth?.uid, request.auth?.token.email);

    const year: number = request.data?.year ?? new Date().getFullYear();
    const classCodes: string[] =
      request.data?.classCodes ?? Object.keys(NHRA_TAB_BY_CODE);

    const db = getFirestore();
    const results: Record<string, StandingRow[]> = {};

    for (const code of classCodes) {
      const rows = await fetchClassStandings(year, code);
      results[code] = rows;
      await db.doc(`standings/${year}_${code}`).set({
        year,
        classCode: code,
        rows,
        source: standingsUrl(year, NHRA_TAB_BY_CODE[code]),
        scrapedAt: FieldValue.serverTimestamp(),
      });
    }

    return { year, results };
  },
);
