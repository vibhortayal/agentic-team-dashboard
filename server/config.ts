// What the board remembers between runs: your GitHub sign-in and which project to show.
// Kept in one file only you can read, in your user folder:
//   Mac and Linux: ~/.config/team-board/config.json    Windows: %APPDATA%\team-board\config.json

import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Saved {
  repo?: string;
  token?: string;
  refresh_token?: string;
  expires_at?: number; // ms since epoch; absent when the token doesn't expire
}

export function configDir(env: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  if (env.BOARD_CONFIG_DIR) return env.BOARD_CONFIG_DIR;
  if (platform === "win32") return join(env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "team-board");
  return join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "team-board");
}

export function load(dir = configDir()): Saved {
  const file = join(dir, "config.json");
  if (!existsSync(file)) return {};
  try {
    const data: unknown = JSON.parse(readFileSync(file, "utf8"));
    return data && typeof data === "object" ? (data as Saved) : {};
  } catch {
    return {};
  }
}

export function save(update: Partial<Saved>, dir = configDir()): Saved {
  const next: Saved = { ...load(dir), ...update };
  for (const k of Object.keys(next) as Array<keyof Saved>) if (next[k] === undefined) delete next[k];
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, "config.json");
  writeFileSync(file, JSON.stringify(next, null, 2), { mode: 0o600 });
  try { chmodSync(file, 0o600); } catch { /* Windows keeps files in the user's own folder private already */ }
  return next;
}

export function forget(dir = configDir()): void {
  rmSync(join(dir, "config.json"), { force: true });
}
