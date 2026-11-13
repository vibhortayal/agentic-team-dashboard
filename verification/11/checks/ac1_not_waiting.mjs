#!/usr/bin/env node
// AC1 Try it, v2 (round 5): "Only a waiting change (labelled `needs-human`) shows a "Try it" button". A change
// that isn't waiting never gets Try it, from a deployment or from a `preview` in its team comments, and the board
// reads no deployment status for it. Status reads go only to the live app and to waiting changes.
//   (a) 1 live, 1 waiting PR (#40), 4 open PRs not waiting at different stages, each with a working preview, one
//       with also a comment preview; an issue not waiting with a comment preview; a PR labelled human:approve-ui
//       but not needs-human. Only #40 has Try it; status reads touch only live and #40's deployment (2).
//   (b) no waiting change: live link still shows, no card has Try it, 1 status read (live).
//   (c) no waiting change, no live deployment, previews only: 0 status reads.
//   (d) #40 loses needs-human: after the one-minute cache it has no Try it and its preview is not read again;
//       it gets it back once labelled again.
import { Board, FakeGitHub, REPO, allCards, comment, deploy, ev, item, run, waiting } from "./lib.mjs";

const ask = (n) => comment(n, "**Priya (product-manager) → owner** · question", "Please try it.",
  ev("product-manager", "owner", "question", { human: "human:approve-ui" }), { minute: 1 });
const note = (n, url) => comment(n, "**Ian (implementer) → Vera (verifier)** · handoff", "Over to you.",
  ev("implementer", "verifier", "handoff", { preview: url }), { minute: 2 });
const sha = (c) => c.repeat(40);
const LIVE = "https://garden.example";
const WAIT = ["stage:verifying", "role:verifier", "needs-human", "human:approve-ui"];
const OTHER = {
  50: ["stage:building", "role:implementer"],
  51: ["stage:verifying", "role:verifier"],
  52: ["stage:review", "role:product-manager"],
  53: ["stage:verifying", "role:verifier", "human:approve-ui"], // a human: label but not needs-human
};

function fixture({ wait = [40], live = true } = {}) {
  const prs = [...Object.keys(OTHER).map(Number), ...wait].sort((x, y) => y - x);
  const items = prs.map((n) => item(n, `Change ${n}`, wait.includes(n) ? WAIT : OTHER[n] ?? OTHER[50], { pr: true }));
  items.push(item(60, "Help page", ["stage:building", "role:implementer"])); // an issue, not waiting
  const pulls = Object.fromEntries(prs.map((n, k) => [n, { ref: `feat/x${n}`, sha: sha("abcdefghij"[k]) }]));
  const deployments = live ? [deploy({ env: "Production", url: LIVE, day: 7 })] : [];
  const ids = {};
  for (const n of prs) {
    const d = deploy({ ref: pulls[n].ref, sha: pulls[n].sha, url: `https://${n}.preview.example`, day: n === 40 ? 8 : 10 });
    deployments.push(d); ids[n] = d.id;
  }
  const comments = { 51: [note(51, "https://51-note.preview.example")], 60: [note(60, "https://60-note.preview.example")] };
  for (const n of wait) comments[n] = [ask(n)];
  return { items, comments, deployments, pulls, ids, liveId: live ? deployments[0].id : null };
}

const statusIds = (gh) => gh.appCalls().map((u) => /deployments\/(\d+)\/statuses/.exec(u)?.[1]).filter(Boolean).map(Number);

await run("AC1 v2 Try it only on waiting changes, no status reads for the others", async (r, own) => {
  for (const [name, opt] of [["a", {}], ["b", { wait: [] }], ["c", { wait: [], live: false }]]) {
    const f = fixture(opt);
    const gh = own(await new FakeGitHub(f.items, f.comments, { deployments: f.deployments, pulls: f.pulls }).start());
    const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
    const out = await b.board();
    const read = statusIds(gh);
    b.stop(); gh.stop();
    const cards = [...allCards(out), ...(out.needed ?? [])];
    const others = cards.filter((c) => c.number !== 40);
    const withTry = [...new Set(others.filter((c) => c.try_url).map((c) => c.number))];
    r.check(others.length > 0 && withTry.length === 0,
      `AC1 (${name}) no change that isn't waiting has Try it (${others.length} cards; with Try it: ${JSON.stringify(withTry)})`);
    if (name === "a") {
      const c = waiting(out, 40);
      r.check(c?.try_url === "https://40.preview.example", `AC1 (a) waiting #40 has Try it (got ${JSON.stringify(c?.try_url)})`);
    }
    const allowed = new Set([f.liveId, ...(opt.wait ?? [40]).map((n) => f.ids[n])].filter((x) => x !== null));
    const stray = read.filter((id) => !allowed.has(id));
    r.check(stray.length === 0, `AC1 (${name}) status reads only for the live app and waiting changes (read ${JSON.stringify(read)}, allowed ${JSON.stringify([...allowed])})`);
    const want = { a: 2, b: 1, c: 0 }[name];
    r.check(read.length === want, `(${name}) status reads: ${read.length}, ${want} are enough`);
    if (name === "b") r.check(out.app?.live_url === LIVE, `AC3 (b) the live link still shows with no waiting change (${JSON.stringify(out.app?.live_url)})`);
  }

  { // (d) the label comes off, then back
    const f = fixture();
    const gh = own(await new FakeGitHub(f.items, f.comments, { deployments: f.deployments, pulls: f.pulls }).start());
    const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
    let out = await b.board();
    r.check(waiting(out, 40)?.try_url === "https://40.preview.example", "(d) setup: #40 waiting has Try it");
    const it40 = gh.items.find((i) => i.number === 40);
    it40.labels = it40.labels.filter((l) => (typeof l === "string" ? l : l.name) !== "needs-human");
    b.advance(61);
    const before = statusIds(gh).length;
    out = await b.board();
    const after = statusIds(gh).slice(before);
    const c40 = allCards(out).filter((c) => c.number === 40);
    r.check(c40.length > 0 && c40.every((c) => !c.try_url) && !waiting(out, 40),
      `AC1 (d) #40 no longer waiting: no Try it (${JSON.stringify(c40.map((c) => c.try_url))})`);
    r.check(!after.includes(f.ids[40]) && after.every((id) => id === f.liveId),
      `AC1 (d) #40's preview is not read once it isn't waiting (read ${JSON.stringify(after)})`);
    it40.labels = [...it40.labels, { name: "needs-human" }];
    b.advance(61);
    out = await b.board();
    r.check(waiting(out, 40)?.try_url === "https://40.preview.example", `AC1 (d) labelled again: #40 has Try it again (${JSON.stringify(waiting(out, 40)?.try_url)})`);
    b.stop(); gh.stop();
  }
});
