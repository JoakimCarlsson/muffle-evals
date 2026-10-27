# muffle-evals

Does muffle save tokens without making the agent's code worse? Yes, and which setup is best depends on the agent:

- **Claude Code: `muffle init --hush --sloth`.** 22% less input per run, 9% fewer tool calls, 16% lower cost, and the
  same 13 of 17 tasks passed as the agent alone. `muffle init` alone saves 27% but passed 11 of 17.
- **Codex: `muffle init --hush`.** 17% less input, 4% fewer tool calls and the same 16 of 20 tasks passed. `--sloth`
  made Codex pass 18 of 20, but at 5% more input than the agent alone.
- **Long tasks gain most.** On 10 changes of 150 to 600 lines Claude Code used 18 to 29% less input in every setup.
- **Shorter command output.** Over 463 commands agents typically run, written as agents write them, muffle printed
  87% fewer bytes, mostly from `git show` of large commits; 88% fewer for `grep`, 77% for `cargo`, 52% for test runs.

Mean tokens per run, 20 tasks for Codex and 17 for Claude Code (three Claude Code runs hung on a command the agent
wrote and are left out with their tasks), change against the agent alone in brackets. Input is split into uncached (read
fresh) and cached (read from the prompt cache, which costs far less):

| Claude Code | Passed | Uncached input | Cached input | Output | Total |
|---|---:|---:|---:|---:|---:|
| alone | 13/17 | 43,277 | 612,947 | 15,234 | 671,458 |
| `muffle init` | 11/17 | 39,554 (−9%) | 442,354 (−28%) | 14,563 (−4%) | 496,470 (−26%) |
| `--hush` | 14/17 | 42,260 (−2%) | 490,973 (−20%) | 12,985 (−15%) | 546,218 (−19%) |
| `--sloth` | 12/17 | 40,631 (−6%) | 513,903 (−16%) | 13,539 (−11%) | 568,073 (−15%) |
| `--hush --sloth` | 13/17 | 38,773 (−10%) | 472,122 (−23%) | 12,229 (−20%) | **523,124 (−22%)** |

| Codex | Passed | Uncached input | Cached input | Output | Total |
|---|---:|---:|---:|---:|---:|
| alone | 16/20 | 26,089 | 314,624 | 3,964 | 344,677 |
| `muffle init` | 17/20 | 23,032 (−12%) | 268,128 (−15%) | 3,883 (−2%) | 295,043 (−14%) |
| `--hush` | 16/20 | 27,963 (+7%) | 253,190 (−20%) | 3,438 (−13%) | **284,592 (−17%)** |
| `--sloth` | 18/20 | 25,004 (−4%) | 332,512 (+6%) | 4,327 (+9%) | 361,843 (+5%) |
| `--hush --sloth` | 18/20 | 27,091 (+4%) | 338,714 (+8%) | 4,126 (+4%) | 369,931 (+7%) |

Long tasks send about ten times the tokens of short ones, so these means follow them. [BENCHMARK.md](BENCHMARK.md)
splits them out.

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
./evals.py matrix base,muffle,hush,sloth,all claude,codex 1
./evals.py report                           # writes results/README.md
./evals.py commands                         # writes commands/: each command's output with and without muffle
```

`MUFFLE_BIN` picks the muffle binary (default `~/Documents/repos/muffle/build/release/muffle`). Agents: Claude Code
with Sonnet, Codex with gpt-6.1-sol at low effort. Clones, prepared projects and raw agent output live in
`~/.cache/muffle-evals`.

Results: [BENCHMARK.md](BENCHMARK.md). What muffle does to each command's output, raw next to muffled, for every
task: [commands/](commands/). The code each agent wrote, next to the upstream change, per task:
[results/tasks/](results/tasks/). Adding a task: see [TASKS.md](TASKS.md).
