// Shared helpers for the #8 checks (not a check itself: it is not executable).
// The board runs as a real process: `node server/main.ts --repo ... --port ... --no-open`, with guard.mjs
// preloaded (no internet, steppable clock). GitHub is a fake served from this process on 127.0.0.1 and
// reached through BOARD_GITHUB_API. Nothing leaves this computer.
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The board needs Node 22.18+ (it runs .ts files directly). Say so plainly instead of failing oddly.
const [maj, min] = process.versions.node.split(".").map(Number);
if (maj < 22 || (maj === 22 && min < 18)) {
  console.error(`FAIL these checks need Node 22.18 or newer (the board runs server/main.ts directly); this runner has Node ${process.versions.node}. Set up Node 22.18+ before running them.`);
  process.exit(1);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "../../..");
if (!fs.existsSync(path.join(ROOT, "dist", "index.html"))) {
  console.error("FAIL dist/index.html is missing: run `npm ci && npm run build` before the checks.");
  process.exit(1);
}

export const REPO = "acme/garden";
const GH = "https://github.com/" + REPO;
export const PERSONAS = ["Ella", "Priya", "Rohan", "Quinn", "Arjun", "Ian", "Vera", "Max", "Bea", "Otto"];

// ---------- GitHub-shaped data ----------
export function item(number, title, labels, { state = "open", pr = false, url } = {}) {
  const it = {
    number, title, labels: labels.map((name) => ({ name })), state,
    html_url: url ?? `${GH}/${pr ? "pull" : "issues"}/${number}`,
    updated_at: "2026-11-10T10:00:00Z", comments: 0, user: { login: "owner" },
  };
  if (pr) it.pull_request = { url: "" };
  return it;
}

let cid = 1000;
export function comment(number, header, body, event, { minute = 0, login = "team-bot" } = {}) {
  cid += 1;
  let text = header + "\n\n" + body;
  if (event) text += "\n\n<!-- team-event " + JSON.stringify(event) + " -->";
  const at = `2026-11-11T10:${String(minute).padStart(2, "0")}:00Z`;
  return { id: cid, html_url: `${GH}/issues/${number}#issuecomment-${cid}`, body: text, user: { login }, created_at: at, updated_at: at };
}
export const ev = (from, to, kind, extra = {}) => ({ from, to, kind, ...extra });

// ---------- fake GitHub on 127.0.0.1 ----------
export class FakeGitHub {
  constructor(items = [], comments = {}) {
    this.set(items, comments);
    this.fail = null; // null | 401 | 404 | 500 | "ratelimit" | "reset"
    this.calls = [];
    this.server = http.createServer((req, res) => this.handle(req, res));
  }
  set(items, comments) {
    this.items = items;
    this.comments = comments;
    for (const it of items) it.comments = (comments[it.number] ?? []).length;
  }
  async start() {
    await new Promise((r) => this.server.listen(0, "127.0.0.1", r));
    this.url = `http://127.0.0.1:${this.server.address().port}`;
    return this;
  }
  stop() { this.server.close(); this.server.closeAllConnections?.(); }
  listCalls() { return this.calls.filter((u) => /\/(issues|pulls)(\?|$)/.test(u)).length; }
  handle(req, res) {
    this.calls.push(req.url);
    const send = (code, body, headers = {}) => {
      res.writeHead(code, { "content-type": "application/json", ...headers });
      res.end(JSON.stringify(body));
    };
    if (this.fail === "reset") return req.socket.destroy();
    if (this.fail === "ratelimit") return send(403, { message: "API rate limit exceeded" }, { "x-ratelimit-remaining": "0" });
    if (typeof this.fail === "number") return send(this.fail, { message: "Bad credentials" });
    const u = new URL(req.url, "http://x");
    const page = Number(u.searchParams.get("page") ?? "1");
    const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts[0] !== "repos" || `${parts[1]}/${parts[2]}` !== REPO) return send(404, { message: "Not Found" });
    if (parts.length === 3) return send(200, { full_name: REPO, html_url: GH, private: false });
    const state = u.searchParams.get("state") ?? "open";
    const pick = (list) => list.filter((i) => state === "all" || i.state === state);
    if (parts.length === 4 && parts[3] === "issues") {
      const want = (u.searchParams.get("labels") ?? "").split(",").filter(Boolean);
      const out = pick(this.items).filter((i) => want.every((w) => i.labels.some((l) => l.name === w)));
      return send(200, page > 1 ? [] : out);
    }
    if (parts.length === 4 && parts[3] === "pulls") {
      return send(200, page > 1 ? [] : pick(this.items.filter((i) => i.pull_request)));
    }
    if (parts.length === 6 && (parts[3] === "issues" || parts[3] === "pulls") && parts[5] === "comments") {
      return send(200, page > 1 ? [] : this.comments[Number(parts[4])] ?? []);
    }
    if (parts.length === 5 && (parts[3] === "issues" || parts[3] === "pulls")) {
      const it = this.items.find((i) => i.number === Number(parts[4]));
      return it ? send(200, it) : send(404, { message: "Not Found" });
    }
    return send(404, { message: "Not Found" });
  }
}

// ---------- running the board ----------
export function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

export class Board {
  static async start(args, { env = {}, github } = {}) {
    const b = new Board();
    b.tmp = fs.mkdtempSync(path.join(os.tmpdir(), "v8-"));
    b.netLog = path.join(b.tmp, "net.log");
    b.toolLog = path.join(b.tmp, "tools.log");
    b.clockFile = path.join(b.tmp, "clock");
    fs.writeFileSync(b.clockFile, "0");
    const bin = path.join(b.tmp, "bin");
    fs.mkdirSync(bin);
    for (const tool of ["gh", "git"]) { // sign-in tools that fail and leave a trace
      fs.writeFileSync(path.join(bin, tool), `#!/bin/sh\necho ${tool} "$@" >> ${b.toolLog}\nexit 1\n`, { mode: 0o755 });
    }
    const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) =>
      !["GITHUB_TOKEN", "GH_TOKEN", "BOARD_GITHUB_API", "NODE_OPTIONS"].includes(k) && !k.toLowerCase().endsWith("_proxy")));
    const nodeDir = path.dirname(process.execPath);
    const fullEnv = {
      ...clean, PATH: `${bin}:${nodeDir}:/usr/bin:/bin`, V8_NET_LOG: b.netLog, V8_CLOCK_FILE: b.clockFile,
      ...(github ? { BOARD_GITHUB_API: github.url } : {}), ...env,
    };
    b.requested = await freePort();
    b.proc = spawn(process.execPath, ["--import", path.join(HERE, "guard.mjs"), "server/main.ts", ...args,
      "--port", String(b.requested), "--no-open"], { cwd: ROOT, env: fullEnv, stdio: ["ignore", "pipe", "pipe"] });
    b.output = "";
    b.proc.stdout.on("data", (d) => (b.output += d));
    b.proc.stderr.on("data", (d) => (b.output += d));
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const m = /localhost:(\d+)/.exec(b.output);
      if (m) { b.port = Number(m[1]); return b; }
      if (b.proc.exitCode !== null) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    b.stop();
    throw new Error("board did not start: " + b.output);
  }
  async get(p) {
    const r = await fetch(`http://127.0.0.1:${this.port}${p}`);
    return { status: r.status, text: await r.text(), headers: r.headers };
  }
  async board(refresh = false) {
    return JSON.parse((await this.get("/api/board" + (refresh ? "?refresh=1" : ""))).text);
  }
  advance(seconds) {
    fs.writeFileSync(this.clockFile, String(Number(fs.readFileSync(this.clockFile, "utf8")) + seconds * 1000));
  }
  netAttempts() { return fs.existsSync(this.netLog) ? fs.readFileSync(this.netLog, "utf8").trim().split("\n") : []; }
  toolCalls() { return fs.existsSync(this.toolLog) ? fs.readFileSync(this.toolLog, "utf8").trim().split("\n") : []; }
  stop() { if (this.proc && this.proc.exitCode === null) this.proc.kill("SIGTERM"); }
}

// ---------- reading the board ----------
export const allCards = (b) => (b.columns ?? []).flatMap((c) => c.cards ?? []);
export const find = (list, n) => (list ?? []).filter((e) => e.number === n);
export function* strings(o) {
  if (typeof o === "string") yield o;
  else if (Array.isArray(o)) for (const v of o) yield* strings(v);
  else if (o && typeof o === "object") for (const v of Object.values(o)) yield* strings(v);
}

export class Result {
  constructor(name) { this.name = name; this.n = 0; this.fails = []; }
  check(ok, what) {
    this.n += 1;
    console.log((ok ? "  ok   " : "  FAIL ") + what);
    if (!ok) this.fails.push(what);
  }
  done() {
    console.log(`${this.name}: ${this.n - this.fails.length}/${this.n} passed`);
    process.exit(this.fails.length ? 1 : 0);
  }
}

// Run a check body; a crash counts as failed and the board/fake are always stopped.
export async function run(name, body) {
  const r = new Result(name);
  const stops = [];
  try {
    await body(r, (x) => (stops.push(x), x));
  } catch (e) {
    r.check(false, "check crashed: " + (e?.stack ?? e));
  } finally {
    for (const s of stops) try { s.stop(); } catch {}
  }
  r.done();
}
