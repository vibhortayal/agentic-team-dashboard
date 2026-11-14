#!/usr/bin/env node
// AC4 and AC6 for #33, in plain Node (CI has no Electron): loads desktop/app/main.cjs with `electron`,
// `electron-updater` and the built board replaced by fakes that record what the app asks of them, then plays
// update events into it as electron-updater would. The real app's window is checked by hand in ../app.mjs.
import Module, { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../desktop/app/main.cjs");
const SIX_HOURS = 6 * 60 * 60 * 1000;
let fails = 0;
const log = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) fails++; };
const tick = () => new Promise((r) => setTimeout(r, 20));

function world({ packaged, checkFails = false, dialogAnswer = 1 }) {
  const w = { appUpdate: null, dialogs: [], errorBoxes: [], checks: 0, quitAndInstall: 0, intervals: [], windows: [], menu: null, quits: 0, opened: [] };
  const app = new EventEmitter();
  let ready;
  Object.assign(app, {
    isPackaged: packaged, name: "Team Board",
    getVersion: () => "0.1.0",
    requestSingleInstanceLock: () => true,
    whenReady: () => new Promise((r) => { ready = r; }),
    quit: () => { w.quits++; },
  });
  class BrowserWindow extends EventEmitter {
    constructor(opts) { super(); this.opts = opts; this.webContents = Object.assign(new EventEmitter(), { setWindowOpenHandler: (f) => { this.openHandler = f; } }); w.windows.push(this); }
    loadURL(u) { this.url = u; } show() {} focus() {} restore() {} isMinimized() { return false; }
  }
  const electron = {
    app, BrowserWindow,
    Menu: { buildFromTemplate: (t) => t, setApplicationMenu: (m) => { w.menu = m; } },
    dialog: {
      showMessageBox: async (win, opts) => { w.dialogs.push(opts ?? win); return { response: dialogAnswer }; },
      showErrorBox: (...a) => { w.errorBoxes.push(a); },
    },
    shell: { openExternal: (u) => { w.opened.push(u); } },
  };
  const autoUpdater = Object.assign(new EventEmitter(), {
    checkForUpdates: () => { w.checks++; return checkFails ? Promise.reject(new Error("net::ERR_INTERNET_DISCONNECTED")) : Promise.resolve(null); },
    quitAndInstall: () => { w.quitAndInstall++; },
  });
  // The built board: startBoard, and setAppUpdate, which the board's "A new version is ready" notice reads (AC9).
  const board = {
    startBoard: async () => ({ url: "http://localhost:4321", port: 4321, server: { close() {} } }),
    setAppUpdate: (version, restart) => { w.appUpdate = { version, restart }; },
  };
  const realLoad = Module._load;
  const realSetInterval = globalThis.setInterval;
  globalThis.setInterval = (fn, ms) => { w.intervals.push({ fn, ms }); return 0; };
  Module._load = function (req, parent, ...rest) {
    if (req === "electron") return electron;
    if (req === "electron-updater") return { autoUpdater };
    if (/server[\\/]board\.cjs$/.test(req)) return board;
    return realLoad.call(this, req, parent, ...rest);
  };
  const require = createRequire(import.meta.url);
  delete require.cache[MAIN];
  try { require(MAIN); } finally { Module._load = realLoad; }
  w.ready = async () => { ready(); await tick(); await tick(); globalThis.setInterval = realSetInterval; };
  w.autoUpdater = autoUpdater;
  w.menuItem = (label) => w.menu?.flatMap((m) => m.submenu ?? []).find((i) => i.label === label);
  return w;
}

console.log("AC6 a packaged app");
{
  const w = world({ packaged: true });
  await w.ready();
  log(w.checks === 1, `checks once when it opens (${w.checks})`);
  const every = w.intervals.filter((i) => i.ms === SIX_HOURS);
  log(every.length === 1, `a timer every 6 hours (${JSON.stringify(w.intervals.map((i) => i.ms))})`);
  every[0]?.fn(); await tick();
  log(w.checks === 2, `the timer checks again (${w.checks})`);
  log(w.autoUpdater.autoDownload !== false, "downloads in the background (autoDownload on)");
  log(w.autoUpdater.autoInstallOnAppQuit !== false, "Later installs it when the app quits (autoInstallOnAppQuit on)");
  log(w.autoUpdater.allowPrerelease !== true, "prereleases are not offered");
  w.autoUpdater.emit("update-available", { version: "0.2.0" }); await tick();
  log(w.dialogs.length === 0, "a found update downloads without asking anything");
  w.autoUpdater.emit("error", new Error("net::ERR_INTERNET_DISCONNECTED")); await tick();
  log(w.dialogs.length === 0 && w.errorBoxes.length === 0, "a failed start or timer check stays quiet");
  w.autoUpdater.emit("update-not-available", { version: "0.1.0" }); await tick();
  log(w.dialogs.length === 0, "nothing new after a start or timer check stays quiet");

  w.autoUpdater.emit("update-downloaded", { version: "0.2.0" }); await tick();
  const d = w.dialogs.at(-1);
  log(d?.message === "A new version of Team Board is ready. Restart now?", `asks "A new version of Team Board is ready. Restart now?" (${JSON.stringify(d?.message)})`);
  log(JSON.stringify(d?.buttons) === JSON.stringify(["Restart", "Later"]), `with Restart and Later (${JSON.stringify(d?.buttons)})`);
  log(w.quitAndInstall === 0, "Later does not restart");

  const item = w.menuItem("Check for Updates…");
  log(!!item && w.menu[0].submenu.includes(item), "the app menu has \"Check for Updates…\"");
  const n = w.dialogs.length;
  item?.click(); await tick();
  log(w.checks === 3, "the menu item checks");
  w.autoUpdater.emit("update-not-available", { version: "0.1.0" }); await tick();
  log(w.dialogs.length === n + 1 && /up to date/i.test(w.dialogs.at(-1)?.message ?? ""), `after the menu check it says it's up to date (${JSON.stringify(w.dialogs.at(-1)?.message)})`);
  item?.click(); await tick();
  w.autoUpdater.emit("error", new Error("net::ERR_INTERNET_DISCONNECTED")); await tick();
  log(w.dialogs.length === n + 2 && /couldn.?t check/i.test(w.dialogs.at(-1)?.message ?? ""), `after the menu check a failure says it couldn't check (${JSON.stringify(w.dialogs.at(-1)?.message)})`);
  w.autoUpdater.emit("error", new Error("again")); await tick();
  log(w.dialogs.length === n + 2, "the next timer failure is quiet again");
}
console.log("AC9 the board's notice and asking once per version");
{
  const w = world({ packaged: true });
  await w.ready();
  log(w.appUpdate === null, "nothing for the board before a version has downloaded");
  w.autoUpdater.emit("update-downloaded", { version: "0.2.0" }); await tick();
  log(w.appUpdate?.version === "0.2.0", `the board is told 0.2.0 is ready (${JSON.stringify(w.appUpdate?.version)})`);
  log(w.dialogs.length === 1, `the app's own box asks (${w.dialogs.length})`);
  w.autoUpdater.emit("update-downloaded", { version: "0.2.0" }); await tick();
  w.autoUpdater.emit("update-downloaded", { version: "0.2.0" }); await tick();
  log(w.dialogs.length === 1, `the same version again (later checks): no second box (${w.dialogs.length})`);
  log(w.appUpdate?.version === "0.2.0", "the board still shows it");
  w.autoUpdater.emit("update-downloaded", { version: "0.3.0" }); await tick();
  log(w.dialogs.length === 2 && w.appUpdate?.version === "0.3.0", `a newer version asks once more and the board shows it (${w.dialogs.length}, ${w.appUpdate?.version})`);
  log(w.quitAndInstall === 0, "nothing restarted yet (Later)");
  w.appUpdate?.restart(); await tick();
  log(w.quitAndInstall === 1, "the board's Restart now restarts into it");
}
{
  const w = world({ packaged: true, dialogAnswer: 0 });
  await w.ready();
  w.autoUpdater.emit("update-downloaded", { version: "0.2.0" }); await tick();
  log(w.quitAndInstall === 1, "Restart installs and restarts");
}
{
  let crashed = null;
  const onUnhandled = (e) => { crashed = e; };
  process.on("unhandledRejection", onUnhandled);
  const w = world({ packaged: true, checkFails: true });
  await w.ready(); await tick();
  process.off("unhandledRejection", onUnhandled);
  log(!crashed && w.dialogs.length === 0, `no network at start: quiet, no crash (${crashed})`);
}
console.log("AC6 started from source (not packaged)");
{
  const w = world({ packaged: false });
  await w.ready();
  log(w.checks === 0 && w.intervals.every((i) => i.ms !== SIX_HOURS), "does not check for updates");
}
console.log("AC4 the window");
{
  const w = world({ packaged: true });
  await w.ready();
  const p = w.windows[0]?.opts?.webPreferences ?? {};
  log(w.windows.length === 1, "one window");
  log(w.windows[0]?.opts?.title === "Team Board", "titled Team Board");
  log(p.nodeIntegration !== true && p.contextIsolation !== false && p.sandbox === true && !p.preload,
    `no Node in the page, context isolation and the sandbox on (${JSON.stringify(p)})`);
}

console.log(fails ? `ac4_ac6_main: ${fails} FAILED` : "ac4_ac6_main: all ok");
process.exit(fails ? 1 : 0);
