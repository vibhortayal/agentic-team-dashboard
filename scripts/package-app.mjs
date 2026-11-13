// Builds the one-file app for the computer it runs on: macOS, Windows or Linux.
//   npm run package        ->  dist-app/Team-Board-<system>(.exe)
// Uses Node's own "single executable application" feature: a copy of Node with the board inside.
// Run it on each system (the release workflow does that on GitHub's Mac and Windows machines).
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync, chmodSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const out = join(root, "dist-app");
const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit", cwd: root, shell: process.platform === "win32" && cmd === "npx" });

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

run("npx", ["vite", "build"]);
run("npx", ["vite", "build", "-c", "vite.app.config.ts"]);

// Everything the page needs, built into the app.
const assets = { "demo.json": join(root, "server", "demo.json") };
const walk = (dir) => readdirSync(dir).forEach((f) => {
  const p = join(dir, f);
  if (statSync(p).isDirectory()) walk(p);
  else assets["dist/" + relative(join(root, "dist"), p).split("\\").join("/")] = p;
});
walk(join(root, "dist"));

const blob = join(out, "board.blob");
writeFileSync(join(out, "sea-config.json"), JSON.stringify({
  main: join(root, "dist-server", "board.cjs"),
  output: blob,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
  assets,
}, null, 2));
run(process.execPath, ["--experimental-sea-config", join(out, "sea-config.json")]);

const system = { darwin: "mac", win32: "windows", linux: "linux" }[process.platform] ?? process.platform;
const app = join(out, `Team-Board-${system}-${process.arch}${process.platform === "win32" ? ".exe" : ""}`);
copyFileSync(process.execPath, app);
chmodSync(app, 0o755);

const postject = ["postject", app, "NODE_SEA_BLOB", blob, "--sentinel-fuse", "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"];
if (process.platform === "darwin") {
  run("codesign", ["--remove-signature", app]);
  run("npx", [...postject, "--macho-segment-name", "NODE_SEA"]);
  run("codesign", ["--sign", "-", app]); // ad-hoc: lets it run; it is not an Apple-checked signature
} else {
  run("npx", postject);
}
rmSync(blob);
rmSync(join(out, "sea-config.json"));
console.log(`Built ${relative(root, app)}`);
