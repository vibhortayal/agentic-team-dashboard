#!/usr/bin/env node
// AC2 The ask, on the board: the message that asked, in plain text (no Markdown marks, no team header line,
// no hidden data), masked, at most 600 characters with "…" when cut. Read from /api/board (card.ask);
// page.mjs checks the card and its closing "Tell Ella in your chat with her." in the browser.
// AC6: the data still carries the GitHub links the page no longer shows.
import { Board, FakeGitHub, REPO, comment, ev, item, run, waiting } from "./lib.mjs";

const HOW = "Tell Ella in your chat with her.";
const HEADER = "**Priya (product-manager) → owner** · question · approve-ui";
const asking = (n, body, minute = 1) => comment(n, HEADER, body, ev("product-manager", "owner", "question", { human: "human:answer" }), { minute });
const labels = ["stage:spec", "role:product-manager", "needs-human", "human:answer"];
// The message alone, without a closing "Tell Ella ..." if the data carries it too.
const message = (c) => String(c?.ask ?? "").replace(new RegExp("\\s*" + HOW.replace(/\./g, "\\.") + "\\s*$"), "");

const A = "Q7vX2mR9kL4tW8nB3pZ6cY1dH5gJ0fSaE";
const KEY = "gh" + "p_" + (A + "uiopas").slice(0, 36); // fake, built at run time
const exact = (n) => { // plain text of exactly n characters, single spaces, ends with a letter
  let s = "";
  while (s.length < n) s += "Please try the seed list and tell me if it feels right ";
  s = s.slice(0, n);
  return s.replace(/ $/, "x");
};

await run("AC2 the ask", async (r, own) => {
  async function board(items, comments) {
    const gh = own(await new FakeGitHub(items, comments).start());
    const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
    const out = await b.board();
    b.stop(); gh.stop();
    return out;
  }

  { // Markdown, header and hidden data
    const md = [
      "## What I need from you",
      "",
      "Please **try** the *new* `seed list` and [read the plan](https://github.com/acme/garden/blob/main/docs/plan.md).",
      "",
      "> The colours are a first guess.",
      "",
      "- Does it load?",
      "* Is it easy to read?",
      "1. Say yes or no.",
      "",
      "<!-- private note for agents -->",
      "<details><summary>More</summary>hidden html</details>",
    ].join("\n");
    const later = comment(40, "**Ian (implementer) → Vera (verifier)** · handoff", "Over to you.", ev("implementer", "verifier", "handoff"), { minute: 5 });
    const bb = await board([item(40, "Seed list", labels)], { 40: [asking(40, md, 1), later] });
    const c = waiting(bb, 40);
    const m = message(c);
    console.log("  note ask as sent: " + JSON.stringify(c?.ask));
    r.check(!!c, "AC2 setup: #40 is waiting for you");
    r.check(/Please try the new seed list and read the plan\.?/.test(m.replace(/\s+/g, " ")), "AC2 the asking comment's words are there, marks removed (\"Please try the new seed list and read the plan\")");
    r.check(/What I need from you/.test(m) && /Does it load\?/.test(m) && /The colours are a first guess/.test(m), "AC2 heading, list and quote words are kept");
    for (const [mark, re] of [["**", /\*\*/], ["`", /`/], ["## heading mark", /(^|\n)\s*#/], ["[text](url)", /\]\(/], ["> quote mark", /(^|\n)\s*>/],
      ["- list mark", /(^|\n)\s*[-*]\s/], ["*emphasis*", /\*new\*/]]) r.check(!re.test(m), `AC2 no Markdown mark: ${mark}`);
    r.check(!/product-manager|→|approve-ui/.test(m), "AC2 no team header line");
    r.check(!/team-event|<!--|-->|private note|"from"/.test(m), "AC2 no hidden data (event line, HTML comment)");
    r.check(!/<\/?[a-z][a-z0-9]*[^>]*>/i.test(m), `AC2 plain text: no HTML tags (GitHub Markdown's <details>, <summary> ...) (got ${JSON.stringify((m.match(/<\/?[a-z][^>]*>/gi) ?? []).join(" "))})`);
    r.check(!/Over to you/.test(m), "AC2 the ask is the asking comment, not a later handoff between team members");
    r.check(!/https?:\/\//.test(m), "AC2 the link's address is not in the plain text");
    r.check(typeof c?.url === "string" && c.url.startsWith("https://github.com/"), `AC6 the data still carries the item's GitHub link (${c?.url})`);
    r.check(typeof c?.needed?.url === "string" && c.needed.url.includes("#issuecomment-"), `AC6 the data still carries the asking comment's link (${c?.needed?.url})`);
  }

  { // masked
    const body = `The deploy key is ${KEY} and DEPLOY_TOKEN=tok9988abcd for now.`;
    const bb = await board([item(41, "Keys", labels)], { 41: [asking(41, body)] });
    const m = message(waiting(bb, 41));
    r.check(!m.includes(KEY) && !m.includes("tok9988abcd"), `AC2 masked: the key and the TOKEN value are hidden (${JSON.stringify(m)})`);
    r.check(/hidden/.test(m), "AC2 masked: the hidden place says so");
  }

  { // 600 characters
    const sizes = [599, 600, 601, 5000];
    const items = sizes.map((n, k) => item(50 + k, `Long ${n}`, labels));
    const comments = Object.fromEntries(sizes.map((n, k) => [50 + k, [asking(50 + k, exact(n))]]));
    const bb = await board(items, comments);
    sizes.forEach((n, k) => {
      const m = message(waiting(bb, 50 + k));
      if (n <= 600) r.check(m === exact(n), `AC2 a ${n}-character ask is shown whole, no "…" (got ${m.length} chars, ends ${JSON.stringify(m.slice(-12))})`);
      else r.check(m.length <= 600 && m.endsWith("…") && exact(n).startsWith(m.slice(0, -1).trimEnd()),
        `AC2 a ${n}-character ask is cut to at most 600 characters ending "…" (got ${m.length} chars, ends ${JSON.stringify(m.slice(-12))})`);
    });
  }
});
