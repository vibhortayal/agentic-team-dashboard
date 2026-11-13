// The local server: AC8 (this computer only), the Host guard, and the one-minute cache (spec §7).
import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { request } from "node:http";
import type { Server } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeServer, Session, Source } from "./main.ts";
import { load } from "./config.ts";

const tmp = () => mkdtempSync(join(tmpdir(), "board-"));
const demo = () => new Source(new Session({ demo: true, dir: tmp() }));
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
    const port = await start(demo());
    expect((server!.address() as AddressInfo).address).toBe("127.0.0.1");
    const r = await get(port, "/api/board", `localhost:${port}`);
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body).repo).toBe("sample/recipe-box");
  });

  it("refuses requests that name another host", async () => {
    const port = await start(demo());
    expect((await get(port, "/api/board", `evil.example:${port}`)).status).toBe(403);
  });

  it("does not serve files outside the built page", async () => {
    const port = await start(demo());
    expect((await get(port, "/../package.json", `localhost:${port}`)).status).toBe(404);
  });
});

describe("Source cache", () => {
  it("reads at most once a minute", async () => {
    let t = 0;
    const src = new Source(new Session({ demo: true, dir: tmp() }), () => t);
    const a = await src.get();
    t = 59_000;
    expect(await src.get()).toBe(a);
    t = 61_000;
    expect(await src.get()).not.toBe(a);
  });

  it("asks for a project when none is chosen", async () => {
    const b = await new Source(new Session({ dir: tmp(), envToken: () => null })).get();
    expect(b.error).toBe("Pick which project to show.");
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

function post(port: number, path: string, body: unknown, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = request({ host: "127.0.0.1", port, path, method: "POST", headers: { "Content-Length": Buffer.byteLength(data), ...headers } }, (res) => {
      let out = "";
      res.on("data", (d: Buffer) => (out += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: out }));
    });
    req.on("error", reject);
    req.end(data);
  });
}

describe("changes from the page", () => {
  it("saves a chosen project only from the board's own page", async () => {
    const dir = tmp();
    const port = await start(new Source(new Session({ dir, envToken: () => null })));
    const own = { Host: `localhost:${port}`, Origin: `http://localhost:${port}`, "Content-Type": "application/json" };
    expect((await post(port, "/api/project", { repo: "o/r" }, { ...own, Origin: "https://evil.example" })).status).toBe(403);
    expect((await post(port, "/api/project", { repo: "o/r" }, { ...own, "Content-Type": "text/plain" })).status).toBe(403);
    expect((await post(port, "/api/project", { repo: "not a repo" }, own)).status).toBe(400);
    expect((await post(port, "/api/project", { repo: "o/r" }, own)).status).toBe(200);
    expect(load(dir).repo).toBe("o/r");
    const status = JSON.parse((await get(port, "/api/status", `localhost:${port}`)).body);
    expect(status.repo).toBe("o/r");
    expect(status.signed_in).toBe(false);
  });

  it("can't sign in without the board's GitHub App", async () => {
    const port = await start(new Source(new Session({ dir: tmp(), envToken: () => null })));
    const own = { Host: `localhost:${port}`, Origin: `http://localhost:${port}`, "Content-Type": "application/json" };
    expect((await post(port, "/api/signin/start", {}, own)).status).toBe(400);
  });
});
