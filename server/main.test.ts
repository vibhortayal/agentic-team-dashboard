// The local server: AC8 (this computer only), the Host guard, and the one-minute cache (spec §7).
import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { request } from "node:http";
import type { Server } from "node:http";
import { makeServer, Source } from "./main.ts";
import { apiBase, repoFromUrl } from "./github.ts";

let server: Server | null = null;
afterEach(() => new Promise<void>((done) => (server ? server.close(() => done()) : done())));

function get(port: number, path: string, host: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, headers: { Host: host } }, (res) => {
      let body = "";
      res.on("data", (d: Buffer) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function start(source: Source): Promise<number> {
  server = makeServer(source, 0);
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as AddressInfo).port;
  // The guard is built for the port it listens on, so rebuild it now that we know the port.
  await new Promise<void>((r) => server!.close(() => r()));
  server = makeServer(source, port);
  await new Promise<void>((r) => server!.listen(port, "127.0.0.1", () => r()));
  return port;
}

describe("local server", () => {
  it("AC8: listens on 127.0.0.1 only", async () => {
    const port = await start(new Source("", true));
    expect((server!.address() as AddressInfo).address).toBe("127.0.0.1");
    const r = await get(port, "/api/board", `localhost:${port}`);
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body).repo).toBe("sample/recipe-box");
  });

  it("refuses requests that name another host", async () => {
    const port = await start(new Source("", true));
    expect((await get(port, "/api/board", `evil.example:${port}`)).status).toBe(403);
  });

  it("does not serve files outside the built page", async () => {
    const port = await start(new Source("", true));
    expect((await get(port, "/../package.json", `localhost:${port}`)).status).toBe(404);
  });
});

describe("Source cache", () => {
  it("reads at most once a minute", async () => {
    let t = 0;
    const src = new Source("", true, () => t);
    const a = await src.get();
    t = 59_000;
    expect(await src.get()).toBe(a);
    t = 61_000;
    expect(await src.get()).not.toBe(a);
  });

  it("explains when it doesn't know the project", async () => {
    const b = await new Source("", false).get();
    expect(b.error).toContain("doesn't know which project");
  });
});

describe("github", () => {
  it("only lets tests point GitHub at this computer", () => {
    expect(apiBase({})).toBe("https://api.github.com");
    expect(apiBase({ BOARD_GITHUB_API: "http://127.0.0.1:9999/" })).toBe("http://127.0.0.1:9999");
    expect(() => apiBase({ BOARD_GITHUB_API: "https://evil.example" })).toThrow();
  });

  it("reads owner/name from a remote address", () => {
    expect(repoFromUrl("git@github.com:o/r.git")).toBe("o/r");
    expect(repoFromUrl("https://github.com/o/r")).toBe("o/r");
    expect(repoFromUrl("http://127.0.0.1:1234/git/o/r")).toBe("o/r");
  });
});
