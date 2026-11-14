#!/usr/bin/env node
// Round 2 finding F1 for #33. AC10: "It asks GitHub at most every six hours per project."
// Two board pages reading /api/updates at the same moment (two tabs of the one-file app opened together, or the page
// and a reload) must still cost one round of GitHub reads. Fails while each read that misses the cache asks GitHub itself.
import { run } from "../../8/checks/lib.mjs";
import { Fake, start, updates } from "./ac9_ac10_board.mjs";

await run("F1 AC10 reads together", async (r, own) => {
  for (const n of [2, 5]) {
    const gh = own(await new Fake().start());
    const b = await start(own, gh);
    const answers = await Promise.all(Array.from({ length: n }, () => updates(b)));
    const v = gh.log.filter((l) => l.what === "version").length;
    const c = gh.log.filter((l) => l.what === "compare").length;
    r.check(v === 1 && c === 1, `${n} reads at the same moment ask GitHub once (got ${v} VERSION reads and ${c} main reads)`);
    r.check(answers.every((a) => a.d?.team), `${n} reads: each shows the team notice`);
    b.stop(); gh.stop();
  }
});
