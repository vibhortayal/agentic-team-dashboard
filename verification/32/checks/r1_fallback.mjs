#!/usr/bin/env node
// R1 for #32: fall back to /commits on the main line, at most 4 reads, never throws.
import { Board, FakeGitHub, REPO, allCards, commit, item, push, run } from "./lib.mjs";

const at = (h) => `2026-11-12T${String(h).padStart(2, "0")}:00:00Z`;

async function boardFor(own, opts, fail = {}) {
  const gh = own(await new FakeGitHub([item(1, "Plan the garden", ["stage:building", "role:implementer"])], {}, opts).start());
  Object.assign(gh.latestFail, fail);
  const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
  const r = await b.get("/api/board");
  let data = null;
  try { data = JSON.parse(r.text); } catch {}
  return { gh, b, status: r.status, data };
}

await run("R1 fallback and never throws", async (r, own) => {
  const main = [5, 4, 3, 2].map((h) => commit({ name: "Ian", email: "implementer@team.invalid", message: `Main ${h}`, at: at(h) }));
  const branch = commit({ name: "Vera", email: "verifier@team.invalid", message: "On a branch", at: at(9) });
  const opts = () => ({ commits: [...main, branch], activity: [push(branch, { ref: "refs/heads/team/1" })], main });
  for (const f of [404, 403, 500, "reset", "garbage", { message: "odd" }]) {
    const { gh, status, data } = await boardFor(own, opts(), { activity: f });
    const tag = `/activity ${typeof f === "object" ? "odd object" : f}`;
    r.check(status === 200 && data && !data.error, `${tag}: board answers without error (status ${status}, error=${JSON.stringify(data?.error)})`);
    r.check(JSON.stringify(data?.latest?.map((x) => x.what)) === JSON.stringify(["Main 5", "Main 4", "Main 3"]), `${tag}: falls back to the main line's 3 newest (got ${JSON.stringify(data?.latest?.map((x) => x.what))})`);
    r.check(gh.latestCalls.length <= 4, `${tag}: at most 4 reads (made ${gh.latestCalls.length}: ${gh.latestCalls.join(" ")})`);
    r.check(gh.latestCalls.some((u) => /\/commits(\?|$)/.test(u)), `${tag}: the fallback read /commits`);
  }
  // everything for latest work fails, each way
  for (const f of [404, 500, "reset", "garbage"]) {
    const { gh, status, data } = await boardFor(own, opts(), { activity: f, commit: f, commits: f });
    r.check(status === 200 && data && !data.error && allCards(data).length === 1 && Array.isArray(data.latest),
      `all latest routes ${f}: board still answers with its card and a list (status ${status}, error=${JSON.stringify(data?.error)}, latest=${JSON.stringify(data?.latest)})`);
    r.check(gh.latestCalls.length <= 4, `all latest routes ${f}: at most 4 reads (made ${gh.latestCalls.length})`);
  }
  // one /commits/<sha> fails
  {
    const { status, data } = await boardFor(own, opts(), { commit: 500 });
    r.check(status === 200 && data && !data.error && Array.isArray(data.latest), `/commits/<sha> 500: board answers (latest=${JSON.stringify(data?.latest)})`);
  }
  // empty repo: no pushes, /commits answers 409
  {
    const { status, data } = await boardFor(own, { commits: [], activity: [], main: [] }, { commits: 409 });
    r.check(status === 200 && data && !data.error && Array.isArray(data.latest) && data.latest.length === 0, `empty repo (409): board answers with no latest (latest=${JSON.stringify(data?.latest)})`);
  }
  // not stated: /activity answers [] but the main line has commits (note only)
  {
    const { data } = await boardFor(own, { commits: main, activity: [], main });
    console.log(`  note /activity empty, main line has commits -> latest ${JSON.stringify(data?.latest?.map((x) => x.what))}`);
  }
});
