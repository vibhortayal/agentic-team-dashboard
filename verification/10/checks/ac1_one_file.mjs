#!/usr/bin/env node
// AC1 (Linux part): the built one-file app starts with --demo and serves the page and /api/board with no
// Node installed and no other files. Builds it with `npm run package` (about 5 s), copies the one file alone
// into an empty folder, and runs it there with a PATH that has no node and a HOME with nothing in it.
// macOS and Windows are proved only by the release workflow (see sec7_release_workflow.mjs).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Board, ROOT, run, tmpdir } from "./lib.mjs";

await run("AC1 one file runs (Linux)", async (r, own) => {
  if (process.platform !== "linux") { r.check(false, "AC1 this check runs on Linux only"); return; }
  execFileSync("npm", ["run", "package"], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
  const built = path.join(ROOT, "dist-app", `Team-Board-linux-${process.arch}`);
  r.check(fs.existsSync(built), `AC1 npm run package makes ${path.relative(ROOT, built)}`);
  const lonely = tmpdir("app");
  const app = path.join(lonely, path.basename(built));
  fs.copyFileSync(built, app);
  fs.chmodSync(app, 0o755);
  r.note(`app size ${(fs.statSync(app).size / 1e6).toFixed(1)} MB`);

  const noNodePath = "/usr/bin:/bin";
  let found = null;
  try { found = execFileSync("/bin/sh", ["-c", "command -v node || true"], { env: { PATH: noNodePath }, encoding: "utf8" }).trim(); } catch {}
  r.check(!found, `AC1 there is no node on the app's PATH (${JSON.stringify(found)})`);

  const cfg = tmpdir("cfg");
  const b = own(await Board.start(["--demo"], { how: { bin: app, cwd: lonely }, cwd: lonely, path: noNodePath, guard: false,
    env: { BOARD_CONFIG_DIR: cfg, NODE_PATH: "" } }));
  const page = await b.get("/");
  r.check(page.status === 200 && page.text.includes("<title>Your project board</title>"), `AC1 the page is served (${page.status})`);
  const assets = [...page.text.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  const got = await Promise.all(assets.map((a) => b.get(a)));
  r.check(assets.length >= 2 && got.every((g) => g.status === 200 && g.text.length > 100), `AC1 the page's script and style are inside the app (${assets.join(", ")})`);
  const board = await b.json("/api/board");
  const cards = (board.columns ?? []).flatMap((c) => c.cards ?? []);
  r.check(!board.error && board.repo === "sample/recipe-box" && cards.length > 0, `AC1 /api/board serves the sample project (${board.repo}, ${cards.length} cards)`);
  const st = await b.json("/api/status");
  r.check(st.demo === true && st.inside_app === true, `AC1 the app knows it is the one-file app (${JSON.stringify(st)})`);
  r.check(JSON.stringify(fs.readdirSync(lonely)) === JSON.stringify([path.basename(app)]), `AC1 the app's folder still holds only the app (${fs.readdirSync(lonely)})`);
  r.check(b.toolCalls().filter((t) => !t.startsWith("xdg-open")).length === 0, `AC1 no other program was needed (${b.toolCalls()})`);
  const stop = await b.post("/api/stop");
  const code = await Promise.race([b.exited, new Promise((res) => setTimeout(() => res("still running"), 5000))]);
  r.check(stop.status === 200 && code === 0, `AC1 the app's Stop button stops it (${stop.status}, exit ${code})`);
});
