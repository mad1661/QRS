import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as cheerio from "cheerio";
import { assertApproved } from "./scrapePoints.js";

/**
 * getresults.nhradata.com is an ASP.NET WebForms app behind a login. The
 * results page uses a cascade of auto-postback dropdowns:
 *
 *   year -> eventType -> event -> date -> category+round -> run grid
 *
 * This function logs in (Secret Manager credentials), then replays the cascade
 * as far as the provided selection allows, returning the option lists for each
 * level plus the run grid once a category+round is chosen. The client drives it
 * progressively, passing back the opaque option values.
 */

const RESULTS_USER = defineSecret("NHRA_RESULTS_USER");
const RESULTS_PASS = defineSecret("NHRA_RESULTS_PASS");

const BASE = "https://getresults.nhradata.com";
const LOGIN_URL = `${BASE}/login.aspx?ReturnUrl=%2f`;
const POST_URL = `${BASE}/default.aspx`;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) QRS/1.0";

interface Option {
  value: string;
  label: string;
}

class CookieJar {
  private jar = new Map<string, string>();
  store(res: Response) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) this.jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  header() {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

/** Hidden inputs + text inputs + current select values, for replaying postbacks. */
function formState(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const fields: Record<string, string> = {};
  $("input").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    const type = ($(el).attr("type") ?? "text").toLowerCase();
    if (type === "hidden" || type === "text") fields[name] = $(el).attr("value") ?? "";
  });
  $("select").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    const selected =
      $(el).find("option[selected]").attr("value") ??
      $(el).find("option").first().attr("value") ??
      "";
    fields[name] = selected;
  });
  return fields;
}

function dropdown(html: string, id: string): Option[] {
  const $ = cheerio.load(html);
  return $(`#${id} option`)
    .map((_, o) => ({ value: $(o).attr("value") ?? "", label: $(o).text().trim() }))
    .get()
    .filter((o) => o.label && !/^--/.test(o.label));
}

function parseGrid(html: string) {
  const $ = cheerio.load(html);
  const headers = $("#runGridView tr")
    .first()
    .find("th")
    .map((_, th) => $(th).text().trim())
    .get();
  const rows: Record<string, string>[] = [];
  $("#runGridView tr")
    .slice(1)
    .each((_, tr) => {
      const cells = $(tr).find("td");
      if (cells.length === 0) return;
      const row: Record<string, string> = {};
      cells.each((i, td) => {
        row[headers[i] || `col${i}`] = $(td).text().trim();
      });
      rows.push(row);
    });
  return { headers, rows };
}

export const scrapeResults = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 240,
    memory: "512MiB",
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

    const sel = {
      year: request.data?.year as string | undefined,
      eventType: (request.data?.eventType as string | undefined) ?? "N",
      event: request.data?.event as string | undefined,
      date: request.data?.date as string | undefined,
      category: request.data?.category as string | undefined,
    };

    const jar = new CookieJar();

    // 1) Login.
    const loginPage = await fetch(LOGIN_URL, { headers: { "User-Agent": UA } });
    jar.store(loginPage);
    const loginFields = formState(await loginPage.text());
    loginFields["UsernameTextbox"] = user;
    loginFields["PasswordTextbox"] = pass;
    loginFields["LoginButton"] = "Login";
    const loginRes = await fetch(`${BASE}/login.aspx`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: jar.header(),
        Referer: LOGIN_URL,
      },
      body: new URLSearchParams(loginFields).toString(),
    });
    jar.store(loginRes);

    let html = await (
      await fetch(`${BASE}/`, { headers: { "User-Agent": UA, Cookie: jar.header() } }).then(
        (r) => {
          jar.store(r);
          return r;
        },
      )
    ).text();

    if (!/runGridView|yearDropDown/.test(html)) {
      throw new HttpsError("permission-denied", "Login failed; check credentials.");
    }

    // Generic postback that sets a control's value and triggers its change.
    async function postback(target: string, value: string): Promise<void> {
      const fields = formState(html);
      fields[target] = value;
      fields["__EVENTTARGET"] = target;
      fields["__EVENTARGUMENT"] = "";
      const res = await fetch(POST_URL, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: jar.header(),
          Referer: `${BASE}/`,
        },
        body: new URLSearchParams(fields).toString(),
      });
      jar.store(res);
      html = await res.text();
    }

    // 2) Drive the cascade as far as the selection allows.
    if (sel.year) await postback("yearDropDown", sel.year);
    if (sel.year || sel.eventType) await postback("eventTypeDropDown", sel.eventType);
    if (sel.event) await postback("divEventRaceDropDown", sel.event);
    if (sel.date) await postback("dateDropDown", sel.date);
    if (sel.category) await postback("categoryRoundDropDown", sel.category);

    const result: {
      years: Option[];
      eventTypes: Option[];
      events: Option[];
      dates: Option[];
      categories: Option[];
      grid?: { headers: string[]; rows: Record<string, string>[] };
      selection: typeof sel;
    } = {
      years: dropdown(html, "yearDropDown"),
      eventTypes: dropdown(html, "eventTypeDropDown"),
      events: dropdown(html, "divEventRaceDropDown"),
      dates: dropdown(html, "dateDropDown"),
      categories: dropdown(html, "categoryRoundDropDown"),
      selection: sel,
    };

    if (sel.category) result.grid = parseGrid(html);

    return result;
  },
);
