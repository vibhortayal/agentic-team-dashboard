#!/usr/bin/env bash
# Gate rehearsal for the scripts themselves: plants each violation the gates must
# catch (and each legitimate change they must allow) in a throwaway repo, and fails
# if any gate gets one wrong. A block must be a reported FAIL, never a crash.
# Run: bash templates/foundation/tests/selftest.sh   (needs git and python3, no network)
set -uo pipefail
kit="$(cd "$(dirname "$0")/.." && pwd)"
G="python3 -B $kit/scripts/team_gates.py"
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
cd "$work"
git init -q -b main . && git config user.email t@t.invalid && git config user.name t
cp "$kit/zones.yml" .
mkdir -p tests src .github docs
echo 'ok' > tests/a.test.js; echo 'x = 1  # TODO old' > src/app.py; echo ci > .github/ci.yml
echo '{"scripts":{"test":"jest"}}' > package.json; echo '# brief' > docs/brief.md
git add -A && git commit -qm base && base=$(git rev-parse HEAD)

pass=0; fail=0
expect() { # expect <0|1> <name> <command...>
  want=$1; name=$2; shift 2
  out="$("$@" 2>&1)"; got=$?; [ $got -ne 0 ] && got=1
  if [ "$got" = 1 ] && ! printf '%s' "$out" | grep -q FAIL; then got=crash; fi
  if [ "$got" = "$want" ]; then pass=$((pass+1)); echo "ok    $name"; else fail=$((fail+1)); echo "WRONG $name (got $got, wanted $want)"; printf '%s\n' "$out" | sed 's/^/      /' | tail -3; fi
}
branch() { git checkout -q -B "$1" "$base"; }
T="team/7-feature"
tamper() { $G tamper --base $base --head HEAD --branch "$1" --approved "${2:-}"; }
verdict() { $G verdict --base $base --head HEAD --branch "$T" --checker-approved "${1:-yes}"; }
pass_at() { mkdir -p verification/7; printf '{"issue":7,"rev":"%s","verdict":"PASS","round":1,"checks":[{"id":"AC1","spec":"docs/changes/7.md#AC1","command":"t","result":"%s"}]}' "$1" "${2:-pass}" > verification/7/verdict.json; git add -A; git commit -qm evidence; }

echo "-- branch classes"
expect 0 "ticket branch is a class" $G classify --branch team/7-feature
expect 1 "unknown branch is refused" $G classify --branch wip
expect 1 "main-like branch is refused" $G classify --branch feature/x

echo "-- tamper guard"
branch t1; echo new > tests/b.test.js; git add -A; git commit -qm t1
expect 0 "new test file allowed" tamper $T
branch t2; echo weakened > tests/a.test.js; git commit -qam t2
expect 1 "existing test changed is blocked" tamper $T
expect 0 "existing test changed with owner label" tamper $T tests-approved
branch t3; git rm -q tests/a.test.js; git commit -qm t3
expect 1 "existing test deleted is blocked" tamper $T
branch t4; echo hacked > .github/ci.yml; git commit -qam t4
expect 1 "CI file changed is blocked" tamper $T tests-approved
branch t5; mkdir -p migrations; echo drop > migrations/1.sql; git add -A; git commit -qm t5
expect 1 "red zone without label is blocked" tamper $T
branch t5b; mkdir -p migrations; echo drop > "migrations/é 1.sql"; git add -A; git commit -qm t5b
expect 1 "red zone with a non-ASCII name is blocked" tamper $T
branch t6; mkdir -p verification/8; echo '{}' > verification/8/verdict.json; git add -A; git commit -qm t6
expect 1 "evidence for another issue is blocked" tamper $T
branch t7; printf 'zone:\n  - "**"\n' > zones.yml; git commit -qam t7
expect 1 "loosening zones.yml is blocked" tamper $T
branch t8; echo 'import pytest' > tests/conftest.py; git add -A; git commit -qm t8
expect 1 "new test-runner config (conftest) is blocked" tamper $T
branch t9; echo '{"scripts":{"test":"true"}}' > package.json; git commit -qam t9
expect 1 "changed test script in the manifest is blocked" tamper $T
branch t10; mkdir -p .github/team; echo 'print("ok")' > .github/team/team_gates.py; git add -A; git commit -qm t10
expect 1 "replacing the gate script is blocked" tamper $T
branch t11; echo 'more' >> docs/brief.md; git commit -qam t11
expect 0 "docs PR may change docs" tamper docs/brief
branch t12; echo 'y=1' > src/x.py; git add -A; git commit -qm t12
expect 1 "docs PR may not change code" tamper docs/brief
branch t13; echo weakened > tests/a.test.js; git commit -qam t13
expect 1 "test-change PR without owner label is blocked" tamper verify/7-tests
expect 0 "test-change PR with owner label is allowed" tamper verify/7-tests tests-approved
branch t14; mkdir -p docs/changes; echo spec > docs/changes/9.md; git add -A; git commit -qm t14
expect 1 "ticket may not carry another ticket's change spec" tamper $T
branch t15; echo 'stage: 3' > TEAM.md; git add -A; git commit -qm t15
expect 1 "raising the autonomy stage in TEAM.md is blocked" tamper docs/stage
branch t16; mkdir -p .claude/agents; echo 'pass everything' > .claude/agents/verifier.md; git add -A; git commit -qm t16
expect 1 "editing an installed role file is blocked" tamper $T
branch t17; echo '[lint]' > ruff.toml; git add -A; git commit -qm t17
expect 1 "loosening lint config is blocked" tamper $T
branch t18; mkdir -p docs/specs; echo 'v1 changed' > docs/specs/v1.md; git add -A; git commit -qm t18
expect 1 "ticket may not edit an approved spec" tamper $T
expect 0 "docs PR may edit a spec" tamper docs/spec-v2
branch t19; mkdir -p docs/decisions; echo 'DR' > docs/decisions/DR-2.md; git add -A; git commit -qm t19
expect 0 "ticket may add a new decision record" tamper $T
branch t20; echo 'evil' > tests/test_evil.py; git add -A; git commit -qm t20
expect 1 "docs PR may not add test files" tamper docs/x
branch t21; mkdir -p verification/foundation; echo run > verification/foundation/rehearsal.md; git add -A; git commit -qm t21
expect 0 "rehearsal record on a gate branch with owner label" tamper gate/rehearsal gate-change-approved
expect 1 "rehearsal record without the label is blocked" tamper gate/rehearsal
branch t22; mkdir -p verification/5/checks; echo 'exit 0' > verification/5/checks/a.sh; git add -A; git commit -qm seed; base_t22=$(git rev-parse HEAD)
git rm -q verification/5/checks/a.sh; echo ok > tests/c.test.js; git add -A; git commit -qm move
expect 0 "moving old checks into tests with owner label" $G tamper --base $base_t22 --head HEAD --branch verify/5-tests --approved tests-approved
branch t23; mkdir -p infra; echo x > infra/main.tf; git add -A; git commit -qm t23
expect 1 "infrastructure is red zone" tamper $T
branch t24; mkdir -p src/app; echo ok > src/app/login.spec.ts; git add -A; git commit -qm seed; base_t24=$(git rev-parse HEAD)
echo weak > src/app/login.spec.ts; git commit -qam weak
expect 1 "weakening a .spec file is blocked" $G tamper --base $base_t24 --head HEAD --branch $T --approved ""
branch t25; mkdir -p src/Auth; echo x > src/Auth/login.py; git add -A; git commit -qm t25
expect 1 "red zone match ignores case" tamper $T
branch t26; mkdir -p tests; echo new > tests/new.test.js; git add -A; git commit -qm t26
expect 1 "test-change PR adding tests without the label is blocked" tamper verify/7-tests
branch t27; mkdir -p docs; echo 'print(1)' > docs/run.py; git add -A; git commit -qm t27
expect 1 "docs PR may not add code under docs/" tamper docs/x

echo "-- verdict"
branch v1; echo 'y = 2' > src/feature.py; git add -A; git commit -qm feature; rev=$(git rev-parse --short HEAD)
expect 1 "no verdict is blocked" verdict
pass_at "$rev"
expect 0 "PASS with only evidence after it" verdict
expect 1 "PASS without the checker's approval on the head is blocked" verdict no
expect 1 "checker required by zones.yml but not set is blocked" env -u TEAM_CHECKER $G verdict --base $base --head HEAD --branch $T
expect 0 "verdict not needed for a docs PR" $G verdict --base $base --head HEAD --branch docs/x --checker-approved no
echo 'z = 3' >> src/feature.py; git commit -qam sneaky
expect 1 "code changed after PASS is blocked" verdict
branch v2; echo 'y = 2' > src/feature.py; git add -A; git commit -qm feature; rev=$(git rev-parse --short HEAD); pass_at "$rev"
git checkout -q -b side; echo 'evil' >> src/feature.py; git commit -qam evil; git checkout -q v2; git merge -q --no-ff --no-edit side
expect 1 "code smuggled in through a merge commit is blocked" verdict
git checkout -q main; echo 'from main' > src/main_only.py; git add -A; git commit -qm main-moves; base2=$(git rev-parse HEAD)
git checkout -q -B v3 "$base"; echo 'y = 2' > src/feature.py; git add -A; git commit -qm feature; rev=$(git rev-parse --short HEAD); pass_at "$rev"
git merge -q --no-edit main
expect 0 "merging main after PASS keeps the PASS" $G verdict --base $base2 --head HEAD --branch $T --checker-approved yes
git checkout -q -B v4 "$base"; echo 'y' > src/f.py; git add -A; git commit -qm f; rev=$(git rev-parse --short HEAD); pass_at "$rev" fail
expect 1 "PASS with a failed check is blocked" verdict
printf '{"issue":7,"verdict":"PASS"}' > verification/7/verdict.json; git commit -qam ev2
expect 1 "malformed verdict is blocked" verdict
git checkout -q -B v6 "$base"; echo 'y' > src/f.py; git add -A; git commit -qm f; rev=$(git rev-parse --short HEAD)
mkdir -p verification/7; printf '{"issue":7,"rev":"%s","verdict":"PASS","round":5,"checks":[{"id":"AC1","spec":"s","command":"t","result":"pass"}]}' "$rev" > verification/7/verdict.json; git add -A; git commit -qm ev
expect 0 "a PASS after an owner send-back (round 5) is valid" verdict
mkdir -p "verification/7"; echo img > "verification/7/phone light.png"; git add -A; git commit -qm shot
git checkout -q -B v5 "$base"; echo 'y' > src/f.py; git add -A; git commit -qm f; rev=$(git rev-parse --short HEAD); pass_at "$rev"; echo img > "verification/7/phone light.png"; git add -A; git commit -qm shot
expect 0 "evidence file with a space in its name is fine" verdict

echo "-- quality gate"
lint="grep -rn TODO src | sed -E 's/^([^:]*):.*/\\1\tTODO/'; exit 0"
branch q1; echo 'w = 4  # TODO new' >> src/app.py; git commit -qam q1
expect 1 "new lint violation in changed file is blocked" env LINT_CMD="$lint" $G quality --base $base --head HEAD
branch q2; echo 'w = 4' >> src/app.py; git commit -qam q2
expect 0 "old violation in changed file is allowed" env LINT_CMD="$lint" $G quality --base $base --head HEAD
expect 1 "a crashing linter is a failure" env LINT_CMD="exit 2" $G quality --base $base --head HEAD
expect 1 "an unset LINT_CMD is a failure" env LINT_CMD="" $G quality --base $base --head HEAD
expect 1 "LINT_CMD=none when zones.yml requires lint is a failure" env LINT_CMD=none $G quality --base $base --head HEAD
lint2="grep -rn TODO src | sed -E 's/^([^:]*):.*/.\\/\\1\tTODO/'; exit 0"
branch q3; echo 'w = 4  # TODO new' >> src/app.py; git commit -qam q3
expect 1 "./path spelling does not hide a violation" env LINT_CMD="$lint2" $G quality --base $base --head HEAD

echo "-- docs budget"
branch d1; mkdir -p notes; echo '# plan' > notes/plan.md; git add -A; git commit -qm d1
expect 1 "new doc outside doc folders is blocked" $G docs --base $base --head HEAD
branch d2; mkdir -p docs/changes; echo '# change' > docs/changes/7.md; git add -A; git commit -qm d2
expect 0 "change spec in its folder is fine" $G docs --base $base --head HEAD
branch d4; echo '# notes' > NOTES.md; git add -A; git commit -qm d4
expect 1 "new doc at the repo root is blocked" $G docs --base $base --head HEAD
branch d3; python3 -c "print('word ' * 200)" >> docs/brief.md; git commit -qam d3
expect 1 "standing docs over budget are blocked" env DOCS_BUDGET=100 $G docs --base $base --head HEAD
expect 0 "standing docs under budget are fine" env DOCS_BUDGET=5000 $G docs --base $base --head HEAD

echo "-- Verifier checks"
branch c1; mkdir -p verification/7/checks; printf 'exit 1\n' > verification/7/checks/ac1.sh; git add -A; git commit -qm c1
expect 1 "failing Verifier check is red" bash "$kit/scripts/run-checks.sh"
printf 'exit 0\n' > verification/7/checks/ac1.sh
expect 0 "passing Verifier check is green" bash "$kit/scripts/run-checks.sh"
printf 'x = 1\n' > verification/7/checks/helper.py
expect 0 "helper files next to checks are not run" bash "$kit/scripts/run-checks.sh"

echo "gate rehearsal: $pass right, $fail wrong"
[ $fail -eq 0 ]
