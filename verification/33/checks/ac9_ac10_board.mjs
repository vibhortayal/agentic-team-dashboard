#!/usr/bin/env node
// AC9 (outside the Mac app) and AC10 for #33: the board from source with #8's guard (no internet, steppable clock)
// against a fake GitHub that also holds the project's .team/VERSION and agentic-team-oss's main line.
import { Board, FakeGitHub, REPO, allCards, item, run } from "../../8/checks/lib.mjs";

const TEAM = "vibhortayal/agentic-team-oss";
const OTHER = "acme/orchard";
const MAIN = ["1111111aaaaaaa", "2222222bbbbbbb", "3333333ccccccc", "4444444ddddddd"].map((s) => s.padEnd(40, "0")); // oldest first
const HOUR = 3600;

export class Fake extends FakeGitHub {
  constructor() {
    super([item(1, "Plan", ["stage:building", "role:implementer"])]);
    this.version = { [REPO]: MAIN[1].slice(0, 7) + "\n", [OTHER]: MAIN[1] }; // repo -> file text, or null for none
    this.teamFail = null; // null | {route: "version"|"compare", how: 500 | "ratelimit" | "reset" | "garbage"}
    this.log = [];
  }
  handle(req, res) {
    const u = new URL(req.url, "http://x");
    const send = (code, body, headers = {}) => { res.writeHead(code, { "content-type": "application/json", ...headers }); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
    const fail = (route) => {
      const f = this.teamFail;
      if (!f || f.route !== route) return false;
      if (f.how === "reset") { req.socket.destroy(); return true; }
      if (f.how === "ratelimit") { send(403, { message: "API rate limit exceeded" }, { "x-ratelimit-remaining": "0" }); return true; }
      if (f.how === "garbage") { send(200, "{not json"); return true; }
      send(f.how, { message: "Server Error" }); return true;
    };
    let m = /^\/repos\/([^/]+\/[^/]+)\/contents\/\.team\/VERSION$/.exec(u.pathname);
    if (m) {
      this.log.push({ method: req.method, what: "version", repo: m[1] });
      if (fail("version")) return;
      const text = this.version[m[1]];
      if (text == null) return send(404, { message: "Not Found" });
      return send(200, { type: "file", name: "VERSION", path: ".team/VERSION", encoding: "base64", content: Buffer.from(text).toString("base64") + "\n" });
    }
    m = /^\/repos\/([^/]+\/[^/]+)\/compare\/([^.]+)\.\.\.(.+)$/.exec(u.pathname);
    if (m && m[1] === TEAM) {
      this.log.push({ method: req.method, what: "compare" });
      if (fail("compare")) return;
      if (m[3] !== "main") return send(404, { message: "Not Found" });
      const i = MAIN.findIndex((s) => s.startsWith(m[2].toLowerCase()));
      if (i < 0) return send(404, { message: "Not Found" });
      const ahead = MAIN.slice(i + 1);
      return send(200, { status: ahead.length ? "ahead" : "identical", ahead_by: ahead.length, behind_by: 0, total_commits: ahead.length,
        commits: ahead.map((sha) => ({ sha, commit: { message: "Team change" } })) });
    }
    if (u.pathname.startsWith(`/repos/${OTHER}`)) { // a second project: just enough to be a project
      const rest = u.pathname.slice(`/repos/${OTHER}`.length);
      if (rest === "") return send(200, { full_name: OTHER, html_url: "https://github.com/" + OTHER, private: false });
      return send(200, []);
    }
    if (u.pathname.startsWith(`/repos/${TEAM}`)) this.log.push({ method: req.method, what: "other team read " + u.pathname });
    return super.handle(req, res);
  }
  teamReads() { return this.log.length; }
}

export const updates = async (b) => { const r = await b.get("/api/updates"); let d = null; try { d = JSON.parse(r.text); } catch {} return { status: r.status, d }; };
const teamShown = (d) => !!d?.team;
export const start = async (own, gh, args = []) => own(await Board.start(["--repo", REPO, ...args], { github: gh, env: { GITHUB_TOKEN: "x" } }));

if (process.argv[1]?.endsWith("ac9_ac10_board.mjs")) await run("AC9 AC10 board", async (r, own) => {
  // AC10 behind, read only, current.
  {
    const gh = own(await new Fake().start());
    const b = await start(own, gh);
    const { status, d } = await updates(b);
    r.check(status === 200, `/api/updates answers (${status})`);
    r.check(teamShown(d), `AC10 VERSION one commit behind... main is 2 ahead: the team notice is on (${JSON.stringify(d)})`);
    r.check(d?.app == null, `AC9 outside the Mac app no new-version notice (${JSON.stringify(d?.app)})`);
    r.check(gh.log.every((l) => l.method === "GET"), `AC10 the board only reads GitHub (${[...new Set(gh.log.map((l) => l.method))]})`);
    r.check(gh.log.filter((l) => l.what === "version" && l.repo === REPO).length === 1 && gh.log.filter((l) => l.what === "compare").length === 1,
      `AC10 one VERSION read and one main read (${JSON.stringify(gh.log)})`);
    r.check(!gh.calls.some((c) => /\/(git|actions|dispatches)\b/.test(c)), "AC10 nothing that runs or writes the installer");

    // 6 hours: many reads, then the clock.
    for (let i = 0; i < 5; i++) await updates(b);
    await b.board(); await b.board(true);
    r.check(gh.teamReads() === 2, `AC10 5 more reads and two board reads within 6 h ask GitHub nothing more (${gh.teamReads()} team reads)`);
    b.advance(6 * HOUR - 60);
    await updates(b);
    r.check(gh.teamReads() === 2, `AC10 at 6 h minus a minute: still cached (${gh.teamReads()})`);
    b.advance(120);
    gh.version[REPO] = MAIN[3].slice(0, 12) + "  \n"; // the project took the newest team
    const late = await updates(b);
    r.check(gh.teamReads() === 4, `AC10 at 6 h plus a minute: one more round (${gh.teamReads()})`);
    r.check(!teamShown(late.d), `AC10 VERSION at main's newest commit (trailing spaces): no notice (${JSON.stringify(late.d)})`);
  }
  // Reads arriving together: f1_team_check_together.mjs (round 2 finding F1).
  // AC10 no team; GitHub down.
  {
    const gh = own(await new Fake().start());
    gh.version[REPO] = null;
    const b = await start(own, gh);
    const { d } = await updates(b);
    const board = await b.board();
    r.check(!teamShown(d) && !board.error && allCards(board).length === 1, `AC10 no .team/VERSION: quiet, board fine (${JSON.stringify(d)}, error ${board.error})`);
  }
  for (const route of ["version", "compare"]) {
    for (const how of [500, "ratelimit", "reset", "garbage"]) {
      const gh = own(await new Fake().start());
      gh.teamFail = { route, how };
      const b = await start(own, gh);
      const res = await updates(b);
      const board = await b.board();
      r.check(res.status === 200 && !teamShown(res.d) && !board.error && allCards(board).length === 1,
        `AC10 ${route} read answers ${how}: quiet, board fine (${res.status} ${JSON.stringify(res.d)}, error ${board.error})`);
      b.stop();
    }
  }
  {
    const gh = own(await new Fake().start());
    gh.version[REPO] = "not a version\n";
    const b = await start(own, gh);
    const { status, d } = await updates(b);
    r.check(status === 200 && !teamShown(d), `AC10 a VERSION that names no commit: quiet (${JSON.stringify(d)})`);
    gh.version[REPO] = "9999999";
  }
  {
    const gh = own(await new Fake().start());
    gh.version[REPO] = "9999999eeee\n"; // a commit main doesn't know
    const b = await start(own, gh);
    const { status, d } = await updates(b);
    r.check(status === 200 && !teamShown(d), `AC10 a commit agentic-team-oss doesn't have (404): quiet (${JSON.stringify(d)})`);
  }
  // AC10 per project.
  {
    const gh = own(await new Fake().start());
    const a = await start(own, gh);
    const o = await start(own, gh, []);
    await updates(a);
    // the second board runs a different project
    o.stop();
    const b2 = own(await Board.start(["--repo", OTHER], { github: gh, env: { GITHUB_TOKEN: "x" } }));
    const { d } = await updates(b2);
    r.check(gh.log.some((l) => l.what === "version" && l.repo === OTHER) && teamShown(d), `AC10 another project is asked for itself (${JSON.stringify(gh.log.map((l) => l.repo ?? l.what))})`);
  }
  // AC10 demo; AC9 restart outside the app.
  {
    const b = own(await Board.start(["--demo"]));
    const { d } = await updates(b);
    r.check(teamShown(d) && d?.app == null, `AC10 the demo shows the team notice, no app notice (${JSON.stringify(d)})`);
    r.check(b.netAttempts().length === 0, `the demo asks nothing of the internet (${b.netAttempts()})`);
    const base = `http://127.0.0.1:${b.port}`;
    const post = (origin) => fetch(base + "/api/app/restart", { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: "{}" });
    const own1 = await post(base);
    r.check(own1.status >= 400 && own1.status < 500, `AC9 outside the Mac app, Restart is refused (${own1.status})`);
    const other = await post("https://evil.example");
    r.check(other.status === 403, `AC9 a restart from another site's page is refused (${other.status})`);
    r.check((await b.get("/api/board")).status === 200 && b.proc.exitCode === null, "AC9 the board keeps running");
  }
});
