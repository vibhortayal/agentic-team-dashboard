// "Sign in with GitHub" without a password box: GitHub's device sign-in.
// The board shows a short code; you type it on github.com; GitHub hands the board a key that can
// only reach the projects you let it see. The board's GitHub App asks for read access to issues,
// pull requests, metadata and contents, and read and write access to Actions secrets and variables
// for the Settings page (#16), nothing else.

/** The board's GitHub App. Its client id is public by design (it is not a secret). */
export function clientId(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.BOARD_GITHUB_CLIENT_ID || BUILT_IN_CLIENT_ID || null;
}
// Filled in once the owner creates the GitHub App (see docs/changes/10.md, section 8).
const BUILT_IN_CLIENT_ID = "";
const BUILT_IN_APP_SLUG = "";

/** The page where you let the board's GitHub App see a project, or null if no app is set up. */
export function installUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const slug = env.BOARD_GITHUB_APP_SLUG || BUILT_IN_APP_SLUG;
  return slug ? `https://github.com/apps/${encodeURIComponent(slug)}/installations/new` : null;
}

/** Where github.com is. Tests may point it at this computer only. */
export function webBase(env: NodeJS.ProcessEnv = process.env): string {
  const custom = env.BOARD_GITHUB_WEB;
  if (!custom) return "https://github.com";
  const u = new URL(custom);
  if (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) return custom.replace(/\/$/, "");
  throw new Error("BOARD_GITHUB_WEB may only point at this computer (http://127.0.0.1:<port>)");
}

export interface DeviceStart { device_code: string; user_code: string; verification_uri: string; interval: number; expires_in: number }
export interface Tokens { token: string; refresh_token?: string; expires_at?: number }
export type PollResult = { state: "pending" | "slow_down" } | { state: "done"; tokens: Tokens } | { state: "denied" | "expired" | "error"; message: string };

async function post(path: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const resp = await fetch(webBase() + path, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "team-progress-board" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data: unknown = await resp.json().catch(() => ({}));
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

export async function startSignIn(id: string): Promise<DeviceStart> {
  const d = await post("/login/device/code", { client_id: id });
  if (typeof d.device_code !== "string" || typeof d.user_code !== "string") {
    throw new Error("GitHub didn't start the sign-in. Try again in a minute.");
  }
  return {
    device_code: d.device_code,
    user_code: d.user_code,
    verification_uri: typeof d.verification_uri === "string" ? d.verification_uri : "https://github.com/login/device",
    interval: typeof d.interval === "number" ? d.interval : 5,
    expires_in: typeof d.expires_in === "number" ? d.expires_in : 900,
  };
}

function tokensFrom(d: Record<string, unknown>, now: number): Tokens {
  const t: Tokens = { token: String(d.access_token) };
  if (typeof d.refresh_token === "string") t.refresh_token = d.refresh_token;
  if (typeof d.expires_in === "number") t.expires_at = now + d.expires_in * 1000;
  return t;
}

export async function pollSignIn(id: string, deviceCode: string, now = Date.now()): Promise<PollResult> {
  const d = await post("/login/oauth/access_token", {
    client_id: id, device_code: deviceCode, grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });
  if (typeof d.access_token === "string") return { state: "done", tokens: tokensFrom(d, now) };
  switch (d.error) {
    case "authorization_pending": return { state: "pending" };
    case "slow_down": return { state: "slow_down" };
    case "access_denied": return { state: "denied", message: "You said no on GitHub, so the board isn't signed in." };
    case "expired_token": return { state: "expired", message: "The code ran out of time. Start again to get a new one." };
    default: return { state: "error", message: "GitHub didn't finish the sign-in. Try again." };
  }
}

/** A fresh key from the refresh key, for apps whose keys expire after a few hours. */
export async function refresh(id: string, refreshToken: string, now = Date.now()): Promise<Tokens | null> {
  const d = await post("/login/oauth/access_token", { client_id: id, grant_type: "refresh_token", refresh_token: refreshToken });
  return typeof d.access_token === "string" ? tokensFrom(d, now) : null;
}
