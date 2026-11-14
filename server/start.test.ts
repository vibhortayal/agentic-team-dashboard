// startBoard(), which the Mac app (desktop/, #33) uses to run the board inside its window: AC1, AC2.
import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { startBoard } from "./main.ts";

let server: Server | null = null;
afterEach(() => new Promise<void>((done) => (server?.listening ? server.close(() => done()) : done())));

describe("startBoard", () => {
  it("serves the sample board on this computer only and gives its address", async () => {
    const board = await startBoard({ demo: true, port: 4611 });
    server = board.server;
    const addr = board.server.address();
    expect(typeof addr === "object" && addr?.address).toBe("127.0.0.1");
    expect(board.url).toBe(`http://localhost:${board.port}`);
    const data = await (await fetch(`${board.url}/api/board`)).json() as { repo: string };
    expect(data.repo).toBe("sample/recipe-box");
  });

  it("moves to the next port when one is busy", async () => {
    const first = await startBoard({ demo: true, port: 4621 });
    const second = await startBoard({ demo: true, port: 4621 });
    expect(second.port).toBe(4622);
    await new Promise((r) => second.server.close(r));
    server = first.server;
  });
});
