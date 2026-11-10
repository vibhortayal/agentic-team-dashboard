#!/usr/bin/env bash
# Create or update the team's labels in a GitHub repo (needs the gh CLI, signed in).
#   adapters/github/labels.sh <owner/repo>
set -euo pipefail
repo="${1:?usage: labels.sh <owner/repo>}"
mk() { gh label create "$1" --repo "$repo" --color "$2" --description "$3" --force >/dev/null && echo "$1"; }

for r in engagement-lead product-manager researcher critic architect implementer verifier evaluator budget-analyst ops; do
  mk "role:$r" 1d76db "Role that must act next"
done
for s in intake research spec ready building verifying review done; do
  mk "stage:$s" c5def5 "Ticket stage"
done
mk needs-human d93f0b "Waiting on a person; see the latest team comment"
for h in answer approve approve-spec approve-release merge spend access red-zone approve-ui blocker; do
  mk "human:$h" f9d0c4 "What the person needs to do"
done
for b in unclear access too-big impossible; do
  mk "blocker:$b" b60205 "Typed blocker"
done
mk mode:ticket ededed "Implementer + Verifier per ticket"
mk mode:multi-unit ededed "Architect coordinates several units"
for a in gate-change tests deps red-zone; do
  mk "$a-approved" 0e8a16 "Owner approval; counts only when the owner's own account adds it"
done
mk verified 0e8a16 "Set by the Verifier on the PR after approving; re-runs the gates"
mk owner-rejected b60205 "The owner sent this back; counted in autonomy stage reviews"
mk class:trivial ededed "One-sentence change outside protected zones; fast path"
mk incident b60205 "Production incident; see severity in the issue"
mk support fbca04 "Report from a user; the Product Manager triages it"
mk team-finding 5319e7 "In the team repo: a lesson from a project retro or review"
