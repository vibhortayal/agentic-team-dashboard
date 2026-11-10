#!/usr/bin/env bash
# Run every Verifier check script committed under verification/*/checks/.
# A check is a *.sh file or any executable file; anything else (helpers, fixtures,
# notes) is left alone. Each check exits 0 when the behaviour it tests is correct. CI runs this on
# every PR, so a BLOCK finding stays red until it is fixed, without anyone
# editing the CI workflow.
set -uo pipefail
shopt -s nullglob
fail=0; ran=0
for s in verification/*/checks/*; do
  [ -f "$s" ] || continue
  case "$s" in *.sh) ;; *) [ -x "$s" ] || continue ;; esac
  ran=$((ran + 1))
  if [ -x "$s" ]; then "$s"; else bash "$s"; fi
  rc=$?
  if [ $rc -ne 0 ]; then echo "CHECK FAIL $s (exit $rc)"; fail=1; else echo "check ok   $s"; fi
done
echo "verifier checks: $ran run, $([ $fail -eq 0 ] && echo ok || echo FAIL)"
exit $fail
