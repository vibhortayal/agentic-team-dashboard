# Checks for #8 (progress board), derived from docs/changes/8.md at d982294

Written from the spec before reading app/ code. Scripts in `checks/` run headless with python3 only.

| Row | Clause | Check | How |
|---|---|---|---|
| AC1 | needs-human item under "Waiting for you", plain sentence per `human:` label, link to latest asking comment, else the item | needed[] holds exactly the open needs-human items; sentence has no label text; link is the latest comment with `"to":"owner"` or `human`, else item url; closed item is not shown | hand-made GitHub data via fake `gh` |
| AC2 | latest Ella `note` on an open item shows under handled, first line as reason | handled[] has the latest note only, reason = its first line; not for closed items | same |
| AC3 | grouped by stage in everyday words; holder persona; header line of latest team comment | column titles exactly the six words; card in the column of its stage; holder is a persona name; update = latest comment header line | same + demo |
| AC4 | "Checked: passed" only on latest verdict PASS; BLOCK -> needs fixes; else "Not checked yet"; stage:done w/o PASS -> not checked | PASS then BLOCK shows needs fixes; BLOCK then PASS shows passed; done without verdict shows Not checked yet | same |
| AC5 | GitHub unreadable -> one plain sentence, repo link, no stale data shown as current | gh failing -> error set, no cards; after a good read then a failure, old cards not shown as current | fake `gh` failing |
| AC6 | every string through one mask; key shapes -> `[hidden: kind]`; NAME_KEY/TOKEN/SECRET/PASSWORD values hidden | my own planted fake keys in titles/comments come out masked in /api/board and nowhere in the served bytes | same |
| AC7 | `--demo` works with no network, no sign-in | demo starts with gh/git on PATH replaced by failing stubs, no token, proxy pointed nowhere; board has data | demo |
| AC8 | listens on 127.0.0.1 only | /proc/net/tcp shows 127.0.0.1:port and no 0.0.0.0/:: socket on that port | demo |
| AC9 | no label names, JSON or jargon on first screen | rendered HTML text from served page + api strings free of `needs-human`, `stage:`, `role:`, `human:`, `{"`, `PR`, `issue`, `label`, `repo`, `commit` | demo, plus browser screenshots (not a CI check) |
| 8 | `/api/board` shape | keys and card keys present | demo |
| 7 | one GitHub read per minute at most (cached); 50 items under 5 s | a refresh 12 s and 59 s after a read must not read GitHub again; 50 items with 5 comments each timed | fake transport counts calls and the board's clock is stepped, not waited (in ac5 check); timing run by hand |
