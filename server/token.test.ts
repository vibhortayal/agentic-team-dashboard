// Where the board looks for the sign-in Ella made with the GitHub command-line tool.
import { describe, expect, it } from "vitest";
import { findToken, ghCandidates } from "./github.ts";

describe("reusing Ella's sign-in", () => {
  it("tries the search path first, then where the Mac installers put gh", () => {
    expect(ghCandidates({}, "darwin")).toEqual(["gh", "/opt/homebrew/bin/gh", "/usr/local/bin/gh"]);
  });

  it("looks in Program Files on Windows, where winget installs gh", () => {
    const found = ghCandidates({ ProgramFiles: "C:\\Program Files", LOCALAPPDATA: "C:\\Users\\a\\AppData\\Local" }, "win32");
    expect(found[0]).toBe("gh");
    expect(found).toContain("C:\\Program Files\\GitHub CLI\\gh.exe");
    expect(found).toContain("C:\\Users\\a\\AppData\\Local\\Programs\\GitHub CLI\\gh.exe");
  });

  it("skips Windows folders that aren't set", () => {
    expect(ghCandidates({}, "win32")).toEqual(["gh"]);
  });

  it("prefers a key in the environment over any sign-in", () => {
    expect(findToken({ GH_TOKEN: " key " })).toBe("key");
  });
});
