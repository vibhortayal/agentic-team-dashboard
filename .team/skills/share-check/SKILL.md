---
name: share-check
description: A quick safety check of a preview before anyone sees it - leaked keys in the code or the browser, open database tables, private pages that work signed out, open admin pages and critical package flaws - with a plain-words result of safe, share with care, or stop. Use on every preview before its link goes to the owner or anyone else.
license: Apache-2.0
---

# Share check

Beginner-built apps most often get hurt by a few simple mistakes: a secret key left in the code, a database anyone can read, a private page that works without signing in. This check looks for exactly those, in a few minutes, on every preview. It is not a full security review (the `security-and-hardening` skill and the `sharp-edges` skill go deeper); it is the seatbelt.

## The six checks

Run each one against the reviewed revision and its preview. Write down the command and what it printed.

1. **Secrets in the code and its history.** Use `gitleaks detect` if it is installed. Otherwise search all history: `git log -p --all | grep -nE 'sk_live_|sk-[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30}|xox[bp]-|service_role|-----BEGIN [A-Z ]*PRIVATE KEY'`, and list any committed `.env` file.
2. **Secrets the browser gets.** Build the app and search what is sent to the browser (`dist/`, `build/`, `.next/static/` or the host's equivalent) with the same patterns, plus the name of every server-only setting in the project. Public keys meant for the browser are fine; name them in the result.
3. **Database access rules.** Every table holding user data has access rules switched on, and none says "anyone can read or write". With the public browser key and no sign-in, try to read one row from each such table; it must fail. Use the database's own security advisor if it has one.
4. **Private pages and data need sign-in.** Signed out, open each page and API route the spec calls private; each must refuse or send you to sign-in. Signed in as one test user, try to open another test user's record by changing its id in the address; it must fail.
5. **Nothing left open.** Try `/admin`, `/debug`, `/api/docs` and any setup or seed route. Each needs sign-in or doesn't exist. Debug mode and default passwords are off.
6. **Known critical flaws in packages.** `npm audit --audit-level=critical`, `pip-audit`, or the stack's equivalent.

A check that doesn't apply (no database, no sign-in) is written as "not needed, because ...". A check you couldn't run is "not checked", with the reason, never a pass.

## The result

Write `verification/<issue>/share-check.md`, ten lines at most, readable at age 10:

- **Safe to share:** all six passed or not needed.
- **Share with care:** something worth fixing soon that exposes nothing today, such as a high-but-not-critical package flaw. Say what and why in one line each.
- **Stop:** a secret is exposed, private data can be read signed out or by the wrong user, or an admin page is open. This is a BLOCK with a failing check under `verification/<issue>/checks/`, like any finding. Ella doesn't send the link.

A secret that ever reached the code history or the browser counts as leaked, even after the fix. The owner must replace it at the service that issued it; Ella walks them through it with the `explain-a-step` skill.
