#!/usr/bin/env node
// R4 for #32: when the board has an error, no latest lines show (in /api/board; the page is in page.mjs).
import { Board, FakeGitHub, REPO, commit, item, push, run } from "./lib.mjs";

await run("R4 error hides latest", async (r, own) => {
  const c = commit({ name: "Vera", email: "verifier@team.invalid", message: "Should not show", at: "2026-11-12T10:00:00Z" });
  for (const how of ["issues 500", "everything 500", "everything reset"]) {
    const gh = own(await new FakeGitHub([item(1, "Plan", ["stage:building", "role:implementer"])], {}, { commits: [c], activity: [push(c)], main: [c] }).start());
    if (how === "issues 500") gh.issuesFail = 500;
    else gh.fail = how === "everything 500" ? 500 : "reset";
    const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
    const res = await b.get("/api/board");
    let data = null;
    try { data = JSON.parse(res.text); } catch {}
    r.check(!!data?.error, `${how}: the board has an error (${JSON.stringify(data?.error)})`);
    r.check(Array.isArray(data?.latest) ? data.latest.length === 0 : data?.latest == null, `${how}: no latest lines (got ${JSON.stringify(data?.latest)})`);
    r.check(!res.text.includes("Should not show"), `${how}: the commit line is nowhere in /api/board`);
  }
});
