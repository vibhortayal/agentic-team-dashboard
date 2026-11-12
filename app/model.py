"""Turn what the team writes on GitHub into the board, in plain words.

Pure functions only: the input is the raw issue and comment data GitHub returns,
the output is the dict the page draws. No network here, so it is easy to test.
The contract this reads is .team/docs/github-state.md.
"""
from __future__ import annotations

import json
import re
from typing import Any

from redact import mask_tree

EVENT = re.compile(r"<!--\s*team-event\s*(\{.*?\})\s*-->", re.S)

PEOPLE = {
    "engagement-lead": ("Ella", "your guide"),
    "product-manager": ("Priya", "plans the work"),
    "researcher": ("Rohan", "looks things up"),
    "critic": ("Quinn", "looks for problems"),
    "architect": ("Arjun", "designs big builds"),
    "implementer": ("Ian", "builds"),
    "verifier": ("Vera", "checks the work"),
    "evaluator": ("Max", "scores AI answers"),
    "budget-analyst": ("Bea", "watches the budget"),
    "ops": ("Otto", "keeps things running"),
    "owner": ("you", ""),
}

# stage label -> column key
STAGE_COLUMN = {
    "intake": "getting-ready", "research": "getting-ready", "spec": "getting-ready",
    "ready": "ready", "building": "building", "verifying": "checking",
    "review": "waiting", "done": "done",
}

COLUMNS = [
    ("getting-ready", "Getting ready", "Ella and Priya are working out what to build."),
    ("ready", "Ready to build", "The plan is agreed. Building starts next."),
    ("building", "Being built", "Ian is building it."),
    ("checking", "Being checked", "Vera is checking it works."),
    ("waiting", "Waiting for you", "Checked and ready for you to try."),
    ("done", "Done", "Finished and accepted."),
]

NEEDED = {
    "human:answer": "The team has a question for you.",
    "human:approve": "Something needs your OK.",
    "human:approve-spec": "A plan is ready. Please read it and say yes or no.",
    "human:approve-release": "A new version is ready to go live, with your OK.",
    "human:merge": "Finished work is ready for you to try and accept.",
    "human:spend": "The team wants to spend more than you agreed.",
    "human:access": "The team needs access to something only you can give.",
    "human:red-zone": "A change touches a sensitive area and needs your OK.",
    "human:approve-ui": "New screens are ready for you to look at.",
    "human:blocker": "The team is stuck and needs your help.",
}
NEEDED_DEFAULT = "The team needs you."

CHECK_WORDS = {
    "PASS": ("passed", "Checked: passed"),
    "BLOCK": ("fixes", "Checked: needs fixes"),
}
NOT_CHECKED = ("none", "Not checked yet")


def person(role: str | None) -> str:
    if not role:
        return "Nobody yet"
    name, job = PEOPLE.get(role, (role.replace("-", " ").title(), ""))
    return f"{name} ({job})" if job else name


def first_name(role: str | None) -> str:
    return PEOPLE.get(role or "", (role or "someone", ""))[0]


def parse_event(body: str) -> dict[str, Any] | None:
    """Return the team-event JSON from a comment, or None if it has none or it is broken."""
    found = EVENT.findall(body or "")
    if not found:
        return None
    try:
        data = json.loads(found[-1])
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def _plain(line: str) -> str:
    line = re.sub(r"[*_`#>]", "", line).strip()
    return re.sub(r"\s+", " ", line)


def reason_line(body: str) -> str:
    """The first line after the header, in plain text: Ella's one-line reason."""
    lines = [ln for ln in (body or "").splitlines() if ln.strip() and "team-event" not in ln]
    if len(lines) >= 2:
        return _plain(lines[1])
    return _plain(lines[0]) if lines else ""


def describe(event: dict[str, Any]) -> str:
    """One plain sentence for a team event."""
    who = first_name(event.get("from"))
    to = event.get("to")
    kind = event.get("kind")
    if kind == "verdict":
        word = {"PASS": "it works", "BLOCK": "it needs fixes", "INCONCLUSIVE": "the check isn't finished"}
        return f"{who} checked it: {word.get(str(event.get('verdict')), 'see the note')}."
    if kind == "handoff":
        return f"{who} passed it to you." if to == "owner" else f"{who} passed it to {first_name(to)}."
    if kind == "question":
        return f"{who} asked {'you' if to == 'owner' else first_name(to)} a question."
    if kind == "blocker":
        return f"{who} is stuck and stopped."
    if kind == "report":
        return f"{who} posted a report."
    if kind == "note":
        return f"{who} left a note."
    return f"{who} posted an update."


def _labels(item: dict[str, Any]) -> list[str]:
    return [(lb.get("name") if isinstance(lb, dict) else str(lb)) or "" for lb in item.get("labels", [])]


def _one(labels: list[str], prefix: str) -> str | None:
    for lb in labels:
        if lb.startswith(prefix):
            return lb[len(prefix):]
    return None


def team_comments(comments: list[dict[str, Any]]) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    """(comment, event) pairs in time order, team comments only."""
    out = []
    for c in sorted(comments, key=lambda c: c.get("created_at") or ""):
        ev = parse_event(c.get("body") or "")
        if ev is not None:
            out.append((c, ev))
    return out


def build_card(item: dict[str, Any], comments: list[dict[str, Any]]) -> dict[str, Any]:
    labels = _labels(item)
    stage = _one(labels, "stage:")
    role = _one(labels, "role:")
    events = team_comments(comments)

    check = NOT_CHECKED
    for _c, ev in events:
        if ev.get("kind") == "verdict":  # the latest verdict wins, whatever it says
            check = CHECK_WORDS.get(str(ev.get("verdict")), NOT_CHECKED)

    update, update_at, update_url = "No team updates yet.", item.get("updated_at"), item.get("html_url")
    if events:
        c, ev = events[-1]
        update, update_at, update_url = describe(ev), c.get("created_at"), c.get("html_url") or update_url

    needed = None
    if "needs-human" in labels:
        human = next((lb for lb in labels if lb.startswith("human:")), "")
        ask_url = item.get("html_url")
        for c, ev in events:
            if ev.get("to") == "owner" or ev.get("human"):
                ask_url = c.get("html_url") or ask_url
        needed = {"why": NEEDED.get(human, NEEDED_DEFAULT), "url": ask_url}

    handled = None
    for c, ev in events:
        if ev.get("from") == "engagement-lead" and ev.get("kind") == "note":
            handled = {"why": reason_line(c.get("body") or ""), "url": c.get("html_url"), "at": c.get("created_at")}

    column = STAGE_COLUMN.get(stage or "")
    return {
        "number": item.get("number"),
        "title": item.get("title") or "",
        "url": item.get("html_url"),
        "kind": "change" if "pull_request" in item else "task",
        "stage": stage,
        "column": column,
        "holder": person(role) if column != "done" else "",
        "update": update,
        "update_at": update_at,
        "update_url": update_url,
        "check": check[0],
        "check_words": check[1],
        "needed": needed,
        "handled": handled,
        "closed": item.get("state") == "closed",
    }


def build_board(repo: str, items: list[dict[str, Any]], comments: dict[int, list[dict[str, Any]]],
                updated: str, error: str | None = None) -> dict[str, Any]:
    cards = [build_card(it, comments.get(it.get("number"), [])) for it in items]
    needed, handled = [], []
    columns = {key: [] for key, _t, _h in COLUMNS}
    for card in cards:
        if card["needed"] and not card["closed"]:
            needed.append(card)
        elif card["handled"] and not card["closed"]:
            handled.append(card)
        if card["column"]:
            columns[card["column"]].append(card)
    board = {
        "repo": repo,
        "repo_url": f"https://github.com/{repo}" if repo else "",
        "updated": updated,
        "error": error,
        "needed": needed,
        "handled": handled,
        "columns": [{"key": k, "title": t, "help": h, "cards": columns[k]} for k, t, h in COLUMNS],
    }
    return mask_tree(board)  # type: ignore[return-value]


def error_board(repo: str, updated: str, error: str) -> dict[str, Any]:
    return build_board(repo, [], {}, updated, error)
