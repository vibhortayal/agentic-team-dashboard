# Progress board

The front door to the agent team, built by the team itself.

## What it is

A page on your own computer that shows what is waiting on you and how each piece of work is going. It reads your project on GitHub. It changes something only when you save a setting or key on its Settings page, so you never have to open GitHub for that.

There are two ways to open it. Pick one.

**Download it (nothing else to install).** From the latest release, take the file for your computer: `Team-Board-mac-arm64.zip` for a Mac with an Apple chip (M1 or later; older Intel Macs aren't supported yet), `Team-Board-windows-x64.exe` for Windows. Open it, and the board opens in your browser. Keep the small window it opens; close it to stop the board.

The app isn't signed yet (signing costs money each year), so the first time your computer warns you:
- Mac: double-click the zip, then double-click the app. When it says it can't check the app, open System Settings > Privacy & Security, scroll down and click "Open Anyway".
- Windows: when the blue "Windows protected your PC" box appears, click "More info", then "Run anyway".

**Or type one command** (needs Node 22.18 or newer): `npx team-board`. Add `--demo` to see sample data. (This works once the package is published to npm.)

The first time, click "Sign in with GitHub", copy the code it shows into GitHub, then pick your project. The board changes nothing unless you save a setting. If you already signed in to GitHub's command-line tool during setup, the board uses that sign-in instead.

## For developers

How the team works here is in `AGENTS.md` and `TEAM.md`. From this folder: `npm install`, then `npm start` (or `npm run demo`). The board also reads `GITHUB_TOKEN` if it's set.

Checks: `npm test` and `npm run typecheck`. Why TypeScript: `docs/decisions/0001-stack.md`.
