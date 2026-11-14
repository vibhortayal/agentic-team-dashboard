#!/usr/bin/env node
// AC7, AC8, §3, §7 and §8 for #33, from the committed files (CI-safe, no network). The Mac build itself is read from
// the release workflow run on a Mac (see ../README.md).
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
let fails = 0;
const log = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) fails++; };

const pkg = JSON.parse(read("desktop/package.json"));
const lock = JSON.parse(read("desktop/package-lock.json"));
const root = JSON.parse(read("package.json"));
const rootLock = read("package-lock.json");

console.log("§8 dependencies, in desktop/package.json only");
log(pkg.devDependencies?.electron === "45.2.3", `electron 45.2.3, build only (${pkg.devDependencies?.electron})`);
log(pkg.devDependencies?.["electron-builder"] === "26.18.1", `electron-builder 26.18.1, build only (${pkg.devDependencies?.["electron-builder"]})`);
log(pkg.dependencies?.["electron-updater"] === "6.8.12", `electron-updater 6.8.12 inside the app (${pkg.dependencies?.["electron-updater"]})`);
log(Object.keys(pkg.dependencies ?? {}).join() === "electron-updater", `nothing else ships inside the app (${Object.keys(pkg.dependencies ?? {})})`);
for (const [n, v] of [["electron", "45.2.3"], ["electron-builder", "26.18.1"], ["electron-updater", "6.8.12"]])
  log(lock.packages?.[`node_modules/${n}`]?.version === v, `lock file pins ${n} ${v} (${lock.packages?.[`node_modules/${n}`]?.version})`);
const all = { ...root.dependencies, ...root.devDependencies };
log(!["electron", "electron-builder", "electron-updater"].some((n) => n in all || rootLock.includes(`"node_modules/${n}"`)), "none of them at the root");

console.log("AC6 the update feed");
const pub = [].concat(pkg.build?.publish ?? []);
log(pub.length === 1 && pub[0].provider === "github" && pub[0].owner === "vibhortayal" && pub[0].repo === "agentic-team-dashboard" && !pub[0].private && !pub[0].token,
  `GitHub releases of this repo, public, no token (${JSON.stringify(pub)})`);
log(!pub[0]?.releaseType || pub[0].releaseType === "release", `only published releases (releaseType ${pub[0]?.releaseType ?? "default: release"})`);

console.log("AC7 the release build");
log(pkg.build?.artifactName === "Team-Board-${version}-${arch}.${ext}", `files named Team-Board-<version>-<arch>.<ext> (${pkg.build?.artifactName})`);
const targets = [].concat(pkg.build?.mac?.target ?? []).map((t) => (typeof t === "string" ? t : t.target));
log(targets.includes("dmg") && targets.includes("zip"), `a disk image and a zip (${targets})`);
log(/electron-builder\b[^\n]*--mac[^\n]*--arm64/.test(pkg.scripts?.dist ?? ""), `arm64 Mac build (${pkg.scripts?.dist})`);
log(pkg.build?.mac?.notarize === true && pkg.build?.mac?.hardenedRuntime === true, "signed builds are notarized, with the hardened runtime");
const wf = read(".github/workflows/release.yml");
const job = wf.slice(wf.indexOf("\n  mac_app:"), wf.indexOf("\n  release:"));
log(job.length > 100, "release.yml has the mac_app job");
log(/timeout-minutes:\s*(\d+)/.exec(job)?.[1] <= 15, `the job keeps to 15 minutes (${/timeout-minutes:\s*(\d+)/.exec(job)?.[1]})`);
log(/npm version[^\n]*\$\{VERSION#v\}/.test(job), "the app gets the release's version");
log(/CSC_LINK:\s*\$\{\{\s*secrets\.MAC_CERT_P12/.test(job) && /CSC_KEY_PASSWORD:\s*\$\{\{\s*secrets\.MAC_CERT_PASSWORD/.test(job)
  && /APPLE_ID:\s*\$\{\{\s*secrets\.APPLE_ID\b/.test(job) && /APPLE_TEAM_ID:\s*\$\{\{\s*secrets\.APPLE_TEAM_ID/.test(job)
  && /APPLE_APP_SPECIFIC_PASSWORD:\s*\$\{\{\s*secrets\.APPLE_APP_PASSWORD/.test(job), "signs and notarizes with the #28 secrets");
log(/::warning::[^\n]*ad hoc[^\n]*update/i.test(job) && /identity=-/.test(job), "ad hoc without them, with a warning that updates need the signed build");
log(/--demo/.test(job) && /api\/board/.test(job) && /sample\/recipe-box/.test(job), "smoke test: starts the built app with the sample project and checks it serves the board");
for (const f of ["*.dmg", "*.zip", "*.blockmap", "latest-mac.yml"]) log(job.includes(`desktop/release/${f}`), `uploads ${f}`);
const rel = wf.slice(wf.indexOf("\n  release:"));
log(/needs:\s*\[[^\]]*\bmac_app\b/.test(rel) && /download-artifact/.test(rel) && /merge-multiple:\s*true/.test(rel) && /--draft/.test(rel),
  "the release job waits for it and attaches every file to the draft release");
const secrets = new Set([...wf.matchAll(/secrets\.([A-Z_0-9]+)/g)].map((m) => m[1]));
const allowed = new Set(["MAC_CERT_P12", "MAC_CERT_PASSWORD", "APPLE_ID", "APPLE_TEAM_ID", "APPLE_APP_PASSWORD", "GITHUB_TOKEN"]);
log([...secrets].every((s) => allowed.has(s)), `§7 no new secrets (${[...secrets]})`);
log(!/contents:\s*write/.test(job), "the Mac job cannot write to the repo");

console.log("AC8 / §3 the one-file apps and npx package are unchanged");
// The diff rows (only the named files changed, no existing test changed) are by hand at the reviewed revision, in
// ../README.md: a later merge would make a diff against the base here fail for reasons that are not this ticket's.
log(existsSync(path.join(ROOT, "scripts/package-app.mjs")) && root.bin?.["team-board"] === "bin/team-board.cjs", "the one-file app and npx entry are where they were");

console.log(fails ? `ac7_ac8_files: ${fails} FAILED` : "ac7_ac8_files: all ok");
process.exit(fails ? 1 : 0);
