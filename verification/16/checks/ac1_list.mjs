#!/usr/bin/env node
// AC1: the page shows each sensible entry of Ella's list (why, set or not, Get it here (https only), steps);
// bad entries are skipped and the page says so; no list: "Nothing to set yet."
import { FakeGitHub, run, settings, startBoard } from "./lib.mjs";

const good = [
  { name: "OPENAI_API_KEY", kind: "secret", why: "Lets your app write answers.", get: "https://platform.example.com/keys", steps: "Sign in. Press New key. Copy it." },
  { name: "SESSION_SECRET", kind: "secret", why: "Keeps people signed in safely.", make: "random" },
  { name: "APP_COLOUR", kind: "variable", why: "The colour of your app.", get: "https://colours.example.com", steps: "Pick one." },
  { name: "A", kind: "variable", why: "One letter is a fine name.", get: "http://plain.example.com", steps: "Steps for A." },
  { name: "A_1", kind: "secret", why: "Digits and underscores are fine.", get: "javascript:alert(1)" },
  { name: "GITHUBX", kind: "variable", why: "Starts GITHUB but not GITHUB_.", get: "not a url" },
];
const bad = [
  { name: "my_key", kind: "secret", why: "lower case" },
  { name: "Mixed_Key", kind: "secret", why: "mixed case" },
  { name: "GITHUB_TOKEN_X", kind: "secret", why: "starts GITHUB_" },
  { name: "GITHUB_", kind: "variable", why: "is GITHUB_" },
  { name: "NO_WHY", kind: "secret" },
  { name: "BLANK_WHY", kind: "secret", why: "   " },
  { name: "ODD_KIND", kind: "env", why: "unknown kind" },
  { name: "OPENAI_API_KEY", kind: "variable", why: "a repeat of the first name" },
];

await run("AC1 the list", async (r, own) => {
  const gh = own(await new FakeGitHub({
    list: JSON.stringify({ settings: [good[0], bad[0], good[1], bad[1], good[2], bad[2], bad[3], good[3], bad[4], bad[5], good[4], bad[6], bad[7], good[5]] }),
    secrets: { OPENAI_API_KEY: "2026-11-12T08:00:00Z" },
    variables: { APP_COLOUR: "green", OTHER_VAR: "x" },
  }).start());
  const b = own(await startBoard(gh));
  const s = await settings(b);
  r.check(s.status === 200 && s.data && Array.isArray(s.data.items), `GET /api/settings answers a list (${s.status})`);
  const items = s.data?.items ?? [];
  const names = items.map((i) => i.name);
  r.check(JSON.stringify(names) === JSON.stringify(good.map((g) => g.name)), `only the sensible entries, in Ella's order (got ${JSON.stringify(names)})`);
  for (const x of bad.slice(0, 7)) r.check(!names.includes(x.name), `skipped: ${x.name} (${x.why ?? "no why"})`);
  r.check(names.filter((n) => n === "OPENAI_API_KEY").length === 1, "a repeated name appears once");
  const first = items.find((i) => i.name === "OPENAI_API_KEY");
  r.check(first?.kind === "secret", `the repeat did not replace the first entry (kind ${first?.kind})`);
  r.check(s.data?.skipped > 0, `the answer says some of the list was skipped (skipped ${s.data?.skipped})`);
  for (const g of good) {
    const it = items.find((i) => i.name === g.name);
    r.check(it?.why === g.why, `${g.name} carries its why ("${it?.why}")`);
  }
  const by = Object.fromEntries(items.map((i) => [i.name, i]));
  r.check(by.OPENAI_API_KEY?.is_set === true && !!by.OPENAI_API_KEY?.updated_at, `a secret GitHub has is set, with when it changed (${by.OPENAI_API_KEY?.is_set}, ${by.OPENAI_API_KEY?.updated_at})`);
  r.check(by.SESSION_SECRET?.is_set === false, "a secret GitHub doesn't have is not set");
  r.check(by.APP_COLOUR?.is_set === true && by.APP_COLOUR?.value === "green", `a variable GitHub has is set, with its value (${by.APP_COLOUR?.value})`);
  r.check(by.A?.is_set === false, "a variable GitHub doesn't have is not set");
  r.check(by.APP_COLOUR?.get === "https://colours.example.com/" || by.APP_COLOUR?.get === "https://colours.example.com", `an https Get it here link is kept (${by.APP_COLOUR?.get})`);
  r.check(by.OPENAI_API_KEY?.steps === good[0].steps, "steps are kept");
  r.check(!by.A?.get, `an http link is dropped (${by.A?.get})`);
  r.check(!by.A_1?.get, `a javascript: link is dropped (${by.A_1?.get})`);
  r.check(!by.GITHUBX?.get, `a link that isn't a URL is dropped (${by.GITHUBX?.get})`);
  r.check(by.A?.steps === "Steps for A.", "steps stay when the link is dropped");
  r.check(!names.includes("OTHER_VAR"), "variables on GitHub but not on Ella's list are not shown");

  // A list where everything makes sense: nothing skipped.
  gh.list = JSON.stringify({ settings: good.slice(0, 3) });
  const clean = await settings(b);
  r.check(clean.data?.skipped === 0 && clean.data?.items?.length === 3, `a clean list skips nothing (skipped ${clean.data?.skipped}, ${clean.data?.items?.length} items)`);

  // No list.
  gh.list = null;
  const none = await settings(b);
  r.check(none.status === 200 && none.data?.items?.length === 0 && !none.data?.problem, `no list: no items and no problem (${none.status} ${none.text})`);
  r.check(b.netAttempts().length === 0, "no attempt to reach the internet");
});
