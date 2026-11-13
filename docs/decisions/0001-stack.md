# 0001: The local app is a TypeScript web app

Status: accepted by the owner, 2026-11-12 (decision card in the project thread) · Ticket: #8

**Decision.** The local app is TypeScript throughout: a React page built with Vite, and a small Node server that runs the TypeScript files directly (Node 22.18 or newer). No server framework.

**Why.** The owner chose a mainstream typed stack so richer screens (Ella's chat, Approve buttons, the dial) are easy to add. Python's standard library needed no installs but would make those screens hand work.

**Cost.** Every user needs Node and one `npm install`. The coding assistant runs both, so the user still says one sentence ("Start the progress board").

**Dependencies.** react, react-dom (runtime); vite, @vitejs/plugin-react, typescript, vitest and type packages (build and test only). All MIT or Apache-2.0, pinned to exact versions released at least 7 days before adding.

**Enforced by.** `npm run typecheck` (strict) and `npm test` in the baseline; `engines.node` in `package.json`.
