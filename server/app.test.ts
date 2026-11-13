// #11: the board shows the app (versions, live link, previews) and the ask, never GitHub.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { readApp } from "./github.ts";
import { buildApp, buildBoard, buildCard, plainMessage, type AppData, type GhComment, type GhItem } from "./model.ts";

const U = "https://github.com/o/r";
const pr = (n: number, labels: string[]): GhItem => ({ number: n, title: `Change ${n}`, labels: labels.map((name) => ({ name })), state: "open", html_url: `${U}/pull/${n}`, comments: 1, pull_request: {} });
const comment = (body: string, ev: object, at = "2026-11-12T10:00:00Z"): GhComment =>
  ({ html_url: `${U}/pull/1#c`, created_at: at, body: `${body}\n\n<!-- team-event ${JSON.stringify(ev)} -->` });

describe("AC2 the ask, in plain words", () => {
  it("drops the header, evidence line, code, Markdown and hidden data", () => {
    const body = "**Priya (product-manager) → owner** · handoff\n\nThe **sign-up** page is ready. See [the plan](https://github.com/o/r/blob/x.md).\n\n- Try it on a phone\n\nRows: AC1 · Revision: abc\n\n```\nnpm test\n```\n<!-- team-event {\"x\":1} -->";
    const t = plainMessage(body);
    expect(t).toBe("The sign-up page is ready. See the plan.\n\n• Try it on a phone");
    expect(t).not.toMatch(/github\.com|Revision|npm|team-event|\*\*/);
  });
  it("cuts long messages at 600 characters with …", () => {
    const t = plainMessage("word ".repeat(400));
    expect(t.length).toBeLessThanOrEqual(600);
    expect(t.endsWith("…")).toBe(true);
  });
  it("a waiting card carries the latest message to the owner", () => {
    const c = buildCard(pr(1, ["needs-human", "human:merge", "stage:review"]), [
      comment("**Vera (verifier) → Priya (product-manager)** · verdict\n\nAll good.", { from: "verifier", to: "product-manager", kind: "verdict", verdict: "PASS" }, "2026-11-12T09:00:00Z"),
      comment("**Priya (product-manager) → owner** · handoff\n\nPlease try the sign-up page.", { from: "product-manager", to: "owner", kind: "handoff", human: "human:merge" }),
    ]);
    expect(c.ask).toBe("Please try the sign-up page.");
  });
});

describe("AC1 Try it", () => {
  const app: AppData = {
    releases: [],
    pulls: [{ number: 1, head_ref: "team/1-x", head_sha: "aaa" }],
    deployments: [
      { environment: "Preview", ref: "team/1-x", sha: "old", url: "https://old.example.com", at: "2026-11-12T08:00:00Z", ok: true },
      { environment: "Preview", ref: "team/1-x", sha: "aaa", url: "https://new.example.com", at: "2026-11-12T09:00:00Z", ok: true },
      { environment: "Preview", ref: "team/1-x", sha: "bbb", url: "https://broken.example.com", at: "2026-11-12T10:00:00Z", ok: false },
      { environment: "Production", ref: "team/1-x", sha: "aaa", url: "https://live.example.com", at: "2026-11-12T11:00:00Z", ok: true },
    ],
  };
  it("uses the newest successful preview deployment of the pull request", () => {
    expect(buildCard(pr(1, ["stage:review", "needs-human"]), [], app).try_url).toBe("https://new.example.com");
  });
  it("falls back to a preview in the team's comments", () => {
    const c = buildCard(pr(2, ["stage:review", "needs-human"]), [comment("x", { from: "implementer", kind: "handoff", preview: "https://p2.example.com" })], app);
    expect(c.try_url).toBe("https://p2.example.com");
  });
  it("a change that isn't waiting for the person gets no link", () => {
    expect(buildCard(pr(1, ["stage:review"]), [], app).try_url).toBeNull();
  });
  it("no preview, no link", () => {
    expect(buildCard(pr(3, ["stage:review", "needs-human"]), [], app).try_url).toBeNull();
  });
});

describe("AC3 Your app", () => {
  it("shows the live link, the version waiting for an OK, the live one and earlier ones", () => {
    const v = buildApp({
      pulls: [],
      deployments: [{ environment: "production", ref: "main", sha: "a", url: "https://live.example.com", at: "2026-11-12T11:00:00Z", ok: true }],
      releases: [
        { tag_name: "v0.3.0", draft: true, created_at: "2026-11-13T00:00:00Z", body: "Sign-up page" },
        { tag_name: "v0.1.0", name: "Version 0.1", published_at: "2026-11-01T00:00:00Z", body: "First" },
        { tag_name: "v0.2.0", name: "Version 0.2", published_at: "2026-11-10T00:00:00Z", body: "## New\n- Home page" },
        { tag_name: "v0.2.1-beta", prerelease: true, published_at: "2026-11-11T00:00:00Z" },
      ],
    });
    expect(v.live_url).toBe("https://live.example.com");
    expect(v.versions.map((x) => [x.name, x.state])).toEqual([["v0.3.0", "waiting"], ["Version 0.2", "live"], ["Version 0.1", "earlier"]]);
    expect(v.versions[1].notes).toBe("New\n• Home page");
  });
  it("with nothing, there is no app yet", () => {
    expect(buildApp({ releases: [], deployments: [], pulls: [] })).toEqual({ live_url: null, live_at: null, versions: [] });
  });
  it("an error board shows no app data", () => {
    expect(buildBoard("o/r", [], new Map(), "now", "oops", { releases: [{ name: "v1", published_at: "x" }], deployments: [], pulls: [] }).app.versions).toEqual([]);
  });
});

describe("AC5 optional reads", () => {
  let close: (() => void) | null = null;
  afterEach(() => { close?.(); delete process.env.BOARD_GITHUB_API; });

  async function fake(handler: (path: string) => [number, unknown]) {
    const calls: string[] = [];
    const srv = createServer((req, res) => {
      calls.push(req.url ?? "");
      const [code, body] = handler(new URL(req.url ?? "/", "http://x").pathname);
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    close = () => srv.close();
    process.env.BOARD_GITHUB_API = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
    return calls;
  }

  it("returns nothing, without throwing, when GitHub refuses every read", async () => {
    await fake(() => [404, { message: "Not Found" }]);
    expect(await readApp("o/r", null, 1)).toEqual({ releases: [], deployments: [], pulls: [] });
  });

  it("reads deployments with their status link, and stays within 10 reads", async () => {
    const deps = Array.from({ length: 20 }, (_, i) => ({ id: i, environment: i % 2 ? "Preview" : "Production", ref: "main", sha: `s${i}`, created_at: `2026-11-12T${String(i).padStart(2, "0")}:00:00Z` }));
    const calls = await fake((p) => {
      if (p.endsWith("/releases")) return [200, [{ tag_name: "v1", published_at: "2026-11-12T00:00:00Z" }]];
      if (p.endsWith("/deployments")) return [200, deps];
      if (p.endsWith("/pulls")) return [200, [{ number: 4, head: { ref: "main", sha: "c" } }]];
      const m = /deployments\/(\d+)\/statuses$/.exec(p);
      if (m) return [200, [{ state: "success", environment_url: `https://d${m[1]}.example.com`, created_at: "2026-11-12T12:00:00Z" }]];
      return [404, {}];
    });
    const app = await readApp("o/r", null, 1, [4]);
    expect(calls.length).toBeLessThanOrEqual(10);
    expect(app.releases).toHaveLength(1);
    expect(app.pulls).toEqual([{ number: 4, head_ref: "main", head_sha: "c" }]);
    expect(app.deployments.map((d) => d.url)).toContain("https://d19.example.com");
    expect(app.deployments.every((d) => d.ok)).toBe(true);
  });
});
