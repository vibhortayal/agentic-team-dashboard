#!/usr/bin/env node
// AC5 (GitHub can't be read) and section 7 (one GitHub read per minute at most, cached).
// The board's clock is stepped forward (guard.mjs), so there is no real wait.
import { Board, FakeGitHub, REPO, allCards, comment, ev, freePort, item, run } from "./lib.mjs";

const items = () => [
  item(1, "Seed list", ["stage:building", "role:implementer"]),
  item(2, "Plan", ["stage:spec", "role:product-manager", "needs-human", "human:approve-spec"]),
];
const JARGON = /HTTP|\b40[0-9]\b|\b50[0-9]\b|\{|Traceback|Error:|fetch failed|ECONN|api\.github|token|undefined/i;

await run("AC5/read rate", async (r, own) => {
  function plainError(board, why) {
    const err = board.error;
    r.check(typeof err === "string" && err.trim() !== "", `AC5 ${why}: page gets an error sentence (${JSON.stringify(err)})`);
    if (typeof err === "string") {
      r.check(!JARGON.test(err), `AC5 ${why}: sentence has no codes or jargon (${JSON.stringify(err)})`);
      console.log(`  note sentences in message: ${(err.trim().match(/[.!?](\s|$)/g) ?? []).length}`);
    }
    r.check(board.repo === REPO, `AC5 ${why}: repo still given so the page can link it (${JSON.stringify(board.repo)})`);
    r.check(allCards(board).length === 0 && !(board.needed ?? []).length && !(board.handled ?? []).length,
      `AC5 ${why}: no cards shown as current`);
  }

  for (const [fail, why] of [["reset", "connection dropped"], [401, "bad sign-in"], ["ratelimit", "rate limit"],
    [404, "private or not found"], [500, "GitHub error"]]) {
    const gh = own(await new FakeGitHub(items(), {}).start());
    gh.fail = fail;
    const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
    plainError(await b.board(), why);
    b.stop(); gh.stop();
  }
  { // No network at all: nothing listens where GitHub should be.
    const dead = { url: `http://127.0.0.1:${await freePort()}` };
    const b = own(await Board.start(["--repo", REPO], { github: dead, env: { GITHUB_TOKEN: "x" } }));
    plainError(await b.board(), "no network");
    b.stop();
  }
  { // No sign-in at all: no token and the gh stub fails. GitHub answers 404 as it does for a private project.
    const gh = own(await new FakeGitHub(items(), {}).start());
    gh.fail = 404;
    const b = own(await Board.start(["--repo", REPO], { github: gh }));
    plainError(await b.board(), "no sign-in");
    b.stop(); gh.stop();
  }

  { // Section 7: a project with 50 open items (5 team comments each) loads in under 5 seconds.
    const big = [], bc = {};
    for (let n = 1; n <= 50; n++) {
      big.push(item(n, `Task ${n}`, ["stage:building", "role:implementer"]));
      bc[n] = Array.from({ length: 5 }, (_, k) => comment(n, "**Ian (implementer) → Vera (verifier)** · handoff", "over to you", ev("implementer", "verifier", "handoff"), { minute: k }));
    }
    const gh = own(await new FakeGitHub(big, bc).start());
    const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
    const t0 = performance.now();
    const bb = await b.board();
    const secs = (performance.now() - t0) / 1000;
    r.check(allCards(bb).length === 50 && secs < 5, `7 50 open items load in under 5 s (${allCards(bb).length} cards in ${secs.toFixed(3)} s)`);
    b.stop(); gh.stop();
  }

  // Read rate and stale data: a good read, refreshes inside the minute, then GitHub fails after the minute.
  const gh = own(await new FakeGitHub(items(), {}).start());
  const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
  const first = await b.board();
  r.check(allCards(first).length === 2 && !first.error, "AC5 setup: first read shows 2 cards");
  const reads0 = gh.listCalls();
  for (const [at, step] of [[12, 12], [59, 47]]) {
    b.advance(step);
    await b.board(true);
    await b.board();
    const reads1 = gh.listCalls();
    r.check(reads1 === reads0, `7 one GitHub read per minute at most: refresh ${at} s after a read (issue-list calls ${reads0} -> ${reads1})`);
  }
  gh.fail = "reset";
  b.advance(3); // 62 s after the good read: a refresh may read again
  await b.board(true);
  const later = await b.board();
  r.check(gh.listCalls() > reads0, `7 a refresh after the minute reads GitHub again (issue-list calls ${reads0} -> ${gh.listCalls()})`);
  plainError(later, "failure after a good read");
});
