#!/usr/bin/env node
// AC4: after sign-in the page lists the projects the user gave the board access to, with a link to give
// access to more, and a box to type owner/name. The choice is saved; "Change project" brings the list back.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Board, CLIENT_ID, FakeGitHub, JARGON, TOKEN, run, tmpdir } from "./lib.mjs";

function signedIn(home) {
  const dir = path.join(home, ".config", "team-board");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ token: TOKEN }), { mode: 0o600 });
  return path.join(dir, "config.json");
}

await run("AC4 pick a project", async (r, own) => {
  const gh = own(await new FakeGitHub().start());
  const env = { BOARD_GITHUB_CLIENT_ID: CLIENT_ID, BOARD_GITHUB_APP_SLUG: "team-progress-board" };
  const home = path.join(tmpdir("home"), "home");
  const cfg = signedIn(home);
  const empty = tmpdir("cwd"); // not a project folder
  const b = own(await Board.start([], { github: gh, env, home, cwd: empty }));

  let st = await b.json("/api/status");
  r.check(st.signed_in === true && st.repo === "", `AC4 signed in with no project yet, so the list is due (${JSON.stringify(st)})`);
  const list = await b.json("/api/projects");
  const names = (list.projects ?? []).map((p) => p.repo);
  r.check(JSON.stringify(names) === JSON.stringify(["acme/garden", "acme/secret-shed"]), `AC4 lists the projects the board was given access to (${JSON.stringify(list)})`);
  r.check(typeof st.install_url === "string" && st.install_url.startsWith("https://github.com/apps/team-progress-board/"),
    `AC4 a link to give the board access to more (${st.install_url})`);

  // Typed names: owner/name is accepted; anything else is refused in plain words and not saved.
  for (const bad of ["", "acme", "acme/", "/garden", "acme/garden/extra", "acme garden/x", "../../etc", "https://github.com/acme/garden"]) {
    const q = await b.post("/api/project", { repo: bad });
    const saved = JSON.parse(fs.readFileSync(cfg, "utf8"));
    r.check(q.status === 400 && !saved.repo && typeof q.data?.error === "string" && !JARGON.test(q.data.error),
      `AC4 typed ${JSON.stringify(bad)} is refused in plain words and not saved (${q.status} ${q.text})`);
  }
  let q = await b.post("/api/project", { repo: "acme/garden" });
  r.check(q.status === 200, `AC4 picking acme/garden is accepted (${q.status} ${q.text})`);
  r.check(JSON.parse(fs.readFileSync(cfg, "utf8")).repo === "acme/garden", "AC4 the choice is saved in the settings file");
  let board = await b.json("/api/board");
  r.check(board.repo === "acme/garden" && JSON.stringify(board).includes("Garden first ticket"), `AC4 the board shows the picked project (${board.repo}, error ${JSON.stringify(board.error)})`);

  // Change project: the list is still there, and a new pick is shown.
  r.check(((await b.json("/api/projects")).projects ?? []).length === 2, "AC4 after a pick the list can be shown again (Change project)");
  q = await b.post("/api/project", { repo: " acme/other " });
  board = await b.json("/api/board");
  r.check(q.status === 200 && board.repo === "acme/other" && JSON.stringify(board).includes("Other project ticket"),
    `AC4 changing project shows the new one at once, not a cached board (${board.repo})`);

  // Saved across a restart.
  b.stop();
  await b.exited;
  const b2 = own(await Board.start([], { github: gh, env, home, cwd: empty }));
  st = await b2.json("/api/status");
  r.check(st.repo === "acme/other", `AC4 the choice is remembered after a restart (${st.repo})`);

  // npx run from inside a project folder (its git remote is acme/garden): a pick must still be shown.
  const proj = tmpdir("proj");
  execFileSync("git", ["init", "-q", proj]);
  execFileSync("git", ["-C", proj, "remote", "add", "origin", "https://github.com/acme/garden.git"]);
  const home3 = path.join(tmpdir("home"), "home");
  signedIn(home3);
  const b3 = own(await Board.start([], { github: gh, env, home: home3, cwd: proj }));
  st = await b3.json("/api/status");
  r.check(st.repo === "acme/garden", `AC4 started in a project folder, it shows that project first (${st.repo})`);
  q = await b3.post("/api/project", { repo: "acme/other" });
  board = await b3.json("/api/board");
  st = await b3.json("/api/status");
  r.check(q.status === 200 && board.repo === "acme/other" && st.repo === "acme/other",
    `AC4 started in a project folder, "Change project" to acme/other shows acme/other (got status ${q.status}, board ${board.repo}, status.repo ${st.repo})`);

  r.check([b, b2, b3].every((x) => x.netAttempts().length === 0), "no attempt to reach the internet");
});
