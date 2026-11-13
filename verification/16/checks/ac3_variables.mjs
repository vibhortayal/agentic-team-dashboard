#!/usr/bin/env node
// AC3: an app variable shows its value and can be changed; a new one is created.
import { FakeGitHub, run, settings, startBoard } from "./lib.mjs";

await run("AC3 variables", async (r, own) => {
  const gh = own(await new FakeGitHub({
    list: JSON.stringify({ settings: [
      { name: "APP_COLOUR", kind: "variable", why: "The colour of your app." },
      { name: "SHOP_NAME", kind: "variable", why: "Your shop's name." },
    ] }),
    variables: { APP_COLOUR: "green" },
  }).start());
  const b = own(await startBoard(gh));
  const s = await settings(b);
  const by = (d) => Object.fromEntries((d?.items ?? []).map((i) => [i.name, i]));
  r.check(by(s.data).APP_COLOUR?.value === "green", `a set variable shows its value (${by(s.data).APP_COLOUR?.value})`);
  r.check(by(s.data).SHOP_NAME?.is_set === false && !by(s.data).SHOP_NAME?.value, "an unset variable shows as not set");

  const ch = await b.post("/api/settings", { name: "APP_COLOUR", value: "deep purple" });
  const patch = gh.calls.filter((c) => c.method === "PATCH");
  r.check(ch.status === 200 && patch.length === 1 && patch[0].path === "/repos/acme/garden/actions/variables/APP_COLOUR"
    && JSON.parse(patch[0].raw).value === "deep purple", `a change is sent to GitHub (${ch.status}, ${patch.map((c) => c.path + " " + c.raw)})`);
  r.check(!gh.calls.some((c) => c.method === "PUT"), "a variable is not sent as a secret");
  r.check(by((await settings(b)).data).APP_COLOUR?.value === "deep purple", "the list then shows the new value");

  const nw = await b.post("/api/settings", { name: "SHOP_NAME", value: "Seeds & Co" });
  const post = gh.calls.filter((c) => c.method === "POST" && c.path === "/repos/acme/garden/actions/variables");
  r.check(nw.status === 200 && post.length === 1 && JSON.parse(post[0].raw).name === "SHOP_NAME" && JSON.parse(post[0].raw).value === "Seeds & Co",
    `a new variable is created (${nw.status}, ${post.map((c) => c.raw)})`);
  const after = by((await settings(b)).data).SHOP_NAME;
  r.check(after?.is_set === true && after?.value === "Seeds & Co", `the new variable then shows as set with its value (${after?.value})`);
  r.check(b.netAttempts().length === 0, "no attempt to reach the internet");
});
