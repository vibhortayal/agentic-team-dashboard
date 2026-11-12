#!/usr/bin/env node
// AC6: the Verifier's own planted fake keys, one per shape, all come out masked in everything the server sends.
// The keys are fake and built at run time so no scanner mistakes this file for a leak.
import { Board, FakeGitHub, REPO, allCards, comment, ev, item, run } from "./lib.mjs";

const A = "Q7vX2mR9kL4tW8nB3pZ6cY1dH5gJ0fSaE"; // filler
const rev = [...A].reverse().join("");
const SHAPES = {
  "github classic": "gh" + "p_" + (A + "uiopas").slice(0, 36),
  "github oauth": "gh" + "o_" + (rev + "qwerty").slice(0, 36),
  "github fine-grained": "github" + "_pat_" + "11ABCDEFG0" + A.slice(0, 12) + "_" + (A + A).slice(0, 59),
  "aws access key": "AK" + "IA" + "Z7QW4XRT9PLM2VBN",
  "anthropic": "sk-" + "ant-api03-" + (A + A + A).slice(0, 80) + "-AA",
  "openai": "sk-" + "proj-" + (A + A).slice(0, 48),
  "slack": "xo" + "xb-" + "2048123456789-1234567890123-" + A.slice(0, 24),
  "google api": "AI" + "za" + "SyD" + (A + A).slice(0, 32),
  "stripe": "sk_" + "live_" + A.slice(0, 24),
  "jwt": "ey" + "JhbGciOiJIUzI1NiJ9." + "eyJzdWIiOiIxMjM0NTY3ODkwIn0." + A.slice(0, 30),
  "private key": "-----BEGIN " + "RSA PRIVATE KEY-----MIIEow" + A.slice(0, 20),
};
const NAMED = { // name ending in KEY / TOKEN / SECRET / PASSWORD -> the value that must disappear
  "SERVICE_API_KEY=": "plainvalue4417",
  "DEPLOY_TOKEN: ": "tok9988abcd",
  "CLIENT_SECRET = ": "s3cretvalue55",
  "DB_PASSWORD=": "hunter2hunter2",
};
const NAMED_LOWER = { "api_key=": "lowercase7731", "password: ": "lowerpw4242" }; // note only: the spec writes the names in capitals

const items = [], comments = {};
const values = {};
let n = 100;
for (const [kind, v] of Object.entries(SHAPES)) { // key in the title, the latest comment header, an asking comment and a note
  n += 1; values[kind] = v;
  const labels = ["stage:building", "role:implementer", ...(n % 2 ? ["needs-human", "human:answer"] : [])];
  items.push(item(n, `Leak test ${kind} ${v}`, labels));
  comments[n] = [
    comment(n, `**Ian (implementer) → owner** · question ${v}`, `see ${v}`, ev("implementer", "owner", "question", { human: "human:answer" }), { minute: 1 }),
    comment(n, "**Ella (engagement-lead)** · note", `${v} handled it`, ev("engagement-lead", "product-manager", "note"), { minute: 2 }),
  ];
}
for (const [name, v] of Object.entries({ ...NAMED, ...NAMED_LOWER })) {
  n += 1; values[name] = v;
  items.push(item(n, `Config ${name}${v}`, ["stage:spec", "role:product-manager", "needs-human", "human:answer"]));
  comments[n] = [comment(n, `**Ella (engagement-lead)** · note ${name}${v}`, `${name}${v} was set`, ev("engagement-lead", "product-manager", "note"), { minute: 1 })];
}
n += 1; // a key inside a link: every string the server sends, links included
const urlKey = "gh" + "p_" + (A + "zzzzzz").slice(1, 37);
values["key in a link"] = urlKey;
items.push(item(n, "Link test", ["stage:building", "role:implementer"], { url: `https://github.com/acme/garden/issues/${n}?t=${urlKey}` }));

await run("AC6", async (r, own) => {
  const gh = own(await new FakeGitHub(items, comments).start());
  const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
  const raw = (await b.get("/api/board")).text;
  const board = JSON.parse(raw);
  r.check(!board.error, `setup: board read fine (error=${JSON.stringify(board.error)})`);
  r.check(allCards(board).length === items.length, `setup: every planted item is on the board (${allCards(board).length}/${items.length})`);
  const text = JSON.stringify(board);
  for (const [kind, v] of Object.entries(values)) {
    const leaked = raw.includes(v) || text.includes(v) || text.includes(v.slice(0, 16));
    if (kind in NAMED_LOWER) { console.log((leaked ? "  note " : "  ok   ") + `AC6 ${kind}: value never sent (lower-case name, not required by the spec)`); continue; }
    r.check(!leaked, `AC6 ${kind}: value never sent`);
  }
  for (const kind of Object.keys(SHAPES)) {
    const titles = allCards(board).map((c) => c.title ?? "").filter((t) => t.startsWith(`Leak test ${kind} `));
    r.check(titles.length > 0 && titles.every((t) => /\[hidden: [^\]]+\]/.test(t)), `AC6 ${kind}: title shows a [hidden: <kind>] marker (${JSON.stringify(titles[0])})`);
  }
  // The page bundle itself must not carry a planted value either (it is static, so this guards against a demo file leak).
  const page = (await b.get("/")).text;
  r.check(!Object.values(values).some((v) => page.includes(v)), "AC6 the served page carries none of the planted values");
});
