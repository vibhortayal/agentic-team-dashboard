#!/usr/bin/env node
// AC7 (demo with no network and no sign-in), AC8 (127.0.0.1 only) and the section 8 data model.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { Board, ROOT, allCards, run } from "./lib.mjs";

function listeners(port) { // local addresses with a LISTEN socket on this port
  const out = [];
  for (const f of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    let lines;
    try { lines = fs.readFileSync(f, "utf8").trim().split("\n").slice(1); } catch { continue; }
    for (const ln of lines) {
      const p = ln.trim().split(/\s+/);
      const i = p[1].lastIndexOf(":");
      if (parseInt(p[1].slice(i + 1), 16) === port && p[3] === "0A") out.push(`${f}:${p[1].slice(0, i)}`);
    }
  }
  return out;
}
const tryConnect = (host, port) => new Promise((res) => {
  const s = net.connect({ host, port, timeout: 1000 }, () => { s.destroy(); res(true); });
  s.on("error", () => res(false)); s.on("timeout", () => { s.destroy(); res(false); });
});

await run("AC7/AC8/data model", async (r, own) => {
  // AC7 + AC8 with the guard: internet refused and logged, gh/git stubs fail, no tokens.
  const b = own(await Board.start(["--demo"]));
  const board = await b.board();
  const cards = allCards(board);
  r.check(!board.error, `AC7 demo has no error (error=${JSON.stringify(board.error)})`);
  r.check(cards.length >= 3 && (board.needed ?? []).length >= 1,
    `AC7 demo shows sample cards (${cards.length}) and something waiting for you (${(board.needed ?? []).length})`);
  const page = (await b.get("/")).text.toLowerCase();
  r.check(page.includes("<html") || page.includes("<!doctype"), "AC7 the page itself is served");
  r.check(b.netAttempts().length === 0, `AC7 no internet attempt in demo mode (${JSON.stringify(b.netAttempts())})`);
  r.check(b.toolCalls().length === 0, `AC7 no sign-in tool (gh/git) called in demo mode (${JSON.stringify(b.toolCalls())})`);

  const ls = listeners(b.port);
  if (fs.existsSync("/proc/net/tcp")) {
    r.check(ls.length > 0 && ls.every((a) => a.endsWith(":0100007F")), `AC8 every listening socket on port ${b.port} is 127.0.0.1 (${JSON.stringify(ls)})`);
  }
  const others = Object.values(os.networkInterfaces()).flat().filter((a) => a && !a.internal).map((a) => a.address);
  for (const ip of others) r.check(!(await tryConnect(ip, b.port)), `AC8 port refuses on non-loopback ${ip}`);

  // Section 8: /api/board shape
  for (const k of ["repo", "updated", "error", "needed", "handled", "columns"]) r.check(k in board, `data model: /api/board has '${k}'`);
  const col = (board.columns ?? [])[0] ?? {};
  r.check(["key", "title", "cards"].every((k) => k in col), `data model: a column has key/title/cards (${Object.keys(col)})`);
  const want = ["number", "title", "url", "kind", "stage", "holder", "update", "check", "needed"];
  const missing = cards.flatMap((c) => want.filter((k) => !(k in c)).map((k) => `#${c.number}.${k}`));
  r.check(cards.length > 0 && missing.length === 0, `data model: every card has ${want.join(",")} (missing ${JSON.stringify(missing)})`);
  b.stop();

  // Guard self-test: without the fake, a real read is attempted and the guard must see it. This shows the
  // "no internet attempt" result above means something.
  const probe = own(await Board.start(["--repo", "acme/garden"], { env: { GITHUB_TOKEN: "x" } }));
  const pb = await probe.board();
  r.check(probe.netAttempts().length > 0 && !!pb.error, `guard self-test: a real-mode read is caught (${JSON.stringify(probe.netAttempts())})`);
  probe.stop();

  // AC7 literally as written: `npm run demo` (it builds, then starts on 4321 or the next free port).
  const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "v8-demo-")), "out.log");
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !["GITHUB_TOKEN", "GH_TOKEN"].includes(k)));
  const p = spawn("npm", ["run", "demo", "--", "--no-open"], { cwd: ROOT, env, stdio: ["ignore", fs.openSync(log, "w"), fs.openSync(log, "a")], detached: true });
  own({ stop: () => { try { process.kill(-p.pid, "SIGTERM"); } catch {} } });
  let body = null;
  for (let i = 0; i < 300 && !body; i++) {
    const m = /localhost:(\d+)/.exec(fs.readFileSync(log, "utf8"));
    if (m) { try { body = await (await fetch(`http://127.0.0.1:${m[1]}/api/board`)).json(); } catch {} }
    if (!body) await new Promise((res) => setTimeout(res, 100));
  }
  r.check(!!body && !body.error && allCards(body).length > 0, `AC7 \`npm run demo\` serves the sample board (${body ? allCards(body).length + " cards" : fs.readFileSync(log, "utf8").slice(-300)})`);
});
