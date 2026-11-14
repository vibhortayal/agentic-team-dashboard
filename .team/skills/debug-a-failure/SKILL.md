---
name: debug-a-failure
description: Find the cause of a failing test, a BLOCK finding, a broken build or a bug before changing any code. Use whenever something fails and the cause isn't already obvious from the error, and before a second attempt at a fix that didn't work.
license: Apache-2.0
---

# Debug a failure

Guessing at fixes burns fix rounds and hides the real fault. Find the cause first, then fix the kind of fault, not just the case.

## Steps

1. **Read the whole error.** The full message, the stack, the first failure (later ones are often knock-ons). Note the exact command and revision.
2. **Reproduce it** at that revision with one command. If you can't reproduce it, say so and stop; don't fix what you can't see fail.
3. **Shrink it.** Cut the input, the setup and the steps until removing anything more makes it pass. That smallest repro goes in your notes and, later, in the test.
4. **Look at what changed.** `git diff <last good>..<first bad>` or `git bisect` when there's a known good revision. Most failures sit in the change, not in old code.
5. **One hypothesis at a time.** Write it down ("the date is parsed in local time, so it's off by a day after 23:00"), then run the one check that would prove it wrong. Change one thing per check. Don't stack fixes.
6. **Name the cause** in one sentence before writing a fix. If you can't, you haven't found it.
7. **Failing test first.** Write a new test that fails for that cause, then fix until it passes. Existing tests are read-only to the builder; if one is wrong, tell the coordinator.
8. **Look for the same fault elsewhere** (the same pattern, the same helper, the same assumption) and fix each with its own test.
9. **Rerun everything**, not just the new test, and record the commands and output.

## When to stop

After three hypotheses that each proved wrong, stop guessing. Write what you tried, what each check showed, and what you'd need to go further, and send it to the coordinator. If the cause is that the spec is wrong or the task can't be done in scope, that's a typed blocker, not another round.

---

The approach draws on the systematic-debugging skill in [obra/superpowers](https://github.com/obra/superpowers) (MIT, Jesse Vincent), rewritten for the team's rules.
