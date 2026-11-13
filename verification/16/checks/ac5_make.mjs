#!/usr/bin/env node
// AC5: a secret with make: "random" gets a button that saves a fresh random value (32 random bytes).
import { FakeGitHub, openSealLibsodium, run, settings, startBoard } from "./lib.mjs";

function bytesOf(v) {
  if (typeof v !== "string") return -1;
  if (/^[0-9a-f]{64}$/i.test(v)) return 32;
  if (/^[A-Za-z0-9_-]+={0,2}$/.test(v) || /^[A-Za-z0-9+/]+={0,2}$/.test(v)) return Buffer.from(v.replace(/-/g, "+").replace(/_/g, "/"), "base64").length;
  return -1;
}

await run("AC5 make one for me", async (r, own) => {
  const gh = own(await new FakeGitHub({
    list: JSON.stringify({ settings: [
      { name: "SESSION_SECRET", kind: "secret", why: "Keeps people signed in safely.", make: "random" },
      { name: "OPENAI_API_KEY", kind: "secret", why: "Lets your app write answers." },
    ] }),
  }).start());
  const b = own(await startBoard(gh));
  const s = await settings(b);
  const by = Object.fromEntries((s.data?.items ?? []).map((i) => [i.name, i]));
  r.check(by.SESSION_SECRET?.can_make === true, "the make-one entry offers the button");
  r.check(by.OPENAI_API_KEY?.can_make === false, "an entry without make: random does not");

  const m1 = await b.post("/api/settings", { name: "SESSION_SECRET", make: true });
  const m2 = await b.post("/api/settings", { name: "SESSION_SECRET", make: true });
  r.check(m1.status === 200 && m2.status === 200, `make saves without typing (${m1.status}, ${m2.status})`);
  const [o1, o2] = gh.opened;
  r.check(gh.opened.length === 2 && o1.name === "SESSION_SECRET", `each make sends one sealed secret (${gh.opened.length})`);
  r.check(bytesOf(o1?.value) === 32 && bytesOf(o2?.value) === 32, `the value is 32 random bytes (${o1?.value?.length} chars -> ${bytesOf(o1?.value)} bytes)`);
  const lib = openSealLibsodium(o1?.encrypted_value ?? "", gh.keys);
  if (lib.ok) r.check(lib.value === o1?.value, "libsodium opens the made value too");
  else r.note(lib.why);
  r.check(o1?.value !== o2?.value, "two makes give different values");
  r.check(![o1?.value, o2?.value].some((v) => v && (m1.text + m2.text + b.output).includes(v)), "the made value is not returned or logged");
  const after = await settings(b);
  r.check(![o1?.value, o2?.value].some((v) => v && after.text.includes(v)) && after.data?.items?.[0]?.is_set === true, "afterwards it shows as set, without the value");
  // Not in the spec: what make does on an entry without make: "random". Reported, not judged.
  const n = gh.opened.length;
  const odd = await b.post("/api/settings", { name: "OPENAI_API_KEY", make: true });
  r.note(`make on an entry without make: random -> ${odd.status} ${odd.text}, ${gh.opened.length - n} sent`);
  r.check(b.netAttempts().length === 0, "no attempt to reach the internet");
});
