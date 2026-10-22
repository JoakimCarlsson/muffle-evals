# Benchmark

Does muffle save tokens without making the agent's code worse? Measured on 20 real bugs, each fixed upstream in an
open-source project in 2025 or 2026: 5 each in Rust, Python, TypeScript and Go (the list is in [tasks/](tasks/)).
The agent gets the bug report and the project as it was before the fix, without git history. The tests the upstream
fix added are hidden from it and decide pass or fail; the agent's own test changes are undone before they run.

Claude Code with Sonnet and Codex 0.163.0 with gpt-6.1-sol at low effort, 2026-10-22, one run per task, agent and
setup: 200 runs. Every diff, reply and hidden test log is in [results/](results/).

| Setup | `muffle init` flags |
|---|---|
| base | none: the agent without muffle |
| muffle | `--lean` |
| hush | `--lean --hush` |
| sloth | `--lean --sloth` |
| all | `--lean --hush --sloth` |

## Claude Code

| Setup | Passed | Cost per run | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|---:|
| base | 19/20 | $0.106 | 192,627 | 2,744 | 165 | 14.4 |
| muffle | 18/20 | $0.106 (0%) | 147,656 (−23%) | 3,266 (+19%) | 168 (+2%) | 16.8 |
| hush | 19/20 | **$0.079 (−26%)** | 109,941 (−43%) | 1,941 (−29%) | 53 (−68%) | 14.8 |
| sloth | 18/20 | $0.110 (+4%) | 144,185 (−25%) | 3,151 (+15%) | 181 (+10%) | 10.2 |
| all | 19/20 | $0.081 (−23%) | 110,046 (−43%) | 1,894 (−31%) | 59 (−64%) | 12.9 |

## Codex

| Setup | Passed | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|
| base | 19/20 | 195,499 | 1,661 | 94 | 13.2 |
| muffle | 19/20 | 155,890 (−20%) | 1,558 (−6%) | 94 (0%) | 14.4 |
| hush | 19/20 | **139,839 (−28%)** | 1,228 (−26%) | 25 (−73%) | 12.8 |
| sloth | 20/20 | 165,081 (−16%) | 1,387 (−16%) | 125 (+33%) | 9.8 |
| all | 18/20 | 152,156 (−22%) | 1,059 (−36%) | 21 (−78%) | 9.2 |

Input tokens count cached and uncached input together. Lines added leave out test files.

## Reading the numbers

- No setup lost correctness beyond the noise of one run per task. Claude Code fails `rust-chrono-iter-days-rev` in
  every setup, `base` included, and `ts-mlly-generic-export-names` with muffle and sloth. Codex fails
  `ts-yaml-flow-key-after-blank` in base and all, and `rust-chrono-iter-days-rev` in muffle, hush and all.
- muffle alone cuts input by about a fifth with both agents. With Claude Code that did not show in the cost of these
  short tasks, since it wrote more.
- `--hush` saves the most: about a quarter of Claude Code's cost and of Codex's input, with the same pass rate.
- `--sloth` writes about 30% fewer lines of code, but costs Claude Code slightly more than without it.
- Run times are not comparable: Claude Code hit its session limit during the muffle and sloth runs, which stalled some
  of them for over ten minutes.

## Reproducing

```sh
./evals.py prepare $(ls tasks) && ./evals.py matrix base,muffle,hush,sloth,all claude,codex 1 && ./evals.py report
```

[results/README.md](results/README.md) has every column and the pass table per task. Earlier measurements on
purpose-built fixtures and on single commands are in [history/fixtures.md](history/fixtures.md).
