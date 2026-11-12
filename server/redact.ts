// Hide secrets before anything reaches the screen.
//
// Every string the board sends to the page goes through mask(). Known key shapes become
// "[hidden: <kind>]". A value written after a name that ends in KEY, TOKEN, SECRET or PASSWORD
// is hidden too, because many keys have no telltale prefix. If masking a line fails for any
// reason, the whole line is hidden.

export const HIDDEN_LINE = "[hidden: this line may hold a secret]";

const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g;

// [kind, pattern]. Order matters: longer, more specific shapes first.
const SHAPES: ReadonlyArray<readonly [string, RegExp]> = [
  ["github token", /\bgithub_pat_[A-Za-z0-9_]{20,}/g],
  ["github token", /\bgh[pousr]_[A-Za-z0-9]{30,}/g],
  ["anthropic key", /\bsk-ant-[A-Za-z0-9_-]{20,}/g],
  ["openai key", /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g],
  ["stripe key", /\b(?:sk|rk|pk|whsec)_(?:live|test)_[A-Za-z0-9]{10,}/g],
  ["stripe key", /\bwhsec_[A-Za-z0-9]{20,}/g],
  ["aws key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ["google key", /\bAIza[0-9A-Za-z_-]{35}/g],
  ["slack token", /\bxox[abposr]-[A-Za-z0-9-]{10,}/g],
  ["gitlab token", /\bglpat-[A-Za-z0-9_-]{20,}/g],
  ["npm token", /\bnpm_[A-Za-z0-9]{36}/g],
  ["supabase key", /\bsbp_[A-Za-z0-9]{40}/g],
  ["resend key", /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/g],
  ["vercel token", /\bvercel_[A-Za-z0-9_-]{20,}/g],
  ["web token", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
  ["password in a link", /(?<=:\/\/)[^/\s:@]+:[^/\s@]+(?=@)/g],
];

// NAME=value, NAME: value, "name": "value" where the name ends in a secret word.
const NAMED = /(\b[A-Za-z0-9_.-]*(?:key|token|secret|password|passwd|pwd)["']?\s*[:=]\s*)(["']?)([^\s"',;]{4,})/gi;

// Values after a secret name that are plainly not secrets.
const HARMLESS = new Set(["none", "null", "true", "false", "unset", "empty", "n/a", "required", "set", "missing"]);

function maskLineImpl(line: string): string {
  for (const [kind, pattern] of SHAPES) line = line.replace(pattern, `[hidden: ${kind}]`);
  return line.replace(NAMED, (whole: string, name: string, quote: string, value: string) =>
    HARMLESS.has(value.toLowerCase()) || value.startsWith("[hidden") ? whole : `${name}${quote}[hidden: secret]`);
}

// Swappable so a test can prove that a failure hides the whole line.
export const hooks = { maskLine: maskLineImpl };

/** Return text with every secret hidden. Never throws. */
export function mask(text: unknown): string {
  if (text === null || text === undefined) return "";
  let s = String(text);
  try {
    s = s.replace(PRIVATE_KEY, "[hidden: private key]"); // keys span lines, so before splitting
  } catch {
    return HIDDEN_LINE;
  }
  return s
    .split("\n")
    .map((line) => {
      try {
        return hooks.maskLine(line);
      } catch {
        return HIDDEN_LINE; // hide the whole line rather than risk showing it
      }
    })
    .join("\n");
}

/** Mask every string inside objects and arrays (keys are left alone). */
export function maskTree<T>(value: T): T {
  if (typeof value === "string") return mask(value) as T;
  if (Array.isArray(value)) return value.map((v) => maskTree(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = maskTree(v);
    return out as T;
  }
  return value;
}
