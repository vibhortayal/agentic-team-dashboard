#!/usr/bin/env node
// Finding F1 for #32 (R5: existing behaviour unchanged). The change renamed the work card's holder row from
// class "who" to "l-who", so the card's "<face> Ian (builds)" row lost its style (.who: flex row, 8px gap,
// muted 14px text). Checks the built page (dist/, as CI builds it): the class on a card's holder row must
// have a top-level CSS rule that lays it out as a flex row, as at the base (5f6b2b6).
// The same thing in a real browser is in ../page.mjs ("card holder row").
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dir = path.join(ROOT, "dist", "assets");
if (!fs.existsSync(dir)) { console.error("FAIL dist/assets is missing: run `npm ci && npm run build` first."); process.exit(1); }
const read = (ext) => fs.readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
const js = read(".js"), css = read(".css");

let fails = 0;
const check = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) fails++; };

// The card's holder row: `holder&&...jsxs("div",{className:"<cls>"`, in any quote style the bundler uses.
const m = /\.holder&&\(?[^;]{0,60}?[`"']div[`"'],\{className:[`"']([\w -]+)[`"']/.exec(js);
check(!!m, `found the work card's holder row in the built page${m ? ` (class "${m[1]}")` : ""}`);
if (m) {
  const cls = m[1].trim().split(/\s+/);
  // top-level rules only: ".cls{...}" not preceded by another selector part
  const rules = cls.flatMap((c) => [...css.matchAll(new RegExp(`(?:^|[}\\s,])\\.${c.replace(/[-]/g, "\\-")}\\{([^}]*)\\}`, "g"))]
    .filter((r) => !/\.\S+\s$/.test(css.slice(Math.max(0, r.index - 40), r.index + 1)))
    .map((r) => r[1]));
  const body = rules.join(";");
  check(/display:\s*flex/.test(body), `the holder row's class has its own rule laying it out as a flex row (rules: ${JSON.stringify(rules)})`);
  check(/gap:\s*8px/.test(body), "the face and the name keep their 8px gap");
}
console.log(`F1 card holder style: ${fails ? "FAIL" : "ok"}`);
process.exit(fails ? 1 : 0);
