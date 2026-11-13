#!/usr/bin/env node
// AC1-AC4 of docs/changes/8.md on hand-made GitHub data (fake GitHub on 127.0.0.1, no internet).
import { Board, FakeGitHub, REPO, allCards, comment, ev, find, item, run } from "./lib.mjs";

const say = (n) => (n && typeof n === "object" ? n.why ?? n.text : n);
const shown = (c) => c.check_words ?? c.check;

const I = [], C = {};
// --- AC1 ---
I.push(item(10, "Plan the watering page", ["stage:spec", "role:product-manager", "needs-human", "human:approve-spec"]));
C[10] = [
  comment(10, "**Priya (product-manager) → owner** · question", "Old question.", ev("product-manager", "owner", "question", { human: "human:approve-spec" }), { minute: 1 }),
  comment(10, "**Priya (product-manager) → owner** · question", "Newer question, the one that asks.", ev("product-manager", "owner", "question", { human: "human:approve-spec" }), { minute: 2 }),
  comment(10, "**Rohan (researcher) → Priya (product-manager)** · report", "Research is in.", ev("researcher", "product-manager", "report"), { minute: 3 }),
  comment(10, "thanks!", "plain human comment, not a team comment", null, { minute: 4, login: "owner" }),
];
I.push(item(11, "Watering page", ["stage:review", "role:product-manager", "needs-human", "human:merge"], { pr: true }));
I.push(item(12, "Pick a colour", ["stage:building", "role:architect", "needs-human", "human:answer"]));
C[12] = [comment(12, "**Arjun (architect) → Priya (product-manager)** · question", "Which colour?", ev("architect", "product-manager", "question", { human: "human:answer" }), { minute: 5 })];
I.push(item(13, "Old closed thing", ["stage:done", "role:product-manager", "needs-human", "human:merge"], { state: "closed" }));
// --- AC4 + AC3 ---
I.push(item(20, "Seed list", ["stage:building", "role:implementer"]));
C[20] = [
  comment(20, "**Vera (verifier) → Priya (product-manager)** · verdict · PASS", "All passed.", ev("verifier", "product-manager", "verdict", { verdict: "PASS" }), { minute: 1 }),
  comment(20, "**Vera (verifier) → Ian (implementer)** · verdict · BLOCK", "Breaks on empty list.", ev("verifier", "implementer", "verdict", { verdict: "BLOCK" }), { minute: 2 }),
  comment(20, "**Ian (implementer) → Vera (verifier)** · handoff", "Fixed, over to you.", ev("implementer", "verifier", "handoff"), { minute: 3 }),
];
I.push(item(21, "Seed photos", ["stage:verifying", "role:verifier"]));
C[21] = [
  comment(21, "**Vera (verifier) → Ian (implementer)** · verdict · BLOCK", "Photo missing.", ev("verifier", "implementer", "verdict", { verdict: "BLOCK" }), { minute: 1 }),
  comment(21, "**Vera (verifier) → Priya (product-manager)** · verdict · PASS", "All good now.", ev("verifier", "product-manager", "verdict", { verdict: "PASS" }), { minute: 2 }),
];
I.push(item(22, "Footer", ["stage:done", "role:product-manager"]));
C[22] = [comment(22, "**Ian (implementer) → Vera (verifier)** · handoff", "verdict PASS expected, all green", ev("implementer", "verifier", "handoff"), { minute: 1 })];
I.push(item(23, "Header", ["stage:done", "role:product-manager"]));
C[23] = [
  comment(23, "**Vera (verifier) → Priya (product-manager)** · verdict · PASS", "ok", ev("verifier", "product-manager", "verdict", { verdict: "PASS" }), { minute: 1 }),
  comment(23, "**Vera (verifier) → Ian (implementer)** · verdict · INCONCLUSIVE", "logs missing", ev("verifier", "implementer", "verdict", { verdict: "INCONCLUSIVE" }), { minute: 2 }),
];
I.push(item(24, "Login", ["stage:ready", "role:verifier"]));
I.push(item(25, "New idea", ["stage:intake", "role:engagement-lead"]));
I.push(item(26, "Hosting options", ["stage:research", "role:researcher"]));
// --- AC2 ---
I.push(item(30, "Typo fix", ["stage:building", "role:implementer"]));
C[30] = [
  comment(30, "**Ella (engagement-lead)** · note", "Older reason that should not show.", ev("engagement-lead", "product-manager", "note"), { minute: 1 }),
  comment(30, "**Ella (engagement-lead)** · note", "Newer reason I handled myself.\nSecond line not the reason.", ev("engagement-lead", "product-manager", "note"), { minute: 2 }),
];
I.push(item(31, "Closed with a note", ["stage:done", "role:product-manager"], { state: "closed" }));
C[31] = [comment(31, "**Ella (engagement-lead)** · note", "Closed-item note must not show.", ev("engagement-lead", "product-manager", "note"), { minute: 1 })];
I.push(item(32, "Not a note", ["stage:building", "role:implementer"]));
C[32] = [
  comment(32, "**Ella (engagement-lead) → Ian (implementer)** · handoff", "Handoff, not a note.", ev("engagement-lead", "implementer", "handoff"), { minute: 1 }),
  comment(32, "**Vera (verifier)** · note", "Vera's note, not Ella's.", ev("verifier", "product-manager", "note"), { minute: 2 }),
];

await run("AC1-AC4", async (r, own) => {
  const gh = own(await new FakeGitHub(I, C).start());
  const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
  const board = await b.board();
  r.check(!board.error, `no error on good data (error=${JSON.stringify(board.error)})`);
  const cards = allCards(board), needed = board.needed ?? [], handled = board.handled ?? [];

  // AC1
  const nums = needed.map((e) => e.number).sort((a, b) => a - b);
  r.check(JSON.stringify(nums) === "[10,11,12]", `AC1 'Waiting for you' holds exactly the open needs-human items 10, 11, 12 (got ${JSON.stringify(nums)})`);
  const [e10, e11, e12] = [10, 11, 12].map((n) => find(needed, n)[0]);
  if (e10 && e11 && e12) {
    const [d10, d11, d12] = [e10, e11, e12].map((e) => JSON.stringify(e));
    r.check(d10.includes(C[10][1].html_url) && !d10.includes(C[10][0].html_url), `AC1 #10 links the latest asking comment ${C[10][1].html_url} (entry ${d10})`);
    r.check(d12.includes(C[12][0].html_url), `AC1 #12 links the comment with a human field (entry ${d12})`);
    r.check(d11.includes("/pull/11") && !d11.includes("#issuecomment"), `AC1 #11 with no comment links the item itself (entry ${d11})`);
    const sentences = [e10, e11, e12].map((e) => say(e.needed));
    r.check(sentences.every((s) => typeof s === "string" && s.split(/\s+/).length >= 3), `AC1 each has a plain sentence in 'needed' (${JSON.stringify(sentences)})`);
    r.check(new Set(sentences).size === 3, "AC1 the three human: labels get three different sentences");
    const bad = sentences.filter((s) => typeof s === "string" && /human:|needs-human|approve-spec|stage:/.test(s));
    r.check(bad.length === 0, `AC1 sentences contain no label names (${JSON.stringify(bad)})`);
  }

  // AC3
  const titles = (board.columns ?? []).map((c) => c.title);
  const want = ["Getting ready", "Ready to build", "Being built", "Being checked", "Waiting for you", "Done"];
  r.check(JSON.stringify(titles) === JSON.stringify(want), `AC3 columns are the six everyday words in order (got ${JSON.stringify(titles)})`);
  const colOf = {};
  for (const col of board.columns ?? []) for (const c of col.cards ?? []) colOf[c.number] = col.title;
  const expectCol = { 25: "Getting ready", 26: "Getting ready", 10: "Getting ready", 24: "Ready to build", 20: "Being built",
    12: "Being built", 21: "Being checked", 11: "Waiting for you", 22: "Done", 23: "Done" };
  for (const [n, t] of Object.entries(expectCol)) r.check(colOf[n] === t, `AC3 #${n} is under '${t}' (got ${JSON.stringify(colOf[n])})`);
  const expectHolder = { 20: "Ian", 21: "Vera", 24: "Vera", 25: "Ella", 26: "Rohan", 12: "Arjun", 10: "Priya" };
  for (const [n, p] of Object.entries(expectHolder)) {
    const h = find(cards, Number(n))[0]?.holder;
    r.check(typeof h === "string" && h.includes(p) && !h.includes(":") && !h.includes("-"), `AC3 #${n} holder names ${p} (got ${JSON.stringify(h)})`);
  }
  let u = find(cards, 10)[0]?.update;
  r.check(typeof u === "string" && u.includes("Rohan") && !u.includes("Research is in") && !u.includes("thanks"),
    `AC3 #10 update is the header of the latest team comment (Rohan's), not a human comment (got ${JSON.stringify(u)})`);
  u = find(cards, 20)[0]?.update;
  r.check(typeof u === "string" && u.includes("Ian") && u.includes("Vera"), `AC3 #20 update is Ian's handoff header (got ${JSON.stringify(u)})`);

  // AC4
  const expectCheck = { 20: "Checked: needs fixes", 21: "Checked: passed", 22: "Not checked yet", 23: "Not checked yet", 24: "Not checked yet", 25: "Not checked yet" };
  for (const [n, v] of Object.entries(expectCheck)) {
    const c = find(cards, Number(n))[0];
    const got = c ? shown(c) : undefined;
    r.check(got === v, `AC4 #${n} shows '${v}' (got ${JSON.stringify(got)})`);
  }
  const passed = cards.filter((c) => shown(c) === "Checked: passed").map((c) => c.number);
  r.check(JSON.stringify(passed) === "[21]", `AC4 only #21 shows 'Checked: passed' (got ${JSON.stringify(passed)})`);

  // AC2
  const hn = handled.map((e) => e.number).sort((a, b) => a - b);
  r.check(JSON.stringify(hn) === "[30]", `AC2 'Ella handled these herself' holds only #30 (got ${JSON.stringify(hn)})`);
  const h30 = find(handled, 30)[0];
  if (h30) {
    const d = JSON.stringify(h30);
    r.check(d.includes("Newer reason I handled myself"), `AC2 #30 reason is the latest note's first line (${d})`);
    r.check(!d.includes("Older reason") && !d.includes("Second line"), "AC2 #30 shows only the latest note's first line");
  }
  const odd = gh.calls.filter((c) => !/^\/repos\/acme\/garden(\/|\?|$)/.test(c));
  r.check(odd.length === 0, `reads only this project's data on the fake GitHub (${JSON.stringify(odd)})`);
  console.log("  info GitHub calls: " + JSON.stringify(gh.calls));
});
