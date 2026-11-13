// Shared helpers for the #11 checks (not a check itself: it is not executable).
// Extends #8's fake GitHub (../../8/checks/lib.mjs) so it also answers what #11 reads:
//   GET /repos/<repo>/releases, /deployments, /deployments/<id>/statuses and /pulls (with head ref and sha).
// Each of those can be made to fail on its own (appFail). Newest first, as GitHub returns them.
import { FakeGitHub as Fake8 } from "../../8/checks/lib.mjs";
export { Board, REPO, allCards, comment, ev, item, run, strings } from "../../8/checks/lib.mjs";
import { REPO } from "../../8/checks/lib.mjs";

export const SHA = "aaa111aaa111aaa111aaa111aaa111aaa111aaa1";
export const BRANCH = "feat/seeds";

let did = 500;
// A deployment with its statuses (oldest first in `states`; the last one is the latest).
export function deploy({ env = "Preview", production, ref = BRANCH, sha = SHA, url, states = ["success"], day = 10, hour = 10, target } = {}) {
  did += 1;
  const at = `2026-11-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00Z`;
  const prod = production ?? /^prod/i.test(env);
  return {
    id: did, sha, ref, environment: env, created_at: at, updated_at: at,
    production_environment: prod, transient_environment: !prod,
    statuses: states.map((state, k) => ({
      id: did * 10 + k, state, environment_url: state === "success" ? url : "", target_url: target ?? url ?? "",
      created_at: at.replace(/:00:00Z$/, `:${String(k).padStart(2, "0")}:00Z`),
    })),
  };
}

export function release(tag, { draft = false, prerelease = false, day = 1, body = `Notes for ${tag}.` } = {}) {
  const at = `2026-10-${String(day).padStart(2, "0")}T09:00:00Z`;
  return { id: 9000 + day, tag_name: tag, name: tag, body, draft, prerelease,
    created_at: at, published_at: draft ? null : at, html_url: `https://github.com/${REPO}/releases/tag/${tag}` };
}

// The pull-request shape of an item, with its head.
export function pullOf(it, { ref = BRANCH, sha = SHA } = {}) {
  return { ...it, head: { ref, sha }, base: { ref: "main" } };
}

export class FakeGitHub extends Fake8 {
  constructor(items = [], comments = {}, { releases = [], deployments = [], pulls = {} } = {}) {
    super(items, comments);
    this.releases = releases;
    this.deployments = deployments;
    this.pulls = pulls; // number -> {ref, sha}
    this.appFail = {}; // {releases|deployments|statuses|pulls: 403 | 404 | 500 | "reset"}
  }
  appCalls() { return this.calls.filter((u) => /\/(releases|deployments|pulls)(\/|\?|$)/.test(u)); }
  handle(req, res) {
    const u = new URL(req.url, "http://x");
    const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    const mine = parts[0] === "repos" && `${parts[1]}/${parts[2]}` === REPO;
    const what = !mine ? null
      : parts.length === 4 && parts[3] === "releases" ? "releases"
      : parts.length === 4 && parts[3] === "deployments" ? "deployments"
      : parts.length === 6 && parts[3] === "deployments" && parts[5] === "statuses" ? "statuses"
      : parts.length === 4 && parts[3] === "pulls" ? "pulls" : null;
    if (!what || this.fail) return super.handle(req, res);
    this.calls.push(req.url);
    const send = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
    const f = this.appFail[what];
    if (f === "reset") return req.socket.destroy();
    if (f === 403) return send(403, { message: "Resource not accessible by integration" });
    if (typeof f === "number") return send(f, { message: f === 404 ? "Not Found" : "Server Error" });
    const page = Number(u.searchParams.get("page") ?? "1");
    if (page > 1) return send(200, []);
    const newest = (list, key) => [...list].sort((a, b) => String(b[key]).localeCompare(String(a[key])));
    if (what === "releases") return send(200, newest(this.releases, "created_at"));
    if (what === "deployments") {
      let list = newest(this.deployments, "created_at");
      for (const k of ["environment", "ref", "sha"]) {
        const v = u.searchParams.get(k);
        if (v) list = list.filter((d) => d[k] === v);
      }
      return send(200, list.map(({ statuses, ...d }) => ({ ...d, url: `${this.url}/repos/${REPO}/deployments/${d.id}` })));
    }
    if (what === "statuses") {
      const d = this.deployments.find((x) => x.id === Number(parts[4]));
      return d ? send(200, newest(d.statuses, "created_at")) : send(404, { message: "Not Found" });
    }
    // pulls: open items that are pull requests, with their head
    const state = u.searchParams.get("state") ?? "open";
    const prs = this.items.filter((i) => i.pull_request && (state === "all" || i.state === state));
    return send(200, prs.map((i) => pullOf(i, this.pulls[i.number] ?? {})));
  }
}

// The waiting card for item n (from board.needed, else any column).
export function waiting(board, n) {
  return (board.needed ?? []).find((c) => c.number === n) ?? null;
}
