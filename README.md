# muffle-evals

Does muffle save tokens without making the agent's code worse? Each task here is a real bug, fixed upstream in an
open-source project. The agent gets the bug report and the project as it was before the fix, without its git history.
When it is done, the tests the upstream fix added are put back over its work and run. The agent never sees them.

Every run is kept in `results/<setup>/<agent>/<task>-<n>/`: the diff the agent made, its reply, the hidden test output
and `score.json` with pass or fail, tokens, cost, lines changed against the upstream fix, and new lint warnings. Read the
diffs: a passing run can still be bad code.

## Setups

`setups.toml`: `base` is the agent without muffle; the others run `muffle init` with the flags listed.

## Running

```sh
./evals.py prepare $(ls tasks)              # once: clone and set up every task
./evals.py verify $(ls tasks)               # hidden tests fail before the fix, pass after
./evals.py matrix base,muffle,all claude,codex 3
./evals.py report                           # writes results/README.md
```

`MUFFLE_BIN` picks the muffle binary (default `~/Documents/repos/muffle/build/release/muffle`). Agents: Claude Code
with Sonnet, Codex with gpt-6.1-sol at low effort. Clones, prepared projects and raw agent output live in
`~/.cache/muffle-evals`.

Results: [BENCHMARK.md](BENCHMARK.md). The code each agent wrote, next to the upstream change, per task:
[results/tasks/](results/tasks/). Adding a task: see [TASKS.md](TASKS.md).
