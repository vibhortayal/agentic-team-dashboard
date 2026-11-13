#!/usr/bin/env node
// AC1 Try it, round 4: "the latest *successful* non-production deployment whose branch or commit matches the pull
// request", inside section 7's 6 status reads. Only a waiting change shows Try it, so a waiting change whose newest
// preview failed needs its older one read before reads go to open pull requests that aren't waiting.
//   (a) 1 live deployment, 1 waiting change (#40, newest preview failed, older one worked), 4 other open pull
//       requests with a preview each: 3 status reads are enough (live, 40's newest, 40's older).
//   (b) 1 live deployment, 3 waiting changes (#42, #41, #40; #40's newest failed), 2 other open pull requests:
//       5 status reads are enough (live, three newest, 40's older).
import { Board, FakeGitHub, REPO, comment, deploy, ev, item, run, waiting } from "./lib.mjs";

const ask = (n) => comment(n, "**Priya (product-manager) → owner** · question", "Please try it.",
  ev("product-manager", "owner", "question", { human: "human:approve-ui" }), { minute: 1 });
const sha = (c) => c.repeat(40);

await run("AC1 Try it: a waiting change's older preview before other open pull requests", async (r, own) => {
  const cases = { a: { wait: [40], other: [50, 51, 52, 53] }, b: { wait: [42, 41, 40], other: [50, 51] } };
  for (const [name, { wait, other }] of Object.entries(cases)) {
    const all = [...other, ...wait].sort((x, y) => y - x);
    const items = all.map((n) => wait.includes(n)
      ? item(n, `Change ${n}`, ["stage:verifying", "role:verifier", "needs-human", "human:approve-ui"], { pr: true })
      : item(n, `Change ${n}`, ["stage:building", "role:implementer"], { pr: true }));
    const pulls = Object.fromEntries(all.map((n, k) => [n, { ref: `feat/x${n}`, sha: sha("abcdefghij"[k]) }]));
    const deployments = [deploy({ env: "Production", url: "https://garden.example", day: 7 })];
    for (const n of wait) {
      deployments.push(deploy({ ref: pulls[n].ref, sha: pulls[n].sha, url: `https://${n}-8.preview.example`, day: 8 }));
      deployments.push(deploy({ ref: pulls[n].ref, sha: pulls[n].sha, url: `https://${n}-9.preview.example`, day: 9,
        states: n === 40 ? ["in_progress", "failure"] : ["success"] }));
    }
    for (const n of other) deployments.push(deploy({ ref: pulls[n].ref, sha: pulls[n].sha, url: `https://${n}.preview.example`, day: 10 }));
    const comments = Object.fromEntries(wait.map((n) => [n, [ask(n)]]));
    const gh = own(await new FakeGitHub(items, comments, { deployments, pulls }).start());
    const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
    const out = await b.board();
    const statuses = gh.appCalls().filter((u) => /\/statuses/.test(u)).length;
    b.stop(); gh.stop();
    for (const n of wait) {
      const c = waiting(out, n);
      const want = n === 40 ? `https://${n}-8.preview.example` : `https://${n}-9.preview.example`;
      r.check(c && c.try_url === want,
        `AC1 (${name}) waiting change #${n} has Try it ${want} (got ${JSON.stringify(c?.try_url)}; ${statuses} status reads)`);
    }
    r.check(statuses <= 6, `(${name}) sec 7 at most 6 status reads (got ${statuses})`);
  }
});
