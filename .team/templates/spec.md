# <Product or change>: spec vN

`docs/specs/vN.md`, for a new product's first version or a change that reshapes the data model or API. Everything else uses a [change spec](documents.md#change-spec).

Owner approval: `<link>` · Date: `<YYYY-MM-DD>`

## Changes in this version
## 1. Problem
## 2. Goal
## 3. Scope in
## 4. Scope out
## 5. Acceptance criteria
Numbered, Given/When/Then, each checkable from this spec alone.

| # | Given | When | Then | Traces to (requirement, API operation, screen, preview check) |
|---|---|---|---|---|
| AC1 | | | | |

## 6. Constraints (owner-stated only)
## 7. Non-functional targets (measurable: latency, cost, privacy, availability)
## 8. Data model
## 9. API contract (OpenAPI 3.x or AsyncAPI, linked or inline)
## 10. Screens (each mapped to API operations)
## 11. AI components (component, metric, golden set, pass mark; omit if none)
## 12. Units (order and dependencies)
## 13. Risks (from the critique, each with its proof or gate)
## 14. Open questions
## 15. Release (preview target, criteria checked on the preview, smoke steps, rollback, monitoring)

---

## Dispatch

The only input to a multi-unit run. Priya commits it as `docs/specs/vN-dispatch.md` after the owner approves the spec, and posts it on the run's issue as a handoff to Arjun. Handoffs point at the spec by path and commit; nothing is pasted.

```markdown
Spec: <path> @ <sha>, version vN approved in <owner's message>
Spec review: docs/specs/vN-review/ and the readiness verdict
Open questions: none, or the deferred list
Repo: <URL> · Team pin: <version>
Units in order: ... · Dependencies: ... (independent units start from main)
Supplied checks: <commands> · Constraints: <what must not be touched or must keep working>
Preview: <command from TEAM.md, criteria checked on the preview; or "no release section: stop at the merged PR">
Next: Architect
```

## Acceptance map

`work/<issue>/acceptance-map.md`, written by Arjun in multi-unit mode. Every requirement, rule, rejection case and boundary in the spec gets a row; supplied checks only cover part of it. In ticket mode the change spec's criteria are the rows.

| Row | Spec statement (quote or section) | Interpretation, if unclear | How it's checked |
|---|---|---|---|
| 1 | | | |
