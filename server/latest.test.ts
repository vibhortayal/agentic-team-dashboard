// The team's latest saved work: shows progress before any issue or label exists.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { readLatest } from "./github.ts";
import { buildBoard, buildLatest, commitAuthor, errorBoard } from "./model.ts";

describe("who saved it", () => {
  it("names team agents by first name, from the email or the role title", () => {
    expect(commitAuthor("Engagement Lead", "engagement-lead@team.invalid")).toBe("Ella");
    expect(commitAuthor("Priya", "priya@team.invalid")).toBe("Priya");
    expect(commitAuthor("Ian", "ian@team.invalid")).toBe("Ian");
    expect(commitAuthor("Product Manager", "pm@team.invalid")).toBe("Priya");
  });
  it("calls anyone else You", () => {
    expect(commitAuthor("Sam Doe", "1+sam@users.noreply.github.com")).toBe("You");
    expect(commitAuthor("Owner", "owner@team.invalid")).toBe("Owner");
  });
});

describe("latest lines", () => {
  const c = (name: string, email: string, message: string, at: string) => ({ name, email, message, at });
  it("keeps the newest three, first line only, in plain words", () => {
    const out = buildLatest([
      c("Ian", "ian@team.invalid", "Build spec 001: guess and feedback page\n\nCo-Authored-By: x", "2026-11-13T20:10:56Z"),
      c("Priya", "priya@team.invalid", "Add spec 001: **guess** and feedback", "2026-11-13T20:04:38Z"),
      c("Engagement Lead", "engagement-lead@team.invalid", "Record owner approval of spec 001", "2026-11-13T20:06:45Z"),
      c("Sam", "sam@example.com", "Add the agent team", "2026-11-13T19:53:56Z"),
    ]);
    expect(out).toEqual([
      { who: "Ian", what: "Build spec 001: guess and feedback page", at: "2026-11-13T20:10:56Z" },
      { who: "Ella", what: "Record owner approval of spec 001", at: "2026-11-13T20:06:45Z" },
      { who: "Priya", what: "Add spec 001: guess and feedback", at: "2026-11-13T20:04:38Z" },
    ]);
  });
  it("masks a key pasted into a commit message", () => {
    const out = buildLatest([c("Ian", "ian@team.invalid", "Use key ghp_abcdefghijklmnopqrstuvwxyz0123456789", "2026-11-13T20:00:00Z")]);
    expect(out[0].what).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz0123456789");
  });
  it("is on the board even with no team issues, and empty when the board has a problem", () => {
    const commits = [c("Ian", "ian@team.invalid", "Build it", "2026-11-13T20:00:00Z")];
    expect(buildBoard("o/r", [], new Map(), "now", null, undefined, commits).latest).toHaveLength(1);
    expect(buildBoard("o/r", [], new Map(), "now", "oops", undefined, commits).latest).toEqual([]);
    expect(errorBoard("o/r", "now", "oops").latest).toEqual([]);
  });
});

describe("reading the latest work", () => {
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
  const commit = (sha: string, name: string) => ({ sha, commit: { message: `Work ${sha}`, author: { name, email: `${name.toLowerCase()}@team.invalid`, date: "2026-11-13T20:00:00Z" } } });

  it("reads the newest pushes on any branch, skips deletions, at most 4 reads", async () => {
    const calls = await fake((p) => {
      if (p.endsWith("/activity")) return [200, [
        { after: "a1", activity_type: "push" },
        { after: "0000000000000000000000000000000000000000", activity_type: "branch_deletion" },
        { after: "a1", activity_type: "push" },
        { after: "b2", activity_type: "branch_creation" },
        { after: "c3", activity_type: "push" },
        { after: "d4", activity_type: "push" },
      ]];
      const m = /\/commits\/(\w+)$/.exec(p);
      if (m) return [200, commit(m[1], "Ian")];
      return [404, {}];
    });
    const out = await readLatest("o/r", null);
    expect(out.map((c) => c.message)).toEqual(["Work a1", "Work b2", "Work c3"]);
    expect(calls.length).toBeLessThanOrEqual(4);
  });

  it("falls back to the main line when push history can't be read", async () => {
    await fake((p) => (p.endsWith("/commits") ? [200, [commit("m1", "Priya")]] : [403, {}]));
    expect((await readLatest("o/r", null)).map((c) => c.name)).toEqual(["Priya"]);
  });

  it("returns nothing, without throwing, when GitHub refuses every read", async () => {
    await fake(() => [404, {}]);
    expect(await readLatest("o/r", null)).toEqual([]);
  });
});
