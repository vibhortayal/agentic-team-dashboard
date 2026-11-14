---
name: screen-review
description: Capture a web app's screens at phone and desktop width, in light and dark, and review them region by region against the project's DESIGN.md. Use when verifying a ticket that changes a screen, for a design critique from screenshots, and when checking a preview after a release.
license: Apache-2.0
---

# Screen review

The Verifier and the Critic look at screens the same way, so their findings line up. Same widths, same themes, same states, same file names.

## Capture

1. Get the app running: the preview address from the handoff, or a local server. To start one for the run, use the `webapp-testing` skill's `with_server.py`.
2. Run the script next to this file once per state you need to see:

   ```bash
   python3 <this skill>/scripts/screens.py --url http://localhost:5173 \
     --out verification/<issue>/screens --path / --path /settings --state default
   ```

   It saves each page at phone (390 px) and desktop (1440 px), light and dark, and appends console errors to `console.txt`. It exits with an error if any page fails to load or logs one.
3. **Every state the spec names:** empty, loading, error and full. Set the state up first (seed or clear data, stop the backend for the error state, slow the network for loading), then run with `--state empty` and so on. In the error state the failed requests you caused are expected: check that the log names only those.
4. If a page needs an interaction to reach (a dialog, a filled form), write a short Playwright script in the `webapp-testing` way and save its screenshots with the same naming.
5. Commit the screenshots and `console.txt` with the evidence. A screenshot that wasn't committed didn't happen.

## Review

Read `DESIGN.md` first, then go region by region (header, main content, each panel, footer) at each width and theme:

- **Rules:** tokens only (no stray colours or sizes), the type scale, spacing on the scale, the component library's own patterns.
- **Usability:** the main action is obvious, text is readable (contrast at least 4.5:1, nothing clipped or overlapping), tap targets big enough on the phone, keyboard focus visible.
- **Content:** real words, not placeholder text. Error and empty states say what happened and what to do.
- **Generic AI look:** the defaults the `frontend-design` skill lists (one-word accents in headlines, all-caps eyebrows, identical cards with the same shadow) when `DESIGN.md` didn't ask for them.

Each finding: the screenshot file, the region, the rule or usability problem, and the smallest fix. Tie it to a line in `DESIGN.md`, a spec criterion or a named principle; anything you can't tie to one is a note, not a finding.

A visual change the spec asked for still needs the owner's OK on the new look (`human:approve-ui`).
