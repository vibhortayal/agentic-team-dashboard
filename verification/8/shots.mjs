// By hand, not a CI check (the runner has no browser). Takes the AC9/layout screenshots and scans the first
// screen's visible text for jargon. Usage: NODE_PATH=$(npm root -g) node verification/8/shots.mjs
// Writes <state>-<desktop|phone>-<light|dark>.png next to this file for the demo, error and empty states.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Board, FakeGitHub, REPO, item } from "./checks/lib.mjs";

const { chromium } = createRequire(import.meta.url)(path.join(process.env.NODE_PATH ?? "", "playwright"));
const OUT = path.dirname(fileURLToPath(import.meta.url));
const BAD = /needs-human|stage:|role:|human:|team-event|\bPR\b|\bissue\b|\blabels?\b|\brepo\b|\bcommit\b|\bverdict\b|\bBLOCK\b|\bPASS\b|[{}]/;

const states = [];
states.push(["demo", await Board.start(["--demo"]), null]);
const dead = await new FakeGitHub([item(1, "x", ["stage:building"])], {}).start();
dead.fail = "reset";
states.push(["error", await Board.start(["--repo", REPO], { github: dead, env: { GITHUB_TOKEN: "x" } }), dead]);
const empty = await new FakeGitHub([], {}).start();
states.push(["empty", await Board.start(["--repo", REPO], { github: empty, env: { GITHUB_TOKEN: "x" } }), empty]);

const browser = await chromium.launch();
for (const [tag, board, gh] of states) {
  for (const scheme of ["light", "dark"]) for (const [name, w, h] of [["desktop", 1440, 900], ["phone", 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: scheme });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e)));
    p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await p.goto(`http://localhost:${board.port}/`);
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, `${tag}-${name}-${scheme}.png`) });
    const scroll = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    const first = await p.evaluate(() => {
      const out = []; const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (tw.nextNode()) {
        const n = tw.currentNode, e = n.parentElement; if (!n.textContent.trim()) continue;
        const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
        if (b.top < innerHeight && b.bottom > 0 && cs.display !== "none" && cs.visibility !== "hidden") out.push(n.textContent.trim());
      }
      return out.join(" | ");
    });
    const links = await p.evaluate(() => [...document.querySelectorAll("a")].filter((a) => a.offsetParent).map((a) => a.href).slice(0, 4));
    const bad = BAD.exec(first);
    console.log(JSON.stringify({ tag, name, scheme, scroll, errs, jargon: bad ? bad[0] : null, links, first: first.slice(0, 600) }));
    await ctx.close();
  }
  board.stop(); gh?.stop();
}
await browser.close();
