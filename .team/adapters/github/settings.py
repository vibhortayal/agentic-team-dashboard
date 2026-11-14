#!/usr/bin/env python3
"""Set a project's GitHub settings and secret keys, so the owner never opens GitHub for them.

Needs the gh CLI, signed in as the owner (its usual `repo` permission is enough). Run it from the
project folder; it reads the list in `team-settings.json` there and acts on that folder's repo.

  settings.py status          what the list asks for, and what is set (names only, never values)
  settings.py fill            set every missing setting whose value is known, and make up every
                              missing secret marked "random"; add --force to also reset known values
  settings.py ask NAME        for the owner's own terminal: asks for one value with hidden typing
                              and saves it; the value never passes through a chat

The list (Ella keeps it; it holds names and help, never a secret's value):

  {"settings": [
    {"name": "SETUP_CMD", "kind": "variable", "why": "How the checks get the app ready to test.",
     "value": "npm ci && npm run build"},
    {"name": "AI_API_KEY", "kind": "secret", "why": "Lets the app write replies with an AI model.",
     "get": "https://<where the owner makes the key>", "steps": "Sign in, press Create key, copy it."},
    {"name": "SESSION_SECRET", "kind": "secret", "why": "Keeps people signed in safely.", "make": "random"}
  ]}

Names are upper case and never start with GITHUB_. "value" is only for variables ("@me" means the
signed-in GitHub login), "make": "random" only for secrets. The progress board's Settings page reads
the same list, so the owner can paste a key there instead of using `ask`. The board reads the first 50 entries,
skips any without a valid name, kind and why, shows a "get" link only if it is https, and shows the checks'
own settings (TEAM_OWNER, TEAM_CHECKER, TEAM_RECEIPTS, LINT_CMD, SETUP_CMD, DOCS_BUDGET) without letting
the owner change them there.
"""
import getpass
import json
import re
import secrets
import subprocess
import sys

LIST = "team-settings.json"
NAME = re.compile(r"^(?!GITHUB_)[A-Z_][A-Z0-9_]{0,99}$")


def gh(args, stdin=None):
    r = subprocess.run(["gh"] + args, input=stdin, stdin=None if stdin is not None else subprocess.DEVNULL,
                       capture_output=True, text=True)
    if r.returncode:
        # gh's own message names the setting, never its value (values go in on stdin or --body).
        raise SystemExit("gh %s failed: %s" % (" ".join(args[:3]), r.stderr.strip()))
    return r.stdout


def read_list(path=LIST):
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        raise SystemExit("No %s here. Run this from the project folder, or write the list first." % path)
    except ValueError as e:
        raise SystemExit("%s isn't valid JSON: %s" % (path, e))
    wanted, seen, problems = [], set(), []
    for i, e in enumerate(data.get("settings", []) if isinstance(data, dict) else []):
        e = e if isinstance(e, dict) else {}
        name = str(e.get("name", "")).strip()
        why = str(e.get("why", "")).strip()
        if not NAME.match(name) or e.get("kind") not in ("secret", "variable") or not why or name in seen:
            problems.append("entry %d (%s): needs an upper-case name not starting GITHUB_, kind secret or variable, a why, and no repeat" % (i + 1, name or "no name"))
            continue
        if "value" in e and e["kind"] != "variable" or "make" in e and (e["kind"] != "secret" or e["make"] != "random"):
            problems.append("%s: value is only for variables, make: random only for secrets" % name)
            continue
        seen.add(name)
        wanted.append(e)
    return wanted, problems


def current():
    variables = {v["name"].upper(): v["value"] for v in json.loads(gh(["variable", "list", "--json", "name,value"]) or "[]")}
    secrets_ = {s["name"].upper() for s in json.loads(gh(["secret", "list", "--json", "name"]) or "[]")}
    return variables, secrets_


def status():
    wanted, problems = read_list()
    variables, secrets_ = current()
    missing = 0
    for e in wanted:
        is_set = e["name"] in (variables if e["kind"] == "variable" else secrets_)
        missing += not is_set
        how = "" if is_set else ("  (fill sets it)" if e.get("make") or "value" in e else "  (owner pastes it: board Settings page, or `ask`)")
        print("%-8s %-9s %s%s" % ("set" if is_set else "MISSING", e["kind"], e["name"], how))
    for p in problems:
        print("LIST PROBLEM: " + p)
    return 1 if missing or problems else 0


def fill(force=False):
    wanted, problems = read_list()
    variables, secrets_ = current()
    me = None
    for e in wanted:
        n = e["name"]
        if e["kind"] == "variable" and "value" in e:
            value = str(e["value"])
            if value == "@me":
                me = me or gh(["api", "user", "--jq", ".login"]).strip()
                value = me
            if n not in variables or (force and variables[n] != value):
                gh(["variable", "set", n, "--body", value])
                print("set " + n)
        elif e["kind"] == "secret" and e.get("make") == "random" and n not in secrets_:
            gh(["secret", "set", n], stdin=secrets.token_urlsafe(32))
            print("made " + n)
    for p in problems:
        print("LIST PROBLEM: " + p)
    return status()


def ask(name):
    wanted, _ = read_list()
    e = next((x for x in wanted if x["name"] == name), None)
    if not e:
        raise SystemExit("%s isn't on the list in %s." % (name, LIST))
    print(e["why"])
    if e.get("get"):
        print("Get it here: " + e["get"])
    if e.get("steps"):
        print(e["steps"])
    if e["kind"] == "secret":
        value = getpass.getpass("Paste it here and press Enter (it stays hidden): ").strip()
    else:
        value = input("Type it and press Enter: ").strip()
    if not value:
        raise SystemExit("Nothing was typed, so nothing changed.")
    if e["kind"] == "secret":
        gh(["secret", "set", name], stdin=value)
    else:
        gh(["variable", "set", name, "--body", value])
    print("Saved %s. You can close this window." % name)
    return 0


def main(argv):
    if argv[:1] == ["status"]:
        return status()
    if argv[:1] == ["fill"]:
        return fill(force="--force" in argv)
    if argv[:1] == ["ask"] and len(argv) == 2:
        return ask(argv[1])
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
