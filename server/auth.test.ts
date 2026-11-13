// Device sign-in against a fake github.com on this computer.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { pollSignIn, startSignIn, webBase } from "./auth.ts";
import { configDir } from "./config.ts";

let server: Server;
let answer: Record<string, unknown> = {};
beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/login/device/code") return res.end(JSON.stringify({ device_code: "dc", user_code: "ABCD-1234", verification_uri: "https://github.com/login/device", interval: 5, expires_in: 900 }));
    res.end(JSON.stringify(answer));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  process.env.BOARD_GITHUB_WEB = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  delete process.env.BOARD_GITHUB_WEB;
  server.close();
});

describe("device sign-in", () => {
  it("starts with a code to type on GitHub", async () => {
    const d = await startSignIn("client");
    expect(d.user_code).toBe("ABCD-1234");
    expect(d.verification_uri).toBe("https://github.com/login/device");
  });

  it("waits, then hands back a key with its expiry", async () => {
    answer = { error: "authorization_pending" };
    expect((await pollSignIn("client", "dc")).state).toBe("pending");
    answer = { access_token: "ghu_x", refresh_token: "ghr_y", expires_in: 28800 };
    const r = await pollSignIn("client", "dc", 1000);
    expect(r).toEqual({ state: "done", tokens: { token: "ghu_x", refresh_token: "ghr_y", expires_at: 1000 + 28800 * 1000 } });
  });

  it("explains a refusal and an expired code in plain words", async () => {
    answer = { error: "access_denied" };
    expect(await pollSignIn("client", "dc")).toMatchObject({ state: "denied" });
    answer = { error: "expired_token" };
    expect(await pollSignIn("client", "dc")).toMatchObject({ state: "expired" });
  });

  it("only lets tests point github.com at this computer", () => {
    expect(webBase({})).toBe("https://github.com");
    expect(() => webBase({ BOARD_GITHUB_WEB: "https://evil.example" })).toThrow();
  });
});

describe("where the board keeps its file", () => {
  it("uses the user's own folder on each system", () => {
    expect(configDir({ APPDATA: "C:\\Users\\a\\AppData\\Roaming" }, "win32")).toContain("team-board");
    expect(configDir({ XDG_CONFIG_HOME: "/home/a/.config" }, "linux")).toBe("/home/a/.config/team-board");
  });
});
