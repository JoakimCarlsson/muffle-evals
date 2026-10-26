# muffle-evals

Does muffle save tokens without making the agent's code worse? Yes:

- **Same results.** On 32 real bug fixes and features in Rust, Python, TypeScript and Go, agents with muffle passed as
  many tasks as without it, or more.
- **Fewer tokens.** Per run, Claude Code used 29 to 38% fewer tokens in total with muffle, Codex 9 to 25% fewer. With
  `muffle init --hush --sloth` that is 33% for Claude Code and 12% for Codex.
- **Shorter command output.** Over 311 commands agents typically run, written as agents write them, muffle printed
  65% fewer bytes: 88% fewer for `grep`, 80% for `cargo`, 52% for test runs.

Mean tokens per run over all 32 tasks, change against the agent alone in brackets. Input is split into uncached (read
fresh) and cached (read from the prompt cache, which costs far less):

| Claude Code | Passed | Uncached input | Cached input | Output | Total |
|---|---:|---:|---:|---:|---:|
| alone | 30/32 | 16,132 | 166,411 | 3,172 | 185,715 |
| `muffle init` | 31/32 | 14,656 (−9%) | 105,518 (−37%) | 3,154 (−1%) | 123,328 (−34%) |
| `--hush` | 30/32 | 14,537 (−10%) | 98,314 (−41%) | 2,538 (−20%) | **115,389 (−38%)** |
| `--sloth` | 30/32 | 15,072 (−7%) | 113,970 (−32%) | 2,912 (−8%) | 131,953 (−29%) |
| `--hush --sloth` | 31/32 | 14,996 (−7%) | 106,222 (−36%) | 2,590 (−18%) | 123,808 (−33%) |

| Codex | Passed | Uncached input | Cached input | Output | Total |
|---|---:|---:|---:|---:|---:|
| alone | 31/32 | 19,193 | 172,628 | 1,897 | 193,718 |
| `muffle init` | 31/32 | 23,824 (+24%) | 124,812 (−28%) | 1,911 (+1%) | 150,547 (−22%) |
| `--hush` | 31/32 | 23,251 (+21%) | 120,832 (−30%) | 1,564 (−18%) | **145,647 (−25%)** |
| `--sloth` | 32/32 | 22,960 (+20%) | 150,536 (−13%) | 2,109 (+11%) | 175,605 (−9%) |
| `--hush --sloth` | 32/32 | 24,509 (+28%) | 144,756 (−16%) | 1,723 (−9%) | 170,988 (−12%) |

Claude Code reads less of everything. Codex's saving is all in cached input: it reads 20 to 28% more uncached input with
muffle, so its total overstates the saving in the tokens that cost the most. Output tokens, the dearest each, fall 18 to
20% with `--hush` for both agents.

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
