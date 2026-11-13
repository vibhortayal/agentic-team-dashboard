// Shared helpers for the #10 checks (not a check itself: it is not executable).
// The board runs as a real process (from source, from the packed npm package, or the one-file app).
// From source and from npm, ../../8/checks/guard.mjs is preloaded: no internet, steppable clock.
// GitHub (both github.com and api.github.com) is one fake on 127.0.0.1, reached through
// BOARD_GITHUB_WEB and BOARD_GITHUB_API. HOME and the settings folder are temp folders.
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [maj, min] = process.versions.node.split(".").map(Number);
if (maj < 22 || (maj === 22 && min < 18)) {
  console.error(`FAIL these checks need Node 22.18 or newer; this runner has Node ${process.versions.node}.`);
  process.exit(1);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "../../..");
export const GUARD = path.resolve(HERE, "../../8/checks/guard.mjs");
export const CLIENT_ID = "Iv1.verifier-test";
export const TOKEN = "ghu_VerifierFakeToken0123456789abcdefXYZ";
export const REFRESH = "ghr_VerifierFakeRefresh0123456789abcdef";

export function tmpdir(tag) { return fs.mkdtempSync(path.join(os.tmpdir(), `v10-${tag}-`)); }

// ---------- GitHub-shaped data ----------
export function item(repo, number, title, labels) {
  return { number, title, labels: labels.map((name) => ({ name })), state: "open",
    html_url: `https://github.com/${repo}/issues/${number}`, updated_at: "2026-11-10T10:00:00Z", comments: 0, user: { login: "owner" } };
}

// ---------- fake github.com + api.github.com on 127.0.0.1 ----------
export class FakeGitHub {
  constructor() {
    this.calls = []; // {method, path, body, auth}
    this.device = "pending"; // pending | slow_down | denied | expired | done | broken
    this.deviceStart = { device_code: "dev-123", user_code: "WDJB-MJHT", verification_uri: "https://github.com/login/device", interval: 5, expires_in: 900 };
    this.installations = [{ id: 7, repos: [{ full_name: "acme/garden", private: false }, { full_name: "acme/secret-shed", private: true }] }];
    this.repos = { "acme/garden": [item("acme/garden", 1, "Garden first ticket", ["stage:building", "role:implementer"])],
      "acme/other": [item("acme/other", 2, "Other project ticket", ["stage:verifying", "role:verifier"])],
      "acme/secret-shed": [] };
    this.server = http.createServer((req, res) => this.handle(req, res));
  }
  async start() {
    await new Promise((r) => this.server.listen(0, "127.0.0.1", r));
    this.url = `http://127.0.0.1:${this.server.address().port}`;
    return this;
  }
  stop() { this.server.close(); this.server.closeAllConnections?.(); }
  tokenCalls() { return this.calls.filter((c) => c.path === "/login/oauth/access_token"); }
  handle(req, res) {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      let parsed = {};
      try { parsed = body ? JSON.parse(body) : {}; } catch { parsed = { raw: body }; }
      const u = new URL(req.url, "http://x");
      this.calls.push({ method: req.method, path: u.pathname, body: parsed, auth: req.headers.authorization ?? "" });
      const send = (code, data) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
      if (req.method === "POST" && u.pathname === "/login/device/code") {
        if (parsed.client_id !== CLIENT_ID) return send(200, { error: "unauthorized_client" });
        return send(200, this.deviceStart);
      }
      if (req.method === "POST" && u.pathname === "/login/oauth/access_token") {
        if (parsed.grant_type === "refresh_token") return send(200, { access_token: TOKEN + "R", refresh_token: REFRESH + "R", expires_in: 28800 });
        switch (this.device) {
          case "pending": return send(200, { error: "authorization_pending" });
          case "slow_down": return send(200, { error: "slow_down", interval: 10 });
          case "denied": return send(200, { error: "access_denied", error_description: "The user has denied your application access." });
          case "expired": return send(200, { error: "expired_token", error_description: "The device_code has expired." });
          case "broken": return send(200, { error: "incorrect_client_credentials" });
          case "done": return send(200, { access_token: TOKEN, token_type: "bearer", refresh_token: REFRESH, expires_in: 28800, scope: "" });
        }
      }
      const authed = (req.headers.authorization ?? "").includes(TOKEN);
      if (u.pathname === "/user/installations") {
        if (!authed) return send(401, { message: "Bad credentials" });
        return send(200, { total_count: this.installations.length, installations: this.installations.map((i) => ({ id: i.id })) });
      }
      const mi = /^\/user\/installations\/(\d+)\/repositories$/.exec(u.pathname);
      if (mi) {
        const inst = this.installations.find((i) => i.id === Number(mi[1]));
        return inst ? send(200, { total_count: inst.repos.length, repositories: inst.repos }) : send(404, { message: "Not Found" });
      }
      if (u.pathname === "/user/repos") return send(200, []);
      const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
      if (parts[0] === "repos") {
        const repo = `${parts[1]}/${parts[2]}`;
        const items = this.repos[repo];
        if (!items) return send(404, { message: "Not Found" });
        if (parts[3] === "issues" && parts.length === 4) {
          const state = u.searchParams.get("state") ?? "open";
          return send(200, items.filter((i) => state === "all" || i.state === state));
        }
        if (parts[5] === "comments") return send(200, []);
        return send(200, { full_name: repo });
      }
      return send(404, { message: "Not Found" });
    });
  }
}

// ---------- running the board ----------
export function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

const STRIP = ["GITHUB_TOKEN", "GH_TOKEN", "BOARD_GITHUB_API", "BOARD_GITHUB_WEB", "BOARD_GITHUB_CLIENT_ID",
  "BOARD_GITHUB_APP_SLUG", "BOARD_CONFIG_DIR", "XDG_CONFIG_HOME", "NODE_OPTIONS", "HOME", "APPDATA"];

export class Board {
  // how: "source" (node server/cli.ts), {bin, cwd} for any executable. home: HOME folder (temp by default).
  static async start(args, { env = {}, github, how = "source", home, cwd, guard = true, path: pathEnv } = {}) {
    const b = new Board();
    b.tmp = tmpdir("run");
    b.home = home ?? path.join(b.tmp, "home");
    fs.mkdirSync(b.home, { recursive: true });
    b.netLog = path.join(b.tmp, "net.log");
    b.toolLog = path.join(b.tmp, "tools.log");
    b.clockFile = path.join(b.tmp, "clock");
    fs.writeFileSync(b.clockFile, "0");
    const bin = path.join(b.tmp, "bin");
    fs.mkdirSync(bin);
    for (const tool of ["gh", "xdg-open", "open"]) { // a gh that isn't signed in; browser openers that only leave a trace
      fs.writeFileSync(path.join(bin, tool), `#!/bin/sh\necho ${tool} "$@" >> ${b.toolLog}\nexit 1\n`, { mode: 0o755 });
    }
    const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !STRIP.includes(k) && !k.toLowerCase().endsWith("_proxy")));
    const nodeDir = path.dirname(process.execPath);
    const fullEnv = {
      ...clean, HOME: b.home, PATH: pathEnv ?? `${bin}:${nodeDir}:/usr/bin:/bin`,
      V8_NET_LOG: b.netLog, V8_CLOCK_FILE: b.clockFile,
      ...(github ? { BOARD_GITHUB_API: github.url, BOARD_GITHUB_WEB: github.url } : {}),
      ...(guard && how !== "source" ? { NODE_OPTIONS: `--import=${GUARD}` } : {}),
      ...env,
    };
    if (pathEnv) fullEnv.PATH = `${bin}:${pathEnv}`;
    b.port = await freePort();
    const extra = [...args, "--port", String(b.port), "--no-open"];
    const [cmd, argv] = how === "source"
      ? [process.execPath, [...(guard ? ["--import", GUARD] : []), path.join(ROOT, "server/cli.ts"), ...extra]]
      : [how.bin, [...(how.pre ?? []), ...extra]];
    b.proc = spawn(cmd, argv, { cwd: cwd ?? (how === "source" ? ROOT : how.cwd), env: fullEnv, stdio: ["ignore", "pipe", "pipe"], detached: true });
    b.output = "";
    b.proc.stdout.on("data", (d) => (b.output += d));
    b.proc.stderr.on("data", (d) => (b.output += d));
    b.exited = new Promise((r) => b.proc.on("exit", (code) => r(code)));
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (new RegExp(`localhost:${b.port}`).test(b.output)) {
        try { await fetch(`http://127.0.0.1:${b.port}/api/status`); return b; } catch {}
      }
      if (b.proc.exitCode !== null) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    b.stop();
    throw new Error("board did not start: " + b.output);
  }
  url(p) { return `http://127.0.0.1:${this.port}${p}`; }
  origin() { return `http://127.0.0.1:${this.port}`; }
  async get(p) {
    const r = await fetch(this.url(p));
    return { status: r.status, text: await r.text() };
  }
  async json(p) { return JSON.parse((await this.get(p)).text); }
  // An action as the board's own page sends it.
  async post(p, body = {}, headers = {}) {
    const r = await fetch(this.url(p), { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { Origin: this.origin(), "Content-Type": "application/json", ...headers } });
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return { status: r.status, text, data };
  }
  // Raw request, for headers fetch won't let us set (Host).
  raw(method, p, headers, body = "") {
    return new Promise((resolve) => {
      const req = http.request({ host: "127.0.0.1", port: this.port, method, path: p, headers: { ...headers, "Content-Length": Buffer.byteLength(body) } }, (res) => {
        let t = ""; res.on("data", (d) => (t += d)); res.on("end", () => resolve({ status: res.statusCode, text: t }));
      });
      req.on("error", (e) => resolve({ status: 0, text: String(e) }));
      req.end(body);
    });
  }
  advance(seconds) {
    fs.writeFileSync(this.clockFile, String(Number(fs.readFileSync(this.clockFile, "utf8")) + seconds * 1000));
  }
  netAttempts() { return fs.existsSync(this.netLog) ? fs.readFileSync(this.netLog, "utf8").trim().split("\n").filter(Boolean) : []; }
  toolCalls() { return fs.existsSync(this.toolLog) ? fs.readFileSync(this.toolLog, "utf8").trim().split("\n").filter(Boolean) : []; }
  alive() { return this.proc.exitCode === null && this.proc.signalCode === null; }
  stop() { if (this.alive()) { try { process.kill(-this.proc.pid, "SIGTERM"); } catch { this.proc.kill("SIGTERM"); } } }
}

// Every file under a folder (relative path -> contents), for "saved only there" checks.
export function filesUnder(dir) {
  const out = {};
  const walk = (d) => {
    let names;
    try { names = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of names) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) { try { out[path.relative(dir, p)] = fs.readFileSync(p, "utf8"); } catch {} }
    }
  };
  walk(dir);
  return out;
}

export const mode = (p) => (fs.statSync(p).mode & 0o777).toString(8);
export const sentences = (s) => (String(s).trim().match(/[.!?](\s|$)/g) ?? []).length;
export const JARGON = /access_denied|expired_token|authorization_pending|device_code|oauth|token|\b4\d\d\b|\{|\}/i;

export class Result {
  constructor(name) { this.name = name; this.n = 0; this.fails = []; }
  check(ok, what) {
    this.n += 1;
    console.log((ok ? "  ok   " : "  FAIL ") + what);
    if (!ok) this.fails.push(what);
  }
  note(what) { console.log("  note " + what); }
  done() {
    console.log(`${this.name}: ${this.n - this.fails.length}/${this.n} passed`);
    process.exit(this.fails.length ? 1 : 0);
  }
}

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
