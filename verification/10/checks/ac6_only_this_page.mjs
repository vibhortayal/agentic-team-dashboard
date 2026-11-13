#!/usr/bin/env node
// AC6: every action request must come from the board's own page (Origin check, JSON body), and the demo
// refuses all of them except "Stop".
import fs from "node:fs";
import path from "node:path";
import { Board, CLIENT_ID, FakeGitHub, TOKEN, run, tmpdir } from "./lib.mjs";

const ACTIONS = ["/api/signin/start", "/api/signin/poll", "/api/signout", "/api/project", "/api/stop"];

await run("AC6 only this page can act", async (r, own) => {
  const gh = own(await new FakeGitHub().start());
  const home = path.join(tmpdir("home"), "home");
  const dir = path.join(home, ".config", "team-board");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const cfg = path.join(dir, "config.json");
  const before = JSON.stringify({ token: TOKEN, repo: "acme/garden" });
  fs.writeFileSync(cfg, before, { mode: 0o600 });
  const b = own(await Board.start([], { github: gh, env: { BOARD_GITHUB_CLIENT_ID: CLIENT_ID }, home, cwd: tmpdir("cwd") }));
  const host = `127.0.0.1:${b.port}`;
  const own_ = `http://${host}`;
  const json = JSON.stringify({ repo: "acme/other" });

  const bad = [
    ["no Origin", { Host: host, "Content-Type": "application/json" }, json],
    ["another site's Origin", { Host: host, Origin: "https://evil.example", "Content-Type": "application/json" }, json],
    ["Origin 'null'", { Host: host, Origin: "null", "Content-Type": "application/json" }, json],
    ["Origin on another port", { Host: host, Origin: `http://127.0.0.1:${b.port + 1}`, "Content-Type": "application/json" }, json],
    ["form body (text/plain)", { Host: host, Origin: own_, "Content-Type": "text/plain" }, json],
    ["form body (urlencoded)", { Host: host, Origin: own_, "Content-Type": "application/x-www-form-urlencoded" }, "repo=acme%2Fother"],
    ["form body (multipart)", { Host: host, Origin: own_, "Content-Type": "multipart/form-data; boundary=x" }, "--x--"],
    ["no Content-Type", { Host: host, Origin: own_ }, json],
    ["another Host (DNS rebinding)", { Host: `evil.example:${b.port}`, Origin: `http://evil.example:${b.port}`, "Content-Type": "application/json" }, json],
  ];
  for (const p of ACTIONS) {
    for (const [why, headers, body] of bad) {
      const res = await b.raw("POST", p, headers, body);
      r.check(res.status === 403, `AC6 ${p} refused with ${why} (${res.status})`);
    }
    const notJson = await b.raw("POST", p, { Host: host, Origin: own_, "Content-Type": "application/json" }, "repo=acme/other");
    r.check(notJson.status === 400, `AC6 ${p} refused when the body isn't JSON (${notJson.status})`);
    const viaGet = await b.raw("GET", p, { Host: host });
    r.check(viaGet.status >= 400, `AC6 ${p} does nothing on GET (${viaGet.status})`);
  }
  r.check(b.alive(), "AC6 the refused requests did not stop the board");
  r.check(fs.readFileSync(cfg, "utf8") === before, "AC6 the refused requests changed nothing saved");
  r.check(!gh.calls.some((c) => c.path.startsWith("/login/")), "AC6 the refused requests started no sign-in");

  // The page's own requests work.
  const ok = await b.post("/api/project", { repo: "acme/other" });
  r.check(ok.status === 200 && JSON.parse(fs.readFileSync(cfg, "utf8")).repo === "acme/other", `AC6 the board's own page can act (${ok.status})`);
  const okLocal = await b.raw("POST", "/api/project", { Host: `localhost:${b.port}`, Origin: `http://localhost:${b.port}`, "Content-Type": "application/json" }, JSON.stringify({ repo: "acme/garden" }));
  r.check(okLocal.status === 200, `AC6 the page opened as localhost can act too (${okLocal.status})`);
  const stop = await b.post("/api/stop");
  const code = await Promise.race([b.exited, new Promise((res) => setTimeout(() => res("still running"), 5000))]);
  r.check(stop.status === 200 && code === 0, `AC6 Stop from the page stops the board (${stop.status}, exit ${code})`);

  // Demo: everything but Stop is refused, even from the page itself.
  const dhome = path.join(tmpdir("home"), "home");
  const d = own(await Board.start(["--demo"], { env: { BOARD_GITHUB_CLIENT_ID: CLIENT_ID }, home: dhome, cwd: tmpdir("cwd") }));
  for (const p of ACTIONS.filter((x) => x !== "/api/stop")) {
    const res = await d.post(p, p === "/api/project" ? { repo: "acme/garden" } : {});
    r.check(res.status >= 400 && res.status < 500, `AC6 demo refuses ${p} from its own page (${res.status} ${res.text})`);
  }
  r.check(Object.keys(fsList(dhome)).length === 0, `AC6 demo saved nothing (${JSON.stringify(fsList(dhome))})`);
  r.check(d.alive(), "AC6 demo still running before Stop");
  const ds = await d.post("/api/stop");
  const dcode = await Promise.race([d.exited, new Promise((res) => setTimeout(() => res("still running"), 5000))]);
  r.check(ds.status === 200 && dcode === 0, `AC6 demo allows Stop (${ds.status}, exit ${dcode})`);
  r.check([b, d].every((x) => x.netAttempts().length === 0), "no attempt to reach the internet");
});

function fsList(dir) {
  const out = {};
  const walk = (x) => { for (const e of fs.readdirSync(x, { withFileTypes: true })) { const p = path.join(x, e.name); if (e.isDirectory()) walk(p); else out[p] = 1; } };
  walk(dir);
  return out;
}
