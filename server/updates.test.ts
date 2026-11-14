// What's new (#33 AC9, AC10): the Mac app's waiting version and a newer team for the project.
import { afterEach, describe, expect, it, vi } from "vitest";
import { newerTeam, restartForUpdate, setAppUpdate, appUpdate, TeamCheck, TEAM_REPO, versionCommit } from "./updates.ts";

afterEach(() => vi.unstubAllGlobals());

describe("versionCommit", () => {
  it("reads a plain commit and the commit at the end of a described tag", () => {
    expect(versionCommit("13e79e1\n")).toBe("13e79e1");
    expect(versionCommit("v1.2-3-gABCDEF1")).toBe("abcdef1");
    expect(versionCommit("unknown")).toBeNull();
    expect(versionCommit("")).toBeNull();
  });
});

describe("the app's waiting version", () => {
  it("is empty until the app says one downloaded, then restarts into it", () => {
    expect(restartForUpdate()).toBe(false);
    const restart = vi.fn();
    setAppUpdate("0.2.0", restart);
    expect(appUpdate()).toEqual({ version: "0.2.0" });
    expect(restartForUpdate()).toBe(true);
    expect(restart).toHaveBeenCalledOnce();
  });
});

function fakeGitHub(answers: Record<string, { status: number; body?: unknown }>) {
  const asked: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    const path = new URL(url).pathname;
    asked.push(path);
    const a = answers[path] ?? { status: 404 };
    return new Response(a.body === undefined ? null : JSON.stringify(a.body), { status: a.status });
  });
  return asked;
}
const version = (text: string) => ({ status: 200, body: { content: Buffer.from(text).toString("base64") } });

describe("newerTeam", () => {
  it("gives the newest team commit when the project's team is older", async () => {
    fakeGitHub({
      "/repos/acme/app/contents/.team/VERSION": version("13e79e1\n"),
      [`/repos/${TEAM_REPO}/compare/13e79e1...main`]: { status: 200, body: { ahead_by: 2, commits: [{ sha: "aaaaaaa111" }, { sha: "bbbbbbb222" }] } },
    });
    expect(await newerTeam("acme/app", null)).toBe("bbbbbbb");
  });

  it("is null when the team is current, the project has no team, or GitHub fails", async () => {
    fakeGitHub({
      "/repos/acme/app/contents/.team/VERSION": version("13e79e1"),
      [`/repos/${TEAM_REPO}/compare/13e79e1...main`]: { status: 200, body: { ahead_by: 0, commits: [] } },
    });
    expect(await newerTeam("acme/app", null)).toBeNull();
    fakeGitHub({});
    expect(await newerTeam("acme/plain", null)).toBeNull();
    vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
    expect(await newerTeam("acme/app", null)).toBeNull();
  });
});

describe("TeamCheck", () => {
  it("asks GitHub at most once every six hours per project", async () => {
    let now = 0;
    const ask = vi.fn(async () => "bbbbbbb");
    const check = new TeamCheck(ask, () => now);
    await check.latest("acme/app", null);
    now += 5 * 60 * 60 * 1000;
    await check.latest("acme/app", null);
    expect(ask).toHaveBeenCalledTimes(1);
    now += 2 * 60 * 60 * 1000;
    expect(await check.latest("acme/app", null)).toBe("bbbbbbb");
    expect(ask).toHaveBeenCalledTimes(2);
  });
});
