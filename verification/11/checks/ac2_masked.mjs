#!/usr/bin/env node
// AC2 "masked", round 2 (finding F3): a key in the ask is hidden even when the key has "_" in it.
// Round 1's row compared the whole key and missed that the key comes through with its "_" taken out.
// Here no long run of the key's own characters may reach the card, with or without the "_".
import { Board, FakeGitHub, REPO, comment, ev, item, run, waiting } from "./lib.mjs";

const HEADER = "**Priya (product-manager) → owner** · question";
const asking = (n, body) => comment(n, HEADER, body, ev("product-manager", "owner", "question", { human: "human:answer" }), { minute: 1 });
const labels = ["stage:spec", "role:product-manager", "needs-human", "human:answer"];
const BODY = "Q7vX2mR9kL4tW8nB3pZ6cY1dH5gJ0fSaEuiopasdfgh"; // fake, 43 characters
// Key shapes #8's masking hides (server/redact.ts), each built at run time from fake characters.
const KEYS = [
  ["github token (ghp_)", "gh" + "p_" + BODY.slice(0, 36)],
  ["github token (github_pat_)", "github" + "_pat_" + BODY.slice(0, 30)],
  ["npm token", "np" + "m_" + BODY.slice(0, 36)],
  ["stripe key", "sk" + "_live_" + BODY.slice(0, 24)],
  ["supabase key", "sb" + "p_" + (BODY + BODY).slice(0, 40)],
];

await run("AC2 masked keys with _", async (r, own) => {
  const items = KEYS.map((_, k) => item(60 + k, `Key ${k}`, labels));
  const comments = Object.fromEntries(KEYS.map(([, key], k) => [60 + k, [asking(60 + k, `Sign in with ${key} and tell me if it works.`)]]));
  const gh = own(await new FakeGitHub(items, comments).start());
  const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
  const out = await b.board();
  b.stop(); gh.stop();
  KEYS.forEach(([kind, key], k) => {
    const c = waiting(out, 60 + k);
    r.check(!!c, `setup: #${60 + k} is waiting for you`);
    const ask = String(c?.ask ?? "");
    const tail = key.slice(-20); // the key's last 20 characters, which hold no "_"
    r.check(!ask.includes(tail) && !ask.includes(key.replace(/_/g, "")),
      `AC2 masked: a ${kind} in the ask is hidden (got ${JSON.stringify(ask)})`);
  });
});
