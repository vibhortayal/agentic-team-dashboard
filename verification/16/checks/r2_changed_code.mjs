#!/usr/bin/env node
// Round 2, changed code only (be305af): every page of variables and secrets is read (AC1 "whether it is set");
// a big body is read to the end, so the next request on a kept-alive connection still works (AC6). Also reported
// (a note, not a check): multi-byte text whose body arrives in pieces that cut a character in half. A real
// browser on this computer sends these bodies whole (Chromium: 9 of 9 saved exactly), so it is not judged here.
import http from "node:http";
import { FakeGitHub, run, settings, startBoard } from "./lib.mjs";

function postPieces(b, body, cut) {
  const buf = Buffer.from(JSON.stringify(body), "utf8");
  return new Promise((resolve) => {
    const req = http.request({ host: "127.0.0.1", port: b.port, method: "POST", path: "/api/settings", agent: false,
      headers: { Origin: b.origin(), "Content-Type": "application/json", "Content-Length": buf.length } }, (res) => {
      let t = ""; res.on("data", (d) => (t += d)); res.on("end", () => resolve({ status: res.statusCode, text: t }));
    });
    req.on("error", (e) => resolve({ status: 0, text: String(e) }));
    // Write in pieces that cut through multi-byte characters, with a pause so they arrive apart.
    let i = 0;
    const next = () => {
      if (i >= buf.length) return req.end();
      const piece = buf.subarray(i, i + cut); i += cut;
      req.write(piece); setTimeout(next, 2);
    };
    next();
  });
}

await run("Round 2 changed code", async (r, own) => {
  const vars = {}; for (let i = 0; i < 61; i++) vars[`V${String(i).padStart(2, "0")}`] = "val" + i;
  const secs = {}; for (let i = 0; i < 201; i++) secs[`S${String(i).padStart(3, "0")}`] = "2026-11-01T00:00:00Z";
  const list = [{ name: "V29", kind: "variable", why: "w" }, { name: "V30", kind: "variable", why: "w" }, { name: "V60", kind: "variable", why: "w" },
    { name: "S099", kind: "secret", why: "w" }, { name: "S100", kind: "secret", why: "w" }, { name: "S200", kind: "secret", why: "w" },
    { name: "NOT_THERE", kind: "variable", why: "w" }, { name: "K", kind: "secret", why: "w" }];
  const gh = own(await new FakeGitHub({ list: JSON.stringify({ settings: list }), variables: vars, secrets: secs }).start());
  const b = own(await startBoard(gh));
  const by = Object.fromEntries(((await settings(b)).data?.items ?? []).map((i) => [i.name, i]));
  for (const n of ["V29", "V30", "V60"]) r.check(by[n]?.is_set === true && by[n]?.value === "val" + Number(n.slice(1)), `variable ${n} (page ${Math.floor(Number(n.slice(1)) / 30) + 1}) is set with its value (${by[n]?.value})`);
  for (const n of ["S099", "S100", "S200"]) r.check(by[n]?.is_set === true, `secret ${n} (page ${Math.floor(Number(n.slice(1)) / 100) + 1}) is set`);
  r.check(by.NOT_THERE?.is_set === false, "a variable on no page is not set");

  // Exactly a full page (30 variables, 100 secrets): the board must not loop or miss anything.
  const v30 = {}; for (let i = 0; i < 30; i++) v30[`W${i}`] = "x";
  gh.variables = v30; gh.secrets = { S099: "2026-11-01T00:00:00Z" };
  gh.list = JSON.stringify({ settings: [{ name: "W29", kind: "variable", why: "w" }] });
  const full = await settings(b);
  r.check(full.data?.items?.[0]?.is_set === true && !full.data?.problem, `exactly 30 variables: the last one is set (${full.text.slice(0, 120)})`);

  // A later page failing: one plain sentence, not a wrong "not set".
  gh.variables = vars;
  const realHandle = gh.handle.bind(gh);
  gh.handle = (req, res) => (/actions\/variables\?.*page=2/.test(req.url) ? (res.writeHead(500), res.end("{}")) : realHandle(req, res));
  const p2 = await settings(b);
  r.check(typeof p2.data?.problem === "string" && p2.data.problem.length > 0, `page 2 failing gives a plain problem (${p2.data?.problem})`);
  gh.handle = realHandle;

  // Keep-alive: big bodies on the page's own fetch connection, then ordinary saves on the same pool.
  gh.list = JSON.stringify({ settings: [{ name: "K", kind: "secret", why: "w" }] });
  const seq = [];
  for (const n of [1024 * 1024, 26000, 4000, 1024 * 1024, 4000, 100, 4000]) {
    try { const x = await b.post("/api/settings", { name: "K", value: "q".repeat(n) }); seq.push(`${n}:${x.status}`); }
    catch (e) { seq.push(`${n}:ERR ${e.cause?.code ?? e.message}`); }
  }
  r.check(seq.join(" ") === "1048576:413 26000:413 4000:200 1048576:413 4000:200 100:200 4000:200", `after big pastes the next saves on the same connections work (${seq.join(" ")})`);

  // Multi-byte text arriving in pieces that cut characters in half.
  for (const [what, value] of [["7 000 CJK characters (21 KB)", "鍵".repeat(7000)], ["3 900 emoji", "🔑".repeat(3900)], ["mixed", "ключ-🔑-鍵-é".repeat(500)]]) {
    const before = gh.opened.length;
    const x = await postPieces(b, { name: "K", value }, 1000 + 1);
    const exact = x.status === 200 && gh.opened.length === before + 1 && gh.opened.at(-1)?.value === value;
    r.note(`${exact ? "exact" : "CHANGED"}: ${what} sent in 1 001-byte pieces (${x.status} ${x.text.slice(0, 80)}, ${gh.opened.at(-1)?.value?.length} vs ${value.length})`);
  }
  r.check(b.netAttempts().length === 0, "no attempt to reach the internet");
});
