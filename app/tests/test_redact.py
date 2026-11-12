"""AC6: every planted fake key comes out masked."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from redact import HIDDEN_LINE, mask, mask_tree  # noqa: E402

# Fake keys, one per shape. None of these are real.
PLANTED = {
    "github classic": "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8",
    "github fine-grained": "github_pat_" + "11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz",
    "github app": "ghs_" + "abcdefghijklmnopqrstuvwxyz0123456789",
    "anthropic": "sk-ant-" + "api03-abcdefghijklmnopqrstuvwxyz012345",
    "openai": "sk-proj-" + "abcdefghijklmnopqrstuvwxyz0123",
    "stripe": "sk_live_" + "abcdefghijklmnop1234",
    "aws": "AKIA" + "ABCDEFGHIJKLMNOP",
    "google": "AIza" + "SyA1234567890abcdefghijklmnopqrstuv",
    "slack": "xoxb-" + "123456789012-abcdefghijkl",
    "gitlab": "glpat-" + "abcdefghijklmnopqrst",
    "npm": "npm_" + "abcdefghijklmnopqrstuvwxyz0123456789",
    "supabase": "sbp_" + "0123456789abcdef0123456789abcdef01234567",
    "resend": "re_" + "AbCd1234_abcdefghijklmnopqrst",
    "jwt": "eyJ" + "hbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop",
}
NAMED = [  # (line, the value that must disappear)
    ("MY_TOKEN=abc123def456", "abc123def456"),
    ("DATABASE_PASSWORD: hunter2hunter2", "hunter2hunter2"),
    ('export STRIPE_SECRET="plainvalue9876"', "plainvalue9876"),
    ("api_key = 0123456789abcdef", "0123456789abcdef"),
    ('{"apiKey": "zzzzyyyyxxxx"}', "zzzzyyyyxxxx"),
]


class MaskTest(unittest.TestCase):
    def test_every_planted_shape_is_hidden(self):
        for kind, key in PLANTED.items():
            with self.subTest(kind=kind):
                out = mask(f"Ian pasted {key} into the log")
                self.assertNotIn(key, out)
                self.assertIn("[hidden:", out)

    def test_named_values_are_hidden(self):
        for line, value in NAMED:
            with self.subTest(line=line):
                out = mask(line)
                self.assertIn("[hidden: secret]", out)
                self.assertNotIn(value, out)

    def test_private_key_block_is_hidden(self):
        block = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXk\nAAAAB3NzaC1\n-----END OPENSSH PRIVATE KEY-----"
        out = mask("before\n" + block + "\nafter")
        self.assertNotIn("b3BlbnNzaC1rZXk", out)
        self.assertIn("before", out)
        self.assertIn("after", out)

    def test_password_in_link(self):
        out = mask("clone https://bob:s3cretpass@example.com/repo.git")
        self.assertNotIn("s3cretpass", out)

    def test_plain_words_survive(self):
        text = "Vera checked it: it works. Ian needs a token from you. Secret: none"
        self.assertEqual(mask(text), text)

    def test_tree_masks_nested_strings(self):
        key = PLANTED["github classic"]
        out = mask_tree({"a": [{"b": key}], "n": 3})
        self.assertNotIn(key, str(out))
        self.assertEqual(out["n"], 3)

    def test_failure_hides_the_line(self):
        import redact
        original = redact._mask_line
        redact._mask_line = lambda line: (_ for _ in ()).throw(RuntimeError("boom"))
        try:
            self.assertEqual(mask("ghp_whatever"), HIDDEN_LINE)
        finally:
            redact._mask_line = original


if __name__ == "__main__":
    unittest.main()
