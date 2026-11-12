# Dashboard

The front door to the agent team, built by the team itself. How the team works here is in `AGENTS.md` and `TEAM.md`.

## The progress board

A page on your own computer that shows what is waiting on you and how each piece of work is going. It only reads your project on GitHub; it changes nothing.

Ask your coding assistant: "Start the progress board for this project." It runs `python3 app/board.py` from the project folder, and the board opens in your browser at http://localhost:4321. To see it with sample data, it runs `python3 app/board.py --demo`.

It needs Python 3.9 or newer and nothing else. To read a private project it uses your GitHub sign-in from the GitHub command-line tool, or a `GITHUB_TOKEN`.

Tests: `python3 -m unittest discover -s app/tests`
