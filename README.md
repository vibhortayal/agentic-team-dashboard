# Progress board

The front door to the agent team, built by the team itself.

## What it is

A page on your own computer that shows what is waiting on you and how each piece of work is going. It reads your project on GitHub. It changes something only when you save a setting or key on its Settings page, so you never have to open GitHub for that.

There are two ways to open it. Pick one.

**Download it (nothing else to install).** Open the [latest release](https://github.com/vibhortayal/agentic-team-dashboard/releases/latest) and, under Assets, click the file for your computer (about 110 MB):
- Mac with an Apple chip (M1 or newer): `Team-Board-mac-arm64.zip`. Older Intel Macs aren't supported yet.
- Windows: `Team-Board-windows-x64.exe`.

The app isn't signed yet (signing costs money each year), so the first time your computer warns you:
- Mac: double-click the zip, then double-click `Team-Board-mac-arm64`. When the Mac says it can't verify the app, click Done. Open System Settings > Privacy & Security, scroll down, click "Open Anyway", type your password and click Open.
- Windows: if the browser says the file isn't commonly downloaded, choose Keep (in Edge: the three dots, then Keep, then Keep anyway). Double-click the file. When the blue "Windows protected your PC" box appears, click "More info", then "Run anyway".

A small window opens (Terminal on a Mac, a black window on Windows) and the board opens in your browser. Keep that window open; close it to stop the board. Next time, just double-click the file.

**Or type one command** (needs Node 22.18 or newer): `npx team-board`. Add `--demo` to see sample data. (This works once the package is published to npm.)

The first time, click "Sign in with GitHub", copy the code it shows into GitHub, then pick your project. The board changes nothing unless you save a setting. If you already signed in to GitHub's command-line tool during setup, the board uses that sign-in instead.

## What you'll see

- **Waiting for you:** anything the team needs from you, in Ella's words, with a "Try it" link when there is a new version to try.
- **Ella handled these herself:** small calls she made without asking you, greyed out, so you can check them.
- **What the team is doing:** every piece of work by stage (getting ready, ready to build, being built, being checked, waiting for you, done), who has it and whether it passed its check. Above the cards, the team's three newest saved steps ("Priya: Add spec 001"), so you see progress from the first minutes, before any card exists.
- **Your app:** the live link and the versions so far, once the app is online.
- **Settings and keys:** the keys your app needs, each with why and where to get it. Paste a key and press Save, or press "Make one for me" where the board can make it up. If the board says it can't see your project or its settings, use its "Let the board see it" link and press Install on GitHub.

The board reads GitHub at most once a minute; press "Check now" to read it again. "Change project", "Sign out" and "Stop the board" are at the top.

## For developers

How the team works here is in `AGENTS.md` and `TEAM.md`. From this folder: `npm install`, then `npm start` (or `npm run demo` for the sample project). Checks: `npm test` and `npm run typecheck`. Why TypeScript: `docs/decisions/0001-stack.md`. `npm run package` builds the one-file app for this computer into `dist-app/`; the release workflow builds the Mac and Windows ones (run it by hand with a version like `v0.2.0`).

Options: `--demo` (sample data, saves nothing), `--repo owner/name` (show this project instead of the saved one), `--port <n>` (default 4321; the next nine are tried if it's busy), `--no-open` (don't open the browser). The board only listens on this computer.

Sign-in, in this order: the board's own saved sign-in, then `GITHUB_TOKEN` or `GH_TOKEN`, then the GitHub command-line tool's sign-in. The saved sign-in and chosen project live in `~/.config/team-board/config.json` on Mac and Linux, or `%APPDATA%\team-board\config.json` on Windows (`BOARD_CONFIG_DIR` moves it). `BOARD_GITHUB_CLIENT_ID=none` turns "Sign in with GitHub" off; `BOARD_GITHUB_CLIENT_ID` and `BOARD_GITHUB_APP_SLUG` point it at another GitHub App. `BOARD_GITHUB_API` and `BOARD_GITHUB_WEB` are for tests and only accept an address on this computer.

What the board reads from GitHub is the contract in `.team/docs/github-state.md`, "What a person sees".
