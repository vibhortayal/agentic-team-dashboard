// By hand (needs a browser): the BLOCK finding F1 of round 1. Every project the board can see uses the team,
// so there is no "Show all your projects" and no box to type a project's name.
// #29 AC2: 'The rest, and the "type its name" box, sit behind "Show all your projects (N more)".'
// #29 AC5: '#8, #10, #11 and #16 still hold' -> #10 AC4: 'the page lists the projects ..., and a box to type owner/name.'
// Exits 0 once the box can be reached from the picker in both cases; 1 now.
// Usage: NODE_PATH=$(npm root -g) node verification/29/f1_type_box.mjs   (after npm run build)
import { createRequire } from "node:module";
import path from "node:path";
import { FakeGitHub, startBoard } from "./checks/lib.mjs";

const { chromium } = createRequire(import.meta.url)(path.join(process.env.NODE_PATH ?? "", "playwright"));
const browser = await chromium.launch();
let fails = 0;
for (const [what, setup] of [
  ["two team projects, no others (the list after Change project)", { repos: ["acme/one", "acme/two"], team: ["acme/one", "acme/two"] }],
  ["no projects at all (No project yet)", { repos: [], team: [] }],
]) {
  const gh = await new FakeGitHub(setup).start();
  const b = await startBoard(gh);
  const page = await browser.newPage();
  await page.goto(`http://localhost:${b.port}/`);
  await page.waitForFunction(() => !/Finding your project|Loading/.test(document.body.innerText), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const summary = page.getByText(/^Show all your projects/);
  if (await summary.count()) await summary.first().click();
  const box = page.getByLabel(/type its name/i);
  const ok = (await box.count()) > 0 && (await box.first().isVisible());
  console.log((ok ? "  ok   " : "  FAIL ") + `${what}: the type-its-name box can be reached (${ok ? "yes" : "no Show all and no box on the page"})`);
  if (!ok) fails++;
  b.stop(); gh.stop();
}
await browser.close();
process.exit(fails ? 1 : 0);
