// Read the project's issues, pull requests and team comments from GitHub.
//
// Read only. Sign-in comes from GITHUB_TOKEN or GH_TOKEN, or from the GitHub command-line tool
// if it is installed and signed in. Nothing is ever written.

import { execFileSync } from "node:child_process";
import type { GhComment, GhItem } from "./model.ts";

/** GitHub couldn't be read. The message is a plain sentence for the page. */
export class CantRead extends Error {}

const DEFAULT_API = "https://api.github.com";

/** Where GitHub is. Tests may point it at this computer only, so a token can't be sent elsewhere. */
export function apiBase(env: NodeJS.ProcessEnv = process.env): string {
  const custom = env.BOARD_GITHUB_API;
  if (!custom) return DEFAULT_API;
  const u = new URL(custom);
  if (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) return custom.replace(/\/$/, "");
  throw new Error("BOARD_GITHUB_API may only point at this computer (http://127.0.0.1:<port>)");
}

export function findToken(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const name of ["GITHUB_TOKEN", "GH_TOKEN"]) {
    const v = env[name]?.trim();
    if (v) return v;
  }
  try {
    const out = execFileSync("gh", ["auth", "token"], { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "ignore"] });
    return out.trim() || null;
  } catch {
    return null;
  }
}

/** owner/name from the folder's git remote, if it points at GitHub. */
export function repoFromGit(folder = "."): string | null {
  let url: string;
  try {
    url = execFileSync("git", ["-C", folder, "remote", "get-url", "origin"], { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
  return repoFromUrl(url);
}

export function repoFromUrl(url: string): string | null {
  // Sessions may use a local proxy remote such as http://127.0.0.1:1234/git/owner/name.
  const m = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url) ?? /\/git\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url);
  return m ? `${m[1]}/${m[2]}` : null;
}

async function get<T>(path: string, token: string | null): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "team-progress-board",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let resp: Response;
  try {
    resp = await fetch(apiBase() + path, { headers, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new CantRead("The board can't reach GitHub. Check your internet connection.");
  }
  if (!resp.ok) {
    if ((resp.status === 401 || resp.status === 403 || resp.status === 429) && resp.headers.get("x-ratelimit-remaining") === "0") {
      throw new CantRead("GitHub asked us to slow down. The board will try again in a few minutes.");
    }
    if (resp.status === 401) throw new CantRead("Your GitHub sign-in didn't work. Ask Ella to help you sign in again.");
    if (resp.status === 403 || resp.status === 404) throw new CantRead("The board can't see this project on GitHub. It may be private and need you to sign in.");
    throw new CantRead("GitHub had a problem just now. The board will try again soon.");
  }
  try {
    return (await resp.json()) as T;
  } catch {
    throw new CantRead("GitHub had a problem just now. The board will try again soon.");
  }
}

export function isTeamItem(item: GhItem): boolean {
  return (item.labels ?? []).some((lb) => {
    const n = typeof lb === "string" ? lb : lb?.name ?? "";
    return n === "needs-human" || n.startsWith("stage:") || n.startsWith("role:") || n.startsWith("human:");
  });
}

/** Open team items, the last few finished ones, and the team comments on each. */
export async function readProject(repo: string, token: string | null): Promise<{ items: GhItem[]; comments: Map<number, GhComment[]> }> {
  const open = await get<GhItem[]>(`/repos/${repo}/issues?state=open&per_page=100`, token);
  const done = await get<GhItem[]>(`/repos/${repo}/issues?state=closed&labels=stage:done&per_page=10&sort=updated`, token);
  const seen = new Set<number>();
  const items: GhItem[] = [];
  for (const it of [...open, ...done]) {
    if (!seen.has(it.number) && isTeamItem(it)) {
      seen.add(it.number);
      items.push(it);
    }
  }
  const comments = new Map<number, GhComment[]>();
  for (const it of items) {
    if (it.comments) comments.set(it.number, await get<GhComment[]>(`/repos/${repo}/issues/${it.number}/comments?per_page=100`, token));
  }
  return { items, comments };
}
