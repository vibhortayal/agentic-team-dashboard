// Team Board for Mac: the progress board in its own window, keeping itself up to date.
// It starts the board's own server inside the app (127.0.0.1 only) and shows it here.
// New versions come from this repo's published GitHub releases (drafts are never offered).
const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const { startBoard } = require("./server/board.cjs");

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const demo = process.argv.includes("--demo");
let win = null;
let boardUrl = "";
let askedByPerson = false;

if (!app.requestSingleInstanceLock()) {
  app.quit(); // a copy is already open: it comes forward instead (below)
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  app.whenReady().then(start).catch((e) => {
    dialog.showErrorBox("Team Board couldn't start", e instanceof Error ? e.message : String(e));
    app.quit();
  });
}

async function start() {
  const board = await startBoard({ demo }, () => app.quit());
  boardUrl = board.url;
  app.on("will-quit", () => board.server.close());
  setMenu();
  openWindow();
  if (app.isPackaged) {
    checkForUpdates(false);
    setInterval(() => checkForUpdates(false), CHECK_EVERY_MS);
  }
}

function isBoard(url) {
  return url === boardUrl || url.startsWith(boardUrl + "/");
}

function openOutside(url) {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
}

function openWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 420,
    minHeight: 500,
    title: "Team Board",
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // Anything that isn't the board opens in the person's own browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isBoard(url)) return { action: "allow" };
    openOutside(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (isBoard(url)) return;
    event.preventDefault();
    openOutside(url);
  });
  win.on("page-title-updated", (event) => event.preventDefault());
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => { win = null; });
  win.loadURL(boardUrl);
}

app.on("window-all-closed", () => app.quit());

function setMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { label: "Check for Updates…", click: () => checkForUpdates(true) },
        { type: "separator" },
        { role: "hide" }, { role: "hideOthers" }, { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [{ role: "reload" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Updates: download quietly, then ask once. "Later" installs it when the app next quits.
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;
autoUpdater.logger = null;

autoUpdater.on("update-not-available", () => {
  if (askedByPerson) tell("Team Board is up to date.", `You have the newest version (${app.getVersion()}).`);
  askedByPerson = false;
});
autoUpdater.on("update-available", (info) => {
  if (askedByPerson) tell("A new version is on its way.", `Version ${info.version} is downloading. Team Board will ask you to restart when it's ready.`);
  askedByPerson = false;
});
autoUpdater.on("error", () => {
  if (askedByPerson) tell("Team Board couldn't check for updates.", "Check that you're online, then try again from the Team Board menu.");
  askedByPerson = false;
});
autoUpdater.on("update-downloaded", async (info) => {
  const { response } = await dialog.showMessageBox(win ?? undefined, {
    type: "info",
    buttons: ["Restart", "Later"],
    defaultId: 0,
    cancelId: 1,
    message: "A new version of Team Board is ready. Restart now?",
    detail: `Version ${info.version} is downloaded. If you choose Later, it's installed the next time you quit Team Board.`,
  });
  if (response === 0) autoUpdater.quitAndInstall();
});

function checkForUpdates(fromMenu) {
  if (!app.isPackaged) {
    if (fromMenu) tell("Updates work in the downloaded app.", "This copy was started from the source code, so it doesn't update itself.");
    return;
  }
  askedByPerson = fromMenu;
  autoUpdater.checkForUpdates().catch(() => { /* reported by the "error" event */ });
}

function tell(message, detail) {
  dialog.showMessageBox(win ?? undefined, { type: "info", buttons: ["OK"], message, detail });
}
