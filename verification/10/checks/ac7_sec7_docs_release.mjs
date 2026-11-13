#!/usr/bin/env node
// AC7: the README's download steps show the Mac "Open Anyway" and Windows "More info, Run anyway" clicks and
// say plainly why the warning appears.
// Section 7 and AC1 (macOS/Windows proof): the release workflow runs only on a v* tag or by hand, with
// 15-minute timeouts, builds on Mac and Windows, starts each app with --demo and reads the page and
// /api/board, and makes a draft release. The workflow is read, not run (it needs GitHub's Mac and Windows machines).
import fs from "node:fs";
import path from "node:path";
import { ROOT, run } from "./lib.mjs";

await run("AC7/section 7 docs and release", async (r) => {
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  r.check(/Open Anyway/.test(readme) && /Privacy & Security/.test(readme), "AC7 README shows the Mac 'Open Anyway' click and where it is");
  r.check(/More info/.test(readme) && /Run anyway/.test(readme), "AC7 README shows the Windows 'More info', 'Run anyway' clicks");
  r.check(/isn't signed|not signed/i.test(readme) && /(costs|because|so the first time)/i.test(readme), "AC7 README says why the warning appears (the app isn't signed yet)");
  r.check(/Team-Board-mac-arm64\.zip/.test(readme) && /Team-Board-windows-x64\.exe/.test(readme), "AC7 README names the file to download for each computer");

  const wf = fs.readFileSync(path.join(ROOT, ".github", "workflows", "release.yml"), "utf8");
  const on = /^on:\n([\s\S]*?)\n\S/m.exec(wf)?.[1] ?? "";
  const triggers = [...on.matchAll(/^ {2}(\w[\w_]*):/gm)].map((m) => m[1]);
  r.check(JSON.stringify(triggers.sort()) === JSON.stringify(["push", "workflow_dispatch"]), `sec7 release runs only on push and by hand (${triggers})`);
  r.check(/push:\n\s+tags: \["v\*"\]/.test(on) && !/branches/.test(on), "sec7 the push trigger is v* tags only");
  const jobs = [...wf.matchAll(/^ {2}(\w+):\n/gm)].map((m) => m[1]).filter((j) => !triggers.includes(j));
  const timeouts = [...wf.matchAll(/timeout-minutes: (\d+)/g)].map((m) => Number(m[1]));
  r.check(jobs.length >= 2 && timeouts.length === jobs.length && timeouts.every((t) => t <= 15), `sec7 every job has a timeout of 15 minutes or less (jobs ${jobs}, timeouts ${timeouts})`);
  r.check(/os: macos-/.test(wf) && /os: windows-/.test(wf), "AC1 the workflow builds on GitHub's Mac and Windows machines");
  r.check(/npm run package/.test(wf), "AC1 the workflow builds with npm run package");
  r.check(/--demo/.test(wf) && /\/api\/board/.test(wf) && /curl -sf http:\/\/localhost:\d+\/ \|/.test(wf), "AC1 the smoke test starts the app with --demo and reads / and /api/board");
  r.check(/gh release create[^\n]*--draft/.test(wf), "sec3 the workflow makes a draft release");
  r.check(!/npm publish/.test(wf), "sec4 the workflow does not publish to npm");
  const smoke = /Smoke test[\s\S]*?\n {6}- /.exec(wf)?.[0] ?? "";
  if (!/PATH=|cp |mv |cd "\$RUNNER_TEMP|working-directory/.test(smoke)) {
    r.note("AC1 the smoke test runs the app from the checkout with setup-node's Node on PATH, so it shows the app starts, not that it needs no Node and no other files");
  }
});
