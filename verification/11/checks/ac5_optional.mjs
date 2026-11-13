#!/usr/bin/env node
// AC5 Optional reads: releases or deployments that can't be read leave the rest of the board, with no error.
// Section 7: at most 10 extra GitHub reads per refresh, inside the same one-minute cache.
import { Board, FakeGitHub, REPO, comment, deploy, ev, item, release, run, waiting } from "./lib.mjs";

const fixture = () => {
  const items = [
    item(30, "Seed list page", ["stage:verifying", "role:verifier", "needs-human", "human:approve-ui"], { pr: true }),
    item(31, "Pick a colour", ["stage:spec", "role:product-manager", "needs-human", "human:answer"]),
    item(32, "Watering log", ["stage:building", "role:implementer"]),
  ];
  const ask = (n) => comment(n, "**Priya (product-manager) → owner** · question", "Please have a look.", ev("product-manager", "owner", "question", { human: "human:answer" }));
  return [items, { 30: [ask(30)], 31: [ask(31)] }];
};
const data = () => ({ releases: [release("v1.0")], deployments: [deploy({ url: "https://p.example" }), deploy({ env: "Production", url: "https://live.example", day: 11 })] });

await run("AC5/sec 7 optional reads", async (r, own) => {
  for (const what of [["releases"], ["deployments"], ["statuses"], ["pulls"], ["releases", "deployments"], ["releases", "deployments", "statuses", "pulls"]]) {
    for (const fail of [403, 404, 500, "reset"]) {
      const [items, cm] = fixture();
      const gh = own(await new FakeGitHub(items, cm, data()).start());
      for (const w of what) gh.appFail[w] = fail;
      const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
      const bb = await b.board();
      const cards = (bb.columns ?? []).flatMap((c) => c.cards ?? []).length;
      r.check(!bb.error && cards === 3 && waiting(bb, 30) && waiting(bb, 31) && typeof bb.app === "object",
        `AC5 ${what.join("+")} answer ${fail}: the board shows with no error (error ${JSON.stringify(bb.error)}, ${cards} cards, waiting ${(bb.needed ?? []).length})`);
      b.stop(); gh.stop();
    }
  }

  // Section 7: 3 waiting pull requests (each with matching previews), 20 deployments, 8 releases.
  const items = [], cm = {}, pulls = {}, deployments = [];
  for (let n = 60; n < 63; n++) {
    items.push(item(n, `Change ${n}`, ["stage:verifying", "role:verifier", "needs-human", "human:approve-ui"], { pr: true }));
    const sha = String(n).repeat(20);
    pulls[n] = { ref: `feat/c${n}`, sha };
    cm[n] = [comment(n, "**Vera (verifier) → owner** · question", "Try it.", ev("verifier", "owner", "question", { human: "human:approve-ui" }))];
  }
  for (let k = 0; k < 20; k++) {
    const n = 60 + (k % 3);
    deployments.push(deploy({ env: k % 4 === 0 ? "Production" : "Preview", ref: `feat/c${n}`, sha: String(n).repeat(20), url: `https://d${k}.example`, day: 1 + k }));
  }
  const releases = Array.from({ length: 8 }, (_, k) => release(`v1.${k}`, { day: k + 1 }));
  const gh = own(await new FakeGitHub(items, cm, { deployments, releases, pulls }).start());
  const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
  const before = gh.appCalls().length;
  const bb = await b.board();
  const first = gh.appCalls().slice(before);
  console.log("  note reads on the first refresh: " + JSON.stringify(first.map((u) => u.replace(/\?.*/, ""))));
  r.check(first.length <= 10, `7 at most 10 extra reads on one refresh with 20 deployments and 3 waiting changes (got ${first.length})`);
  r.check(first.filter((u) => /\/statuses/.test(u)).length <= 6, `7 at most 6 deployment-status reads (got ${first.filter((u) => /\/statuses/.test(u)).length})`);
  const tries = (bb.needed ?? []).filter((c) => c.try_url).length;
  console.log(`  note waiting changes with a Try it link under the read limit: ${tries} of 3; live link ${JSON.stringify(bb.app?.live_url)}`);
  r.check(bb.app?.live_url === "https://d16.example", `7 within the limit the live link is still the latest production one (got ${JSON.stringify(bb.app?.live_url)})`);
  const n0 = gh.appCalls().length;
  for (const step of [12, 47]) {
    b.advance(step);
    await b.board(true);
    await b.board();
  }
  r.check(gh.appCalls().length === n0, `7 refreshes inside the minute read none of them again (${n0} -> ${gh.appCalls().length})`);
  b.advance(3);
  await b.board(true);
  r.check(gh.appCalls().length > n0, `7 a refresh after the minute reads them again (${n0} -> ${gh.appCalls().length})`);
});
