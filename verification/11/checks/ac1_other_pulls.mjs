#!/usr/bin/env node
// AC1 Try it, round 2 (finding F1 still open): every waiting change gets its preview while the status reads stay
// inside section 7's 6. Open pull requests that are not waiting, and older previews of the same branch, must not
// use up the reads a waiting change needs. In both cases below one status read per waiting change (plus the live
// link's) is enough, so a board that reads only what it can show finds every preview.
import { Board, FakeGitHub, REPO, comment, deploy, ev, item, run, waiting } from "./lib.mjs";

const ask = (n) => comment(n, "**Priya (product-manager) → owner** · question", "Please try it.",
  ev("product-manager", "owner", "question", { human: "human:approve-ui" }), { minute: 1 });
const sha = (c) => c.repeat(40);

await run("AC1 Try it with other open pull requests", async (r, own) => {
  async function board(items, comments, deployments, pulls) {
    const gh = own(await new FakeGitHub(items, comments, { deployments, pulls }).start());
    const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
    const out = await b.board();
    const statuses = gh.appCalls().filter((u) => /\/statuses/.test(u)).length;
    b.stop(); gh.stop();
    return { out, statuses };
  }

  { // One waiting pull request (#40, the oldest); three newer open pull requests that are not waiting, each with two previews.
    const items = [
      item(43, "Menu colours", ["stage:building", "role:implementer"], { pr: true }),
      item(42, "Footer", ["stage:building", "role:implementer"], { pr: true }),
      item(41, "Search box", ["stage:building", "role:implementer"], { pr: true }),
      item(40, "Seed list page", ["stage:verifying", "role:verifier", "needs-human", "human:approve-ui"], { pr: true }),
    ];
    const pulls = { 43: { ref: "feat/menu", sha: sha("3") }, 42: { ref: "feat/footer", sha: sha("2") },
      41: { ref: "feat/search", sha: sha("1") }, 40: { ref: "feat/seeds", sha: sha("0") } };
    const deployments = [deploy({ ref: "feat/seeds", sha: sha("0"), url: "https://seeds.preview.example", day: 5 })];
    for (const [n, p] of Object.entries(pulls)) if (n !== "40")
      for (const day of [8, 9]) deployments.push(deploy({ ref: p.ref, sha: p.sha, url: `https://${n}-${day}.preview.example`, day }));
    deployments.push(deploy({ env: "Production", url: "https://garden.example", day: 7 }));
    const { out, statuses } = await board(items, { 40: [ask(40)] }, deployments, pulls);
    const c = waiting(out, 40);
    r.check(!!c, `setup: #40 is waiting for you (needed: ${JSON.stringify((out.needed ?? []).map((x) => x.number))})`);
    r.check(c && c.try_url === "https://seeds.preview.example",
      `AC1 the one waiting change has Try it when 3 open pull requests that aren't waiting have newer previews (want "https://seeds.preview.example", got ${JSON.stringify(c?.try_url)}; ${statuses} status reads)`);
    r.check(statuses <= 6, `sec 7 at most 6 status reads (got ${statuses})`);
  }

  { // Three waiting pull requests, each with two successful previews, and two production deployments.
    const items = [42, 41, 40].map((n) => item(n, `Change ${n}`, ["stage:verifying", "role:verifier", "needs-human", "human:approve-ui"], { pr: true }));
    const pulls = { 42: { ref: "feat/c", sha: sha("c") }, 41: { ref: "feat/b", sha: sha("b") }, 40: { ref: "feat/a", sha: sha("a") } };
    const deployments = [deploy({ env: "Production", url: "https://garden.example", day: 6 }), deploy({ env: "Production", url: "https://garden.example", day: 7 })];
    for (const [n, p] of Object.entries(pulls)) for (const day of [8, 9])
      deployments.push(deploy({ ref: p.ref, sha: p.sha, url: `https://${n}-${day}.preview.example`, day }));
    const { out, statuses } = await board(items, { 40: [ask(40)], 41: [ask(41)], 42: [ask(42)] }, deployments, pulls);
    for (const n of [40, 41, 42]) {
      const c = waiting(out, n);
      r.check(!!c, `setup: #${n} is waiting for you`);
      r.check(c && c.try_url === `https://${n}-9.preview.example`,
        `AC1 waiting change #${n} of 3 has Try it, its newest preview (got ${JSON.stringify(c?.try_url)}; ${statuses} status reads)`);
    }
    r.check(statuses <= 6, `sec 7 at most 6 status reads (got ${statuses})`);
  }
});
