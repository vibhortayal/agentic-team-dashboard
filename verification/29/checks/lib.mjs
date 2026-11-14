// Shared helpers for the #29 checks (not a check itself: it is not executable).
// The board runs from source with ../../8/checks/guard.mjs preloaded (no internet), via ../../10/checks/lib.mjs.
// GitHub is a fake on 127.0.0.1:
//   GET /user/installations, /user/installations/<id>/repositories   the projects, when `installs` is set
//   GET /user/repos                                                  the projects otherwise
//   GET /repos/<p>/contents/TEAM.md   200 for a team project, 404 for the rest; lookFail[p] makes one fail
//   anything else under /repos/<p>/   what the board page reads: an empty project
// Every request under /repos/<p>/ is logged in `looks` with how many were open at once (`peak`).
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { Board, run, tmpdir } from "../../10/checks/lib.mjs";
export { Board, run, tmpdir };

export const TOKEN = "ghp_VerifierTeamProjects0123456789abcd";
const B64 = (s) => Buffer.from(s, "utf8").toString("base64");

export class FakeGitHub {
  constructor({ repos = [], team = [], installs = null } = {}) {
    this.repos = repos; // full names, in GitHub's order
    this.team = new Set(team);
    this.installs = installs; // null -> /user/installations 404; else array of arrays of full names
    this.lookFail = {}; // repo -> code | "reset" | "badjson" | "hang"
    this.lookDelay = 0;
    this.listFail = null; // code for /user/installations and /user/repos
    this.looks = []; // {repo, path}
    this.open = 0;
    this.peak = 0;
    this.hung = [];
    this.server = http.createServer((req, res) => this.handle(req, res));
  }
  async start() {
    await new Promise((r) => this.server.listen(0, "127.0.0.1", r));
    this.url = `http://127.0.0.1:${this.server.address().port}`;
    return this;
  }
  stop() { for (const r of this.hung) try { r.destroy(); } catch {} this.server.close(); this.server.closeAllConnections?.(); }
  reset() { this.looks = []; this.open = 0; this.peak = 0; }
  looked() { return this.looks.map((l) => l.repo); }
  handle(req, res) {
    const u = new URL(req.url, "http://x");
    const send = (code, data) => { if (res.writableEnded || res.destroyed) return; res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
    const shape = (n) => ({ full_name: n, private: false, name: n.split("/")[1], owner: { login: n.split("/")[0] } });
    if (u.pathname === "/user/installations") {
      if (this.listFail) return send(this.listFail, { message: "Server Error" });
      if (!this.installs) return send(404, { message: "Not Found" });
      return send(200, { total_count: this.installs.length, installations: this.installs.map((_, i) => ({ id: i + 1 })) });
    }
    const mi = /^\/user\/installations\/(\d+)\/repositories$/.exec(u.pathname);
    if (mi && this.installs) {
      const list = this.installs[Number(mi[1]) - 1] ?? [];
      return send(200, { total_count: list.length, repositories: list.map(shape) });
    }
    if (u.pathname === "/user/repos") {
      if (this.listFail) return send(this.listFail, { message: "Server Error" });
      return send(200, this.repos.map(shape));
    }
    const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts[0] !== "repos" || parts.length < 3) return send(404, { message: "Not Found" });
    const repo = `${parts[1]}/${parts[2]}`;
    const rest = parts.slice(3).join("/");
    const isLook = rest === "contents/TEAM.md" || rest.endsWith("TEAM.md");
    if (!isLook) {
      // What the board page reads once a project is open: an empty project.
      if (parts.length === 3) return send(200, { full_name: repo, html_url: `https://github.com/${repo}`, private: false });
      return send(200, []);
    }
    this.looks.push({ repo, path: u.pathname + u.search });
    this.open += 1;
    this.peak = Math.max(this.peak, this.open);
    const done = () => { this.open -= 1; };
    const f = this.lookFail[repo];
    const answer = () => {
      if (f === "hang") { this.hung.push(req.socket); req.socket.on("close", done); return; }
      done();
      if (f === "reset") return req.socket.destroy();
      if (f === "badjson") { res.writeHead(200, { "content-type": "application/json" }); return res.end("<html>not json"); }
      if (typeof f === "number") return send(f, { message: "Server Error" });
      if (!this.team.has(repo)) return send(404, { message: "Not Found" });
      return send(200, { type: "file", name: "TEAM.md", path: "TEAM.md", encoding: "base64", content: B64("# Team\n") });
    };
    if (this.lookDelay) setTimeout(answer, this.lookDelay); else answer();
  }
}

// The board signed in with a fake GITHUB_TOKEN, no project saved, started outside any project folder.
export async function startBoard(gh, { env = {}, config = null } = {}) {
  const cfg = tmpdir("cfg");
  if (config) fs.writeFileSync(path.join(cfg, "config.json"), JSON.stringify(config), { mode: 0o600 });
  const b = await Board.start([], { github: gh, cwd: tmpdir("cwd"),
    env: { GITHUB_TOKEN: TOKEN, BOARD_GITHUB_CLIENT_ID: "none", BOARD_CONFIG_DIR: cfg, ...env } });
  b.cfg = cfg;
  return b;
}

export const names = (n, prefix = "acme/p") => Array.from({ length: n }, (_, i) => `${prefix}${String(i + 1).padStart(3, "0")}`);
