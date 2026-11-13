#!/usr/bin/env node
// F1 (round 1 finding, AC8 via #10 AC1/AC2): the server bundle used by the one-file app and the npm package must
// run on its own. Builds it into a temp folder, copies board.cjs alone into an empty folder and starts the demo.
// Fails while board.cjs still requires packages it doesn't carry (tweetnacl, @noble/hashes).
import { spawn, spawnSync } from "node:child_process";
import { builtinModules } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { run, tmpdir } from "./lib.mjs";
import { ROOT, GUARD, freePort } from "../../10/checks/lib.mjs";

await run("F1 the server bundle runs alone", async (r) => {
  const out = tmpdir("bundle");
  const vite = path.join(ROOT, "node_modules", ".bin", "vite");
  const b = spawnSync(vite, ["build", "-c", "vite.app.config.ts", "--outDir", out, "--emptyOutDir"], { cwd: ROOT, encoding: "utf8" });
  r.check(b.status === 0 && fs.existsSync(path.join(out, "board.cjs")), `the server bundle builds (exit ${b.status})`);
  const code = fs.readFileSync(path.join(out, "board.cjs"), "utf8");
  const needs = [...code.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1])
    .filter((m) => !m.startsWith("node:") && !builtinModules.includes(m) && !m.startsWith("."));
  r.check(needs.length === 0, `board.cjs needs no package it doesn't carry (needs ${JSON.stringify([...new Set(needs)])})`);
  const alone = tmpdir("alone");
  fs.copyFileSync(path.join(out, "board.cjs"), path.join(alone, "board.cjs"));
  const port = await freePort();
  const p = spawn(process.execPath, ["--import", GUARD, path.join(alone, "board.cjs"), "--demo", "--no-open", "--port", String(port)],
    { cwd: alone, env: { PATH: process.env.PATH, HOME: alone }, stdio: ["ignore", "pipe", "pipe"] });
  let text = "";
  p.stdout.on("data", (d) => (text += d)); p.stderr.on("data", (d) => (text += d));
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && !/open at/.test(text) && p.exitCode === null) await new Promise((res) => setTimeout(res, 50));
  let served = 0;
  if (/open at/.test(text)) served = (await fetch(`http://127.0.0.1:${port}/api/settings`).catch(() => ({ status: 0 }))).status;
  if (p.exitCode === null) p.kill("SIGTERM");
  r.check(/open at/.test(text) && served === 200, `board.cjs alone starts the demo and answers /api/settings (${served}; ${text.split("\n").find((l) => /Cannot find|Error:|open at/.test(l)) ?? text.slice(0, 120)})`);
});
