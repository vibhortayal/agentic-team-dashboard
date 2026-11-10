#!/usr/bin/env bash
# Print a short-lived installation token for the checker GitHub App, so a Verifier
# session can approve a pull request as the checker identity:
#
#   GH_TOKEN="$(bash app-token.sh)" gh pr review <n> --approve --body "PASS, see verification/<issue>/"
#
# Needs: CHECKER_APP_ID, CHECKER_INSTALLATION_ID and CHECKER_PRIVATE_KEY (the PEM text)
# from the agent tool's secret store, available to Verifier sessions only. Uses only
# openssl and curl. The token expires within an hour; never print or store it.
set -euo pipefail
: "${CHECKER_APP_ID:?}" "${CHECKER_INSTALLATION_ID:?}" "${CHECKER_PRIVATE_KEY:?}"
b64() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
now=$(date +%s)
header=$(printf '{"alg":"RS256","typ":"JWT"}' | b64)
payload=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' $((now - 60)) $((now + 540)) "$CHECKER_APP_ID" | b64)
key="$(mktemp)"; trap 'rm -f "$key"' EXIT
printf '%s\n' "$CHECKER_PRIVATE_KEY" > "$key"
sig=$(printf '%s.%s' "$header" "$payload" | openssl dgst -sha256 -sign "$key" | b64)
curl -fsS -X POST \
  -H "Authorization: Bearer $header.$payload.$sig" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/app/installations/$CHECKER_INSTALLATION_ID/access_tokens" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
