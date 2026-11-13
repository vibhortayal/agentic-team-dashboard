// By hand, not a CI check (the runner has no browser). Uses the project picker as a person would in a real
// browser (Playwright): AC2 team projects up front, the rest behind "Show all your projects (N more)"; AC3 one team
// project opens straight away on the first run, "Change project" shows the list; AC4 "No project yet" with Ella's
// three steps and Check again. Then screenshots at phone and desktop widths, light and dark.
// Usage: NODE_PATH=$(npm root -g) node verification/29/page.mjs   (after npm run build)
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FakeGitHub, startBoard } from "./checks/lib.mjs";

const { chromium } = createRequire(import.meta.url)(path.join(process.env.NODE_PATH ?? "", "playwright"));
const OUT = path.dirname(fileURLToPath(import.meta.url));
const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
let fails = 0;
const log = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) fails++; };
const note = (what) => console.log("  note " + what);
const stops = [];
const shots = process.argv.includes("--no-shots") ? false : true;

async function shoot(page, name) {
  if (!shots) return;
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

async function open(browser, gh, opts = {}) {
  const b = await startBoard(gh, opts); stops.push(b); current = b;
  const page = await (await browser.newContext({ viewport: SIZES.desktop })).newPage();
  await page.goto(`http://localhost:${b.port}/`);
  return { page, b };
}
const settle = (page) => page.waitForFunction(() => !/Finding your project|Loading/.test(document.body.innerText), null, { timeout: 30000 }).then(() => page.waitForTimeout(400));
const visible = async (loc) => (await loc.count()) > 0 && (await loc.first().isVisible());
const text = (page) => page.evaluate(() => document.body.innerText);
const repoButton = (page, repo) => page.getByRole("button", { name: new RegExp(`^${repo.replace("/", "\\/")}( \\(private\\))?$`) });
const typeBox = (page) => page.getByLabel(/type its name/i);
const showAll = (page) => page.getByText(/^Show all your projects/);
// The board for a project: its "Change project" button is on the page and the board says that project is showing.
let current = null;
const boardOf = async (page, repo) => (await visible(page.getByRole("button", { name: "Change project" }))) && (await current.json("/api/board")).repo === repo;

const browser = await chromium.launch();
try {
  // AC2: 2 team + 3 others.
  {
    const gh = await new FakeGitHub({ repos: ["acme/old-site", "acme/garden", "acme/notes", "acme/shop", "acme/scratch"], team: ["acme/garden", "acme/shop"] }).start();
    const { page, b } = await open(browser, gh);
    await settle(page);
    log(await visible(page.getByRole("heading", { name: "Which project should the board show?" })), "AC2 the picker shows");
    for (const t of ["acme/garden", "acme/shop"]) log(await visible(repoButton(page, t)), `AC2 team project ${t} shown up front`);
    for (const o of ["acme/old-site", "acme/notes", "acme/scratch"]) log(!(await visible(repoButton(page, o))), `AC2 other project ${o} not shown up front`);
    log(!(await visible(typeBox(page))), "AC2 the type-its-name box is not shown up front");
    const sa = showAll(page);
    log(await visible(sa) && (await sa.first().innerText()).trim() === "Show all your projects (3 more)", `AC2 says "Show all your projects (3 more)" (${await sa.first().innerText().catch(() => "missing")})`);
    await shoot(page, "list");
    await sa.first().click();
    await page.waitForTimeout(300);
    for (const o of ["acme/old-site", "acme/notes", "acme/scratch"]) log(await visible(repoButton(page, o)), `AC2 after Show all, ${o} is shown`);
    log(await visible(typeBox(page)), "AC2 after Show all, the type-its-name box is shown");
    await shoot(page, "list-all");
    await repoButton(page, "acme/shop").click();
    await page.waitForTimeout(1500);
    log(await boardOf(page, "acme/shop"), "AC2 picking a team project opens its board");
    log((await b.json("/api/status")).repo === "acme/shop", "AC2 the pick is saved");
    gh.stop();
  }

  // AC3: exactly one team project on the first run.
  {
    const gh = await new FakeGitHub({ repos: ["acme/a", "acme/b", "acme/mine", "acme/c", "acme/d"], team: ["acme/mine"] }).start();
    const { page, b } = await open(browser, gh);
    let sawList = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      if (await visible(page.getByRole("heading", { name: "Which project should the board show?" })) || await visible(showAll(page))) sawList = true;
      if (await boardOf(page, "acme/mine")) break;
      await page.waitForTimeout(50);
    }
    log(await boardOf(page, "acme/mine"), "AC3 the one team project opens straight away");
    log(!sawList, "AC3 no list was shown on the way");
    note(`AC3 opened in ${Date.now() - t0} ms; saved project now ${JSON.stringify((await b.json("/api/status")).repo)}`);
    await shoot(page, "opened");
    await page.getByRole("button", { name: "Change project" }).click();
    await settle(page);
    await page.waitForTimeout(1500);
    log(await visible(repoButton(page, "acme/mine")) && await visible(showAll(page)), "AC3 Change project shows the list (the team project and Show all) and it stays");
    log((await showAll(page).first().innerText()).trim() === "Show all your projects (4 more)", "AC3 the list says (4 more)");
    await shoot(page, "change");
    await page.reload();
    await page.waitForTimeout(3000);
    note(`AC3 reload after Change project: ${await boardOf(page, "acme/mine") ? "the board for acme/mine (saved)" : "the list"}`);
    gh.stop();
  }
  // AC3: two team projects -> the list, not opened.
  {
    const gh = await new FakeGitHub({ repos: ["acme/a", "acme/one", "acme/two"], team: ["acme/one", "acme/two"] }).start();
    const { page, b } = await open(browser, gh);
    await settle(page); await page.waitForTimeout(1500);
    log(await visible(repoButton(page, "acme/one")) && await visible(repoButton(page, "acme/two")) && (await b.json("/api/status")).repo === "", "AC3 two team projects: the list shows, nothing opened");
    gh.stop();
  }
  // AC3: not the first run (a project is saved): the saved one opens, not the team project.
  {
    const gh = await new FakeGitHub({ repos: ["acme/saved", "acme/mine"], team: ["acme/mine"] }).start();
    const { page, b } = await open(browser, gh, { config: { repo: "acme/saved" } });
    await page.waitForTimeout(3000);
    log(await boardOf(page, "acme/saved") && (await b.json("/api/status")).repo === "acme/saved", "AC3 with a project saved, that one opens, not the team project");
    await page.getByRole("button", { name: "Change project" }).click();
    await settle(page); await page.waitForTimeout(1500);
    log(await visible(repoButton(page, "acme/mine")) && (await b.json("/api/status")).repo === "acme/saved", "AC3 Change project with one team project shows the list (not first run, nothing switched)");
    gh.stop();
  }

  // AC4: no team project (3 others), GITHUB_TOKEN sign-in.
  {
    const gh = await new FakeGitHub({ repos: ["acme/x", "acme/y", "acme/z"], team: [] }).start();
    const { page, b } = await open(browser, gh);
    await settle(page);
    const t = await text(page);
    log(await visible(page.getByRole("heading", { name: "No project yet" })), "AC4 says No project yet");
    log(/Ella/.test(t) && /talk to Ella first/i.test(t), "AC4 tells the person to talk to Ella first");
    const steps = await page.locator("ol li").allInnerTexts();
    log(steps.length === 3 && steps.every((s) => s.split(/\s+/).length <= 25), `AC4 three short steps (${steps.length}: ${steps.map((s) => s.split(/\s+/).length + " words").join(", ")})`);
    const lesson = page.getByRole("link", { name: "Your first project" });
    const href = await lesson.first().getAttribute("href").catch(() => null);
    log(await visible(lesson) && /^https:\/\/[^/]+\/learn\/first-project\.html/.test(href ?? ""), `AC4 links the "Your first project" lesson (${href})`);
    log(await visible(page.getByRole("button", { name: "Check again" })), "AC4 has a Check again button");
    note(`AC4 with others: Show all ${await visible(showAll(page)) ? "is there" : "is not there"}; "Let the board see it on GitHub" ${await visible(page.getByRole("link", { name: "Let the board see it on GitHub" })) ? "shown" : "not shown"} (GITHUB_TOKEN sign-in)`);
    await shoot(page, "none");
    // Ella makes the project: Check again reads the list again.
    gh.team.add("acme/y");
    const before = gh.looks.length;
    await page.getByRole("button", { name: "Check again" }).click();
    await page.waitForTimeout(3000);
    log(gh.looks.length > before, "AC4 Check again reads the list again");
    log(!(await visible(page.getByRole("heading", { name: "No project yet" }))), "AC4 after TEAM.md appears, Check again moves on from No project yet");
    note(`AC4 after Check again with one team project now: ${await boardOf(page, "acme/y") ? "its board opened" : "the list"}; saved ${JSON.stringify((await b.json("/api/status")).repo)}`);
    gh.stop();
  }
  // AC4: signed in through the board's GitHub App (no GITHUB_TOKEN), nothing at all granted yet.
  {
    const gh = await new FakeGitHub({ installs: [[]], team: [] }).start();
    const { page } = await open(browser, gh, { config: { token: "ghu_VerifierAppToken0123456789abcdef" }, env: { GITHUB_TOKEN: "", BOARD_GITHUB_CLIENT_ID: "Iv1.verifier-test", BOARD_GITHUB_APP_SLUG: "team-progress-board" } });
    await settle(page);
    log(await visible(page.getByRole("heading", { name: "No project yet" })), "AC4 App sign-in, no projects: No project yet");
    const link = page.getByRole("link", { name: "Let the board see it on GitHub" });
    const href = await link.first().getAttribute("href").catch(() => null);
    log(await visible(link) && href?.startsWith("https://github.com/apps/team-progress-board/"), `AC4 App sign-in: "Let the board see it on GitHub" stays (${href})`);
    log(await visible(page.getByRole("button", { name: "Check again" })), "AC4 App sign-in: Check again");
    note(`AC4 no projects at all: type-its-name box ${await visible(typeBox(page)) || await visible(showAll(page)) ? "reachable" : "not on the page"}`);
    await shoot(page, "none-app");
    gh.stop();
  }

  // AC5 / #10 AC4 under AC2: the type-its-name box when every project the board can see uses the team.
  {
    const gh = await new FakeGitHub({ repos: ["acme/one", "acme/two"], team: ["acme/one", "acme/two"] }).start();
    const { page } = await open(browser, gh);
    await settle(page);
    const reach = await visible(typeBox(page)) || await visible(showAll(page));
    log(reach, `F1 every project is a team one: the type-its-name box is reachable (#10 AC4 "a box to type owner/name"; #29 AC2 puts it behind "Show all") (${reach ? "yes" : "no box and no Show all"})`);
    await shoot(page, "all-team");
    gh.stop();
  }

  // Loading and error states.
  {
    const gh = await new FakeGitHub({ repos: ["acme/a", "acme/b"], team: ["acme/a", "acme/b"] }).start();
    gh.lookDelay = 6000;
    const { page } = await open(browser, gh);
    await page.waitForTimeout(800);
    log(/Finding your project/.test(await text(page)), "loading: the page says it is finding your project");
    await shoot(page, "loading");
    gh.stop();
  }
  {
    const gh = await new FakeGitHub({ repos: ["acme/a"], installs: null }).start();
    gh.listFail = 500;
    const { page } = await open(browser, gh);
    await page.waitForTimeout(2500);
    const t = await text(page);
    log(!/\{|\}|undefined|500|Server Error/.test(t) && await visible(page.getByRole("button", { name: "Try again" })), `error: a plain problem and Try again (${t.replace(/\s+/g, " ").slice(0, 160)})`);
    await shoot(page, "error");
    gh.listFail = null;
    await page.getByRole("button", { name: "Try again" }).click();
    await page.waitForTimeout(2500);
    log(await boardOf(page, "acme/a") || await visible(page.getByRole("heading", { name: "No project yet" })) || await visible(repoButton(page, "acme/a")), "error: Try again recovers once GitHub answers");
    gh.stop();
  }
} finally {
  await browser.close();
  for (const s of stops) try { s.stop(); } catch {}
}
console.log(`page: ${fails ? fails + " failed" : "all ok"}`);
process.exit(fails ? 1 : 0);
