// By hand, not a CI check (the runner has no browser). Uses the board as a person would in a real browser
// (Playwright): AC1 Try it, AC2 the ask on the card, AC3 Your app, AC4 no github.com link on the board view,
// in a fake-GitHub run and in the demo, then takes screenshots at phone and desktop widths, light and dark.
// Usage: NODE_PATH=$(npm root -g) node verification/11/page.mjs   (after npm run build)
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Board, FakeGitHub, REPO, comment, deploy, ev, item, release } from "./checks/lib.mjs";

const { chromium } = createRequire(import.meta.url)(path.join(process.env.NODE_PATH ?? "", "playwright"));
const OUT = path.dirname(fileURLToPath(import.meta.url));
const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
const HOW = "Tell Ella in your chat with her.";
let fails = 0;
const log = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) fails++; };
const stops = [];

async function shoot(page, name) {
  for (const scheme of ["light", "dark"]) {
    for (const [size, vp] of Object.entries(SIZES)) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize(vp);
      await page.waitForTimeout(150);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      log(!wide, `${name} ${size} ${scheme}: no sideways scroll`);
      await page.screenshot({ path: path.join(OUT, `${name}-${size}-${scheme}.png`), fullPage: true });
    }
  }
  await page.setViewportSize(SIZES.desktop);
  await page.emulateMedia({ colorScheme: "light" });
}

// AC4: every <a href> on the page, and whether any points at github.com.
async function noGitHub(page, why) {
  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
  const gh = hrefs.filter((h) => { try { return /(^|\.)github\.com$/i.test(new URL(h).hostname); } catch { return false; } });
  log(gh.length === 0, `AC4 ${why}: no link points at github.com (${hrefs.length} links: ${JSON.stringify(hrefs)})`);
  return hrefs;
}

async function boardPage(browser, fakeArgs, why) {
  const gh = await new FakeGitHub(...fakeArgs).start(); stops.push(gh);
  const b = await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }); stops.push(b);
  const page = await (await browser.newContext({ viewport: SIZES.desktop })).newPage();
  await page.goto(`http://localhost:${b.port}/`);
  await page.getByRole("heading", { name: "What the team is doing" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);
  return { page, gh, b };
}

const PREVIEW = "https://seeds.preview.example/";
const LIVE = "https://garden.example/";
const asking = (n, body, extra = {}) => comment(n, "**Priya (product-manager) → owner** · question · approve-ui", body,
  ev("product-manager", "owner", "question", { human: "human:approve-ui", ...extra }), { minute: 1 });
const MD = "## What I need\n\nPlease **try** the *new* `seed list` and [read the plan](https://github.com/acme/garden/blob/main/plan.md).\n\n- Does it load?\n- Is it easy to read?";
const LONG = "Please try the seed list and tell me if it feels right ".repeat(30);

function fullFixture() {
  const items = [
    item(30, "Seed list page", ["stage:verifying", "role:verifier", "needs-human", "human:approve-ui"], { pr: true }),
    item(31, "Pick a colour for the buttons", ["stage:spec", "role:product-manager", "needs-human", "human:answer"]),
    item(32, "Watering log", ["stage:building", "role:implementer"]),
    item(33, "Sign-up form", ["stage:verifying", "role:verifier"]),
  ];
  const comments = {
    30: [asking(30, MD)],
    31: [asking(31, LONG)],
    32: [comment(32, "**Ian (implementer) → Vera (verifier)** · handoff", "Over to you.", ev("implementer", "verifier", "handoff"))],
  };
  const releases = ["v1.0", "v1.1", "v1.2", "v1.3", "v1.4", "v1.5", "v1.6"].map((t, k) => release(t, { day: k + 1, body: `## What changed\n\n- **Bigger** seed photos in ${t}\n- Faster search` }));
  releases.push(release("v2.0", { draft: true, day: 20, body: "A watering log you can print." }));
  const deployments = [deploy({ url: PREVIEW, day: 11 }), deploy({ env: "Production", url: LIVE, day: 9 })];
  return [items, comments, { releases, deployments }];
}

const browser = await chromium.launch();
try {
  { // A. a full board from the fake GitHub
    const { page } = await boardPage(browser, fullFixture(), "full");
    const hrefs = await noGitHub(page, "board with cards, Your app and Try it");
    const need = page.locator("li.need");
    log(await need.count() === 2, `setup: two cards wait for you (${await need.count()})`);
    const pr = need.filter({ hasText: "Seed list page" });
    const tryIt = pr.getByRole("link", { name: "Try it" });
    log(await tryIt.count() === 1 && (await tryIt.getAttribute("href")) === PREVIEW, `AC1 the waiting change has a Try it button that opens its preview (${await tryIt.count() ? await tryIt.getAttribute("href") : "none"})`);
    const issue = need.filter({ hasText: "Pick a colour" });
    log(await issue.getByRole("link", { name: "Try it" }).count() === 0, "AC1 no preview, no button (the issue)");
    for (const [name, card] of [["Seed list page", pr], ["Pick a colour", issue]]) {
      const text = (await card.innerText()).trim();
      log(text.endsWith(HOW), `AC2 "${name}" card ends with "${HOW}" (ends ${JSON.stringify(text.slice(-40))})`);
    }
    const ask = (await pr.locator(".ask").innerText()).trim();
    log(/Please try the new seed list and read the plan/.test(ask.replace(/\s+/g, " ")) && !/\*|`|##|\]\(|product-manager|team-event/.test(ask),
      `AC2 the ask is shown in plain text: ${JSON.stringify(ask)}`);
    const long = (await issue.locator(".ask").innerText()).trim();
    log(long.length <= 600 && long.endsWith("…"), `AC2 a long ask is cut to at most 600 characters with "…" (${long.length} chars)`);
    const app = page.locator("section", { has: page.getByRole("heading", { name: "Your app" }) });
    const open = app.getByRole("link", { name: "Open your app" });
    log(await open.count() === 1 && (await open.getAttribute("href")) === LIVE, `AC3 "Open your app" opens the live link (${await open.count() ? await open.getAttribute("href") : "none"})`);
    const appText = await app.innerText();
    log(/Ready to go live, waiting for your OK/.test(appText) && /v2\.0/.test(appText), "AC3 the draft shows as \"Ready to go live, waiting for your OK\"");
    log(/v1\.6/.test(appText) && /Bigger seed photos in v1\.6/.test(appText) && !/\*\*|##/.test(appText), "AC3 the live version v1.6 with the first lines of its notes, plain");
    const live = app.locator(".v-live time");
    log(await live.count() === 1 && (await live.getAttribute("datetime"))?.startsWith("2026-10-07"), `AC3 the live version has its date (${await live.count() ? `${await live.getAttribute("datetime")} shown as "${(await live.innerText()).trim()}"` : "none"})`);
    log(await app.locator(".v-earlier").count() === 5, `AC3 up to 5 earlier versions (${await app.locator(".v-earlier").count()})`);
    log(!/[0-9a-f]{40}|feat\/seeds|stage:|role:|human:/.test(await page.locator("body").innerText()), "sec 6 no sha, branch or label names on the page");
    log(hrefs.length === 2, `AC4 the only links are the app's own (Try it, Open your app): ${hrefs.length}`);
    await shoot(page, "board");
  }

  { // B. links that aren't https are never links
    const items = [item(30, "Seed list page", ["stage:verifying", "role:verifier", "needs-human", "human:approve-ui"], { pr: true }),
      item(34, "Help page", ["stage:verifying", "role:verifier", "needs-human", "human:approve-ui"])];
    const cm = { 30: [asking(30, "Try it.")], 34: [asking(34, "Try it.", { preview: "javascript:alert(1)" })] };
    const { page } = await boardPage(browser, [items, cm, { deployments: [deploy({ url: "http://seeds.preview.example" }), deploy({ env: "Production", url: "http://garden.example" })] }], "http");
    const hrefs = await noGitHub(page, "board with http links");
    log(await page.getByRole("link", { name: "Try it" }).count() === 0, "AC1 only https: an http deployment and a javascript: comment preview are not Try it links");
    log(await page.getByRole("link", { name: "Open your app" }).count() === 0, "AC1/AC3 only https: an http production link is not \"Open your app\"");
    log(hrefs.every((h) => h.startsWith("https:")), `AC1 every link on the page is https (${JSON.stringify(hrefs)})`);
  }

  { // C. nothing online yet
    const { page } = await boardPage(browser, [[item(32, "Watering log", ["stage:building", "role:implementer"])], {}, {}], "empty");
    const app = page.locator("section", { has: page.getByRole("heading", { name: "Your app" }) });
    const t = (await app.innerText()).trim();
    log(/isn.t online yet/i.test(t), `AC3 with none of these it says the app isn't online yet (${JSON.stringify(t)})`);
    await noGitHub(page, "board with nothing online");
    await shoot(page, "notyet");
  }

  { // D. GitHub can't be read: the error message has no GitHub link
    const gh = await new FakeGitHub([], {}).start(); stops.push(gh);
    gh.fail = 500;
    const b = await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }); stops.push(b);
    const page = await (await browser.newContext({ viewport: SIZES.desktop })).newPage();
    await page.goto(`http://localhost:${b.port}/`);
    await page.getByRole("heading", { name: "We can't see your project right now" }).waitFor({ timeout: 15000 });
    await noGitHub(page, "the can't-read message");
    await shoot(page, "error");
  }

  { // E. demo
    const b = await Board.start(["--demo"]); stops.push(b);
    const page = await (await browser.newContext({ viewport: SIZES.desktop })).newPage();
    await page.goto(`http://localhost:${b.port}/`);
    await page.getByRole("heading", { name: "Your app" }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(300);
    const hrefs = await noGitHub(page, "demo board");
    log(await page.getByRole("link", { name: "Try it" }).count() >= 1 && await page.getByRole("link", { name: "Open your app" }).count() === 1,
      `demo shows Try it and Open your app (${JSON.stringify(hrefs)})`);
    log((await page.locator("li.need").allInnerTexts()).every((t) => t.trim().endsWith(HOW)), `AC2 demo: every waiting card ends with "${HOW}"`);
    log(b.netAttempts().length === 0, "demo: no internet attempts");
    await shoot(page, "demo");
  }
} catch (e) {
  log(false, "crashed: " + (e?.stack ?? e));
} finally {
  await browser.close();
  for (const s of stops) try { s.stop(); } catch {}
}
console.log(`page.mjs: ${fails ? fails + " FAIL" : "all ok"}`);
process.exitCode = fails ? 1 : 0;
