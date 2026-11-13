// By hand, not a CI check (the runner has no browser). Walks the sign-in and project picker as a person
// would (AC3, AC4, AC5) in a real browser, then takes screenshots at phone and desktop widths, light and dark.
// Usage: NODE_PATH=$(npm root -g) node verification/10/shots.mjs   (after npm run build)
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Board, CLIENT_ID, FakeGitHub, tmpdir } from "./checks/lib.mjs";

const { chromium } = createRequire(import.meta.url)(path.join(process.env.NODE_PATH ?? "", "playwright"));
const OUT = path.dirname(fileURLToPath(import.meta.url));
const gh = await new FakeGitHub().start();
gh.deviceStart.interval = 1;
const b = await Board.start([], { github: gh, env: { BOARD_GITHUB_CLIENT_ID: CLIENT_ID, BOARD_GITHUB_APP_SLUG: "team-progress-board" }, cwd: tmpdir("cwd") });
const browser = await chromium.launch();
const log = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) process.exitCode = 1; };
const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };

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
}

try {
  const page = await (await browser.newContext({ viewport: SIZES.desktop })).newPage();
  await page.goto(b.url("/").replace("127.0.0.1", "localhost"));
  await page.getByRole("button", { name: "Sign in with GitHub" }).waitFor();
  await shoot(page, "signin");
  await page.getByRole("button", { name: "Sign in with GitHub" }).click();
  await page.getByText(gh.deviceStart.user_code).waitFor();
  const href = await page.getByRole("link", { name: "Open GitHub" }).getAttribute("href");
  log(href === "https://github.com/login/device", `AC3 the page shows the code and a button that opens GitHub (${href})`);
  log(await page.getByRole("button", { name: "Copy" }).isVisible(), "AC3 a Copy button for the code");
  await shoot(page, "code");

  // Refused: one plain sentence on the page.
  gh.device = "denied";
  const refused = page.getByText("You said no on GitHub");
  await refused.waitFor({ timeout: 15000 });
  log(true, `AC3 refused: the page says "${(await page.locator(".problem-line").innerText()).trim()}"`);
  await shoot(page, "refused");

  // Yes: the page moves on by itself to the project list.
  gh.device = "pending";
  await page.getByRole("button", { name: "Sign in with GitHub" }).click();
  await page.getByText(gh.deviceStart.user_code).waitFor();
  const t0 = Date.now();
  gh.device = "done";
  await page.getByText("Which project should the board show?").waitFor({ timeout: 15000 });
  log(true, `AC3 after GitHub says yes the page moved on by itself in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.getByRole("button", { name: "acme/garden" }).waitFor();
  log(await page.getByRole("button", { name: "acme/secret-shed (private)" }).isVisible(), "AC4 the list shows the projects the board can see");
  const more = await page.getByRole("link", { name: "Let the board see it on GitHub" }).getAttribute("href");
  log(more?.startsWith("https://github.com/apps/team-progress-board/"), `AC4 a link to give access to more (${more})`);
  log(await page.getByLabel(/type its name/).isVisible(), "AC4 a box to type owner/name");
  await shoot(page, "pick");

  await page.getByLabel(/type its name/).fill("not a name");
  await page.getByRole("button", { name: "Show it" }).click();
  await page.getByText("doesn't look like a project name").waitFor();
  log(true, "AC4 a wrong typed name is refused in plain words");
  await page.getByRole("button", { name: "acme/garden" }).click();
  await page.getByText("Garden first ticket").waitFor({ timeout: 10000 });
  log(true, "AC4 picking acme/garden shows its board");
  await shoot(page, "board");

  await page.getByRole("button", { name: "Change project" }).click();
  await page.getByText("Which project should the board show?").waitFor();
  log(true, "AC4 Change project brings the list back");
  await page.getByLabel(/type its name/).fill("acme/other");
  await page.getByRole("button", { name: "Show it" }).click();
  await page.getByText("Other project ticket").waitFor({ timeout: 10000 });
  log(true, "AC4 typing acme/other shows its board");

  await page.reload();
  await page.getByText("Other project ticket").waitFor({ timeout: 10000 });
  log(true, "AC4 the choice is kept on reload");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Sign in with GitHub" }).waitFor();
  log(true, "AC5 Sign out goes back to the sign-in screen");
} finally {
  await browser.close();
  b.stop();
  gh.stop();
}
