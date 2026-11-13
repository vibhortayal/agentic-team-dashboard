// Settings and keys: Ella's list, what the page may show, and what reaches GitHub.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import nacl from "tweetnacl";
import { blake2b } from "@noble/hashes/blake2.js";
import { seal } from "./seal.ts";
import { parseList, readSettings, saveSetting, SaveRefused } from "./settings.ts";

function open(sealed: string, pk: Uint8Array, sk: Uint8Array): string | null {
  const raw = Buffer.from(sealed, "base64");
  const epk = raw.subarray(0, 32);
  const nonce = blake2b(new Uint8Array([...epk, ...pk]), { dkLen: 24 });
  const out = nacl.box.open(new Uint8Array(raw.subarray(32)), nonce, new Uint8Array(epk), sk);
  return out ? new TextDecoder().decode(out) : null;
}

describe("seal", () => {
  it("locks a value that only the key's owner can open", () => {
    const kp = nacl.box.keyPair();
    const s = seal("sk-live-ünï 🔑", Buffer.from(kp.publicKey).toString("base64"));
    expect(open(s, kp.publicKey, kp.secretKey)).toBe("sk-live-ünï 🔑");
    expect(s).not.toContain("sk-live");
    const other = nacl.box.keyPair();
    expect(open(s, other.publicKey, other.secretKey)).toBeNull();
  });
  it("refuses a key of the wrong size", () => {
    expect(() => seal("x", Buffer.from("short").toString("base64"))).toThrow();
  });
});

describe("Ella's list", () => {
  it("keeps sensible entries and skips the rest", () => {
    const { wanted, skipped } = parseList(JSON.stringify({ settings: [
      { name: "OPENAI_API_KEY", kind: "secret", why: "AI replies", get: "https://platform.openai.com/api-keys", value: "leak", make: "random" },
      { name: "SITE_NAME", kind: "variable", why: "Name", value: "Shop", make: "random", get: "http://insecure.example" },
      { name: "lower_case", kind: "secret", why: "x" },
      { name: "GITHUB_TOKEN", kind: "secret", why: "x" },
      { name: "NO_WHY", kind: "secret" },
      { name: "BAD_KIND", kind: "file", why: "x" },
      { name: "SITE_NAME", kind: "variable", why: "again" },
    ] }));
    expect(skipped).toBe(5);
    expect(wanted).toEqual([
      { name: "OPENAI_API_KEY", kind: "secret", why: "AI replies", get: "https://platform.openai.com/api-keys", make: "random" },
      { name: "SITE_NAME", kind: "variable", why: "Name", value: "Shop" },
    ]);
  });
  it("treats a broken file as one skipped entry", () => {
    expect(parseList("{not json")).toEqual({ wanted: [], skipped: 1 });
  });
});

// A pretend GitHub on this computer.
const kp = nacl.box.keyPair();
let gh: Server;
let calls: Array<{ method: string; url: string; body: Record<string, unknown> }> = [];
let list: unknown = null;
let variables: Array<{ name: string; value: string; updated_at: string }> = [];
let secrets: Array<{ name: string; updated_at: string }> = [];
let deny = false;

beforeAll(async () => {
  gh = createServer((req, res) => {
    let raw = "";
    req.on("data", (d: Buffer) => (raw += d));
    req.on("end", () => {
      const url = req.url ?? "";
      calls.push({ method: req.method ?? "", url, body: raw ? JSON.parse(raw) as Record<string, unknown> : {} });
      const reply = (code: number, data?: unknown) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(data ? JSON.stringify(data) : ""); };
      if (deny && !url.includes("/contents/")) return reply(403, { message: "Resource not accessible by integration" });
      if (url === "/repos/o/r/contents/team-settings.json") {
        return list === null ? reply(404) : reply(200, { content: Buffer.from(JSON.stringify(list)).toString("base64") });
      }
      if (url.startsWith("/repos/o/r/actions/variables?")) return reply(200, { variables });
      if (url.startsWith("/repos/o/r/actions/secrets?")) return reply(200, { secrets });
      if (url === "/repos/o/r/actions/secrets/public-key") return reply(200, { key_id: "k1", key: Buffer.from(kp.publicKey).toString("base64") });
      if (req.method === "PUT" && url.startsWith("/repos/o/r/actions/secrets/")) return reply(201);
      if (req.method === "PATCH" && url.startsWith("/repos/o/r/actions/variables/")) {
        return variables.some((v) => url.endsWith("/" + v.name)) ? reply(204) : reply(404);
      }
      if (req.method === "POST" && url === "/repos/o/r/actions/variables") return reply(201);
      reply(500);
    });
  });
  await new Promise<void>((r) => gh.listen(0, "127.0.0.1", r));
  process.env.BOARD_GITHUB_API = `http://127.0.0.1:${(gh.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => { delete process.env.BOARD_GITHUB_API; gh.close(() => r()); }));

const LIST = { settings: [
  { name: "SETUP_CMD", kind: "variable", why: "Gets the app ready to test.", value: "npm ci && npm run build" },
  { name: "OPENAI_API_KEY", kind: "secret", why: "AI replies." },
  { name: "SESSION_SECRET", kind: "secret", why: "Keeps people signed in.", make: "random" },
  { name: "SITE_NAME", kind: "variable", why: "The app's name." },
] };

beforeEach(() => {
  calls = []; list = LIST; deny = false;
  variables = [{ name: "SETUP_CMD", value: "npm ci && npm run build", updated_at: "t1" }, { name: "SITE_NAME", value: "Shop", updated_at: "t2" }];
  secrets = [{ name: "OPENAI_API_KEY", updated_at: "t3" }];
});

describe("reading settings", () => {
  it("says what is set, shows app values only, never checks values or secrets", async () => {
    const v = await readSettings("o/r", "tok");
    expect(v.problem).toBeNull();
    const by = Object.fromEntries(v.items.map((i) => [i.name, i]));
    expect(by.SETUP_CMD).toMatchObject({ checks: true, is_set: true, value: null });
    expect(by.SITE_NAME).toMatchObject({ checks: false, is_set: true, value: "Shop" });
    expect(by.OPENAI_API_KEY).toMatchObject({ is_set: true, value: null, updated_at: "t3", can_make: false });
    expect(by.SESSION_SECRET).toMatchObject({ is_set: false, can_make: true });
  });
  it("shows nothing to set when the project has no list", async () => {
    list = null;
    expect(await readSettings("o/r", "tok")).toEqual({ items: [], problem: null, skipped: 0 });
  });
  it("says in plain words when the board has no permission", async () => {
    deny = true;
    const v = await readSettings("o/r", "tok");
    expect(v.problem).toMatch(/permission/);
    expect(v.items.every((i) => !i.is_set)).toBe(true);
  });
});

describe("saving settings", () => {
  it("locks a pasted secret, trims it, and sends GitHub's key id", async () => {
    await saveSetting("o/r", "tok", "OPENAI_API_KEY", "  sk-abc123\n");
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.url).toBe("/repos/o/r/actions/secrets/OPENAI_API_KEY");
    expect(put.body.key_id).toBe("k1");
    expect(open(String(put.body.encrypted_value), kp.publicKey, kp.secretKey)).toBe("sk-abc123");
    expect(JSON.stringify(calls)).not.toContain("sk-abc123");
  });
  it("makes up a random secret only where the list allows it", async () => {
    await saveSetting("o/r", "tok", "SESSION_SECRET", null);
    const put = calls.find((c) => c.method === "PUT")!;
    expect(open(String(put.body.encrypted_value), kp.publicKey, kp.secretKey)!.length).toBeGreaterThanOrEqual(40);
    await expect(saveSetting("o/r", "tok", "OPENAI_API_KEY", null)).rejects.toThrow(/can't make this one up/);
  });
  it("changes a variable that exists and creates one that doesn't", async () => {
    await saveSetting("o/r", "tok", "SITE_NAME", "Corner Shop");
    expect(calls.filter((c) => c.method !== "GET").map((c) => c.method)).toEqual(["PATCH"]);
    calls = []; variables = [];
    await saveSetting("o/r", "tok", "SITE_NAME", "Corner Shop");
    const writes = calls.filter((c) => c.method !== "GET");
    expect(writes.map((c) => c.method)).toEqual(["PATCH", "POST"]);
    expect(writes[1].body).toEqual({ name: "SITE_NAME", value: "Corner Shop" });
  });
  it("never changes the checks' settings, names off the list, or empty values", async () => {
    await expect(saveSetting("o/r", "tok", "SETUP_CMD", "rm -rf /")).rejects.toThrow(SaveRefused);
    await expect(saveSetting("o/r", "tok", "TEAM_RECEIPTS", "off")).rejects.toThrow(/isn't on Ella's list/);
    await expect(saveSetting("o/r", "tok", "SITE_NAME", "   ")).rejects.toThrow(/empty/);
    await expect(saveSetting("o/r", "tok", "SITE_NAME", "x".repeat(8001))).rejects.toThrow(/too long/);
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });
  it("explains a missing permission without repeating the value", async () => {
    deny = true;
    const err = await saveSetting("o/r", "tok", "OPENAI_API_KEY", "sk-secret-value").catch((e: Error) => e);
    expect(err).toBeInstanceOf(SaveRefused);
    expect((err as Error).message).toMatch(/permission/);
    expect((err as Error).message).not.toContain("sk-secret-value");
  });
});
