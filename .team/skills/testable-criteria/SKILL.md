---
name: testable-criteria
description: Write or review acceptance criteria as numbered Given/When/Then rows that someone can check from the spec alone. Use when drafting a spec or change spec, when building an acceptance map, and when reviewing a spec for readiness before any build.
license: Apache-2.0
---

# Testable criteria

A criterion is good when a checker who has never seen the conversation can turn it into a pass or fail. The spec templates are in `.team/templates/spec.md` and `.team/templates/documents.md`; this skill is how to fill the criteria in.

## Write them

1. **One behaviour per row**, numbered `AC1`, `AC2`, ... and never renumbered once reviewed (add `AC7`, don't shift `AC3`).
2. **Given / When / Then** with real values: `Given a cart with 3 items, When the person removes 1, Then the total shows 2 items and the price drops by that item's price.`
3. **Say what's observable from outside:** a response code, a message on screen, a file or message another system receives. A stored record counts only when keeping or deleting the data is the requirement. Not "handles errors gracefully".
4. **Put a number on every quality word.** "Fast", "large", "many", "secure", "user-friendly" mean nothing to a checker. "First page shows within 2 seconds on the preview", "accepts files up to 10 MB".
5. **Every limit gets both sides:** the last allowed value passes, the first disallowed value is rejected with a stated message. Write both rows.
6. **Write the rejection rows,** not only the happy path: empty input, wrong type, duplicate, missing permission, the service being down.
7. **Help pages:** if what a user sees or does changes, one row checks the shipped help page says the new wording.
8. **Screens:** name the states (empty, loading, error, full) and the widths (phone and desktop). A visual change says where the before and after screenshots go.
9. **No "should", "may", "etc." or "and so on".** If it's optional, it's not a criterion.

## Review them

Go row by row and mark each `OK` or `FIX`, with the reason for every `FIX`:

- Could two checkers disagree on pass or fail? That's a `FIX`.
- Does it need knowledge outside the spec (a chat, a guess about intent)? `FIX`.
- Is it two behaviours in one row? `FIX`: split it.

Then list every spec statement that has **no** row (a rule in the prose, a limit in a table, an error in the API contract). Those gaps are the most common reason work passes its checks and still does the wrong thing. End with `GO` (nothing to fix, no gaps) or `NO-GO` and the list.
