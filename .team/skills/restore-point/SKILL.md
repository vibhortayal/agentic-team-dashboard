---
name: restore-point
description: Save a named restore point after each change the owner approves, list them in plain words, and take the app back to one when the owner asks ("go back to Tuesday's version"). Use after every merge the owner said yes to, and whenever the owner wants to undo, compare or recover an earlier version.
license: Apache-2.0
---

# Restore points

A newcomer is often afraid to break things. A restore point is a saved version of the app they can always go back to, like the version history in a shared document. Going back never deletes anything: it is a new change that makes the app match the old version, checked like any other.

## Save one

Right after a change the owner said yes to is merged into `main`, tag the merge commit:

```bash
git tag -a "restore/$(date +%Y-%m-%d)-<issue>-<slug>" <merge-commit> -m "<one plain sentence: what the app could do at this point>"
git push origin "restore/$(date +%Y-%m-%d)-<issue>-<slug>"
```

The message is for the owner, so write it as they'd say it: "Grocery list with sign-in, before the budget feature." Never move or delete a tag. A tag is not a commit, so this needs no PR.

## List them

When the owner asks what they can go back to, run `git tag -l 'restore/*' -n1 --sort=-creatordate` and show the latest five as a short list: date, the sentence, and what changed since. Offer older ones if they ask.

## Go back

1. **Say what will happen first,** in plain words: which features disappear, that nothing is deleted for good, and that it can be undone the same way. **Saved data is not rolled back.** Lists, accounts and uploads people added stay as they are. If the old version can't read data saved since, say so and stop until the owner decides.
2. **If the live app is broken right now,** the first step is Otto's rollback of the deploy (the production playbook's "roll back first" rule). This skill is for the code, which takes longer.
3. **Open an issue** "Go back to <restore point>" and hand it to Priya. Its one-line criterion: the app's files match the tag, and the team's records (`docs/`, `budget/`, `reports/`, `verification/`) stay as they are now.
4. Ian makes the change as one new commit on a ticket branch, never by resetting or force-pushing `main`:

   ```bash
   git restore --source=<tag> --staged --worktree -- . ':!docs' ':!budget' ':!reports' ':!verification'
   git commit -m "Go back to <tag>"
   ```

   This brings back the tagged files and removes files added since, while the team's records stay. Vera checks that `git diff <tag> HEAD` shows only team records, then runs the smoke checks and the share check.
5. If the range changed tests, gate files or a red zone, the tamper guard asks for the owner's labels. Walk them through it with the `explain-a-step` skill, naming what each label approves.
6. The owner tries the preview and merges, as with any change. Then save a new restore point for it.
