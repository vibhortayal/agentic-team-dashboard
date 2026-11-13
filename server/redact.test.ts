// AC6: every planted fake key comes out masked.
import { describe, expect, it } from "vitest";
import { HIDDEN_LINE, hooks, mask, maskTree } from "./redact.ts";

// Fake keys, one per shape. None of these are real.
const PLANTED: Record<string, string> = {
  "github classic": "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8",
  "github fine-grained": "github_pat_" + "11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz",
  "github app": "ghs_" + "abcdefghijklmnopqrstuvwxyz0123456789",
  anthropic: "sk-ant-" + "api03-abcdefghijklmnopqrstuvwxyz012345",
  openai: "sk-proj-" + "abcdefghijklmnopqrstuvwxyz0123",
  stripe: "sk_live_" + "abcdefghijklmnop1234",
  aws: "AKIA" + "ABCDEFGHIJKLMNOP",
  google: "AIza" + "SyA1234567890abcdefghijklmnopqrstuv",
  slack: "xoxb-" + "123456789012-abcdefghijkl",
  gitlab: "glpat-" + "abcdefghijklmnopqrst",
  npm: "npm_" + "abcdefghijklmnopqrstuvwxyz0123456789",
  supabase: "sbp_" + "0123456789abcdef0123456789abcdef01234567",
  resend: "re_" + "AbCd1234_abcdefghijklmnopqrst",
  jwt: "eyJ" + "hbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop",
};
const NAMED: Array<[string, string]> = [
  ["MY_TOKEN=abc123def456", "abc123def456"],
  ["DATABASE_PASSWORD: hunter2hunter2", "hunter2hunter2"],
  ['export STRIPE_SECRET="plainvalue9876"', "plainvalue9876"],
  ["api_key = 0123456789abcdef", "0123456789abcdef"],
  ['{"apiKey": "zzzzyyyyxxxx"}', "zzzzyyyyxxxx"],
];

describe("mask", () => {
  it.each(Object.entries(PLANTED))("hides a planted %s", (_kind, key) => {
    const out = mask(`Ian pasted ${key} into the log`);
    expect(out).not.toContain(key);
    expect(out).toContain("[hidden:");
  });

  it.each(NAMED)("hides the value in %s", (line, value) => {
    const out = mask(line);
    expect(out).toContain("[hidden: secret]");
    expect(out).not.toContain(value);
  });

  it("hides a private key block but keeps the lines around it", () => {
    const block = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXk\nAAAAB3NzaC1\n-----END OPENSSH PRIVATE KEY-----";
    const out = mask("before\n" + block + "\nafter");
    expect(out).not.toContain("b3BlbnNzaC1rZXk");
    expect(out).toContain("before");
    expect(out).toContain("after");
  });

  it("hides a password inside a link", () => {
    expect(mask("clone https://bob:s3cretpass@example.com/repo.git")).not.toContain("s3cretpass");
  });

  it("leaves plain words alone", () => {
    const text = "Vera checked it: it works. Ian needs a token from you. Secret: none";
    expect(mask(text)).toBe(text);
  });

  it("masks strings nested in objects and arrays", () => {
    const key = PLANTED["github classic"];
    const out = maskTree({ a: [{ b: key }], n: 3 });
    expect(JSON.stringify(out)).not.toContain(key);
    expect(out.n).toBe(3);
  });

  it("hides the whole line when masking fails", () => {
    const original = hooks.maskLine;
    hooks.maskLine = () => { throw new Error("boom"); };
    try {
      expect(mask("ghp_whatever")).toBe(HIDDEN_LINE);
    } finally {
      hooks.maskLine = original;
    }
  });
});
