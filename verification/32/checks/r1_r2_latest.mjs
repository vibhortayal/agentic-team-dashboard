#!/usr/bin/env node
// R1 (newest pushes on any branch, at most 4 reads) and R2 (three newest; who, what, when) for #32.
import { Board, FakeGitHub, KEY, REPO, allCards, commit, item, push, run, strings } from "./lib.mjs";

const at = (h) => `2026-11-12T${String(h).padStart(2, "0")}:00:00Z`;
const ISSUE = () => [item(1, "Plan the garden", ["stage:building", "role:implementer"])];

async function boardFor(own, opts, items = ISSUE()) {
  const gh = own(await new FakeGitHub(items, {}, opts).start());
  const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
  const r = await b.get("/api/board");
  let data = null;
  try { data = JSON.parse(r.text); } catch {}
  return { gh, b, status: r.status, data };
}

await run("R1/R2 latest work", async (r, own) => {
  // --- five pushes on four branches, newest first ---
  const c = [
    commit({ name: "Vera", email: "verifier@team.invalid", message: "Add checks for the seed list\n\nRows R1-R5.\nMore.", at: at(15) }),
    commit({ name: "Ian", email: "implementer@team.invalid", message: `Wire the login using ${KEY} for now\n\nbody`, at: at(14) }),
    commit({ name: "Engagement Lead", email: "ella@team.invalid", message: "Open the first ticket", at: at(13) }),
    commit({ name: "Product Manager", email: "pm@team.invalid", message: "Draft the plan", at: at(12) }),
    commit({ name: "Sam Owner", email: "sam@gmail.com", message: "My own tweak", at: at(11) }),
  ];
  const mainLine = [commit({ name: "Main Only", email: "main@team.invalid", message: "MAIN LINE ONLY", at: at(1) })];
  const activity = [push(c[0], { ref: "refs/heads/team/32-seeds" }), push(c[1], { ref: "refs/heads/team/40-login" }),
    push(c[2], { ref: "refs/heads/docs/brief" }), push(c[3], { ref: "refs/heads/main" }), push(c[4], { ref: "refs/heads/main" })];
  {
    const { gh, status, data } = await boardFor(own, { commits: [...c, ...mainLine], activity, main: mainLine });
    r.check(status === 200 && data && !data.error, `board answers without error (status ${status}, error=${JSON.stringify(data?.error)})`);
    const L = data?.latest;
    r.check(Array.isArray(L), "latest is a list");
    r.check(L?.length === 3, `R2 three newest shown (got ${L?.length})`);
    r.check(JSON.stringify(L?.map((x) => x.what)) === JSON.stringify(["Add checks for the seed list", L?.[1]?.what, "Open the first ticket"]) && /^Wire the login using/.test(L?.[1]?.what ?? ""),
      `R1 newest pushes on any branch, in order (got ${JSON.stringify(L?.map((x) => x.what))})`);
    r.check(!JSON.stringify(L ?? []).includes("MAIN LINE ONLY"), "R1 the main line does not fill latest when /activity answers");
    r.check(L?.[0]?.what === "Add checks for the seed list", `R2 first line only (got ${JSON.stringify(L?.[0]?.what)})`);
    r.check(!(L ?? []).some((x) => /\n/.test(x.what)), "R2 no line breaks in what");
    r.check(![...strings(data)].some((s) => s.includes(KEY)), "R2 the key in a commit's first line shows nowhere in /api/board");
    r.check(/Wire the login using/.test(L?.[1]?.what ?? "") && !(L?.[1]?.what ?? "").includes("ghp_Abcdef"), `R2 key masked in what (got ${JSON.stringify(L?.[1]?.what)})`);
    r.check(L?.[0]?.who === "Vera", `R2 verifier@team.invalid -> Vera (got ${JSON.stringify(L?.[0]?.who)})`);
    r.check(L?.[1]?.who === "Ian", `R2 implementer@team.invalid -> Ian (got ${JSON.stringify(L?.[1]?.who)})`);
    r.check(L?.[2]?.who === "Ella", `R2 role title "Engagement Lead" -> Ella (got ${JSON.stringify(L?.[2]?.who)})`);
    r.check((L ?? []).every((x, k) => Date.parse(x.at) === Date.parse(c[k].commit.author.date)), `R2 when is the commit's date (got ${JSON.stringify(L?.map((x) => x.at))})`);
    r.check(allCards(data ?? {}).length === 1, "existing cards still show");
    r.check(gh.latestCalls.length <= 4, `R1 at most 4 latest-work reads (made ${gh.latestCalls.length}: ${gh.latestCalls.join(" ")})`);
  }
  // --- who for the 4th/5th commits, and "anyone else": each newest on its own ---
  for (const [name, email, want] of [["Product Manager", "pm@team.invalid", "Priya"], ["Sam Owner", "sam@gmail.com", "You"],
    ["Ian Smith", "ian.smith@example.com", "You"], ["Bea", "budget-analyst@team.invalid", "Bea"], ["Otto", "ops@team.invalid", "Otto"]]) {
    const x = commit({ name, email, message: "One change", at: at(9) });
    const { data } = await boardFor(own, { commits: [x], activity: [push(x)], main: [] });
    r.check(data?.latest?.[0]?.who === want, `R2 ${name} <${email}> -> ${want} (got ${JSON.stringify(data?.latest?.[0]?.who)})`);
  }
  // --- fewer than three, and none ---
  {
    const two = c.slice(0, 2);
    const { data, gh } = await boardFor(own, { commits: two, activity: two.map((x) => push(x)), main: [] });
    r.check(data?.latest?.length === 2, `R2 two available: two shown (got ${data?.latest?.length})`);
    r.check(gh.latestCalls.length <= 4, `R1 at most 4 reads with 2 pushes (made ${gh.latestCalls.length})`);
  }
  {
    const { data, gh, status } = await boardFor(own, { commits: [], activity: [], main: [] });
    r.check(status === 200 && Array.isArray(data?.latest) && data.latest.length === 0, `R2 nothing available: empty list (got ${JSON.stringify(data?.latest)})`);
    r.check(gh.latestCalls.length <= 4, `R1 at most 4 reads with nothing (made ${gh.latestCalls.length})`);
  }
  // --- ten pushes: still at most 4 reads ---
  {
    const many = Array.from({ length: 10 }, (_, k) => commit({ name: "Ian", email: "implementer@team.invalid", message: `Step ${10 - k}`, at: at(20 - k) }));
    const { data, gh } = await boardFor(own, { commits: many, activity: many.map((x, k) => push(x, { ref: `refs/heads/b${k}` })), main: [] });
    r.check(gh.latestCalls.length <= 4, `R1 at most 4 reads with 10 pushes (made ${gh.latestCalls.length}: ${gh.latestCalls.join(" ")})`);
    r.check(JSON.stringify(data?.latest?.map((x) => x.what)) === JSON.stringify(["Step 10", "Step 9", "Step 8"]), `R2 the 3 newest of 10 (got ${JSON.stringify(data?.latest?.map((x) => x.what))})`);
  }
  // --- not stated by the clauses: same commit pushed to two branches, a branch deletion (notes only) ---
  {
    const a = commit({ name: "Ian", email: "implementer@team.invalid", message: "Same commit", at: at(8) });
    const b2 = commit({ name: "Ian", email: "implementer@team.invalid", message: "Older", at: at(7) });
    const { data, gh } = await boardFor(own, { commits: [a, b2], activity: [push(null, { type: "branch_deletion", ref: "refs/heads/old" }), push(a, { ref: "refs/heads/x" }), push(a, { ref: "refs/heads/y", type: "branch_creation" }), push(b2)], main: [] });
    r.note?.(`note: deletion + same commit on two branches -> latest ${JSON.stringify(data?.latest?.map((x) => x.what))}, reads ${gh.latestCalls.length}`);
    console.log(`  note deletion + same commit on two branches -> latest ${JSON.stringify(data?.latest?.map((x) => x.what))}, reads ${gh.latestCalls.length}`);
    r.check(gh.latestCalls.length <= 4, `R1 at most 4 reads with a deletion and a repeat (made ${gh.latestCalls.length})`);
    r.check(data && !data.error && Array.isArray(data.latest), "R1 never throws on a deletion or repeat");
  }
});
