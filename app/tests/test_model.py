"""AC1 to AC5 and AC9 on the board model, from hand-made GitHub data."""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from model import build_board, error_board, parse_event  # noqa: E402

U = "https://github.com/o/r"


def item(n, labels, state="open", pr=False):
    d = {"number": n, "title": f"Item {n}", "labels": [{"name": x} for x in labels], "state": state,
         "html_url": f"{U}/issues/{n}", "updated_at": "2026-11-12T10:00:00Z", "comments": 1}
    if pr:
        d["pull_request"] = {}
    return d


def comment(n, cid, at, ev, header="**Header**", body="Reason line"):
    return {"html_url": f"{U}/issues/{n}#c{cid}", "created_at": at,
            "body": f"{header}\n\n{body}\n\n<!-- team-event {json.dumps(ev)} -->"}


def board(items, comments):
    return build_board("o/r", items, comments, "2026-11-12T12:00:00Z")


def col(b, key):
    return next(c for c in b["columns"] if c["key"] == key)["cards"]


class ModelTest(unittest.TestCase):
    def test_needed_links_the_asking_comment(self):  # AC1
        b = board([item(1, ["needs-human", "human:merge", "stage:review"])],
                  {1: [comment(1, 1, "2026-11-12T09:00:00Z", {"from": "verifier", "to": "product-manager", "kind": "verdict", "verdict": "PASS"}),
                       comment(1, 2, "2026-11-12T09:30:00Z", {"from": "product-manager", "to": "owner", "kind": "handoff"})]})
        self.assertEqual(len(b["needed"]), 1)
        self.assertEqual(b["needed"][0]["needed"]["why"], "Finished work is ready for you to try and accept.")
        self.assertEqual(b["needed"][0]["needed"]["url"], f"{U}/issues/1#c2")

    def test_needed_without_a_team_comment_links_the_item(self):  # AC1
        b = board([item(2, ["needs-human"])], {})
        self.assertEqual(b["needed"][0]["needed"]["url"], f"{U}/issues/2")
        self.assertEqual(b["needed"][0]["needed"]["why"], "The team needs you.")

    def test_ella_note_is_shown_with_her_reason(self):  # AC2
        b = board([item(3, ["stage:ready", "role:implementer"])],
                  {3: [comment(3, 1, "2026-11-12T09:00:00Z", {"from": "engagement-lead", "to": "product-manager", "kind": "note"},
                               header="**Ella (engagement-lead) · note**", body="Too small to stop you for.")]})
        self.assertEqual(len(b["handled"]), 1)
        self.assertEqual(b["handled"][0]["handled"]["why"], "Too small to stop you for.")

    def test_notes_from_others_are_not_ella_calls(self):  # AC2
        b = board([item(4, ["stage:ready"])],
                  {4: [comment(4, 1, "2026-11-12T09:00:00Z", {"from": "implementer", "to": "verifier", "kind": "note"})]})
        self.assertEqual(b["handled"], [])

    def test_stages_group_into_plain_columns_with_persona(self):  # AC3
        items = [item(n, [f"stage:{s}", "role:implementer"]) for n, s in
                 enumerate(["intake", "research", "spec", "ready", "building", "verifying", "review"], start=10)]
        b = board(items, {})
        self.assertEqual([c["title"] for c in b["columns"]],
                         ["Getting ready", "Ready to build", "Being built", "Being checked", "Waiting for you", "Done"])
        self.assertEqual(len(col(b, "getting-ready")), 3)
        self.assertEqual(col(b, "building")[0]["holder"], "Ian (builds)")

    def test_latest_update_is_a_plain_sentence(self):  # AC3
        b = board([item(5, ["stage:building"])],
                  {5: [comment(5, 1, "2026-11-12T08:00:00Z", {"from": "implementer", "to": "verifier", "kind": "handoff"}),
                       comment(5, 2, "2026-11-12T09:00:00Z", {"from": "verifier", "to": "implementer", "kind": "verdict", "verdict": "BLOCK"})]})
        card = col(b, "building")[0]
        self.assertEqual(card["update"], "Vera checked it: it needs fixes.")
        self.assertEqual(card["check_words"], "Checked: needs fixes")

    def test_done_label_without_pass_is_not_checked(self):  # AC4
        b = board([item(6, ["stage:done"], state="closed")], {})
        self.assertEqual(col(b, "done")[0]["check_words"], "Not checked yet")

    def test_pass_shows_checked(self):  # AC4
        b = board([item(7, ["stage:done"], state="closed")],
                  {7: [comment(7, 1, "2026-11-12T09:00:00Z", {"from": "verifier", "to": "product-manager", "kind": "verdict", "verdict": "PASS"})]})
        self.assertEqual(col(b, "done")[0]["check_words"], "Checked: it works")

    def test_later_block_overrides_earlier_pass(self):  # AC4
        b = board([item(8, ["stage:building"])],
                  {8: [comment(8, 1, "2026-11-12T09:00:00Z", {"from": "verifier", "kind": "verdict", "verdict": "PASS"}),
                       comment(8, 2, "2026-11-12T10:00:00Z", {"from": "verifier", "kind": "verdict", "verdict": "BLOCK"})]})
        self.assertEqual(col(b, "building")[0]["check"], "fixes")

    def test_error_board_has_message_link_and_no_cards(self):  # AC5
        b = error_board("o/r", "2026-11-12T12:00:00Z", "The board can't reach GitHub.")
        self.assertEqual(b["error"], "The board can't reach GitHub.")
        self.assertEqual(b["repo_url"], "https://github.com/o/r")
        self.assertEqual(sum(len(c["cards"]) for c in b["columns"]), 0)

    def test_broken_event_json_is_ignored(self):
        self.assertIsNone(parse_event("<!-- team-event {not json} -->"))

    def test_secrets_in_titles_are_masked(self):  # AC6 end to end
        it = item(9, ["needs-human"])
        it["title"] = "Use ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"
        b = board([it], {})
        self.assertNotIn("A1b2C3d4", json.dumps(b))

    def test_no_jargon_in_page_words(self):  # AC9
        b = board([item(n, [f"stage:{s}", f"role:{r}", "needs-human", f"human:{h}"]) for n, (s, r, h) in enumerate(
            [("spec", "product-manager", "approve-spec"), ("review", "verifier", "merge"), ("building", "implementer", "blocker")])],
            {})
        words = json.dumps([[c["needed"]["why"], c["holder"], c["update"], c["check_words"]] for c in b["needed"]])
        words += json.dumps([[c["title"], c["help"]] for c in b["columns"]])
        for jargon in ("needs-human", "human:", "stage:", "role:", "PR", "merge", "label", "issue", "verdict"):
            self.assertNotIn(jargon, words, jargon)


if __name__ == "__main__":
    unittest.main()
