#!/usr/bin/env node
// AC2: a secret is locked with the project's public key (sealed box) before it leaves the board's server and
// sent once; it opens only with GitHub's private key; the board never returns, logs or shows it; a saved secret
// can be replaced, not shown.
import nacl from "tweetnacl";
import { B64, FakeGitHub, filesUnder, openSeal, openSealLibsodium, run, settings, startBoard } from "./lib.mjs";

const V1 = "sk-verifier-FIRST-6f1c0a9e2b7d4c3a";
const V2 = "sk-verifier-SECOND-ünïcødé-🔑-0b8e";

await run("AC2 secrets stay secret", async (r, own) => {
  const gh = own(await new FakeGitHub({
    list: JSON.stringify({ settings: [
      { name: "OPENAI_API_KEY", kind: "secret", why: "Lets your app write answers.", get: "https://platform.example.com/keys" },
      { name: "STRIPE_KEY", kind: "secret", why: "Takes payments.", value: "LISTVALUE-should-never-show" },
    ] }),
  }).start());
  const b = own(await startBoard(gh));
  const answers = [];

  const s1 = await b.post("/api/settings", { name: "OPENAI_API_KEY", value: V1 });
  answers.push(s1.text);
  r.check(s1.status === 200, `save from the board's page works (${s1.status} ${s1.text})`);
  const puts1 = gh.calls.filter((c) => c.method === "PUT");
  r.check(puts1.length === 1 && puts1[0].path === "/repos/acme/garden/actions/secrets/OPENAI_API_KEY", `sent once, to the secret's address (${puts1.map((c) => c.path)})`);
  const o1 = gh.opened[0];
  r.check(o1?.key_id === gh.keyId, `sent with the project's key id (${o1?.key_id})`);
  r.check(o1?.value === V1, `the sealed value opens with GitHub's private key to exactly the value (tweetnacl)`);
  const lib1 = openSealLibsodium(o1?.encrypted_value ?? "", gh.keys);
  if (lib1.ok) r.check(lib1.value === V1, `libsodium (PyNaCl SealedBox) opens it to exactly the value (${lib1.err ?? "ok"})`);
  else r.note(lib1.why);
  const other = nacl.box.keyPair();
  r.check(openSeal(o1?.encrypted_value ?? "", other) === null, "another private key can't open it");
  const lib1b = openSealLibsodium(o1?.encrypted_value ?? "", other);
  if (lib1b.ok) r.check(lib1b.value === null, "libsodium with another private key can't open it either");
  const allRaw = gh.calls.map((c) => c.path + " " + c.raw).join("\n");
  r.check(!allRaw.includes(V1) && !allRaw.includes(B64(V1)) && !allRaw.includes(encodeURIComponent(V1)), "the plain value is in no request GitHub got");
  const body = JSON.parse(puts1[0]?.raw ?? "{}");
  r.check(Object.keys(body).sort().join(",") === "encrypted_value,key_id", `the PUT carries only encrypted_value and key_id (${Object.keys(body)})`);

  // Shown afterwards: set, with a date, never the value.
  const after = await settings(b);
  answers.push(after.text);
  const it = after.data?.items?.find((i) => i.name === "OPENAI_API_KEY");
  r.check(it?.is_set === true && !!it?.updated_at, `after saving it shows as set, with when it changed (${it?.is_set}, ${it?.updated_at})`);
  r.check(it?.value === null || it?.value === undefined, `a secret's value is never in the list (${it?.value})`);
  const stripe = after.data?.items?.find((i) => i.name === "STRIPE_KEY");
  r.check(!after.text.includes("LISTVALUE"), `a value written into Ella's list for a secret is not shown (${stripe?.value})`);

  // Replace: a new value goes, sealed, once; the old one is never returned.
  const s2 = await b.post("/api/settings", { name: "OPENAI_API_KEY", value: V2 });
  answers.push(s2.text);
  const puts2 = gh.calls.filter((c) => c.method === "PUT");
  r.check(s2.status === 200 && puts2.length === 2, `a saved secret can be replaced (${s2.status}, ${puts2.length} PUTs in all)`);
  r.check(gh.opened[1]?.value === V2, "the replacement opens to the new value, non-ASCII included");
  const lib2 = openSealLibsodium(gh.opened[1]?.encrypted_value ?? "", gh.keys);
  if (lib2.ok) r.check(lib2.value === V2, "libsodium opens the replacement to the new value");
  r.check(gh.opened[0]?.encrypted_value !== gh.opened[1]?.encrypted_value, "each seal is fresh");
  answers.push((await settings(b)).text);

  // Two saves at once: each goes once and opens to its own value.
  gh.list = JSON.stringify({ settings: [
    { name: "OPENAI_API_KEY", kind: "secret", why: "w" }, { name: "MAIL_KEY", kind: "secret", why: "w" } ] });
  const [c1, c2] = await Promise.all([b.post("/api/settings", { name: "OPENAI_API_KEY", value: "concurrent-one" }),
    b.post("/api/settings", { name: "MAIL_KEY", value: "concurrent-two" })]);
  answers.push(c1.text, c2.text);
  const byName = Object.fromEntries(gh.opened.slice(2).map((o) => [o.name, o.value]));
  r.check(c1.status === 200 && c2.status === 200 && byName.OPENAI_API_KEY === "concurrent-one" && byName.MAIL_KEY === "concurrent-two" && gh.opened.length === 4,
    `two saves at once each go once, to the right name (${JSON.stringify(byName)})`);

  // Sent once even when GitHub fails.
  gh.fail.put = 500;
  const before = gh.calls.filter((c) => c.method === "PUT").length;
  const f = await b.post("/api/settings", { name: "MAIL_KEY", value: "fails-once-value" });
  answers.push(f.text);
  const puts3 = gh.calls.filter((c) => c.method === "PUT").length - before;
  r.check(f.status >= 400 && puts3 === 1, `when GitHub fails it is still sent once (${f.status}, ${puts3} PUT)`);
  delete gh.fail.put;

  const secretsSent = [V1, V2, "concurrent-one", "concurrent-two", "fails-once-value"];
  const leaks = (text) => secretsSent.filter((v) => text.includes(v) || text.includes(B64(v)));
  r.check(leaks(answers.join("\n")).length === 0, `no answer from the board holds a value (${leaks(answers.join("\n"))})`);
  r.check(leaks(b.output).length === 0, `the board's output holds no value (${leaks(b.output)})`);
  const files = { ...filesUnder(b.home), ...filesUnder(b.tmp) };
  const inFiles = Object.entries(files).filter(([, t]) => leaks(t).length);
  r.check(inFiles.length === 0, `no file under HOME or the run folder holds a value (${inFiles.map(([p]) => p)})`);
  r.check(b.netAttempts().length === 0, "no attempt to reach the internet");
});
