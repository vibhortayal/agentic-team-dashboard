// #29: the picker shows projects that use the team (TEAM.md at the root) first, and marks them.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { listProjects } from "./github.ts";

let close: (() => void) | null = null;
afterEach(() => { close?.(); close = null; delete process.env.BOARD_GITHUB_API; });

async function fake(handler: (path: string) => [number, unknown]): Promise<string[]> {
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

describe("#29 team projects", () => {
  it("marks projects with TEAM.md and lists them first (the command-line sign-in's list)", async () => {
    await fake((p) => {
      if (p === "/user/installations") return [403, {}];
      if (p === "/user/repos") return [200, ["me/old", "me/grocery-list", "me/notes"].map((full_name) => ({ full_name, private: true }))];
      if (p === "/repos/me/grocery-list/contents/TEAM.md") return [200, { name: "TEAM.md" }];
      return [404, {}];
    });
    const out = await listProjects("t");
    expect(out).toEqual([
      { repo: "me/grocery-list", private: true, team: true },
      { repo: "me/old", private: true, team: false },
      { repo: "me/notes", private: true, team: false },
    ]);
  });

  it("uses the board's GitHub App list when it has one", async () => {
    await fake((p) => {
      if (p === "/user/installations") return [200, { installations: [{ id: 7 }] }];
      if (p === "/user/installations/7/repositories") return [200, { repositories: [{ full_name: "me/app", private: false }] }];
      if (p === "/repos/me/app/contents/TEAM.md") return [200, {}];
      return [404, {}];
    });
    expect(await listProjects("t")).toEqual([{ repo: "me/app", private: false, team: true }]);
  });

  it("a failed look counts as not a team project, and never stops the list", async () => {
    await fake((p) => {
      if (p === "/user/installations") return [403, {}];
      if (p === "/user/repos") return [200, [{ full_name: "me/a" }, { full_name: "me/b" }]];
      if (p === "/repos/me/a/contents/TEAM.md") return [500, {}];
      return [404, {}];
    });
    expect((await listProjects("t")).map((p) => p.team)).toEqual([false, false]);
  });

  it("looks inside at most 100 projects", async () => {
    const many = Array.from({ length: 130 }, (_, i) => ({ full_name: `me/p${i}` }));
    const calls = await fake((p) => {
      if (p === "/user/installations") return [403, {}];
      if (p === "/user/repos") return [200, many];
      return [404, {}];
    });
    const out = await listProjects("t");
    expect(out).toHaveLength(130);
    expect(calls.filter((c) => c.includes("/contents/TEAM.md"))).toHaveLength(100);
  });
});
