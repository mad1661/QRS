// One-off: grant allUsers the Cloud Run invoker role on the callable function
// services so browsers can invoke them (callable functions enforce auth inside).
import os from "node:os";
import fs from "node:fs";

const PROJECT = "nhra-qrs";
const REGION = "us-central1";
// Well-known public firebase-tools desktop OAuth client.
const CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

const cfg = JSON.parse(
  fs.readFileSync(`${os.homedir()}/.config/configstore/firebase-tools.json`, "utf8"),
);
const refreshToken = cfg.tokens?.refresh_token;
if (!refreshToken) throw new Error("No refresh token in firebase-tools config");

async function accessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error("token exchange failed: " + JSON.stringify(json));
  return json.access_token;
}

const TOKEN = await accessToken();
const auth = { Authorization: `Bearer ${TOKEN}` };

async function api(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { ...auth, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${res.status} ${url}\n${JSON.stringify(body)}`);
  return body;
}

const base = `https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services`;
const list = await api(base);
const services = (list.services || []).map((s) => s.name);
console.log("Cloud Run services found:");
for (const n of services) console.log("  -", n.split("/").pop());

const wanted = services.filter((n) => {
  const id = n.split("/").pop().toLowerCase();
  return id.includes("scrapepoints") || id.includes("scraperesults");
});
if (wanted.length === 0) throw new Error("No scrape* services found");

for (const name of wanted) {
  const id = name.split("/").pop();
  const policy = await api(`https://run.googleapis.com/v2/${name}:getIamPolicy`);
  const bindings = policy.bindings || [];
  let inv = bindings.find((b) => b.role === "roles/run.invoker");
  if (!inv) {
    inv = { role: "roles/run.invoker", members: [] };
    bindings.push(inv);
  }
  if (inv.members?.includes("allUsers")) {
    console.log(`= ${id}: allUsers already invoker`);
    continue;
  }
  inv.members = [...new Set([...(inv.members || []), "allUsers"])];
  await api(`https://run.googleapis.com/v2/${name}:setIamPolicy`, {
    method: "POST",
    body: JSON.stringify({ policy: { bindings, etag: policy.etag } }),
  });
  console.log(`+ ${id}: granted allUsers roles/run.invoker`);
}
console.log("Done.");
