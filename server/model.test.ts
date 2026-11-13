// AC1 to AC5 and AC9 on the board model, from hand-made GitHub data.
import { describe, expect, it } from "vitest";
import { buildBoard, errorBoard, parseEvent, type Board, type GhComment, type GhItem, type TeamEvent } from "./model.ts";

const U = "https://github.com/o/r";

function item(n: number, labels: string[], state = "open", pr = false): GhItem {
  return { number: n, title: `Item ${n}`, labels: labels.map((name) => ({ name })), state,
    html_url: `${U}/issues/${n}`, updated_at: "2026-11-12T10:00:00Z", comments: 1, ...(pr ? { pull_request: {} } : {}) };
}

function comment(n: number, cid: number, at: string, ev: TeamEvent, header = "**Header**", body = "Reason line"): GhComment {
  return { html_url: `${U}/issues/${n}#c${cid}`, created_at: at, body: `${header}\n\n${body}\n\n<!-- team-event ${JSON.stringify(ev)} -->` };
}

function board(items: GhItem[], comments: Record<number, GhComment[]>): Board {
  return buildBoard("o/r", items, new Map(Object.entries(comments).map(([k, v]) => [Number(k), v])), "2026-11-12T12:00:00Z");
}

function col(b: Board, key: string) {
  return b.columns.find((c) => c.key === key)!.cards;
}

describe("board model", () => {
  it("AC1: a needed item links the comment that asks", () => {
    const b = board([item(1, ["needs-human", "human:merge", "stage:review"])], {
      1: [comment(1, 1, "2026-11-12T09:00:00Z", { from: "verifier", to: "product-manager", kind: "verdict", verdict: "PASS" }),
        comment(1, 2, "2026-11-12T09:30:00Z", { from: "product-manager", to: "owner", kind: "handoff" })],
    });
    expect(b.needed).toHaveLength(1);
    expect(b.needed[0].needed!.why).toBe("Finished work is ready for you to try and accept.");
    expect(b.needed[0].needed!.url).toBe(`${U}/issues/1#c2`);
  });

  it("AC1: with no team comment, it links the item itself", () => {
    const b = board([item(2, ["needs-human"])], {});
    expect(b.needed[0].needed!.url).toBe(`${U}/issues/2`);
    expect(b.needed[0].needed!.why).toBe("The team needs you.");
  });

  it("AC2: Ella's note shows with her reason", () => {
    const b = board([item(3, ["stage:ready", "role:implementer"])], {
      3: [comment(3, 1, "2026-11-12T09:00:00Z", { from: "engagement-lead", to: "product-manager", kind: "note" },
        "**Ella (engagement-lead) · note**", "Too small to stop you for.")],
    });
    expect(b.handled).toHaveLength(1);
    expect(b.handled[0].handled!.why).toBe("Too small to stop you for.");
  });

  it("AC2: notes from others are not Ella's calls", () => {
    const b = board([item(4, ["stage:ready"])], { 4: [comment(4, 1, "2026-11-12T09:00:00Z", { from: "implementer", to: "verifier", kind: "note" })] });
    expect(b.handled).toEqual([]);
  });

  it("AC3: stages group into plain columns, with persona names", () => {
    const stages = ["intake", "research", "spec", "ready", "building", "verifying", "review"];
    const b = board(stages.map((s, i) => item(10 + i, [`stage:${s}`, "role:implementer"])), {});
    expect(b.columns.map((c) => c.title)).toEqual(["Getting ready", "Ready to build", "Being built", "Being checked", "Waiting for you", "Done"]);
    expect(col(b, "getting-ready")).toHaveLength(3);
    expect(col(b, "building")[0].holder).toBe("Ian (builds)");
    expect(col(b, "building")[0].stage).toBe("building");
  });

  it("AC3: the latest update is a plain sentence", () => {
    const b = board([item(5, ["stage:building"])], {
      5: [comment(5, 1, "2026-11-12T08:00:00Z", { from: "implementer", to: "verifier", kind: "handoff" }),
        comment(5, 2, "2026-11-12T09:00:00Z", { from: "verifier", to: "implementer", kind: "verdict", verdict: "BLOCK" })],
    });
    const card = col(b, "building")[0];
    expect(card.update).toBe("Vera checked it: it needs fixes.");
    expect(card.check_words).toBe("Checked: needs fixes");
  });

  it("AC4: done without a PASS is not checked", () => {
    expect(col(board([item(6, ["stage:done"], "closed")], {}), "done")[0].check_words).toBe("Not checked yet");
  });

  it("AC4: a PASS shows checked", () => {
    const b = board([item(7, ["stage:done"], "closed")], {
      7: [comment(7, 1, "2026-11-12T09:00:00Z", { from: "verifier", to: "product-manager", kind: "verdict", verdict: "PASS" })],
    });
    expect(col(b, "done")[0].check_words).toBe("Checked: passed");
  });

  it("AC4: the latest verdict wins", () => {
    const b = board([item(8, ["stage:building"]), item(9, ["stage:verifying"])], {
      8: [comment(8, 1, "2026-11-12T09:00:00Z", { from: "verifier", kind: "verdict", verdict: "PASS" }),
        comment(8, 2, "2026-11-12T10:00:00Z", { from: "verifier", kind: "verdict", verdict: "BLOCK" })],
      9: [comment(9, 1, "2026-11-12T09:00:00Z", { from: "verifier", kind: "verdict", verdict: "PASS" }),
        comment(9, 2, "2026-11-12T10:00:00Z", { from: "verifier", kind: "verdict", verdict: "INCONCLUSIVE" })],
    });
    expect(col(b, "building")[0].check).toBe("fixes");
    expect(col(b, "checking")[0].check_words).toBe("Not checked yet");
  });

  it("AC5: an error board has the message, the link and no cards", () => {
    const b = errorBoard("o/r", "2026-11-12T12:00:00Z", "The board can't reach GitHub.");
    expect(b.error).toBe("The board can't reach GitHub.");
    expect(b.repo_url).toBe("https://github.com/o/r");
    expect(b.columns.reduce((n, c) => n + c.cards.length, 0)).toBe(0);
  });

  it("ignores broken team-event JSON", () => {
    expect(parseEvent("<!-- team-event {not json} -->")).toBeNull();
  });

  it("AC6: secrets in titles are masked end to end", () => {
    const it2 = item(9, ["needs-human"]);
    it2.title = "Use ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";
    expect(JSON.stringify(board([it2], {}))).not.toContain("A1b2C3d4");
  });

  it("AC9: no jargon in the words the page shows", () => {
    const rows: Array<[string, string, string]> = [["spec", "product-manager", "approve-spec"], ["review", "verifier", "merge"], ["building", "implementer", "blocker"]];
    const b = board(rows.map(([s, r, h], i) => item(i, [`stage:${s}`, `role:${r}`, "needs-human", `human:${h}`])), {});
    const words = JSON.stringify(b.needed.map((c) => [c.needed!.why, c.holder, c.update, c.check_words]))
      + JSON.stringify(b.columns.map((c) => [c.title, c.help]));
    for (const jargon of ["needs-human", "human:", "stage:", "role:", "PR", "merge", "label", "issue", "verdict"]) {
      expect(words, jargon).not.toContain(jargon);
    }
  });
});
