// By hand, not a CI check (the runner has no browser). Uses the board as a person would in a real browser
// (Playwright) for R3 and R4 of #32, then takes screenshots at phone (390px) and desktop widths, light and dark,
// checking there is no sideways scroll in each.
// Usage: NODE_PATH=$(npm root -g) node verification/32/page.mjs   (after npm run build)
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Board, FakeGitHub, REPO, commit, item, push } from "./checks/lib.mjs";

const { chromium } = createRequire(import.meta.url)(path.join(process.env.NODE_PATH ?? "", "playwright"));
const OUT = path.dirname(fileURLToPath(import.meta.url));
const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
const HEAD = "Latest from the team";
const STARTED = "The team is getting started. Cards show up here once Ella opens your project's first task.";
const NOTHING = "Nothing here yet. Talk to Ella to get your project started.";
let fails = 0;
const log = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) fails++; };
const stops = [];
const at = (h) => `2026-11-12T${String(h).padStart(2, "0")}:00:00Z`;

async function shoot(page, name) {
  for (const scheme of ["light", "dark"]) {
    for (const [size, vp] of Object.entries(SIZES)) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize(vp);
      await page.waitForTimeout(200);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      log(!wide, `${name} ${size} ${scheme}: no sideways scroll`);
      await page.screenshot({ path: path.join(OUT, `${name}-${size}-${scheme}.png`), fullPage: true });
    }
  }
  await page.setViewportSize(SIZES.desktop);
  await page.emulateMedia({ colorScheme: "light" });
}

async function open(browser, { items = [], commits = [], activity = [], main = [], issuesFail = null, demo = false }) {
  let b;
  if (demo) b = await Board.start(["--demo"]);
  else {
    const gh = await new FakeGitHub(items, {}, { commits, activity, main }).start(); stops.push(gh);
    gh.issuesFail = issuesFail;
    b = await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } });
  }
  stops.push(b);
  const page = await (await browser.newContext({ viewport: SIZES.desktop })).newPage();
  await page.goto(`http://localhost:${b.port}/`);
  await page.waitForFunction(() => document.body.innerText.length > 40 && !/Loading/i.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  return page;
}
const text = (page) => page.evaluate(() => document.body.innerText);

const LONG = "Rename" + "x".repeat(300);
const c = [
  commit({ name: "Vera", email: "verifier@team.invalid", message: LONG, at: at(15) }),
  commit({ name: "Ian", email: "implementer@team.invalid", message: "Build the seed list\n\ndetails", at: at(14) }),
  commit({ name: "Engagement Lead", email: "ella@team.invalid", message: "Open the first ticket", at: at(13) }),
  commit({ name: "Sam", email: "sam@gmail.com", message: "Fourth, not shown", at: at(12) }),
];
const pushes = c.map((x, k) => push(x, { ref: `refs/heads/b${k}` }));

const browser = await chromium.launch();
try {
  // R3 with cards and latest work
  {
    const page = await open(browser, { items: [item(1, "Plan the garden", ["stage:building", "role:implementer"])], commits: c, activity: pushes, main: [] });
    const t = await text(page);
    log(t.includes(HEAD), "cards: 'Latest from the team' shows");
    log(t.includes("Build the seed list") && t.includes("Open the first ticket") && !t.includes("Fourth, not shown") && !t.includes("details"), "cards: the three newest first lines, not the fourth");
    log(/Vera/.test(t) && /Ian/.test(t) && /Ella/.test(t), "cards: who by first name");
    log(!t.includes(STARTED) && !t.includes(NOTHING), "cards: no empty-board sentence");
    // F1 (R5): the work card's "<face> Ian (builds)" row looks as it did at the base (flex row, 8px gap)
    const row = await page.evaluate(() => {
      const card = [...document.querySelectorAll("article.card")].find((a) => a.textContent.includes("Plan the garden"));
      const span = card && [...card.querySelectorAll("span")].find((s) => s.textContent.trim() === "Ian (builds)");
      const div = span?.parentElement;
      if (!div) return null;
      const s = getComputedStyle(div);
      return { cls: div.className, display: s.display, gap: s.columnGap, size: s.fontSize };
    });
    log(row?.display === "flex" && row?.gap === "8px" && row?.size === "14px", `card holder row styled as at base: flex, 8px gap, 14px (got ${JSON.stringify(row)})`);
    const pos = await page.evaluate((h) => {
      const el = [...document.querySelectorAll("body *")].find((e) => e.children.length === 0 && e.textContent.trim() === h);
      const cols = document.querySelector(".columns");
      return { head: el?.getBoundingClientRect().top ?? null, cols: cols?.getBoundingClientRect().top ?? null };
    }, HEAD);
    log(pos.head !== null && pos.cols !== null && pos.head < pos.cols, `cards: heading above the columns (heading y=${pos.head}, columns y=${pos.cols})`);
    for (const w of ["phone"]) { await page.setViewportSize(SIZES[w]); await page.waitForTimeout(150); }
    const posPhone = await page.evaluate((h) => {
      const el = [...document.querySelectorAll("body *")].find((e) => e.children.length === 0 && e.textContent.trim() === h);
      return { head: el?.getBoundingClientRect().top ?? null, cols: document.querySelector(".columns")?.getBoundingClientRect().top ?? null };
    }, HEAD);
    log(posPhone.head !== null && posPhone.head < posPhone.cols, `cards phone: heading above the columns (${posPhone.head} < ${posPhone.cols})`);
    await page.setViewportSize(SIZES.desktop);
    await shoot(page, "cards");
  }
  // R3 no cards, latest work
  {
    const page = await open(browser, { items: [], commits: c.slice(1, 3), activity: pushes.slice(1, 3), main: [] });
    const t = await text(page);
    log(t.includes(STARTED), "started: the getting-started sentence shows");
    log(!t.includes(NOTHING), "started: no 'Nothing here yet'");
    log(t.includes(HEAD) && t.includes("Build the seed list") && t.includes("Open the first ticket"), "started: heading and both lines show");
    await shoot(page, "started");
  }
  // R3 no cards, no latest
  {
    const page = await open(browser, { items: [], commits: [], activity: [], main: [] });
    const t = await text(page);
    log(t.includes(NOTHING), "nothing: 'Nothing here yet. Talk to Ella to get your project started.' shows");
    log(!t.includes(STARTED), "nothing: no getting-started sentence");
    log(!t.includes(HEAD), "nothing: no latest heading");
    await shoot(page, "nothing");
  }
  // R4 error: the issue read fails, latest work still answers
  {
    const page = await open(browser, { items: [item(1, "Plan", ["stage:building", "role:implementer"])], commits: c, activity: pushes, main: [], issuesFail: 500 });
    await page.getByRole("heading", { name: "We can't see your project right now" }).waitFor({ timeout: 15000 }).catch(() => {});
    const t = await text(page);
    log(/can't see your project/i.test(t), "error: the problem shows");
    log(!t.includes(HEAD) && !t.includes("Build the seed list") && !t.includes("Open the first ticket"), "error: no latest heading or lines");
    log(!t.includes(STARTED) && !t.includes(NOTHING), "error: no empty-board sentence");
    await shoot(page, "error");
  }
  // demo
  {
    const page = await open(browser, { demo: true });
    const t = await text(page);
    log(t.includes(HEAD), "demo: latest heading shows");
    await shoot(page, "demo");
  }
} finally {
  await browser.close();
  for (const s of stops) try { s.stop(); } catch {}
}
console.log(fails ? `page: ${fails} FAILED` : "page: all passed");
process.exit(fails ? 1 : 0);
