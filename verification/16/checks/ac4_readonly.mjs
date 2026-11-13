#!/usr/bin/env node
// AC4: the checks' settings show only set or not set; the server refuses to change them, and refuses any
// name not on Ella's list.
import { FakeGitHub, run, settings, startBoard } from "./lib.mjs";

const CHECKS = ["TEAM_OWNER", "TEAM_CHECKER", "TEAM_RECEIPTS", "LINT_CMD", "SETUP_CMD", "DOCS_BUDGET"];

await run("AC4 checks' settings are read-only", async (r, own) => {
  const gh = own(await new FakeGitHub({
    list: JSON.stringify({ settings: [
      { name: "TEAM_OWNER", kind: "variable", why: "Who owns the project.", get: "https://example.com/owner", steps: "x" },
      { name: "TEAM_CHECKER", kind: "secret", why: "The checker's key.", make: "random" },
      { name: "TEAM_RECEIPTS", kind: "variable", why: "Where receipts go." },
      { name: "LINT_CMD", kind: "variable", why: "How to lint." },
      { name: "SETUP_CMD", kind: "variable", why: "How to set up." },
      { name: "DOCS_BUDGET", kind: "variable", why: "How many docs." },
      { name: "OPENAI_API_KEY", kind: "secret", why: "Lets your app write answers." },
      { name: "APP_COLOUR", kind: "variable", why: "Colour." },
      { name: "my_key", kind: "secret", why: "lower case, skipped" },
    ] }),
    variables: { TEAM_OWNER: "octo-owner-VALUE", LINT_CMD: "npm run lint-VALUE", SETUP_CMD: "npm ci --VALUE", APP_COLOUR: "green" },
    secrets: { TEAM_CHECKER: "2026-11-10T10:00:00Z" },
  }).start());
  const b = own(await startBoard(gh));
  const s = await settings(b);
  const items = s.data?.items ?? [];
  const set = { TEAM_OWNER: true, TEAM_CHECKER: true, TEAM_RECEIPTS: false, LINT_CMD: true, SETUP_CMD: true, DOCS_BUDGET: false };
  for (const n of CHECKS) {
    const it = items.find((i) => i.name === n);
    r.check(it?.checks === true && it?.is_set === set[n] && (it?.value === null || it?.value === undefined) && !it?.can_make,
      `${n} is shown as a checks setting, ${set[n] ? "set" : "not set"}, with no value and no button (${JSON.stringify(it && { checks: it.checks, is_set: it.is_set, value: it.value, can_make: it.can_make })})`);
  }
  r.check(!/VALUE/.test(s.text), "no checks setting's value is anywhere in the answer");
  r.check(items.find((i) => i.name === "APP_COLOUR")?.checks === false, "an app variable is not a checks setting");

  const before = gh.writes().length;
  for (const n of CHECKS) {
    const v = await b.post("/api/settings", { name: n, value: "changed-by-page" });
    r.check(v.status >= 400 && v.status < 500, `saving ${n} is refused (${v.status} ${v.text})`);
    const m = await b.post("/api/settings", { name: n, make: true });
    r.check(m.status >= 400 && m.status < 500, `making ${n} is refused (${m.status})`);
  }
  for (const [why, body] of [
    ["a name not on the list", { name: "NOT_LISTED", value: "v" }],
    ["a skipped entry's name", { name: "my_key", value: "v" }],
    ["a lowercase variant of a listed name", { name: "openai_api_key", value: "v" }],
    ["GITHUB_TOKEN", { name: "GITHUB_TOKEN", value: "v" }],
    ["a path in the name", { name: "../OPENAI_API_KEY", value: "v" }],
    ["a listed name with a slash", { name: "OPENAI_API_KEY/x", value: "v" }],
    ["an empty name", { name: "", value: "v" }],
    ["no name", { value: "v" }],
    ["a name that isn't text", { name: ["OPENAI_API_KEY"], value: "v" }],
  ]) {
    const x = await b.post("/api/settings", body);
    r.check(x.status >= 400 && x.status < 500, `${why} is refused (${x.status} ${x.text})`);
  }
  r.check(gh.writes().length === before, `none of the refused saves wrote to GitHub (${gh.writes().map((c) => c.method + " " + c.path)})`);
  r.check(gh.variables.TEAM_OWNER === "octo-owner-VALUE" && gh.variables.TEAM_RECEIPTS === undefined, "the checks settings on GitHub are unchanged");
  const ok = await b.post("/api/settings", { name: "OPENAI_API_KEY", value: "a-real-one" });
  r.check(ok.status === 200, `a name on the list can still be saved (${ok.status})`);
  r.check(b.netAttempts().length === 0, "no attempt to reach the internet");
});
