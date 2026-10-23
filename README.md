# muffle-evals

Does muffle save tokens without making the agent's code worse? Yes:

- **Same results.** On 32 real bug fixes and features in Rust, Python, TypeScript and Go, agents with muffle passed as
  many tasks as without it.
- **Fewer tokens.** With `muffle init --lean --hush --sloth`, Claude Code read 35% fewer input tokens and cost 14% less
  on the bug fixes; Codex read 14% fewer.
- **Shorter command output.** Over 311 commands agents typically run, written as agents write them, muffle printed
  65% fewer bytes: 88% fewer for `grep`, 80% for `cargo`, 52% for test runs.

| Bug fixes, `--lean --hush --sloth` | Passed | Input tokens | Cost |
|---|---:|---:|---:|
| Claude Code alone | 19/20 | 192,628 | $0.106 |
| Claude Code with muffle | 19/20 | **125,689 (−35%)** | **$0.092 (−14%)** |
| Codex alone | 19/20 | 195,499 | |
| Codex with muffle | 20/20 | **168,900 (−14%)** | |

Every setup and number is in [BENCHMARK.md](BENCHMARK.md); the code each agent wrote is in
[results/tasks/](results/tasks/), and each command's output with and without muffle in [commands/](commands/).

## How it works

Each task is a real change made upstream in an open-source project. The agent gets the bug report or feature request
and the project as it was before the change, without its git history. When it is done, the tests the upstream change
added are put back over its work and run. The agent never sees them.

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
./evals.py commands                         # writes commands/: each command's output with and without muffle
```

`MUFFLE_BIN` picks the muffle binary (default `~/Documents/repos/muffle/build/release/muffle`). Agents: Claude Code
with Sonnet, Codex with gpt-6.1-sol at low effort. Clones, prepared projects and raw agent output live in
`~/.cache/muffle-evals`.

Results: [BENCHMARK.md](BENCHMARK.md). What muffle does to each command's output, raw next to muffled, for every
task: [commands/](commands/). The code each agent wrote, next to the upstream change, per task:
[results/tasks/](results/tasks/). Adding a task: see [TASKS.md](TASKS.md).
