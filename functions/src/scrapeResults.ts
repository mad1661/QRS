import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as cheerio from "cheerio";
import { assertApproved } from "./scrapePoints.js";

/**
 * getresults.nhradata.com is an ASP.NET WebForms app behind a login. This
 * function logs in with Secret Manager credentials, then scrapes the run grid
 * (runGridView) and the available filter dropdowns. Selection postbacks
 * (year/event/category) need validation against the live portal, so the first
 * runs are expected to be used to refine the postback flow.
 */

const RESULTS_USER = defineSecret("NHRA_RESULTS_USER");
const RESULTS_PASS = defineSecret("NHRA_RESULTS_PASS");

const BASE = "https://getresults.nhradata.com";
const LOGIN_URL = `${BASE}/login.aspx?ReturnUrl=%2f`;

/** Minimal cookie jar: stores name=value pairs from Set-Cookie. */
class CookieJar {
  private jar = new Map<string, string>();

  store(res: Response) {
    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookies) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) this.jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  header(): string {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) QRS/1.0";

/** Collect every hidden input plus the discovered credential/submit fields. */
function buildLoginForm(html: string, user: string, pass: string) {
  const $ = cheerio.load(html);
  const form: Record<string, string> = {};

  $("input").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    const type = ($(el).attr("type") ?? "text").toLowerCase();
    const value = $(el).attr("value") ?? "";
    if (type === "hidden") form[name] = value;
  });

  // Discover the username (text/email) and password fields by type.
  const userField =
    $('input[type="email"]').attr("name") ??
    $('input[type="text"]').first().attr("name");
  const passField = $('input[type="password"]').first().attr("name");
  if (!userField || !passField) {
    throw new HttpsError(
      "internal",
      "Could not locate login fields on login.aspx (page layout changed).",
    );
  }
  form[userField] = user;
  form[passField] = pass;

  // Include the submit button so WebForms treats it as the trigger.
  const submit = $('input[type="submit"]').first();
  const submitName = submit.attr("name");
  if (submitName) form[submitName] = submit.attr("value") ?? "Log In";

  const action = $("form").attr("action") ?? "login.aspx";
  return { form, action };
}

function parseDropdown($: cheerio.CheerioAPI, id: string) {
  const opts: { value: string; label: string }[] = [];
  $(`#${id} option`).each((_, o) => {
    opts.push({
      value: $(o).attr("value") ?? "",
      label: $(o).text().trim(),
    });
  });
  return opts;
}

function parseRunGrid($: cheerio.CheerioAPI) {
  const headers: string[] = [];
  $("#runGridView tr").first().find("th").each((_, th) => {
    headers.push($(th).text().trim());
  });

  const rows: Record<string, string>[] = [];
  $("#runGridView tr").slice(1).each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length === 0) return;
    const row: Record<string, string> = {};
    cells.each((i, td) => {
      const key = headers[i] || `col${i}`;
      row[key] = $(td).text().trim();
    });
    rows.push(row);
  });

  return { headers, rows };
}

export const scrapeResults = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 240,
    memory: "1GiB",
    secrets: [RESULTS_USER, RESULTS_PASS],
  },
  async (request) => {
    await assertApproved(request.auth?.uid, request.auth?.token.email);

    const user = RESULTS_USER.value();
    const pass = RESULTS_PASS.value();
    if (!user || !pass) {
      throw new HttpsError(
        "failed-precondition",
        "Portal credentials are not configured in Secret Manager.",
      );
    }

    const jar = new CookieJar();

    // 1) GET the login page to capture viewstate + discover fields.
    const loginPage = await fetch(LOGIN_URL, { headers: { "User-Agent": UA } });
    jar.store(loginPage);
    const { form, action } = buildLoginForm(
      await loginPage.text(),
      user,
      pass,
    );

    // 2) POST credentials.
    const postUrl = new URL(action, LOGIN_URL).toString();
    const loginRes = await fetch(postUrl, {
      method: "POST",
      redirect: "manual",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: jar.header(),
        Referer: LOGIN_URL,
      },
      body: new URLSearchParams(form).toString(),
    });
    jar.store(loginRes);

    const redirected =
      loginRes.status >= 300 && loginRes.status < 400;
    // 3) Follow to the landing/results page.
    const landingUrl = redirected
      ? new URL(loginRes.headers.get("location") ?? "/", BASE).toString()
      : BASE + "/";
    const landing = await fetch(landingUrl, {
      headers: { "User-Agent": UA, Cookie: jar.header() },
    });
    jar.store(landing);
    const html = await landing.text();
    const $ = cheerio.load(html);

    const loggedIn = !/login\.aspx/i.test(landing.url) &&
      $("#runGridView").length + $("#yearDropDown").length > 0;

    if (!loggedIn) {
      throw new HttpsError(
        "permission-denied",
        "Login appears to have failed (no results page returned). Check credentials.",
      );
    }

    const dropdowns = {
      year: parseDropdown($, "yearDropDown"),
      eventType: parseDropdown($, "eventTypeDropDown"),
      event: parseDropdown($, "divEventRaceDropDown"),
      categoryRound: parseDropdown($, "categoryRoundDropDown"),
    };
    const grid = parseRunGrid($);

    return {
      loggedIn: true,
      landingUrl: landing.url,
      dropdowns,
      grid,
    };
  },
);
