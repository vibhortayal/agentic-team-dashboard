#!/usr/bin/env node
// AC7: saving obeys the same rules as other changes (this computer, same origin, JSON body).
// The demo shows a sample list and saves nothing.
import fs from "node:fs";
import path from "node:path";
import { FakeGitHub, filesUnder, run, settings, startBoard } from "./lib.mjs";

await run("AC7 only from the board's own page", async (r, own) => {
  const gh = own(await new FakeGitHub({
    list: JSON.stringify({ settings: [{ name: "OPENAI_API_KEY", kind: "secret", why: "Lets your app write answers." },
      { name: "APP_COLOUR", kind: "variable", why: "Colour." }] }),
  }).start());
  const b = own(await startBoard(gh));
  const host = `127.0.0.1:${b.port}`;
  const own_ = `http://${host}`;
  const json = JSON.stringify({ name: "OPENAI_API_KEY", value: "from-elsewhere-123" });
  const bad = [
    ["no Origin", { Host: host, "Content-Type": "application/json" }, json],
    ["another site's Origin", { Host: host, Origin: "https://evil.example", "Content-Type": "application/json" }, json],
    ["Origin 'null'", { Host: host, Origin: "null", "Content-Type": "application/json" }, json],
    ["Origin on another port", { Host: host, Origin: `http://127.0.0.1:${b.port + 1}`, "Content-Type": "application/json" }, json],
    ["form body (text/plain)", { Host: host, Origin: own_, "Content-Type": "text/plain" }, json],
    ["form body (urlencoded)", { Host: host, Origin: own_, "Content-Type": "application/x-www-form-urlencoded" }, "name=OPENAI_API_KEY&value=x"],
    ["form body (multipart)", { Host: host, Origin: own_, "Content-Type": "multipart/form-data; boundary=x" }, "--x--"],
    ["no Content-Type", { Host: host, Origin: own_ }, json],
    ["another Host (DNS rebinding)", { Host: `evil.example:${b.port}`, Origin: `http://evil.example:${b.port}`, "Content-Type": "application/json" }, json],
  ];
  for (const [why, headers, body] of bad) {
    const res = await b.raw("POST", "/api/settings", headers, body);
    r.check(res.status === 403, `refused with ${why} (${res.status})`);
  }
  const notJson = await b.raw("POST", "/api/settings", { Host: host, Origin: own_, "Content-Type": "application/json" }, "name=OPENAI_API_KEY");
  r.check(notJson.status === 400, `refused when the body isn't JSON (${notJson.status})`);
  for (const m of ["PUT", "PATCH", "DELETE"]) {
    const res = await b.raw(m, "/api/settings", { Host: host, Origin: own_, "Content-Type": "application/json" }, json);
    r.check(res.status >= 400, `${m} does nothing (${res.status})`);
  }
  const rebindGet = await b.raw("GET", "/api/settings", { Host: `evil.example:${b.port}` });
  r.check(rebindGet.status === 403, `reading the list from another Host is refused (${rebindGet.status})`);
  r.check(gh.writes().length === 0, `nothing reached GitHub (${gh.writes().map((c) => c.method + " " + c.path)})`);
  const ok = await b.raw("POST", "/api/settings", { Host: `localhost:${b.port}`, Origin: `http://localhost:${b.port}`, "Content-Type": "application/json" },
    JSON.stringify({ name: "APP_COLOUR", value: "blue" }));
  r.check(ok.status === 200 && gh.variables.APP_COLOUR === "blue", `the page opened as localhost can save (${ok.status})`);
  r.check(b.netAttempts().length === 0, "no attempt to reach the internet");

  // The demo.
  const d = own(await startBoard(null, { demo: true }));
  const ds = await settings(d);
  const n = ds.data?.items?.length ?? 0;
  r.check(ds.status === 200 && n > 0, `the demo shows a sample list (${n} entries: ${(ds.data?.items ?? []).map((i) => i.name)})`);
  r.check((ds.data?.items ?? []).some((i) => i.kind === "secret") && (ds.data?.items ?? []).some((i) => i.kind === "variable") && (ds.data?.items ?? []).some((i) => i.checks),
    "the sample has a secret, a variable and a checks setting");
  r.check(!(ds.data?.items ?? []).some((i) => i.kind === "secret" && i.value), "the sample shows no secret value");
  for (const body of [...(ds.data?.items ?? []).map((i) => ({ name: i.name, value: "demo-typed-value" })), ...(ds.data?.items ?? []).map((i) => ({ name: i.name, make: true }))]) {
    const res = await d.post("/api/settings", body);
    r.check(res.status >= 400 && res.status < 500 && typeof res.data?.error === "string", `the demo saves nothing for ${JSON.stringify(body)} (${res.status} ${res.text})`);
  }
  const files = filesUnder(d.home);
  r.check(Object.keys(files).length === 0, `the demo wrote no file (${Object.keys(files)})`);
  r.check(d.netAttempts().length === 0 && !d.output.includes("demo-typed-value"), "the demo tried no network and logged nothing typed");
});
