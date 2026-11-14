---
name: team-comment
description: Write a team comment on a GitHub issue or PR (handoff, verdict, blocker, question, report or note) with the header, the evidence line, the next prompt and the one-line team-event. Use every time a team role posts on an issue or PR, and to check a comment before posting it.
license: Apache-2.0
---

# Team comment

Every handoff, verdict, blocker and question on the team is one GitHub comment in a fixed shape, so people can read it and tools can follow it. The full rules are in `.team/docs/github-state.md` (comment format and the label table). This skill makes the shape hard to get wrong.

## Write one

1. Put the body in a file: what you did or found, then what you need. A handoff, fix request or verdict body opens with the evidence line: `Rows:` · `Revision:` · `Files:` · `Command:` · `Expected / actual:` · `Repro:`, with `n/a` where a field doesn't apply.
2. Build the comment with the script next to this file. It adds the header, the next prompt for the role you hand to, and the event line, and refuses anything the replayer would reject:

   ```bash
   python3 <this skill>/scripts/team_comment.py --from verifier --to implementer \
     --kind verdict --verdict BLOCK --rev abc1234 --round 2 --issue 42 --body body.md > comment.md
   ```

   Use `--human human:merge` (or another `human:` label) when the comment asks a person to act, and add that label in the same step.
3. Post `comment.md` as written (`gh issue comment 42 --body-file comment.md`), then swap the `role:` and `stage:` labels as the table in `github-state.md` says. One role label and one stage label at a time.

## Approval receipts (Ella only)

When the owner says yes in chat, Ella posts a receipt before she merges, adds an owner label or asks Otto to release. The body quotes the owner's words in a `>` line and says when they said them and the one thing approved:

```bash
python3 <this skill>/scripts/team_comment.py --from engagement-lead --to owner \
  --kind approval --approves spend-approved --body body.md > comment.md
```

`--approves` is the label, `merge` or `release`; add `--rev <head>` for a merge. The gates ignore an owner label with no receipt before it.

## Check one

`python3 <this skill>/scripts/team_comment.py --check comment.md` prints `ok` or each problem. Run it on a comment you wrote by hand before posting.

## Rules the script can't check

- Point at the source by path and exact commit; never paste a summary in place of it.
- One comment per event. Don't edit a posted team comment to change its meaning; post a new one.
- If the tool can't post (no access, rate limit), that's a blocker, not a reason to skip the comment.
