# Benchmark

Does muffle save tokens without making the agent's code worse? Measured on 32 real changes, each made upstream in an
open-source project in 2025 or 2026 (the list is in [tasks/](tasks/)): 20 bug fixes and 12 small features, a quarter
each in Rust, Python, TypeScript and Go.
The agent gets the bug report or feature request and the project as it was before the change, without git history.
The tests the upstream change added are hidden from it and decide pass or fail; the agent's own test changes are
undone before they run. A feature request names the functions and options the tests call, never how to build them.

Claude Code with Sonnet and Codex 0.163.0 with gpt-6.1-sol at low effort, 2026-10-22, one run per task, agent and
setup: 320 runs. To judge the code itself, each task has a page in [results/tasks/](results/tasks/) with
the bug report, the upstream change and every agent's diff next to it.

| Setup | `muffle init` flags |
|---|---|
| base | none: the agent without muffle |
| muffle | `--lean` |
| hush | `--lean --hush` |
| sloth | `--lean --sloth` |
| all | `--lean --hush --sloth` |

## Bug fixes

### Claude Code

| Setup | Passed | Cost per run | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|---:|
| base | 19/20 | $0.106 | 192,627 | 2,744 | 165 | 14.4 |
| muffle | 18/20 | $0.106 (0%) | 147,656 (−23%) | 3,266 (+19%) | 168 (+2%) | 16.8 |
| hush | 19/20 | **$0.079 (−26%)** | 109,941 (−43%) | 1,941 (−29%) | 53 (−68%) | 14.8 |
| sloth | 18/20 | $0.110 (+4%) | 144,185 (−25%) | 3,151 (+15%) | 181 (+10%) | 10.2 |
| all | 19/20 | $0.081 (−23%) | 110,046 (−43%) | 1,894 (−31%) | 59 (−64%) | 12.9 |

### Codex

| Setup | Passed | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|
| base | 19/20 | 195,499 | 1,661 | 94 | 13.2 |
| muffle | 19/20 | 155,890 (−20%) | 1,558 (−6%) | 94 (0%) | 14.4 |
| hush | 19/20 | **139,839 (−28%)** | 1,228 (−26%) | 25 (−73%) | 12.8 |
| sloth | 20/20 | 165,081 (−16%) | 1,387 (−16%) | 125 (+33%) | 9.8 |
| all | 18/20 | 152,156 (−22%) | 1,059 (−36%) | 21 (−78%) | 9.2 |

Input tokens count cached and uncached input together. Lines added leave out test files.

## Features

### Claude Code

| Setup | Passed | Cost per run | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|---:|
| base | 11/12 | $0.124 | 165,734 | 3,885 | 183 | 60.0 |
| muffle | 12/12 | $0.103 (−17%) | 115,118 (−31%) | 3,451 (−11%) | 174 (−5%) | 60.2 |
| hush | 11/12 | $0.100 (−19%) | 108,867 (−34%) | 3,091 (−20%) | 44 (−76%) | 56.2 |
| sloth | 12/12 | **$0.084 (−32%)** | 88,103 (−47%) | 2,503 (−36%) | 168 (−8%) | 41.9 (−30%) |
| all | 12/12 | $0.096 (−23%) | 109,477 (−34%) | 2,688 (−31%) | 57 (−69%) | 45.5 (−24%) |

### Codex

| Setup | Passed | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|
| base | 12/12 | 185,691 | 2,288 | 88 | 48.7 |
| muffle | 12/12 | 168,352 (−9%) | 2,291 (0%) | 90 (+2%) | 46.8 (−4%) |
| hush | 12/12 | 131,042 (−29%) | 1,834 (−20%) | 25 (−72%) | 43.2 (−11%) |
| sloth | 12/12 | 147,535 (−21%) | 1,649 (−28%) | 125 (+42%) | 44.8 (−8%) |
| all | 12/12 | **134,487 (−28%)** | 1,374 (−40%) | 25 (−72%) | 39.2 (−20%) |

## Reading the numbers

- No setup lost correctness beyond the noise of one run per task. Claude Code fails `rust-chrono-iter-days-rev` in
  every setup, `base` included, and `ts-mlly-generic-export-names` with muffle and sloth. Codex fails
  `ts-yaml-flow-key-after-blank` in base and all, and `rust-chrono-iter-days-rev` in muffle, hush and all.
- muffle alone cuts input by about a fifth with both agents. With Claude Code that did not show in the cost of these
  short tasks, since it wrote more.
- `--hush` saves the most: about a quarter of Claude Code's cost and of Codex's input, with the same pass rate.
- `--sloth` pays off where there is code to leave out. On features it is the cheapest Claude Code setup, 32% under
  `base` with 30% fewer lines and every task passed; on bug fixes, whose upstream changes are a few lines, it costs
  4% more.
- On features every setup with muffle passed at least as many tasks as `base`; the one miss in `base` and `hush` is
  `python-feat-packaging-requirement-replace`.
- Run times are not comparable: Claude Code hit its session limit during the muffle and sloth runs, which stalled some
  of them for over ten minutes.

## Reproducing

```sh
./evals.py prepare $(ls tasks) && ./evals.py matrix base,muffle,hush,sloth,all claude,codex 1 && ./evals.py report
```

[results/README.md](results/README.md) has every column and the pass table per task. Earlier measurements on
purpose-built fixtures and on single commands are in [history/fixtures.md](history/fixtures.md).
