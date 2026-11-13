#!/usr/bin/env python3
"""Team gates: the CI checks that agents cannot argue with.

Standard library only. In CI this file is always taken from the BASE branch, never
from the pull request, so a pull request cannot change the guard that judges it
(see workflows/team-gates.yml).

  team_gates.py classify --branch NAME
  team_gates.py tamper   --base SHA --head SHA --branch NAME [--approved a,b]
  team_gates.py verdict  --base SHA --head SHA --branch NAME [--checker-approved]
  team_gates.py quality  --base SHA --head SHA            (reads LINT_CMD, SETUP_CMD)
  team_gates.py docs     --base SHA --head SHA            (reads DOCS_BUDGET, default 6000)
  team_gates.py strip-approvals                           (CI, on every new push)

classify  Prints the pull request's class from its branch name: ticket, trivial is a
          ticket too (team/<issue>-...), docs (docs/...), records (team/records),
          tests (verify/<issue>-tests), deps (dependabot/... or deps/...), gate (gate/...).
          Any other branch name fails, unless the PR description has one line
          "Team branch: <name>" naming one of these (for agent tools that pick the
          branch name themselves); then that name decides the class and the rules.
tamper    Fails when the PR touches a protected zone (zones.yml, read from base) without
          the owner's approval label, or touches paths its class may not touch.
          Approval labels count only if the owner's own account added them after the
          latest push (strip-approvals removes them on every push).
verdict   Ticket PRs only. Fails unless verification/<issue>/verdict.json is a valid PASS
          for a revision in the branch, nothing the ticket wrote changed after that
          revision (except its own evidence), and, when TEAM_CHECKER is set, the checker
          identity approved the exact head.
quality   Block new violations only. Runs SETUP_CMD then LINT_CMD at base and at head;
          LINT_CMD prints "<path>\t<rule>" per violation and exits 0 or 1. Fails if a changed
          file gains violations of any rule, or if the linter crashes. LINT_CMD=none opts
          out (prototype profile only).
docs      Keeps documentation lean. A new Markdown file may only appear in a folder made
          for it (DOC_FOLDERS); the standing docs (README, AGENTS, TEAM, DESIGN and
          docs/*.md) may not grow past DOCS_BUDGET words in total.
"""
import argparse, json, os, re, subprocess, sys, tempfile, urllib.request

APPROVAL = {"gate": "gate-change-approved", "tests": "tests-approved",
            "deps": "deps-approved", "red": "red-zone-approved"}
APPROVAL_LABELS = set(APPROVAL.values())

# Paths each non-ticket class may touch (besides what zones allow with a label).
CLASS_PATHS = {
    "docs": ["docs/**/*.md", "docs/**/*.png", "docs/**/*.svg", "docs/**/*.jpg", "research/**", "budget/estimate-*.md", "budget/prices.yml", "README.md", "DESIGN.md", "TEAM.md", "AGENTS.md"],
    "records": ["budget/ledger.csv", "reports/**"],
    "tests": [],          # only the tests zone, with the owner's tests-approved label
    "deps": [],           # only the deps zone, with the owner's deps-approved label
    "gate": [],           # only gate files, with the owner's gate-change-approved label
}


DOC_FOLDERS = ["docs/changes/", "docs/change-requests/", "docs/decisions/", "docs/specs/",
               "reports/", "research/", "work/", "verification/", "evals/", "budget/", ".github/",
               ".team/", ".claude/"]
STANDING_DOCS = ["README.md", "AGENTS.md", "TEAM.md", "DESIGN.md", "docs/*.md"]
ROOT_DOCS = ["CLAUDE.md", "GEMINI.md", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md", "LICENSE.md"]


def git(*args, cwd=None):
    return subprocess.run(["git", "-c", "core.quotePath=false", *args], cwd=cwd, check=True,
                          capture_output=True, text=True).stdout


def glob_re(pattern):
    out, i = "", 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out += "(?:.*/)?"; i += 3
        elif pattern.startswith("**", i):
            out += ".*"; i += 2
        elif pattern[i] == "*":
            out += "[^/]*"; i += 1
        elif pattern[i] == "?":
            out += "[^/]"; i += 1
        else:
            out += re.escape(pattern[i]); i += 1
    return re.compile("^" + out + "$", re.IGNORECASE)


def matches(path, patterns):
    return any(glob_re(p).match(path) for p in patterns)


def load_zones(text):
    """Parse the small YAML subset zones.yml uses: 'name:' then '  - pattern' lines."""
    zones, current = {}, None
    for raw in text.splitlines():
        if raw.lstrip().startswith("#") or not raw.strip():
            continue
        line = raw.split(" #")[0].rstrip()
        if not line.startswith(" ") and line.endswith(":"):
            current = line[:-1].strip(); zones[current] = []
        elif line.strip().startswith("- ") and current:
            zones[current].append(line.strip()[2:].strip().strip('"\''))
        else:
            sys.exit(f"zones.yml: cannot read line: {raw!r}")
    return zones


def changed(base, head):
    """(status, path) pairs between the merge base and head. NUL-separated, so any file name works."""
    out = git("diff", "--name-status", "-z", "-M", f"{base}...{head}").split("\0")
    pairs, i = [], 0
    while i < len(out) and out[i]:
        status = out[i][0]
        if status in "RC":
            pairs += [("D", out[i + 1]), ("A", out[i + 2])]; i += 3
        else:
            pairs.append((status, out[i + 1])); i += 2
    return pairs


TEAM_BRANCH_RE = re.compile(r"^[ \t>*_]*Team branch:[ \t*_]*`?([^\s`]+)`?[ \t*_]*$", re.I | re.M)


def classify(branch):
    """The class of a branch. A branch whose name the agent tool chose for us (say a tool that
    may only push to its own prefix) takes its class from a "Team branch: <name>" line in the
    PR description (PR_BODY), with exactly the same rules as a branch of that name."""
    cls, issue = branch_class(branch)
    if cls is None:
        named = TEAM_BRANCH_RE.findall(os.environ.get("PR_BODY") or "")
        if len(named) == 1:
            return branch_class(named[0])
    return cls, issue


def branch_class(branch):
    m = re.fullmatch(r"team/(\d+)-[A-Za-z0-9._-]+", branch)
    if m:
        return "ticket", int(m.group(1))
    m = re.fullmatch(r"verify/(\d+)-tests", branch)
    if m:
        return "tests", int(m.group(1))
    if branch == "team/records":
        return "records", None
    for prefix, cls in (("docs/", "docs"), ("dependabot/", "deps"), ("deps/", "deps"), ("gate/", "gate")):
        if branch.startswith(prefix) and len(branch) > len(prefix):
            return cls, None
    return None, None


def github(path, method="GET", body=None):
    repo, token = os.environ.get("GITHUB_REPOSITORY"), os.environ.get("GITHUB_TOKEN")
    if not repo or not token:
        sys.exit("needs GITHUB_REPOSITORY and GITHUB_TOKEN")
    req = urllib.request.Request(f"https://api.github.com/repos/{repo}/{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req) as r:
        data = r.read()
        return json.loads(data) if data else None


def paged(path):
    page, items = 1, []
    while True:
        batch = github(f"{path}{'&' if '?' in path else '?'}per_page=100&page={page}")
        items += batch
        if len(batch) < 100:
            return items
        page += 1


def owner_labels():
    """Labels currently on the PR whose latest 'labeled' event was by the owner's account."""
    pr, owner = os.environ.get("PR_NUMBER"), os.environ.get("TEAM_OWNER")
    if not pr or not owner:
        sys.exit("tamper: PR_NUMBER and TEAM_OWNER must be set")
    last_by = {}
    for e in paged(f"issues/{pr}/events"):
        if e.get("event") == "labeled":
            last_by[e["label"]["name"]] = e["actor"]["login"]
        elif e.get("event") == "unlabeled":
            last_by.pop(e["label"]["name"], None)
    return {name for name, actor in last_by.items() if actor.lower() == owner.lower()}


def cmd_classify(a):
    cls, issue = classify(a.branch)
    if cls is None:
        print(f"classify: FAIL, branch '{a.branch}' is not a team branch "
              "(team/<issue>-<slug>, docs/<topic>, team/records, verify/<issue>-tests, deps/..., dependabot/..., gate/...), "
              "and the PR description has no single 'Team branch: <one of those>' line")
        return 1
    via = "" if branch_class(a.branch)[0] else " (from the PR's 'Team branch:' line)"
    print(f"class={cls}" + (f" issue={issue}" if issue else "") + via)
    return 0


def cmd_tamper(a):
    cls, issue = classify(a.branch)
    if cls is None:
        print("tamper guard: FAIL, unknown branch class"); return 1
    zones = load_zones(git("show", f"{a.base}:zones.yml"))   # rules from base, so a PR cannot loosen them
    approved = set(filter(None, a.approved.split(","))) if a.approved is not None else owner_labels()
    problems = []
    for status, path in changed(a.base, a.head):
        zone_hits = [z for z in ("gate", "deps", "red", "tests", "evidence") if matches(path, zones.get(z, []))]
        if "evidence" in zone_hits:
            own = cls == "ticket" and path.startswith(f"verification/{issue}/")
            rehearsal = cls == "gate" and path.startswith("verification/foundation/") and APPROVAL["gate"] in approved
            moved = cls == "tests" and matches(path, ["verification/*/checks/**"]) and APPROVAL["tests"] in approved
            if not (own or rehearsal or moved):
                problems.append(f"{path}: evidence may only be written under verification/<issue>/ on that ticket's branch")
            continue
        if cls == "ticket" and matches(path, zones.get("approved", [])) and not (status == "A" and path.startswith("docs/decisions/")):
            problems.append(f"{path}: approved document; change it through a docs/<topic> pull request the owner merges")
        for zone in ("gate", "deps", "red"):
            if zone in zone_hits and APPROVAL[zone] not in approved:
                problems.append(f"{path}: {zone} zone, needs the owner's '{APPROVAL[zone]}' label")
        if "tests" in zone_hits and status == "A" and cls not in ("ticket", "tests"):
            problems.append(f"{path}: new test files only come with a ticket or a test-change pull request")
        if "tests" in zone_hits and status != "A" and APPROVAL["tests"] not in approved:
            problems.append(f"{path}: existing test {'deleted' if status == 'D' else 'changed'}, needs the owner's 'tests-approved' label")
        if cls == "tests" and APPROVAL["tests"] not in approved:
            problems.append(f"{path}: a test-change pull request needs the owner's 'tests-approved' label")
        if cls != "ticket" and not zone_hits and not matches(path, CLASS_PATHS[cls] + (zones.get("approved", []) if cls == "docs" else [])):
            problems.append(f"{path}: a '{cls}' pull request may not change this path")
        if cls == "ticket" and path.startswith("docs/changes/") and path != f"docs/changes/{issue}.md":
            problems.append(f"{path}: a ticket may only carry its own change spec")
    for p in problems:
        print("TAMPER", p)
    print(f"tamper guard ({cls}):", "FAIL" if problems else "ok")
    return 1 if problems else 0


def validate_verdict(v):
    errs = []
    for key, typ in (("issue", int), ("rev", str), ("verdict", str), ("round", int), ("checks", list)):
        if not isinstance(v.get(key), typ):
            errs.append(f"'{key}' missing or not {typ.__name__}")
    if errs:
        return errs
    if not re.fullmatch(r"[0-9a-f]{7,40}", v["rev"]):
        errs.append("'rev' is not a commit hash")
    if v["verdict"] not in ("PASS", "BLOCK", "INCONCLUSIVE"):
        errs.append("'verdict' must be PASS, BLOCK or INCONCLUSIVE")
    if v["round"] < 1:
        errs.append("'round' must be 1 or more")
    if not v["checks"]:
        errs.append("'checks' is empty")
    for i, c in enumerate(v["checks"]):
        if not isinstance(c, dict) or not all(isinstance(c.get(k), str) for k in ("id", "spec", "command", "result")):
            errs.append(f"checks[{i}] needs id, spec, command and result")
        elif c["result"] not in ("pass", "fail", "skip", "error"):
            errs.append(f"checks[{i}].result invalid")
    return errs


def blob(rev, path):
    r = subprocess.run(["git", "rev-parse", "-q", "--verify", f"{rev}:{path}"], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def checker_approved_head(head):
    checker = os.environ.get("TEAM_CHECKER")
    pr = os.environ.get("PR_NUMBER")
    if not checker:
        return None
    reviews = paged(f"pulls/{pr}/reviews")
    return any(r["user"]["login"].lower() == checker.lower() and r["state"] == "APPROVED"
               and r["commit_id"] == head for r in reviews)


def cmd_verdict(a):
    cls, issue = classify(a.branch)
    if cls != "ticket":
        print(f"verdict check: not needed for a '{cls}' pull request"); return 0
    path = f"verification/{issue}/verdict.json"
    try:
        v = json.loads(git("show", f"{a.head}:{path}"))
    except subprocess.CalledProcessError:
        print(f"VERDICT no {path} at head (the Verifier has not passed this PR)\nverdict check: FAIL"); return 1
    except json.JSONDecodeError:
        print(f"VERDICT {path} is not valid JSON\nverdict check: FAIL"); return 1
    errs = validate_verdict(v)
    if not errs:
        if v["issue"] != issue:
            errs.append(f"verdict is for issue {v['issue']}, not {issue}")
        if v["verdict"] != "PASS":
            errs.append(f"verdict is {v['verdict']}")
        failed = [c["id"] for c in v["checks"] if c["result"] != "pass"]
        if failed:
            errs.append("PASS with checks not passed: " + ", ".join(failed))
        if subprocess.run(["git", "merge-base", "--is-ancestor", v["rev"], a.head]).returncode != 0:
            errs.append(f"reviewed revision {v['rev']} is not in this branch")
        else:
            # Compare trees, not commit lists: every file that differs between the reviewed
            # revision and the head must be the Verifier's evidence, or exactly main's version
            # (brought in by merging main). Anything else was written after the PASS.
            out = git("diff", "--name-only", "-z", v["rev"], a.head).split("\0")
            for f in filter(None, out):
                if f.startswith(f"verification/{issue}/"):
                    continue
                if blob(a.head, f) != blob(a.base, f):
                    errs.append(f"{f} changed after the reviewed revision {v['rev'][:8]} and is not main's version; needs a new verdict")
    required = "checker" in load_zones(git("show", f"{a.base}:zones.yml")).get("require", [])
    if required and a.checker_approved is None and not os.environ.get("TEAM_CHECKER"):
        errs.append("zones.yml requires a checker identity but TEAM_CHECKER is not set")
    elif a.checker_approved is not None or os.environ.get("TEAM_CHECKER"):
        ok = a.checker_approved if a.checker_approved is not None else checker_approved_head(a.head)
        if not ok:
            errs.append("no approving review from the checker identity on this exact head")
    else:
        print("NOTE no TEAM_CHECKER set: the PASS was written by an identity the builder shares; the owner must read verification/ before merging")
    for e in errs:
        print("VERDICT", e)
    print("verdict check:", "FAIL" if errs else "ok")
    return 1 if errs else 0


def norm(path, root):
    path = path.strip()
    if os.path.isabs(path):
        path = os.path.relpath(path, root)
    while path.startswith("./"):
        path = path[2:]
    return path


def violations(cmd, setup, cwd):
    if setup:
        s = subprocess.run(setup, shell=True, cwd=cwd, capture_output=True, text=True)
        if s.returncode != 0:
            sys.exit(f"QUALITY setup failed in {cwd}: {s.stderr[-500:]}\nquality gate: FAIL")
    r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if r.returncode not in (0, 1):
        sys.exit(f"QUALITY lint command exited {r.returncode} in {cwd} (a crash is not a pass): {r.stderr[-500:]}\nquality gate: FAIL")
    counts = {}
    for line in r.stdout.splitlines():
        if "\t" in line:
            p, rule = line.split("\t", 1)
            key = (norm(p, cwd), rule.strip())
            counts[key] = counts.get(key, 0) + 1
    if r.returncode == 1 and not counts:
        sys.exit("QUALITY lint command reported failure but printed no '<path>\\t<rule>' lines\nquality gate: FAIL")
    return counts


def cmd_quality(a):
    cmd, setup = os.environ.get("LINT_CMD", ""), os.environ.get("SETUP_CMD", "")
    if cmd.strip().lower() == "none":
        if "lint" in load_zones(git("show", f"{a.base}:zones.yml")).get("require", []):
            print("QUALITY LINT_CMD is 'none' but zones.yml requires lint\nquality gate: FAIL"); return 1
        print("quality gate: skipped (LINT_CMD=none, prototype profile)"); return 0
    if not cmd.strip():
        print("QUALITY LINT_CMD is not set (set it, or 'none' for the prototype profile)\nquality gate: FAIL"); return 1
    files = {p for s, p in changed(a.base, a.head) if s != "D"}
    root = os.getcwd()
    with tempfile.TemporaryDirectory() as tmp:
        git("worktree", "add", "--detach", tmp, a.base)
        try:
            before = violations(cmd, setup, tmp)
        finally:
            git("worktree", "remove", "--force", tmp)
    after = violations(cmd, setup, root)
    new = [(p, r, n - before.get((p, r), 0)) for (p, r), n in after.items()
           if p in files and n > before.get((p, r), 0)]
    for p, r, n in sorted(new):
        print(f"QUALITY {p}: {n} new '{r}'")
    print("quality gate:", "FAIL" if new else "ok")
    return 1 if new else 0


def standing_words(rev):
    files = [f for f in git("ls-tree", "-r", "--name-only", "-z", rev).split("\0") if f and matches(f, STANDING_DOCS)]
    return sum(len(git("show", f"{rev}:{f}").split()) for f in files)


def cmd_docs(a):
    budget = int(os.environ.get("DOCS_BUDGET") or 6000)
    problems = []
    for status, path in changed(a.base, a.head):
        if status == "A" and path.endswith(".md") and not any(path.startswith(d) for d in DOC_FOLDERS) \
                and not matches(path, STANDING_DOCS + ROOT_DOCS):
            problems.append(f"{path}: new document outside the folders made for them; put it in an existing doc or an issue comment")
    before, after = standing_words(a.base), standing_words(a.head)
    if after > budget and after > before:
        problems.append(f"standing docs grow from {before} to {after} words, over the budget of {budget}; cut before adding")
    for p in problems:
        print("DOCS", p)
    print(f"docs budget ({after}/{budget} words):", "FAIL" if problems else "ok")
    return 1 if problems else 0


def cmd_strip(a):
    """On every push, remove approval labels so the owner approves what is there now."""
    pr = os.environ.get("PR_NUMBER")
    labels = {l["name"] for l in github(f"issues/{pr}")["labels"]}
    for name in sorted(labels & APPROVAL_LABELS):
        github(f"issues/{pr}/labels/{urllib.request.quote(name)}", method="DELETE")
        print(f"removed '{name}': new commits need a fresh owner approval")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("classify"); p.add_argument("--branch", required=True)
    for name in ("tamper", "verdict", "quality", "docs"):
        p = sub.add_parser(name)
        p.add_argument("--base", required=True)
        p.add_argument("--head", required=True)
        if name not in ("quality", "docs"):
            p.add_argument("--branch", required=True)
        if name == "tamper":
            p.add_argument("--approved", help="comma-separated labels; local tests only (CI asks GitHub)")
        if name == "verdict":
            p.add_argument("--checker-approved", dest="checker_approved", type=lambda s: s == "yes",
                           help="yes|no; local tests only (CI asks GitHub)")
    sub.add_parser("strip-approvals")
    a = ap.parse_args()
    return {"classify": cmd_classify, "tamper": cmd_tamper, "verdict": cmd_verdict,
            "quality": cmd_quality, "docs": cmd_docs, "strip-approvals": cmd_strip}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
