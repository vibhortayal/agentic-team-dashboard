#!/usr/bin/env node
// AC6: no permission, an expired sign-in, an empty or over-long value, and GitHub being down each give one
// plain sentence; none repeats the value.
import http from "node:http";
import { FakeGitHub, JARGON, run, sentences, settings, startBoard } from "./lib.mjs";

// "One plain sentence": checked as a short plain message with no codes; more than one sentence is a note,
// as in #10's checks of the same words.
const plain = (r, what, res, value) => {
  const msg = res.data?.error ?? "";
  if (sentences(msg) > 1) r.note(`${what}: ${sentences(msg)} sentences: "${msg}"`);
  r.check(res.status >= 400 && typeof msg === "string" && msg.length > 0 && msg.length <= 160 && !JARGON.test(msg)
    && (!value || !msg.includes(value)) && !res.text.includes(value || "\u0000"),
    `${what}: one plain sentence without the value (${res.status} "${msg}")`);
  return msg;
};

// Big bodies go on their own connection: a body the board refuses unread can break the next request on a kept-alive one.
function post(b, body) {
  const text = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = http.request({ host: "127.0.0.1", port: b.port, method: "POST", path: "/api/settings", agent: false,
      headers: { Origin: b.origin(), "Content-Type": "application/json", Connection: "close", "Content-Length": Buffer.byteLength(text) } }, (res) => {
      let t = ""; res.on("data", (d) => (t += d)); res.on("end", () => { let data = null; try { data = JSON.parse(t); } catch {} resolve({ status: res.statusCode, text: t, data }); });
    });
    req.on("error", (e) => resolve({ status: 0, text: String(e), data: null }));
    req.end(text);
  });
}

await run("AC6 plain problems", async (r, own) => {
  const gh = own(await new FakeGitHub({
    list: JSON.stringify({ settings: [
      { name: "OPENAI_API_KEY", kind: "secret", why: "Lets your app write answers." },
      { name: "APP_COLOUR", kind: "variable", why: "Colour." },
    ] }),
  }).start());
  const b = own(await startBoard(gh));
  const msgs = {};
  let k = 0;
  for (const [route, code, kind] of [["put", 403, "permission"], ["put", 401, "signin"], ["put", 500, "down"], ["put", 503, "down"], ["put", "reset", "down"],
    ["key", 403, "permission"], ["key", 401, "signin"], ["key", 500, "down"], ["key", "reset", "down"],
    ["patch", 403, "permission"], ["patch", 401, "signin"], ["patch", 500, "down"]]) {
    gh.fail = { [route]: code };
    k += 1;
    const name = route === "patch" ? "APP_COLOUR" : "OPENAI_API_KEY";
    const value = `problem-value-${k}-zq9`;
    const res = await b.post("/api/settings", { name, value });
    const m = plain(r, `GitHub ${code} on ${route}`, res, value);
    (msgs[kind] ??= new Set()).add(m);
  }
  gh.fail = {};
  const perm = [...msgs.permission].join(" | "), sign = [...msgs.signin].join(" | "), down = [...msgs.down].join(" | ");
  r.check(/permission|allow|access|isn't allowed|can't change/i.test(perm), `no permission says so (${perm})`);
  r.check(/sign/i.test(sign), `an expired sign-in says to sign in again (${sign})`);
  r.check(![...msgs.signin].some((m) => msgs.permission.has(m)), "expired sign-in and no permission read differently");
  r.check(/GitHub|internet|reach|try again/i.test(down), `GitHub down says so (${down})`);

  const before = gh.writes().length;
  for (const [what, value] of [["an empty value", ""], ["no value at all", undefined]]) {
    const res = await b.post("/api/settings", value === undefined ? { name: "OPENAI_API_KEY" } : { name: "OPENAI_API_KEY", value });
    plain(r, what, res, "");
  }
  const sp = await b.post("/api/settings", { name: "OPENAI_API_KEY", value: "   \n " });
  r.note(`a value of only spaces -> ${sp.status} ${sp.text}`);
  // A long real key (a service account JSON is ~2.3 KB) still goes.
  const longKey = "k".repeat(4000);
  const lk = await b.post("/api/settings", { name: "OPENAI_API_KEY", value: longKey });
  r.check(lk.status === 200 && gh.opened.at(-1)?.value === longKey, `a 4000-character key is still saved (${lk.status} ${lk.text})`);
  // The spec names no length. The board's own limit (found by hand: 8 000 saved, 8 001 refused) and GitHub's
  // 48 KB secret limit: every over-long value must get a plain sentence and reach nothing on GitHub. Each big
  // request goes on its own connection (see the note in README.md on kept-alive connections).
  const at8000 = await post(b, { name: "OPENAI_API_KEY", value: "z".repeat(8000) });
  r.note(`8000 characters -> ${at8000.status} ${at8000.text}`);
  const lim = gh.writes().length;
  for (const [what, value] of [["8 001 characters", "z".repeat(8001)], ["a value of 12 000 characters", "w".repeat(12000)], ["a value one byte over GitHub's 48 KB limit", "x".repeat(48 * 1024 + 1)], ["a 1 MB value", "y".repeat(1024 * 1024)]]) {
    const res = await post(b, { name: "OPENAI_API_KEY", value });
    const m1 = plain(r, what, res, value.slice(0, 64));
    r.check(/long/i.test(m1), `${what}: the sentence says the value is too long ("${m1}")`);
    const res2 = await post(b, { name: "APP_COLOUR", value });
    const m2 = plain(r, what + " (variable)", res2, value.slice(0, 64));
    r.check(/long/i.test(m2), `${what} (variable): the sentence says the value is too long ("${m2}")`);
  }
  r.check(gh.writes().length === lim, `empty and over-long values reach nothing on GitHub (${gh.writes().length - lim} writes)`);

  // Reading the list: plain sentences too.
  for (const [route, code] of [["contents", 401], ["contents", 403], ["contents", 500], ["contents", "reset"], ["secrets", 403], ["variables", 500]]) {
    gh.fail = { [route]: code };
    const s = await settings(b);
    const msg = s.data?.problem ?? s.data?.error ?? "";
    if (sentences(msg) > 1) r.note(`reading with ${code} on ${route}: ${sentences(msg)} sentences`);
    r.check(typeof msg === "string" && msg.length > 0 && msg.length <= 160 && !JARGON.test(msg),
      `reading the list with GitHub ${code} on ${route}: one plain sentence (${s.status} "${msg}")`);
  }
  gh.fail = {};
  r.check(!b.output.includes("problem-value-") && !b.output.includes(longKey), "no value in the board's output");
  r.check(b.netAttempts().length === 0, "no attempt to reach the internet");
});
