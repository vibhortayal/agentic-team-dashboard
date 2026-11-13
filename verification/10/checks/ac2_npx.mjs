#!/usr/bin/env node
// AC2: the packed package installs with no runtime dependencies, and `npx team-board --demo` serves the board.
// `npm pack`, then install the tarball offline into an empty folder and run `npx team-board` there.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Board, ROOT, run, tmpdir } from "./lib.mjs";

await run("AC2 npx runs", async (r, own) => {
  const packDir = tmpdir("pack");
  // prepack (the build) prints to stdout too; the JSON report is the last thing printed.
  const raw = execFileSync("npm", ["pack", "--json", "--pack-destination", packDir], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const out = JSON.parse(raw.slice(raw.lastIndexOf("\n[") + 1));
  const tgz = path.join(packDir, out[0].filename);
  r.check(fs.existsSync(tgz), `AC2 npm pack makes ${out[0].filename} (${(out[0].size / 1e3).toFixed(0)} kB, ${out[0].entryCount} files)`);
  const files = out[0].files.map((f) => f.path);
  r.check(files.includes("bin/team-board.cjs") && files.includes("dist/index.html"), "AC2 the package holds the command and the built page");
  r.check(!files.some((f) => /^(node_modules|web|verification|\.github|docs)\//.test(f)), `AC2 the package holds no source, tests or evidence (${files.join(" ")})`);

  const ex = tmpdir("x");
  execFileSync("tar", ["-xzf", tgz, "-C", ex]);
  const pkg = JSON.parse(fs.readFileSync(path.join(ex, "package", "package.json"), "utf8"));
  const deps = ["dependencies", "optionalDependencies", "peerDependencies", "bundleDependencies", "bundledDependencies"].filter((k) => pkg[k] && Object.keys(pkg[k]).length);
  r.check(deps.length === 0, `AC2 the package lists no runtime dependencies (${deps.map((k) => k + "=" + JSON.stringify(pkg[k])).join(" ")})`);
  r.check(pkg.bin?.["team-board"], `AC2 the package has a team-board command (${JSON.stringify(pkg.bin)})`);

  const user = tmpdir("user");
  fs.writeFileSync(path.join(user, "package.json"), "{}");
  execFileSync("npm", ["install", "--offline", "--no-audit", "--no-fund", tgz], { cwd: user, stdio: ["ignore", "ignore", "inherit"] });
  const installed = fs.readdirSync(path.join(user, "node_modules")).filter((n) => !n.startsWith("."));
  r.check(JSON.stringify(installed) === JSON.stringify(["team-board"]), `AC2 installing it, offline, brings nothing else (${installed})`);

  const cfg = tmpdir("cfg");
  const npx = path.join(path.dirname(process.execPath), "npx");
  const b = own(await Board.start(["--demo"], { how: { bin: npx, pre: ["--offline", "team-board"], cwd: user }, cwd: user, env: { BOARD_CONFIG_DIR: cfg, npm_config_update_notifier: "false" } })); // npm itself checks for its own updates otherwise
  const page = await b.get("/");
  r.check(page.status === 200 && page.text.includes("<title>Your project board</title>"), `AC2 npx team-board --demo serves the page (${page.status})`);
  const assets = [...page.text.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  const got = await Promise.all(assets.map((a) => b.get(a)));
  r.check(assets.length >= 2 && got.every((g) => g.status === 200), `AC2 its script and style load (${assets.join(", ")})`);
  const board = await b.json("/api/board");
  const cards = (board.columns ?? []).flatMap((c) => c.cards ?? []);
  r.check(!board.error && board.repo === "sample/recipe-box" && cards.length > 0, `AC2 /api/board serves the sample project (${board.repo}, ${cards.length} cards)`);
  r.check(b.netAttempts().length === 0, `AC2 the demo tried no internet (${b.netAttempts()})`);
});
