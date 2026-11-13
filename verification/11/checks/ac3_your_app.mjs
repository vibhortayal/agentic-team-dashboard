#!/usr/bin/env node
// AC3 Your app: live link (latest successful production deployment), live version (latest published release,
// date, first lines of notes), a draft as the version waiting to go live, up to 5 earlier versions; with none,
// the app isn't online yet. Read from /api/board (board.app); page.mjs checks the words on the page.
import { Board, FakeGitHub, REPO, deploy, item, release, run } from "./lib.mjs";

await run("AC3 your app", async (r, own) => {
  async function app(why, data) {
    const gh = own(await new FakeGitHub([item(1, "Seed list", ["stage:building", "role:implementer"])], {}, data).start());
    const b = own(await Board.start(["--repo", REPO], { github: gh, env: { GITHUB_TOKEN: "x" } }));
    const bb = await b.board();
    b.stop(); gh.stop();
    r.check(!bb.error && (bb.columns ?? []).some((c) => (c.cards ?? []).length), `${why}: the board still shows (error ${JSON.stringify(bb.error)})`);
    return bb.app ?? {};
  }
  const names = (a, state) => (a.versions ?? []).filter((v) => v.state === state).map((v) => v.name);

  { // live link
    const a = await app("live link", { deployments: [
      deploy({ env: "Production", url: "https://garden-v1.example", day: 8 }),
      deploy({ env: "Production", url: "https://garden-v2.example", day: 9 }),
      deploy({ env: "Production", url: "https://garden-broken.example", day: 10, states: ["in_progress", "failure"] }),
      deploy({ env: "Preview", url: "https://preview.example", day: 11 }),
    ] });
    r.check(a.live_url === "https://garden-v2.example", `AC3 the live link is the latest successful production deployment (got ${JSON.stringify(a.live_url)})`);
    const p = await app("live link, production by flag", { deployments: [deploy({ env: "garden-main", production: true, url: "https://garden-flag.example" })] });
    console.log(`  note an environment marked production_environment but not named production: live_url ${JSON.stringify(p.live_url)}`);
    const q = await app("only a preview", { deployments: [deploy({ env: "Preview", url: "https://preview.example" })] });
    r.check(!q.live_url, `AC3 a preview is never the live link (got ${JSON.stringify(q.live_url)})`);
    const h = await app("http live", { deployments: [deploy({ env: "Production", url: "http://garden.example" })] });
    console.log(`  note an http production link: data live_url ${JSON.stringify(h.live_url)} (page.mjs checks it is not a link)`);
  }

  { // versions
    const published = ["v1.0", "v1.1", "v1.2", "v1.3", "v1.4", "v1.5", "v1.6", "v1.7"].map((t, k) =>
      release(t, { day: k + 1, body: `## What changed\n\n- **Faster** seed list for ${t}\n- Second line\n\nThird paragraph that is long.` }));
    const draft = release("v2.0", { draft: true, day: 20, body: "Bigger buttons." });
    const a = await app("versions", { releases: [...published, draft] });
    const live = (a.versions ?? []).filter((v) => v.state === "live");
    r.check(live.length === 1 && live[0].name.includes("v1.7"), `AC3 the live version is the latest published release (got ${JSON.stringify(names(a, "live"))})`);
    r.check(live[0]?.at && live[0].at.startsWith("2026-10-08"), `AC3 the live version has its date (got ${JSON.stringify(live[0]?.at)})`);
    const notes = String(live[0]?.notes ?? "");
    r.check(/Faster seed list for v1\.7/.test(notes) && !/\*\*|##|(^|\n)\s*-\s/.test(notes), `AC3 the live version shows the first lines of its notes, plain (got ${JSON.stringify(notes)})`);
    r.check(JSON.stringify(names(a, "waiting")) === JSON.stringify(["v2.0"]) || names(a, "waiting").every((n) => n.includes("v2.0")) && names(a, "waiting").length === 1,
      `AC3 the draft is the version waiting to go live (got ${JSON.stringify(names(a, "waiting"))})`);
    r.check(!names(a, "live").some((n) => n.includes("v2.0")) && !names(a, "earlier").some((n) => n.includes("v2.0")), "AC3 the draft is not live or earlier");
    const earlier = names(a, "earlier");
    r.check(earlier.length === 5 && ["v1.6", "v1.5", "v1.4", "v1.3", "v1.2"].every((t, k) => earlier[k]?.includes(t)),
      `AC3 up to 5 earlier versions, newest first (got ${JSON.stringify(earlier)})`);
    const b = await app("three versions", { releases: published.slice(0, 3) });
    r.check(names(b, "earlier").length === 2 && names(b, "live").length === 1 && names(b, "waiting").length === 0,
      `AC3 three published releases: live and 2 earlier (got live ${JSON.stringify(names(b, "live"))}, earlier ${JSON.stringify(names(b, "earlier"))})`);
    const d = await app("draft only", { releases: [draft] });
    r.check(names(d, "live").length === 0 && names(d, "waiting").length === 1, `AC3 a draft alone is waiting, not live (got ${JSON.stringify(d.versions)})`);
  }

  { // nothing yet
    const a = await app("nothing", {});
    r.check(!a.live_url && !(a.versions ?? []).length, `AC3 no deployments and no releases: no live link and no versions (page.mjs checks the words) (got ${JSON.stringify(a)})`);
  }
});
