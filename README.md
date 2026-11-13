# Dashboard

The front door to the agent team, built by the team itself. How the team works here is in `AGENTS.md` and `TEAM.md`.

## The progress board

A page on your own computer that shows what is waiting on you and how each piece of work is going. It only reads your project on GitHub; it changes nothing.

There are two ways to open it. Pick one.

**Download it (nothing else to install).** From the latest release, take the file for your computer: `Team-Board-mac-arm64.zip` for a Mac, `Team-Board-windows-x64.exe` for Windows. Open it, and the board opens in your browser. Keep the small window it opens; close it to stop the board.

The app isn't signed yet (signing costs money each year), so the first time your computer warns you:
- Mac: double-click the zip, then double-click the app. When it says it can't check the app, open System Settings > Privacy & Security, scroll down and click "Open Anyway".
- Windows: when the blue "Windows protected your PC" box appears, click "More info", then "Run anyway".

**Or type one command** (needs Node 22.18 or newer): `npx team-board`. Add `--demo` to see sample data. (This works once the package is published to npm.)

The first time, click "Sign in with GitHub", copy the code it shows into GitHub, then pick your project. The board only reads; it changes nothing. It also uses `GITHUB_TOKEN` or the GitHub command-line tool's sign-in if you have one.

From this folder: `npm install`, then `npm start` (or `npm run demo`).

Checks: `npm test` and `npm run typecheck`. Why TypeScript: `docs/decisions/0001-stack.md`.
