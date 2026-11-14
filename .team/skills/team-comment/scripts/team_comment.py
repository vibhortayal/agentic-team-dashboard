#!/usr/bin/env python3
"""Build or check a team comment. Standard library only.

  team_comment.py --from ROLE --to ROLE|owner --kind KIND [--verdict V --rev SHA --round N]
                  [--issue N] [--human human:LABEL] [--approves LABEL|merge|release]
                  [--body FILE] [--roles DIR]
  team_comment.py --check FILE [--roles DIR]

Role names come from the role files: .team/roles/ in a project, roles/ in the team repo.
Prints the comment (or "ok") on stdout; problems go to stderr with exit code 1.
"""
import argparse, json, os, re, sys

KINDS = ("handoff", "verdict", "blocker", "question", "report", "note", "approval")
VERDICTS = ("PASS", "BLOCK", "INCONCLUSIVE")
EVENT = re.compile(r"<!--\s*team-event\s+(.*?)\s*-->", re.S)
HEADER = re.compile(r"^\*\*[^*()]+\(([a-z-]+)\)\s*(?:→|->)")


def find_roles(given):
    if given:
        return given
    here = os.path.dirname(os.path.realpath(__file__))
    candidates = [os.path.join(here, "..", "..", "..", "roles")]
    d = os.getcwd()
    while True:
        candidates += [os.path.join(d, ".team", "roles"), os.path.join(d, "roles")]
        if os.path.dirname(d) == d:
            break
        d = os.path.dirname(d)
    for c in candidates:
        if os.path.isdir(c) and any(f.endswith(".md") and not f.startswith("_") for f in os.listdir(c)):
            return os.path.normpath(c)
    sys.exit("can't find the role files; pass --roles <dir>")


def load_roles(path):
    out = {}
    for f in sorted(os.listdir(path)):
        if not f.endswith(".md") or f.startswith("_"):
            continue
        text = open(os.path.join(path, f), encoding="utf-8").read()
        persona = re.search(r"^persona:\s*(.+?)\s*$", text, re.M)
        title = re.search(r"^# (.+?)\s*$", text, re.M)
        out[f[:-3]] = {"persona": persona.group(1) if persona else f[:-3], "title": title.group(1) if title else f[:-3]}
    return out


def problems(ev, roles, body=""):
    errs = []
    frm, to, kind = ev.get("from"), ev.get("to"), ev.get("kind")
    if frm not in roles and not (kind == "approval" and frm == "owner"):
        errs.append("from %r is not a role" % frm)
    if to is not None and to not in roles and to != "owner":
        errs.append("to %r is not a role or owner" % to)
    if kind not in KINDS:
        errs.append("kind %r is not one of %s" % (kind, ", ".join(KINDS)))
    if kind == "verdict":
        if ev.get("verdict") not in VERDICTS:
            errs.append("verdict %r is not PASS, BLOCK or INCONCLUSIVE" % ev.get("verdict"))
        if frm != "verifier":
            errs.append("only the verifier gives verdicts")
        if not ev.get("rev"):
            errs.append("a verdict needs rev (the full revision it judged)")
        rnd = ev.get("round")
        if ev.get("verdict") == "BLOCK" and isinstance(rnd, int):
            if rnd > 3:
                errs.append("BLOCK round %d: three BLOCKs stop with a typed blocker" % rnd)
            elif rnd == 3 and to == "implementer":
                errs.append("the third BLOCK goes to the coordinator, not the implementer")
    elif "verdict" in ev:
        errs.append("verdict field on a %s" % kind)
    if kind == "approval":
        if frm not in ("engagement-lead", "owner"):
            errs.append("only Ella (or the owner) writes an approval receipt")
        if not ev.get("approves"):
            errs.append("an approval receipt needs approves (the label, merge or release it approves)")
        if not re.search(r'^> ', body, re.M):
            errs.append("an approval receipt quotes the owner's words in a > line")
    elif "approves" in ev:
        errs.append("approves field on a %s" % kind)
    if ev.get("human") and not str(ev["human"]).startswith("human:"):
        errs.append("human %r is not a human: label" % ev["human"])
    if kind in ("handoff", "verdict") and to in roles:
        if not re.search(r"You are (?:the )?[A-Z][\w -]*\. Read \S*roles/%s\.md" % re.escape(to), body):
            errs.append("hands to %s without a next prompt for that role" % to)
    return errs


def build(a, roles):
    ev = {"from": a.frm, "to": a.to, "kind": a.kind}
    if a.verdict:
        ev["verdict"] = a.verdict
    if a.rev:
        ev["rev"] = a.rev
    if a.round is not None:
        ev["round"] = a.round
    if a.human:
        ev["human"] = a.human
    if a.approves:
        ev["approves"] = a.approves
    body = open(a.body, encoding="utf-8").read().strip() if a.body else ""
    who = lambda r: "owner" if r == "owner" else "%s (%s)" % (roles.get(r, {}).get("persona", r), r)
    header = "**%s → %s** · %s" % (who(a.frm), who(a.to), a.kind)
    if a.verdict:
        header += " · " + a.verdict
    if a.rev:
        header += " · rev `%s`" % a.rev[:12]
    parts = [header, body] if body else [header]
    if a.kind in ("handoff", "verdict") and a.to in roles:
        if a.issue is None:
            sys.exit("--issue is needed to write the next prompt for %s" % a.to)
        prompt = "You are the %s. Read .team/roles/%s.md and act on issue #%d." % (roles[a.to]["title"], a.to, a.issue)
        parts.append("```\n%s\n```" % prompt)
    parts.append("<!-- team-event %s -->" % json.dumps(ev, ensure_ascii=False, separators=(",", ":")))
    text = "\n\n".join(parts) + "\n"
    errs = problems(ev, roles, text)
    if errs:
        sys.exit("\n".join("problem: " + e for e in errs))
    return text


def check(path, roles):
    text = open(path, encoding="utf-8").read()
    errs = []
    first = next((l.strip() for l in text.splitlines() if l.strip()), "")
    if not HEADER.match(first):
        errs.append("first line isn't a team header like **Vera (verifier) → Ian (implementer)** · ...")
    found = EVENT.findall(text)
    if len(found) != 1:
        errs.append("needs exactly one team-event line, found %d" % len(found))
    else:
        raw = found[0]
        if "\n" in raw:
            errs.append("team-event JSON is not on one line")
        else:
            try:
                errs += problems(json.loads(raw), roles, text)
            except ValueError:
                errs.append("team-event is not valid JSON")
    return errs


def main(argv):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--check")
    p.add_argument("--from", dest="frm")
    p.add_argument("--to")
    p.add_argument("--kind", choices=KINDS)
    p.add_argument("--approves", help="approval receipts: the label, merge or release the owner said yes to")
    p.add_argument("--verdict", choices=VERDICTS)
    p.add_argument("--rev")
    p.add_argument("--round", type=int)
    p.add_argument("--issue", type=int)
    p.add_argument("--human")
    p.add_argument("--body")
    p.add_argument("--roles")
    a = p.parse_args(argv)
    roles = load_roles(find_roles(a.roles))
    if a.check:
        errs = check(a.check, roles)
        if errs:
            sys.exit("\n".join("problem: " + e for e in errs))
        print("ok")
        return
    if not (a.frm and a.to and a.kind):
        p.error("--from, --to and --kind are needed (or --check FILE)")
    sys.stdout.write(build(a, roles))


if __name__ == "__main__":
    main(sys.argv[1:])
