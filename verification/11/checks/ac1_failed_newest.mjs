#!/usr/bin/env node
// AC1 Try it, round 3: "the latest *successful* non-production deployment whose branch or commit matches the pull
// request", inside section 7's 6 status reads. Three waiting changes and one live deployment; the newest preview of
// the third change failed and the one before it worked. That needs 5 status reads (live, the three newest previews,
// then the third change's older one), so every waiting change can still have its Try it.
import { Board, FakeGitHub, REPO, comment, deploy, ev, item, run, waiting } from "./lib.mjs";

const ask = (n) => comment(n, "**Priya (product-manager) → owner** · question", "Please try it.",
  ev("product-manager", "owner", "question", { human: "human:approve-ui" }), { minute: 1 });
const sha = (c) => c.repeat(40);

await run("AC1 Try it when a waiting change's newest preview failed", async (r, own) => {
  for (const failed of [40, 41, 42]) {
    const items = [42, 41, 40].map((n) => item(n, `Change ${n}`, ["stage:verifying", "role:verifier", "needs-human", "human:approve-ui"], { pr: true }));
    const pulls = { 42: { ref: "feat/c", sha: sha("c") }, 41: { ref: "feat/b", sha: sha("b") }, 40: { ref: "feat/a", sha: sha("a") } };
    const deployments = [deploy({ env: "Production", url: "https://garden.example", day: 7 })];
    for (const [n, p] of Object.entries(pulls)) {
      deployments.push(deploy({ ref: p.ref, sha: p.sha, url: `https://${n}-8.preview.example`, day: 8 }));
      deployments.push(deploy({ ref: p.ref, sha: p.sha, url: `https://${n}-9.preview.example`, day: 9,
        states: Number(n) === failed ? ["in_progress", "failure"] : ["success"] }));
    }
    const gh = own(await new FakeGitHub(items, { 40: [ask(40)], 41: [ask(41)], 42: [ask(42)] }, { deployments, pulls }).start());
    const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
    const out = await b.board();
    const statuses = gh.appCalls().filter((u) => /\/statuses/.test(u)).length;
    b.stop(); gh.stop();
    for (const n of [40, 41, 42]) {
      const c = waiting(out, n);
      const want = n === failed ? `https://${n}-8.preview.example` : `https://${n}-9.preview.example`;
      r.check(c && c.try_url === want,
        `AC1 #${failed}'s newest preview failed: waiting change #${n} has Try it ${want} (got ${JSON.stringify(c?.try_url)}; ${statuses} status reads)`);
    }
    r.check(statuses <= 6, `sec 7 at most 6 status reads (got ${statuses})`);
  }
});
