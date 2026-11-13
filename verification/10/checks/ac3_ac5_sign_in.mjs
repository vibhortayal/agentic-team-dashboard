#!/usr/bin/env node
// AC3 (sign in with GitHub's device sign-in, refused/expired in one plain sentence, token saved only in
// the user's settings folder, readable only by them) and AC5 (sign out deletes the saved sign-in).
// The settings folder is the default one (HOME is a temp folder; BOARD_CONFIG_DIR is not set).
import fs from "node:fs";
import path from "node:path";
import { Board, CLIENT_ID, FakeGitHub, JARGON, REFRESH, TOKEN, filesUnder, mode, run, sentences } from "./lib.mjs";

await run("AC3/AC5 sign in", async (r, own) => {
  const gh = own(await new FakeGitHub().start());
  const env = { BOARD_GITHUB_CLIENT_ID: CLIENT_ID };
  const b = own(await Board.start([], { github: gh, env, cwd: path.join("/", "tmp") }));
  const cfgDir = path.join(b.home, ".config", "team-board");
  const cfg = path.join(cfgDir, "config.json");

  // No saved sign-in, no GITHUB_TOKEN, gh not signed in: the page must ask to sign in.
  let st = await b.json("/api/status");
  r.check(st.signed_in === false && st.can_sign_in === true, `AC3 not signed in at first and sign-in offered (${JSON.stringify(st)})`);

  // Start: a code to copy and the GitHub page to open.
  let s = await b.post("/api/signin/start");
  r.check(s.status === 200 && s.data?.user_code === gh.deviceStart.user_code, `AC3 start gives the code to copy (${s.status} ${s.text})`);
  r.check(s.data?.verification_uri === "https://github.com/login/device", `AC3 start gives the GitHub page to open (${s.data?.verification_uri})`);
  const startCall = gh.calls.find((c) => c.path === "/login/device/code");
  r.check(startCall?.body?.client_id === CLIENT_ID, `AC3 the board asks GitHub's device sign-in with its client id (${JSON.stringify(startCall?.body)})`);
  r.check(!JSON.stringify(s.data).includes("dev-123"), "AC3 the secret device code is not handed to the page");

  // Checks every few seconds until GitHub says yes, without asking GitHub faster than it allows (interval 5 s).
  let p = await b.post("/api/signin/poll");
  r.check(p.data?.state === "pending", `AC3 first check: still waiting (${p.text})`);
  const n1 = gh.tokenCalls().length;
  p = await b.post("/api/signin/poll");
  r.check(p.data?.state === "pending" && gh.tokenCalls().length === n1, `AC3 a check 0 s later doesn't ask GitHub again (calls ${n1} -> ${gh.tokenCalls().length})`);
  b.advance(5);
  p = await b.post("/api/signin/poll");
  r.check(gh.tokenCalls().length === n1 + 1, `AC3 a check after GitHub's 5 s interval asks GitHub again (calls ${n1} -> ${gh.tokenCalls().length})`);
  gh.device = "slow_down";
  b.advance(5);
  await b.post("/api/signin/poll");
  const n2 = gh.tokenCalls().length;
  b.advance(6);
  await b.post("/api/signin/poll");
  r.check(gh.tokenCalls().length === n2, `AC3 after GitHub says slow down, a check 6 s later waits (calls ${n2} -> ${gh.tokenCalls().length})`);
  gh.device = "done";
  b.advance(10);
  p = await b.post("/api/signin/poll");
  r.check(p.data?.state === "done", `AC3 when GitHub says yes, the check says done (${p.text})`);
  st = await b.json("/api/status");
  r.check(st.signed_in === true && st.saved_sign_in === true, `AC3 signed in and saved afterwards (${JSON.stringify(st)})`);

  // Saved only in the user's settings folder, readable only by them.
  r.check(fs.existsSync(cfg), `AC3 sign-in saved in the settings folder (${cfg})`);
  if (fs.existsSync(cfg)) {
    const saved = JSON.parse(fs.readFileSync(cfg, "utf8"));
    r.check(saved.token === TOKEN, "AC3 the saved file holds the key GitHub gave");
    r.check(mode(cfg) === "600", `AC3 settings file is readable only by the user (mode ${mode(cfg)})`);
    r.check(mode(cfgDir) === "700", `AC3 settings folder is open only to the user (mode ${mode(cfgDir)})`);
  }
  const holders = Object.entries(filesUnder(b.tmp)) // HOME is inside the run folder
    .filter(([, t]) => t.includes(TOKEN) || t.includes(REFRESH)).map(([f]) => f);
  r.check(holders.length === 1 && holders[0].endsWith(path.join(".config", "team-board", "config.json")),
    `AC3 the key is written nowhere else under HOME or the run folder (${JSON.stringify(holders)})`);
  r.check(!b.output.includes(TOKEN), "AC3 the key is not printed to the window");
  const pages = await Promise.all(["/api/status", "/api/board", "/api/projects", "/"].map((u) => b.get(u)));
  r.check(pages.every((x) => !x.text.includes(TOKEN) && !x.text.includes(REFRESH)), "AC3 the key is never sent to the page");
  const used = gh.calls.filter((c) => c.path.startsWith("/repos/") || c.path.startsWith("/user/"));
  r.check(used.length > 0 && used.every((c) => c.auth === `Bearer ${TOKEN}`), `AC3 the board reads GitHub with the new key (${used.length} reads)`);

  // AC5: sign out deletes the saved sign-in.
  const so = await b.post("/api/signout");
  r.check(so.status === 200, `AC5 sign out answers OK (${so.status})`);
  const after = fs.existsSync(cfg) ? fs.readFileSync(cfg, "utf8") : "";
  r.check(!after.includes(TOKEN) && !after.includes(REFRESH), `AC5 the saved key and refresh key are gone from the file (${after.replace(/\s+/g, " ")})`);
  st = await b.json("/api/status");
  r.check(st.signed_in === false && st.saved_sign_in === false, `AC5 signed out afterwards (${JSON.stringify(st)})`);
  b.stop();
  await b.exited;
  const b2 = own(await Board.start([], { github: gh, env, home: b.home, cwd: "/tmp" }));
  st = await b2.json("/api/status");
  r.check(st.signed_in === false, `AC5 still signed out after the board restarts (${JSON.stringify(st)})`);

  // Refused and expired: one plain sentence each, nothing saved.
  for (const [answer, word] of [["denied", "denied"], ["expired", "expired"]]) {
    gh.device = "pending";
    await b2.post("/api/signin/start");
    gh.device = answer;
    b2.advance(6);
    const q = await b2.post("/api/signin/poll");
    const msg = q.data?.message ?? "";
    r.check(q.data?.state === word, `AC3 GitHub ${answer}: the page is told (${q.text})`);
    r.check(typeof msg === "string" && msg.split(/\s+/).length >= 4 && !JARGON.test(msg), `AC3 ${answer}: a plain sentence with no codes (${JSON.stringify(msg)})`);
    if (sentences(msg) !== 1) r.note(`AC3 ${answer}: message has ${sentences(msg)} sentences: ${JSON.stringify(msg)}`);
    r.check(!fs.existsSync(cfg) || !fs.readFileSync(cfg, "utf8").includes("token\""), `AC3 ${answer}: nothing saved`);
  }
  // The code runs out on the board's own clock (GitHub said 900 s).
  gh.device = "pending";
  await b2.post("/api/signin/start");
  b2.advance(901);
  const ex = await b2.post("/api/signin/poll");
  r.check(ex.data?.state === "expired" && !JARGON.test(ex.data?.message ?? "x"), `AC3 after 901 s the code has run out, in plain words (${ex.text})`);

  // GITHUB_TOKEN set: no sign-in screen (the clause applies only without one).
  const b3 = own(await Board.start([], { github: gh, env: { ...env, GITHUB_TOKEN: TOKEN }, cwd: "/tmp" }));
  st = await b3.json("/api/status");
  r.check(st.signed_in === true && st.saved_sign_in === false, `AC3 with GITHUB_TOKEN the board is signed in without the device sign-in (${JSON.stringify(st)})`);

  r.check([b, b2, b3].every((x) => x.netAttempts().length === 0), "no attempt to reach the internet");
});
