#!/usr/bin/env node
// AC8: the footer now says the board changes the project only when you save a setting; the old "only reads"
// line is gone. (#8, #10 and #11 themselves are their own checks under verification/.)
import fs from "node:fs";
import path from "node:path";
import { run } from "./lib.mjs";
import { ROOT } from "../../10/checks/lib.mjs";

await run("AC8 footer", async (r) => {
  const dir = path.join(ROOT, "dist", "assets");
  const js = fs.readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
  r.check(/changes your project only when you save a setting/i.test(js), "the built page's footer says it changes the project only when you save a setting");
  r.check(!/only reads your project\. It changes nothing/.test(js), "the old 'only reads ... changes nothing' footer is gone");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  r.check(!/changes nothing|only reads/i.test(readme) || /setting/i.test(readme), "README doesn't still say the board only reads or changes nothing without mentioning settings");
});
