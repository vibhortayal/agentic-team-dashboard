#!/usr/bin/env node
// AC1 Try it: a waiting change's preview is the latest successful non-production deployment whose branch or
// commit matches the pull request, else the latest `preview` in its team comments. No preview, no button.
// Only https links. Read from /api/board (card.try_url); page.mjs checks the button itself.
import { BRANCH, Board, FakeGitHub, REPO, SHA, comment, deploy, ev, item, run, waiting } from "./lib.mjs";

const PR = 30, ISSUE = 31;
const ask = (n, extra = {}, minute = 1) => comment(n, "**Priya (product-manager) → owner** · question",
  "Please try the new seed list.", ev("product-manager", "owner", "question", { human: "human:approve-ui", ...extra }), { minute });
function fixture(prComments = [ask(PR)]) {
  const items = [
    item(PR, "Seed list page", ["stage:verifying", "role:verifier", "needs-human", "human:approve-ui"], { pr: true }),
    item(ISSUE, "Pick a colour", ["stage:spec", "role:product-manager", "needs-human", "human:answer"]),
  ];
  return [items, { [PR]: prComments, [ISSUE]: [ask(ISSUE)] }];
}

await run("AC1 Try it", async (r, own) => {
  async function tryUrl(why, { deployments = [], comments, pulls } = {}) {
    const [items, cm] = fixture(comments);
    const gh = own(await new FakeGitHub(items, cm, { deployments, pulls }).start());
    const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
    const board = await b.board();
    const card = waiting(board, PR);
    if (!card) r.check(false, `${why}: the pull request is waiting for you (needed: ${JSON.stringify((board.needed ?? []).map((c) => c.number))}, error ${JSON.stringify(board.error)})`);
    const net = b.netAttempts();
    b.stop(); gh.stop();
    if (net.length) r.check(false, `${why}: no internet attempts (${net})`);
    return { card, board };
  }
  const is = async (why, opts, want) => {
    const { card } = await tryUrl(why, opts);
    r.check(card && card.try_url === want, `AC1 ${why} (want ${JSON.stringify(want)}, got ${JSON.stringify(card?.try_url)})`);
  };

  const OLD = "https://seeds-old.preview.example", NEW = "https://seeds-new.preview.example";
  await is("by branch: the newer of two successful previews", {
    deployments: [deploy({ url: OLD, day: 10 }), deploy({ url: NEW, day: 11 })] }, NEW);
  await is("by commit: a preview whose ref is the head sha", {
    deployments: [deploy({ ref: SHA, url: NEW })] }, NEW);
  await is("by commit only: same sha, another branch name", {
    deployments: [deploy({ ref: "some-other-name", url: NEW })] }, NEW);
  await is("a newer failed preview is skipped for the older successful one", {
    deployments: [deploy({ url: OLD, day: 10 }), deploy({ url: "https://broken.preview.example", day: 11, states: ["in_progress", "failure"] })] }, OLD);
  await is("a newer preview still in progress is skipped", {
    deployments: [deploy({ url: OLD, day: 10 }), deploy({ url: "https://building.preview.example", day: 11, states: ["queued", "in_progress"] })] }, OLD);
  await is("a production deployment of the same commit is never Try it", {
    deployments: [deploy({ env: "Production", url: "https://live.example", day: 12 })] }, null);
  await is("a preview of another branch and commit gives no button", {
    deployments: [deploy({ ref: "feat/other", sha: "bbb222bbb222bbb222bbb222bbb222bbb222bbb2", url: NEW })] }, null);
  await is("no deployment and no comment preview: no button", {}, null);

  const C1 = "https://from-comment-1.example", C2 = "https://from-comment-2.example";
  const withPreviews = [ask(PR, { preview: C1 }, 1), ask(PR, { preview: C2 }, 2), ask(PR, {}, 3)];
  await is("no deployment: the latest `preview` in its team comments", { comments: withPreviews }, C2);
  await is("a matching deployment beats a comment preview", {
    comments: withPreviews, deployments: [deploy({ url: NEW })] }, NEW);
  await is("a failed-only deployment falls back to the comment preview", {
    comments: withPreviews, deployments: [deploy({ url: NEW, states: ["failure"] })] }, C2);

  // Only https links are shown: the page draws a link only for https (page.mjs checks the page with these).
  // The data may still carry another address; that is a note here, not a failure.
  for (const bad of ["http://seeds.preview.example", "javascript:alert(1)"]) {
    const { card } = await tryUrl(`note ${bad}`, { deployments: [deploy({ url: bad })] });
    console.log(`  note deployment url ${JSON.stringify(bad)}: data try_url ${JSON.stringify(card?.try_url)} (page.mjs checks it is not a link)`);
  }

  // Previews of other branches are newer (a team works on several branches; each push deploys a preview).
  await is("the change's preview is found when 1 newer preview of another branch exists", {
    deployments: [deploy({ url: NEW, day: 10 }), deploy({ ref: "feat/a", sha: "c".repeat(40), url: "https://a.preview.example", day: 11 })] }, NEW);
  await is("the change's preview is found when 2 newer previews of other branches exist", {
    deployments: [deploy({ url: NEW, day: 10 }), deploy({ ref: "feat/a", sha: "c".repeat(40), url: "https://a.preview.example", day: 11 }),
      deploy({ ref: "feat/b", sha: "d".repeat(40), url: "https://b.preview.example", day: 12 })] }, NEW);

  { // The issue (not a pull request) gets no deployment link, even when a preview exists for the PR.
    const { board } = await tryUrl("issue", { deployments: [deploy({ url: NEW })] });
    const c = waiting(board, ISSUE);
    r.check(c && !c.try_url, `AC1 a waiting issue with no preview of its own has no button (got ${JSON.stringify(c?.try_url)})`);
  }
  r.check(BRANCH === "feat/seeds", "fixture: the pull request's branch is feat/seeds");
});
