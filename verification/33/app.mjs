// By hand, not a CI check (the runner has no Electron or display). Uses the real Team Board app as a person would,
// for AC1-AC5 of #33. Electron is started under xvfb with Playwright's _electron, and a fake `xdg-open` comes first
// on PATH: it only logs what the app asked to open in the person's browser.
// Usage (after `cd desktop && npm ci && npm run board`, and the root `npm run build` in REF):
//   REF=<a checkout of the same revision, built> NODE_PATH=$(npm root -g) xvfb-run -a node verification/33/app.mjs
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync } from "node:fs";
import { tmpdir, networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { _electron } = createRequire(import.meta.url)(path.join(process.env.NODE_PATH ?? "", "playwright"));
const OUT = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(OUT, "../..");
const DESKTOP = path.join(ROOT, "desktop");
const ELECTRON = path.join(DESKTOP, "node_modules/electron/dist/electron");
const REF = process.env.REF ?? ROOT; // where the one-file app's server runs from source, for AC2
let fails = 0;
const log = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fake = mkdtempSync(path.join(tmpdir(), "v33-"));
const LOG = path.join(fake, "opened.log");
writeFileSync(LOG, "");
writeFileSync(path.join(fake, "xdg-open"), `#!/bin/sh\necho "$@" >> "${LOG}"\n`);
chmodSync(path.join(fake, "xdg-open"), 0o755);
const env = { ...process.env, PATH: `${fake}:${process.env.PATH}`, HOME: path.join(fake, "home"), ELECTRON_ENABLE_LOGGING: "" };
const opened = () => readFileSync(LOG, "utf8").split("\n").filter(Boolean);
// Listening sockets on ports 4321-4330, from /proc/net/tcp{,6} (no ss here): "127.0.0.1:4321", "[::]:4321", ...
const listening = () => ["/proc/net/tcp", "/proc/net/tcp6"].filter((f) => existsSync(f)).flatMap((f) => readFileSync(f, "utf8").split("\n").slice(1).map((l) => l.trim().split(/\s+/))
  .filter((c) => c[3] === "0A").map((c) => { const [a, p] = c[1].split(":"); const port = parseInt(p, 16);
    const ip = a.length === 8 ? a.match(/../g).reverse().map((h) => parseInt(h, 16)).join(".") : `[${a}]`; return { ip, port, s: `${ip}:${port}` }; })
  .filter((x) => x.port >= 4321 && x.port <= 4330).map((x) => x.s));
const other = Object.values(networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal)?.address;
async function answers(url) { try { const r = await fetch(url, { signal: AbortSignal.timeout(2000) }); return r.status; } catch { return 0; } }

async function launch(args) {
  const app = await _electron.launch({ executablePath: ELECTRON, args: [DESKTOP, "--no-sandbox", ...args], cwd: DESKTOP, env });
  const page = await app.firstWindow();
  await page.waitForLoadState("load");
  await page.waitForFunction(() => document.body.innerText.trim().length > 0 && !document.body.innerText.includes("Loading…"), null, { timeout: 15000 }).catch(() => {});
  return { app, page };
}
async function shoot(app, page, name) {
  for (const scheme of ["light", "dark"]) {
    // On Linux under xvfb, nativeTheme does not reach prefers-color-scheme, so the page is told directly.
    await page.emulateMedia({ colorScheme: scheme });
    for (const [size, w, h] of [["narrow", 420, 820], ["wide", 1280, 820]]) {
      await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setSize(w, h), [w, h]);
      await sleep(400);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      log(!wide, `${name} ${size} ${scheme}: no sideways scroll`);
      await page.screenshot({ path: path.join(OUT, `${name}-${size}-${scheme}.png`) });
    }
  }
  await page.emulateMedia({ colorScheme: null });
}

// A reference: the one-file app's server, from source, same revision (AC2).
function refServer(args, cwd) {
  const p = spawn(process.execPath, [path.join(REF, "server/cli.ts"), "--no-open", "--port", "4400", ...args], { cwd, env, stdio: "pipe" });
  return new Promise((res) => { p.stdout.on("data", (d) => { if (String(d).includes("4400")) res(p); }); setTimeout(() => res(p), 8000); });
}
const strip = (j) => JSON.stringify(j, (k, v) => (/^(at|now|updated|asOf|time|checked|fetchedAt|readAt)$/i.test(k) ? undefined : v));

console.log("AC1, AC2, AC3, AC4 with --demo");
{
  log(listening().length === 0, "no board running before the app starts");
  const { app, page } = await launch(["--demo"]);
  const wins = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => ({ title: w.getTitle(), visible: w.isVisible(), url: w.webContents.getURL() })));
  log(wins.length === 1, `AC1 one window (${wins.length})`);
  log(wins[0]?.title === "Team Board", `AC1 window title is "Team Board" (${JSON.stringify(wins[0]?.title)})`);
  log(wins[0]?.visible === true, "AC1 the window is shown");
  const url = new URL(wins[0].url);
  console.log(`       window shows ${wins[0].url}`);
  log(["127.0.0.1", "localhost"].includes(url.hostname), `AC1 the window shows the board on this computer (${url.host})`);
  const ls = listening();
  console.log("       listening: " + ls.join(", "));
  log(ls.length === 1 && ls[0].startsWith("127.0.0.1:"), "AC1 one board, bound to 127.0.0.1 only");
  const port = Number(url.port);
  log(await answers(`http://127.0.0.1:${port}/api/board`) === 200, "AC1 the board answers on 127.0.0.1");
  if (other) log(await answers(`http://${other}:${port}/api/board`) === 0, `AC1 the board does not answer on this machine's other address (${other})`);
  await sleep(2000);
  log(opened().length === 0, `AC1 nothing handed to the browser at start (${JSON.stringify(opened())})`);

  // AC2: same board as the one-file app's server.
  const board = `http://127.0.0.1:${port}`;
  const appData = await (await fetch(board + "/api/board")).json();
  log(appData.repo === "sample/recipe-box", `AC2 --demo shows the sample project (${appData.repo})`);
  const ref = await refServer(["--demo"], REF);
  const refData = await (await fetch("http://127.0.0.1:4400/api/board")).json();
  log(strip(appData) === strip(refData), "AC2 /api/board in the app equals the one-file app's (time fields aside)");
  const [h1, h2] = [await (await fetch(board + "/")).text(), await (await fetch("http://127.0.0.1:4400/")).text()];
  log(h1 === h2, "AC2 the page HTML is the one-file app's");
  for (const p of ["/api/settings", "/api/projects", "/api/me", "/api/session"]) {
    const [a, b] = [await answers(board + p), await answers("http://127.0.0.1:4400" + p)];
    log(a === b, `AC2 ${p} answers the same (${a} vs ${b})`);
  }
  ref.kill();
  const text = await page.evaluate(() => document.body.innerText);
  log(/recipe/i.test(text), "AC2 the window shows the sample project's board");
  console.log("       page starts: " + JSON.stringify(text.slice(0, 300)));
  await shoot(app, page, "demo");
  const settings = page.getByText("Settings", { exact: false }).first();
  if (await settings.count()) {
    await settings.click();
    await sleep(800);
    const t2 = await page.evaluate(() => document.body.innerText);
    log(t2 !== text, "AC2 Settings opens in the window");
    await shoot(app, page, "settings");
    await page.goto(board + "/");
    await page.waitForLoadState("load");
  } else log(false, "AC2 a Settings control is on the page");

  const theme = await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource);
  log(theme === "system", `the window follows the Mac's light or dark setting (themeSource ${theme})`);
  // AC4: locked down.
  const g = await page.evaluate(() => ({ require: typeof require, process: typeof process, module: typeof module, Buffer: typeof Buffer }));
  log(Object.values(g).every((t) => t === "undefined"), `AC4 no Node in the page ${JSON.stringify(g)}`);
  const prefs = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  log(prefs.nodeIntegration === false && prefs.contextIsolation === true && prefs.sandbox === true,
    `AC4 nodeIntegration ${prefs.nodeIntegration}, contextIsolation ${prefs.contextIsolation}, sandbox ${prefs.sandbox}`);

  // AC3: links leave the app.
  // The board's own links, clicked as a person would (the first few that leave the board).
  const links = await page.$$eval("a[href^='http']", (as) => as.map((a) => a.href).filter((h) => !/^http:\/\/(127\.0\.0\.1|localhost):/.test(h)));
  log(links.length > 0, `AC3 the demo board has outside links (${links.length})`);
  for (const h of [...new Set(links)].slice(0, 3)) {
    const b0 = opened().length;
    const loc = page.locator(`a[href="${h}"]`).first();
    const vis = await loc.isVisible();
    if (vis) await loc.click({ timeout: 5000 }).catch((e) => console.log("       click: " + String(e.message).split("\n").slice(0, 12).join(" / ")));
    else await loc.evaluate((a) => a.click()); // not on screen (folded away): the same click, from the page
    console.log(`       ${h}: ${vis ? "clicked on screen" : "clicked from the page (not visible)"}`);
    await sleep(1200);
    const now = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => w.webContents.getURL()));
    log(opened().slice(b0).includes(h) && now.length === 1 && /^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(now[0]), `AC3 clicking the board's link ${h} opens it in the browser, window stays (${JSON.stringify(now)} opened ${JSON.stringify(opened().slice(b0))})`);
  }
  const tries = [
    ["a target=_blank link to GitHub", "https://github.com/sample/recipe-box/issues/1",
      (u) => { const a = document.createElement("a"); a.href = u; a.target = "_blank"; a.textContent = "x"; document.body.append(a); a.click(); }],
    ["window.open to a try-it link", "https://recipe-box-pr-3.example.app/", (u) => { window.open(u); }],
    ["a same-window link to a help page", "https://docs.github.com/en/get-started",
      (u) => { const a = document.createElement("a"); a.href = u; a.textContent = "y"; document.body.append(a); a.click(); }],
    ["the page moving itself to another site", "http://example.com/help", (u) => { location.href = u; }],
  ];
  for (const [what, u, fn] of tries) {
    const before = opened().length;
    await page.evaluate(fn, u).catch(() => {});
    await sleep(1200);
    const now = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => w.webContents.getURL()));
    log(opened().slice(before).some((l) => l.includes(u)), `AC3 ${what} opens in the browser (${JSON.stringify(opened().slice(before))})`);
    log(now.length === 1 && [board, board.replace("127.0.0.1", "localhost")].some((b) => now[0].startsWith(b + "/")), `AC3 ${what}: the window stays on the board, no second window (${JSON.stringify(now)})`);
  }
  const before = opened().length;
  await page.evaluate((u) => { location.href = u; }, wins[0].url.replace(/\/?$/, "/?again=1"));
  await sleep(1200);
  const now = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getURL());
  log(now.includes("again=1") && opened().length === before, `AC3 a link to the board itself stays in the window (${now})`);

  // AC10 in the window (demo), and AC9: a version downloads while the app is open.
  await page.goto(wins[0].url); await page.waitForLoadState("load");
  await page.getByText("Your team has learned some new things").first().waitFor({ timeout: 10000 }).catch(() => {});
  let t = await page.evaluate(() => document.body.innerText);
  log(/learned some new things/.test(t) && /update the team/.test(t), "AC10 the demo shows the newer-team notice in the window");
  log(!/A new version of Team Board is ready/.test(t), "AC9 no new-version notice before one has downloaded");
  await app.evaluate(({ dialog }, where) => {
    const u = process.mainModule.require(where).autoUpdater; // the same module main.cjs loaded
    globalThis.__v33 = { boxes: [], installs: 0 };
    dialog.showMessageBox = async (w, o) => { globalThis.__v33.boxes.push((o ?? w).message); return { response: 1 }; }; // Later
    u.quitAndInstall = () => { globalThis.__v33.installs++; };
    u.emit("update-downloaded", { version: "9.9.9" });
    u.emit("update-downloaded", { version: "9.9.9" });
  }, path.join(DESKTOP, "node_modules/electron-updater"));
  await page.getByRole("button", { name: "Check now" }).click();
  await page.getByText("A new version of Team Board is ready.").first().waitFor({ timeout: 10000 }).catch(() => {});
  t = await page.evaluate(() => document.body.innerText);
  log(/A new version of Team Board is ready\./.test(t), "AC9 the board shows \"A new version of Team Board is ready.\"");
  const restartBtn = page.getByRole("button", { name: "Restart now" });
  log(await restartBtn.count() === 1, "AC9 with a Restart now button");
  let rec = await app.evaluate(() => globalThis.__v33);
  log(rec.boxes.length === 1, `AC9 the app's own box asked once for 9.9.9 (${JSON.stringify(rec.boxes)})`);
  await shoot(app, page, "news");
  await restartBtn.click().catch(() => {});
  await sleep(800);
  rec = await app.evaluate(() => globalThis.__v33);
  log(rec.installs === 1, `AC9 Restart now restarts into it (quitAndInstall called ${rec.installs})`);
  log(opened().length === before, "AC9 nothing handed to the browser");

  // AC5: opening the app again.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
  await sleep(500);
  const second = spawn(ELECTRON, [DESKTOP, "--no-sandbox", "--demo"], { cwd: DESKTOP, env, stdio: "ignore" });
  const t0 = Date.now();
  const code = await new Promise((r) => { second.on("exit", (c) => r(c)); setTimeout(() => r("still running"), 10000); });
  log(code !== "still running", `AC5 the second copy ends by itself (${code}, ${Date.now() - t0} ms)`);
  if (code === "still running") second.kill();
  log(listening().length === 1, `AC5 still one board (${listening().length} listening)`);
  const st = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows(); return { n: w.length, min: w[0].isMinimized(), vis: w[0].isVisible() }; });
  log(st.n === 1 && !st.min && st.vis, `AC5 the open window comes forward ${JSON.stringify(st)}`);

  // AC1: closing the window quits the app and stops the board.
  const proc = app.process();
  const exited = new Promise((r) => { proc.on("exit", () => r(true)); setTimeout(() => r(false), 10000); });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  log(await exited, "AC1 closing the window quits the app");
  await sleep(300);
  log(await answers(`${board}/api/board`) === 0 && listening().length === 0, "AC1 the board is stopped");
}

console.log("AC2 without --demo (sign-in and the project picker)");
{
  const { app, page } = await launch([]);
  const url = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getURL());
  const port = new URL(url).port;
  const appData = await (await fetch(`http://127.0.0.1:${port}/api/board`)).json();
  const cwd = mkdtempSync(path.join(tmpdir(), "v33-nogit-"));
  const ref = await refServer([], cwd);
  const refData = await (await fetch("http://127.0.0.1:4400/api/board")).json();
  ref.kill();
  log(strip(appData) === strip(refData), `AC2 with no project chosen the app answers as the one-file app (${JSON.stringify(appData).slice(0, 160)})`);
  const text = await page.evaluate(() => document.body.innerText);
  console.log("       page: " + JSON.stringify(text.slice(0, 300)));
  log(text.length > 20, "AC2 the window shows the start page (sign-in / project picker)");
  await shoot(app, page, "start");
  const proc = app.process();
  const exited = new Promise((r) => { proc.on("exit", () => r(true)); setTimeout(() => r(false), 10000); });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  log(await exited, "AC1 closing the window quits the app (no project)");
}

console.log(fails ? `app.mjs: ${fails} FAILED` : "app.mjs: all ok");
process.exit(fails ? 1 : 0);
