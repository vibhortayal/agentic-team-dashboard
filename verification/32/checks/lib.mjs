// Shared helpers for the #32 checks (not a check itself: it is not executable).
// Extends #11's fake GitHub (../../11/checks/lib.mjs, itself #8's) so it also answers what #32 reads:
//   GET /repos/<repo>/activity          pushes on any branch, newest first (GitHub's shape: ref, after, timestamp, activity_type)
//   GET /repos/<repo>/commits/<sha>     one commit
//   GET /repos/<repo>/commits           the main line, newest first
// Each of those can be made to fail on its own (latestFail[route] = 403 | 404 | 409 | 500 | "reset" | "garbage").
import { FakeGitHub as Fake11 } from "../../11/checks/lib.mjs";
export { Board, REPO, allCards, comment, ev, item, run, strings } from "../../11/checks/lib.mjs";
import { REPO } from "../../11/checks/lib.mjs";

export const KEY = "ghp_Abcdefghijklmnopqrstuvwxyz0123456789"; // a GitHub key shape (ghp_ + 36)

let n = 0;
// A commit as GitHub's REST API returns it. `at` is the author date.
export function commit({ name, email, message, at, sha }) {
  n += 1;
  sha = sha ?? (n.toString(16).padStart(4, "0").repeat(10));
  return {
    sha, node_id: "C_" + sha.slice(0, 8), html_url: `https://github.com/${REPO}/commit/${sha}`,
    commit: { author: { name, email, date: at }, committer: { name: "GitHub", email: "noreply@github.com", date: at }, message },
    author: null, committer: null, parents: [],
  };
}
// One push in /activity, pointing at a commit.
export function push(c, { ref = "refs/heads/main", type = "push", at } = {}) {
  n += 1;
  return { id: 7000 + n, node_id: "A_" + n, before: "0".repeat(40), after: c?.sha ?? "0".repeat(40), ref,
    timestamp: at ?? c?.commit.author.date, activity_type: type, actor: { login: "someone" } };
}

export class FakeGitHub extends Fake11 {
  constructor(items = [], comments = {}, { commits = [], activity = [], main = [] } = {}) {
    super(items, comments);
    this.commitsBySha = Object.fromEntries(commits.map((c) => [c.sha, c]));
    this.activity = activity; // newest first, as GitHub returns it
    this.main = main; // newest first
    this.latestFail = {}; // {activity|commit|commits: code | "reset" | "garbage"}
    this.latestCalls = [];
    this.issuesFail = null; // a status code for every /issues read
  }
  handle(req, res) {
    const u = new URL(req.url, "http://x");
    const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    const mine = parts[0] === "repos" && `${parts[1]}/${parts[2]}` === REPO;
    const what = !mine ? null
      : parts.length === 4 && parts[3] === "activity" ? "activity"
      : parts.length === 5 && parts[3] === "commits" ? "commit"
      : parts.length === 4 && parts[3] === "commits" ? "commits" : null;
    if (this.issuesFail && mine && parts[3] === "issues") { // the board's own read fails, latest work still answers
      this.calls.push(req.url);
      res.writeHead(this.issuesFail, { "content-type": "application/json" });
      return res.end(JSON.stringify({ message: "Server Error" }));
    }
    if (!what || this.fail) return super.handle(req, res);
    this.calls.push(req.url);
    this.latestCalls.push(req.url);
    const send = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
    const f = this.latestFail[what];
    if (f === "reset") return req.socket.destroy();
    if (f === "garbage") return send(200, "{not json");
    if (typeof f === "number") return send(f, { message: f === 404 ? "Not Found" : f === 409 ? "Git Repository is empty." : "Server Error" });
    if (typeof f === "object" && f) return send(200, f); // a well-formed but odd body
    const per = Number(u.searchParams.get("per_page") ?? "30");
    if (what === "activity") return send(200, this.activity.slice(0, per));
    if (what === "commits") return send(200, this.main.slice(0, per));
    const c = this.commitsBySha[parts[4]];
    return c ? send(200, c) : send(422, { message: "No commit found for SHA: " + parts[4] });
  }
}

// GitHub reads made for the latest work in one board read.
export const latestReads = (gh) => gh.latestCalls.length;
