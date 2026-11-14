#!/usr/bin/env node
// #29 AC1: GET /api/projects marks each project team: true when TEAM.md exists at its root and lists those first.
// It looks inside at most 100 projects, 8 at a time. A look that fails counts as not a team project and never
// fails the list.
import { FakeGitHub, names, run, startBoard } from "./lib.mjs";

async function list(b) {
  const r = await b.get("/api/projects");
  let data = null;
  try { data = JSON.parse(r.text); } catch {}
  return { status: r.status, text: r.text, projects: data?.projects ?? null };
}
const teamFirst = (ps) => { const i = ps.findIndex((p) => !p.team); return i === -1 || ps.slice(i).every((p) => !p.team); };
const short = (ps) => JSON.stringify((ps ?? []).map((p) => `${p.repo}${p.team ? "*" : ""}`)).slice(0, 300);

await run("#29 AC1 team projects", async (r, own) => {
  // 1. Mark and order, through /user/repos (a GITHUB_TOKEN sign-in has no App installations).
  const six = ["acme/alpha", "acme/bravo", "acme/charlie", "acme/delta", "acme/echo", "acme/foxtrot"];
  const gh = own(await new FakeGitHub({ repos: six, team: ["acme/charlie", "acme/foxtrot"] }).start());
  const b = own(await startBoard(gh));
  const st = await b.json("/api/status");
  r.check(st.repo === "", `no project saved yet (${JSON.stringify(st.repo)})`);
  let l = await list(b);
  r.check(l.status === 200 && Array.isArray(l.projects), `AC1 the list answers 200 (${l.status} ${l.text.slice(0, 200)})`);
  const ps = l.projects ?? [];
  r.check(ps.length === 6 && new Set(ps.map((p) => p.repo)).size === 6 && six.every((n) => ps.some((p) => p.repo === n)), `AC1 all 6 projects listed once (${short(ps)})`);
  r.check(ps.every((p) => typeof p.team === "boolean"), "AC1 every project carries a true/false team mark");
  r.check(ps.filter((p) => p.team).map((p) => p.repo).sort().join() === "acme/charlie,acme/foxtrot", `AC1 team: true exactly where TEAM.md exists (${short(ps)})`);
  r.check(teamFirst(ps), `AC1 team projects listed first (${short(ps)})`);
  r.check(gh.looks.every((x) => /\/contents\/TEAM\.md/.test(x.path)), `looks ask for TEAM.md at the root (${JSON.stringify(gh.looks.slice(0, 2).map((x) => x.path))})`);
  const others = ps.filter((p) => !p.team).map((p) => p.repo);
  r.note(`order kept among the others: ${JSON.stringify(others)} (GitHub's was ${JSON.stringify(six.filter((n) => others.includes(n)))})`);
  const again = await list(b);
  r.check(JSON.stringify(again.projects) === JSON.stringify(ps), "AC1 asking again gives the same answer");

  // 2. Same through GitHub App installations (two of them).
  const gh2 = own(await new FakeGitHub({ installs: [["acme/one", "acme/two"], ["beta/three", "beta/four"]], team: ["beta/four"] }).start());
  const b2 = own(await startBoard(gh2));
  l = await list(b2);
  r.check(l.status === 200 && l.projects?.length === 4 && l.projects[0].repo === "beta/four" && l.projects[0].team === true && l.projects.slice(1).every((p) => p.team === false),
    `AC1 through installations: the team project first, the rest marked false (${short(l.projects)})`);

  // 3. At most 100 looks: 100 (last allowed), 101 (first over), 250.
  for (const [n, how] of [[100, "repos"], [100, "installs"], [101, "installs"], [250, "installs"]]) {
    const all = names(n);
    const last = all[Math.min(n, 100) - 1];
    const g = own(await new FakeGitHub(how === "repos" ? { repos: all, team: [last] } : { installs: [all.slice(0, 100), all.slice(100, 200), all.slice(200)].filter((x) => x.length), team: [last] }).start());
    const bb = own(await startBoard(g));
    const t = Date.now();
    l = await list(bb);
    const looked = g.looked();
    r.check(l.status === 200 && l.projects?.length === n, `AC1 ${n} projects (${how}): all ${n} listed (${l.status}, ${l.projects?.length}, ${Date.now() - t} ms)`);
    r.check(new Set(looked).size <= 100 && looked.length <= 100, `AC1 ${n} projects: at most 100 looked at (${looked.length} looks, ${new Set(looked).size} projects)`);
    r.check(new Set(looked).size === looked.length, `AC1 ${n} projects: no project looked at twice`);
    if (n === 100) {
      r.check(new Set(looked).size === 100, `AC1 100 projects (last allowed): all 100 looked at (${new Set(looked).size})`);
      r.check(l.projects?.[0]?.repo === last && l.projects?.[0]?.team === true, `AC1 100 projects: a team project in 100th place is marked and listed first (${short(l.projects?.slice(0, 2))})`);
    } else {
      r.check(new Set(looked).size === 100, `AC1 ${n} projects (over the cap): exactly 100 looked at (${new Set(looked).size})`);
      r.note(`${n} projects: looked at ${JSON.stringify([...new Set(looked)].slice(0, 2))} ... ${JSON.stringify([...new Set(looked)].slice(-2))}; team project ${last} marked ${l.projects?.find((p) => p.repo === last)?.team}`);
    }
  }

  // 4. 8 at a time.
  const forty = names(40, "acme/q");
  const g8 = own(await new FakeGitHub({ repos: forty, team: [forty[39]] }).start());
  g8.lookDelay = 150;
  const b8 = own(await startBoard(g8));
  let t = Date.now();
  l = await list(b8);
  const ms = Date.now() - t;
  r.check(l.status === 200 && l.projects?.length === 40 && l.projects[0].repo === forty[39], `AC1 40 slow looks: the list answers with the team project first (${l.status}, ${ms} ms)`);
  r.check(g8.peak <= 8, `AC1 never more than 8 looks at once (peak ${g8.peak})`);
  r.note(`40 looks of 150 ms took ${ms} ms with a peak of ${g8.peak} open at once`);

  // 5. A look that fails.
  const kinds = { "acme/e500": 500, "acme/e403": 403, "acme/e401": 401, "acme/e429": 429, "acme/e502": 502, "acme/reset": "reset" };
  const failing = Object.keys(kinds);
  const gf = own(await new FakeGitHub({ repos: ["acme/plain", ...failing, "acme/realteam"], team: ["acme/realteam", ...failing] }).start());
  Object.assign(gf.lookFail, kinds);
  const bf = own(await startBoard(gf));
  l = await list(bf);
  r.check(l.status === 200 && l.projects?.length === failing.length + 2, `AC1 failed looks never fail the list (${l.status}, ${l.projects?.length} of ${failing.length + 2})`);
  for (const f of failing) {
    const p = l.projects?.find((x) => x.repo === f);
    r.check(p && p.team === false, `AC1 a look that ${typeof kinds[f] === "number" ? "answers " + kinds[f] : "drops the connection"} counts as not a team project (${JSON.stringify(p)})`);
  }
  r.check(l.projects?.[0]?.repo === "acme/realteam" && l.projects[0].team === true, `AC1 a real team project next to failed looks is still marked and first (${short(l.projects?.slice(0, 2))})`);
  r.check(bf.alive(), "the board is still running");
  // A 200 whose body isn't JSON: GitHub said the file is there, so not counted as a failed look (a note, not a row).
  const gj = own(await new FakeGitHub({ repos: ["acme/badjson"], team: ["acme/badjson"] }).start());
  gj.lookFail["acme/badjson"] = "badjson";
  const bj = own(await startBoard(gj));
  l = await list(bj);
  r.check(l.status === 200 && l.projects?.length === 1, `a 200 TEAM.md answer whose body isn't JSON never fails the list (${l.status})`);
  r.note(`a 200 TEAM.md answer whose body isn't JSON is marked team: ${l.projects?.[0]?.team} (the board reads only the status)`);

  // 6. A look that never answers: the list still answers once the board gives up on it.
  const gh6 = own(await new FakeGitHub({ repos: ["acme/hang", "acme/realteam"], team: ["acme/realteam", "acme/hang"] }).start());
  gh6.lookFail["acme/hang"] = "hang";
  const b6 = own(await startBoard(gh6));
  t = Date.now();
  const ctl = AbortSignal.timeout(60_000);
  let hl = null;
  try { const resp = await fetch(b6.url("/api/projects"), { signal: ctl }); hl = { status: resp.status, data: JSON.parse(await resp.text()) }; } catch (e) { hl = { status: 0, err: String(e) }; }
  const took = Date.now() - t;
  const hp = hl.data?.projects ?? [];
  r.check(hl.status === 200 && hp.length === 2 && hp.find((p) => p.repo === "acme/hang")?.team === false && hp[0]?.repo === "acme/realteam",
    `AC1 a look that never answers: the list still answers, that project not a team one (${hl.status} ${JSON.stringify(hl.data ?? hl.err).slice(0, 200)}, ${took} ms)`);
  r.note(`a look that never answers held the list for ${took} ms`);

  r.check([b, b2, b8, bf, bj, b6].every((x) => x.netAttempts().length === 0), "no attempt to reach the internet");
});
