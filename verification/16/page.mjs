// By hand, not a CI check (the runner has no browser). Uses the Settings page as a person would in a real
// browser (Playwright): AC1 the list, skipped entries and "Nothing to set yet.", AC2 the password box and the value
// never shown after Save, AC4 "Ella fills this in" with no box, AC5 "Make one for me", AC6 a plain problem,
// AC7 the demo, AC8 the footer. Then screenshots at phone and desktop widths, light and dark.
// Usage: NODE_PATH=$(npm root -g) node verification/16/page.mjs   (after npm run build)
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FakeGitHub, startBoard } from "./checks/lib.mjs";

const { chromium } = createRequire(import.meta.url)(path.join(process.env.NODE_PATH ?? "", "playwright"));
const OUT = path.dirname(fileURLToPath(import.meta.url));
const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
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

async function open(browser, gh, demo = false) {
  const b = await startBoard(gh, { demo }); stops.push(b);
  const page = await (await browser.newContext({ viewport: SIZES.desktop })).newPage();
  await page.goto(`http://localhost:${b.port}/`);
  await page.getByRole("button", { name: "Settings and keys" }).click({ timeout: 15000 });
  await page.getByRole("heading", { name: "Settings and keys" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  return { page, b };
}

const row = (page, name) => page.locator("li", { has: page.locator("code", { hasText: new RegExp(`^${name}$`) }) });
const VALUE = "sk-page-typed-SECRET-a81f";

const browser = await chromium.launch();
try {
  // 1. A list with every kind of entry, one that doesn't make sense, and saving.
  const gh = await new FakeGitHub({
    list: JSON.stringify({ settings: [
      { name: "OPENAI_API_KEY", kind: "secret", why: "Lets your app write answers.", get: "https://platform.example.com/keys", steps: "Sign in, press New key, copy it." },
      { name: "SESSION_SECRET", kind: "secret", why: "Keeps people signed in safely.", make: "random" },
      { name: "MAIL_KEY", kind: "secret", why: "Sends your app's emails.", get: "http://insecure.example.com" },
      { name: "SITE_NAME", kind: "variable", why: "The name people see at the top of your app." },
      { name: "SETUP_CMD", kind: "variable", why: "How the team's checks set up your app." },
      { name: "TEAM_CHECKER", kind: "secret", why: "Lets the checker sign its work." },
      { name: "bad_name", kind: "secret", why: "lower case" },
    ] }),
    variables: { SITE_NAME: "Seeds & Co", SETUP_CMD: "npm ci --setup-VALUE" },
    secrets: { MAIL_KEY: "2026-11-12T08:00:00Z" },
  }).start(); stops.push(gh);
  const { page } = await open(browser, gh);
  const text = await page.locator("body").innerText();
  log(text.includes("Lets your app write answers.") && text.includes("The name people see at the top of your app."), "AC1 each entry shows its why");
  log(/didn't make sense/i.test(text), "AC1 the page says some of the list didn't make sense");
  log(!text.includes("bad_name"), "AC1 the bad entry is not shown");
  const getIt = row(page, "OPENAI_API_KEY").getByRole("link", { name: "Get it here" });
  log((await getIt.count()) === 1 && (await getIt.getAttribute("href")).startsWith("https://platform.example.com/"), "AC1 an unset entry has Get it here (https)");
  log((await row(page, "OPENAI_API_KEY").innerText()).includes("Sign in, press New key, copy it."), "AC1 an unset entry shows its steps");
  log((await row(page, "MAIL_KEY").getByRole("link", { name: "Get it here" }).count()) === 0, "AC1 an http link is not shown");
  log((await row(page, "SITE_NAME").innerText()).includes("Seeds & Co"), "AC3 a set variable shows its value");
  const setup = await row(page, "SETUP_CMD").innerText();
  log(/Ella fills this in|Ella set this/i.test(setup) && (await row(page, "SETUP_CMD").locator("input, textarea, button").count()) === 0,
    `AC4 a checks setting says Ella fills it in, with no box or button ("${setup.replace(/\n/g, " / ")}")`);
  log(!text.includes("setup-VALUE"), "AC4 a checks setting's value is not shown");
  const notSetCheck = await row(page, "TEAM_CHECKER").innerText();
  log(/Ella fills this in/i.test(notSetCheck), `AC4 an unset checks setting says "Ella fills this in" ("${notSetCheck.replace(/\n/g, " / ")}")`);
  log((await row(page, "SESSION_SECRET").getByRole("button", { name: "Make one for me" }).count()) === 1
    && (await row(page, "OPENAI_API_KEY").getByRole("button", { name: "Make one for me" }).count()) === 0, "AC5 only the make-one entry has the button");
  log(/changes your project only when you (save a setting|press Save)/i.test(await page.locator("footer").innerText()), "AC8 the footer says it changes the project only when you save");
  await shoot(page, "list");

  const box = row(page, "OPENAI_API_KEY").locator("input");
  log((await box.getAttribute("type")) === "password", "AC2 a secret is typed in a password box");
  await box.fill(VALUE);
  await row(page, "OPENAI_API_KEY").getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(800);
  const after = await page.content();
  const inputs = await page.$$eval("input", (xs) => xs.map((x) => x.value));
  log(gh.opened.at(-1)?.value === VALUE, "AC2 Save sent the value, sealed, to GitHub");
  log(!after.includes(VALUE) && !inputs.includes(VALUE), "AC2 after Save the value is nowhere on the page, not even in a box");
  log(/Saved/i.test(await row(page, "OPENAI_API_KEY").innerText()), "AC2 the row then shows it is saved");
  log((await row(page, "OPENAI_API_KEY").getByRole("button", { name: "Replace" }).count()) === 1, "AC2 a saved secret offers Replace, not Show");
  await row(page, "SESSION_SECRET").getByRole("button", { name: "Make one for me" }).click();
  await page.waitForTimeout(800);
  const made = gh.opened.at(-1);
  log(made?.name === "SESSION_SECRET" && !(await page.content()).includes(made.value), "AC5 Make one for me saves a value the page never shows");
  await shoot(page, "saved");

  // A save GitHub refuses: one plain sentence, without the value.
  gh.fail = { put: 403 };
  await row(page, "OPENAI_API_KEY").getByRole("button", { name: "Replace" }).click();
  await row(page, "OPENAI_API_KEY").locator("input").fill("sk-refused-VALUE-77");
  await row(page, "OPENAI_API_KEY").getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(800);
  const prob = await row(page, "OPENAI_API_KEY").locator(".problem-line").innerText().catch(() => "");
  log(prob.length > 0 && !prob.includes("sk-refused-VALUE-77"), `AC6 a refused save shows a plain sentence without the value ("${prob}")`);
  await shoot(page, "refused");
  gh.fail = {};

  // 2. No list.
  const gh2 = await new FakeGitHub({ list: null }).start(); stops.push(gh2);
  const e = await open(browser, gh2);
  log((await e.page.locator("body").innerText()).includes("Nothing to set yet."), "AC1 no list: Nothing to set yet.");
  await shoot(e.page, "empty");

  // 3. GitHub down while reading.
  const gh3 = await new FakeGitHub({ list: "{}" }).start(); stops.push(gh3);
  gh3.fail = { contents: 500 };
  const x = await open(browser, gh3);
  const xt = await x.page.locator(".problem").innerText().catch(() => "");
  log(xt.length > 0, `AC6 GitHub down: the page says so ("${xt}")`);
  await shoot(x.page, "error");

  // 4. The demo.
  const d = await open(browser, null, true);
  const dt = await d.page.locator("body").innerText();
  log((await d.page.locator("ul.settings > li").count()) > 0, "AC7 the demo shows a sample list");
  const saveButtons = d.page.getByRole("button", { name: /Save|Make one for me/ });
  const n = await saveButtons.count();
  let allOff = true;
  for (let i = 0; i < n; i++) allOff &&= await saveButtons.nth(i).isDisabled();
  log(allOff, `AC7 the demo's Save and Make buttons are off (${n})`);
  log(d.b.netAttempts().length === 0, "AC7 the demo tried no network");
  void dt;
  await shoot(d.page, "demo");
} finally {
  await browser.close();
  for (const s of stops) try { s.stop(); } catch {}
}
console.log(`${fails ? "FAIL" : "ok"}: ${fails} failed`);
process.exit(fails ? 1 : 0);
