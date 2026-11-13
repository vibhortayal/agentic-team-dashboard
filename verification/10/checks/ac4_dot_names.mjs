#!/usr/bin/env node
// Round 2 (changed code only): a typed project name whose owner or name is "." or ".." is refused and not
// saved, since it would point at another GitHub address. Names that merely contain dots still work.
import fs from "node:fs";
import path from "node:path";
import { Board, CLIENT_ID, FakeGitHub, TOKEN, run, tmpdir } from "./lib.mjs";

await run("AC4 dot names", async (r, own) => {
  const gh = own(await new FakeGitHub().start());
  const home = path.join(tmpdir("home"), "home");
  const dir = path.join(home, ".config", "team-board");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const cfg = path.join(dir, "config.json");
  fs.writeFileSync(cfg, JSON.stringify({ token: TOKEN }), { mode: 0o600 });
  const b = own(await Board.start([], { github: gh, env: { BOARD_GITHUB_CLIENT_ID: CLIENT_ID }, home, cwd: tmpdir("cwd") }));
  for (const bad of ["../etc", "acme/..", "./.", "../..", "./garden", "acme/."]) {
    const q = await b.post("/api/project", { repo: bad });
    const saved = JSON.parse(fs.readFileSync(cfg, "utf8"));
    r.check(q.status === 400 && !saved.repo, `typed ${JSON.stringify(bad)} is refused and not saved (${q.status})`);
  }
  for (const ok of ["acme/.github", "acme/garden.js", "a.b/c"]) {
    const q = await b.post("/api/project", { repo: ok });
    r.check(q.status === 200, `typed ${JSON.stringify(ok)} is accepted (${q.status} ${q.text})`);
  }
  r.check(b.netAttempts().length === 0, "no attempt to reach the internet");
});
