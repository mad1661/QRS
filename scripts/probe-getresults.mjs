// Probe getresults.nhradata.com to inspect the cascade + grid structure.
import * as cheerio from "../functions/node_modules/cheerio/dist/esm/index.js";

const BASE = "https://getresults.nhradata.com";
const LOGIN_URL = `${BASE}/login.aspx?ReturnUrl=%2f`;
const POST_URL = `${BASE}/default.aspx`;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) QRS/1.0";
const USER = "getresults";
const PASS = "letmein";

const jar = new Map();
function store(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}
const cookie = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

function formState(html) {
  const $ = cheerio.load(html);
  const f = {};
  $("input").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    const type = ($(el).attr("type") ?? "text").toLowerCase();
    if (type === "hidden" || type === "text") f[name] = $(el).attr("value") ?? "";
  });
  $("select").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    f[name] =
      $(el).find("option[selected]").attr("value") ??
      $(el).find("option").first().attr("value") ??
      "";
  });
  return f;
}
function dropdown(html, id) {
  const $ = cheerio.load(html);
  return $(`#${id} option`)
    .map((_, o) => ({ value: $(o).attr("value") ?? "", label: $(o).text().trim() }))
    .get()
    .filter((o) => o.label && !/^--/.test(o.label));
}

let html = "";
async function postback(target, value) {
  const f = formState(html);
  f[target] = value;
  f["__EVENTTARGET"] = target;
  f["__EVENTARGUMENT"] = "";
  const res = await fetch(POST_URL, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie(),
      Referer: `${BASE}/`,
    },
    body: new URLSearchParams(f).toString(),
  });
  store(res);
  html = await res.text();
}

// 1) login
const loginPage = await fetch(LOGIN_URL, { headers: { "User-Agent": UA } });
store(loginPage);
const lf = formState(await loginPage.text());
lf["UsernameTextbox"] = USER;
lf["PasswordTextbox"] = PASS;
lf["LoginButton"] = "Login";
const loginRes = await fetch(`${BASE}/login.aspx`, {
  method: "POST",
  redirect: "manual",
  headers: {
    "User-Agent": UA,
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: cookie(),
    Referer: LOGIN_URL,
  },
  body: new URLSearchParams(lf).toString(),
});
store(loginRes);
html = await (await fetch(`${BASE}/`, { headers: { "User-Agent": UA, Cookie: cookie() } }).then((r) => { store(r); return r; })).text();
console.log("logged in:", /runGridView|yearDropDown/.test(html));

console.log("\nYEARS:", dropdown(html, "yearDropDown"));
await postback("yearDropDown", "2026");
await postback("eventTypeDropDown", "N");
const events = dropdown(html, "divEventRaceDropDown");
console.log("\nEVENTS (2026, N):", events);

const potomac = events.find((e) => /potomac/i.test(e.label)) ?? events[0];
console.log("\nusing event:", potomac);
await postback("divEventRaceDropDown", potomac.value);
const dates = dropdown(html, "dateDropDown");
console.log("\nDATES:", dates);

if (dates[0]) {
  await postback("dateDropDown", dates[0].value);
  const cats = dropdown(html, "categoryRoundDropDown");
  console.log("\nCATEGORY/ROUND options for", dates[0].label, ":");
  for (const c of cats) console.log("   ", JSON.stringify(c));

  const fc = cats.find((c) => /funny/i.test(c.label)) ?? cats[0];
  if (fc) {
    console.log("\nusing category/round:", fc);
    await postback("categoryRoundDropDown", fc.value);
    const $ = cheerio.load(html);
    const headers = $("#runGridView tr").first().find("th").map((_, th) => $(th).text().trim()).get();
    console.log("\nGRID HEADERS:", headers);
    const firstRow = $("#runGridView tr").slice(1).first().find("td").map((_, td) => $(td).text().trim()).get();
    console.log("FIRST ROW:", firstRow);
    console.log("ROW COUNT:", $("#runGridView tr").length - 1);
  }
}
