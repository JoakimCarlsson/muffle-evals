# Benchmark

Does muffle save tokens without making the agent's code worse? Measured on 32 real changes, each made upstream in an
open-source project in 2025 or 2026 (the list is in [tasks/](tasks/)): 20 bug fixes and 12 small features, a quarter
each in Rust, Python, TypeScript and Go.
The agent gets the bug report or feature request and the project as it was before the change, without git history.
The tests the upstream change added are hidden from it and decide pass or fail; the agent's own test changes are
undone before they run. A feature request names the functions and options the tests call, never how to build them.

Claude Code with Sonnet and Codex 0.163.0 with gpt-6.1-sol at low effort, one run per task, agent and setup: 320 runs.
The `base` runs are from 2026-10-22; the setups with muffle were run on 2026-10-22 and 23, after `muffle init` began
pointing both agents at muffle's proxy, which leaves old tool results, call inputs and reasoning out of what they send. To judge the code itself, each task has a page in [results/tasks/](results/tasks/) with
the bug report, the upstream change and every agent's diff next to it.

| Setup | `muffle init` flags |
|---|---|
| base | none: the agent without muffle |
| muffle | none |
| hush | `--hush` |
| sloth | `--sloth` |
| all | `--hush --sloth` |

## Command output

In every task's project, the commands an agent typically runs (its tests, build, lint, `git`, `ls`, `find`, `grep`,
`cat` of the longest source file) were run once as they are and once as muffle's hook rewrites them. They are written
the way agents write them: tests and builds with `2>&1`, and `grep` for two names at once with a quoted `"a\|b"`
pattern. `cat` shows a long source file as an outline first. A command muffle leaves alone counts its raw output on
both sides.

| Program | Commands | Raw bytes | With muffle | Saved |
|---|---:|---:|---:|---:|
| grep | 31 | 2,202,674 | 265,922 | 88% |
| cargo | 24 | 970,299 | 197,575 | 80% |
| ls | 32 | 42,045 | 12,292 | 71% |
| task tests | 32 | 80,361 | 38,741 | 52% |
| go | 24 | 11,253 | 5,570 | 51% |
| find | 32 | 73,111 | 41,434 | 44% |
| cat | 32 | 1,641,446 | 1,082,651 | 35% |
| git | 96 | 81,669 | 58,827 | 28% |
| uvx | 8 | 174,798 | 174,798 | 0% |
| **All** | **311** | **5,277,656** | **1,877,810** | **65%** |

Before muffle's hook looked past quoted text and a trailing `2>&1`, it left the tests, builds and `grep` above alone
and saved 14% of the same output (4,590,571 bytes); now it saves 65%, about 850,000 tokens over these 311 commands
instead of 170,000. The agent runs below were made after that change.

Each output, raw and with muffle, is in [commands/](commands/), listed in [commands/README.md](commands/README.md).

## Bug fixes

### Claude Code

| Setup | Passed | Cost per run | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|---:|
| base | 19/20 | $0.106 | 192,628 | 2,744 | 165 | 14.4 |
| muffle | 19/20 | $0.096 (−10%) | 127,543 (−34%) | 2,636 (−4%) | 157 (−5%) | 15.9 |
| hush | 18/20 | $0.091 (−14%) | **122,516 (−36%)** | 2,234 (−19%) | 51 (−69%) | 16.8 |
| sloth | 19/20 | $0.095 (−11%) | 129,308 (−33%) | 2,569 (−6%) | 151 (−8%) | 11.9 (−17%) |
| all | 19/20 | **$0.092 (−14%)** | 125,689 (−35%) | 2,253 (−18%) | 57 (−66%) | 11.3 (−22%) |

### Codex

| Setup | Passed | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|
| base | 19/20 | 195,499 | 1,662 | 94 | 13.2 |
| muffle | 19/20 | **145,820 (−25%)** | 1,635 (−2%) | 97 (+3%) | 14.1 |
| hush | 19/20 | 148,705 (−24%) | 1,322 (−20%) | 25 (−74%) | 12.1 |
| sloth | 20/20 | 166,016 (−15%) | 1,765 (+6%) | 137 (+45%) | 10.6 (−20%) |
| all | 20/20 | 168,900 (−14%) | 1,482 (−11%) | 24 (−74%) | 11.9 (−10%) |

Input tokens count cached and uncached input together. Lines added leave out test files.

## Features

### Claude Code

| Setup | Passed | Cost per run | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|---:|
| base | 11/12 | $0.124 | 165,735 | 3,886 | 184 | 60.0 |
| muffle | 12/12 | $0.108 (−13%) | 107,893 (−35%) | 4,017 (+3%) | 168 (−9%) | 60.2 |
| hush | 12/12 | **$0.097 (−22%)** | **96,743 (−42%)** | 3,044 (−22%) | 39 (−79%) | 55.8 (−7%) |
| sloth | 11/12 | $0.111 (−10%) | 128,597 (−22%) | 3,483 (−10%) | 171 (−7%) | 42.8 (−29%) |
| all | 12/12 | $0.104 (−16%) | 113,767 (−31%) | 3,152 (−19%) | 60 (−67%) | 45.8 (−24%) |

### Codex

| Setup | Passed | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|
| base | 12/12 | 185,691 | 2,288 | 89 | 48.7 |
| muffle | 12/12 | 153,329 (−17%) | 2,371 (+4%) | 92 (+4%) | 48.7 (0%) |
| hush | 12/12 | **136,381 (−27%)** | 1,968 (−14%) | 22 (−75%) | 45.5 (−7%) |
| sloth | 12/12 | 185,962 (0%) | 2,683 (+17%) | 132 (+49%) | 41.2 (−15%) |
| all | 12/12 | 169,871 (−9%) | 2,124 (−7%) | 20 (−77%) | 37.6 (−23%) |

## Reading the numbers

- No setup lost correctness beyond the noise of one run per task. Claude Code fails `rust-chrono-iter-days-rev` in
  base, muffle, hush and all, `ts-mlly-generic-export-names` in hush and sloth, and
  `python-feat-packaging-requirement-replace` in base and sloth. Codex fails `rust-chrono-iter-days-rev` in muffle and
  hush, and `ts-yaml-flow-key-after-blank` in base.
- muffle alone cuts input by about a third with Claude Code and a fifth with Codex, and Claude Code's cost by 10 to
  13%.
- Every setup with muffle costs Claude Code less than `base`, 10 to 22%; `--hush` saves the most on features and
  `all` on bug fixes.
- `--sloth` writes 15 to 29% fewer lines of code and adds one focused test for each fix or feature.
- Codex's cost is not reported, so only its tokens are compared. Its uncached input rose with muffle while its cached
  input fell further.

## Reproducing

```sh
./evals.py prepare $(ls tasks) && ./evals.py matrix base,muffle,hush,sloth,all claude,codex 1 && ./evals.py report
```

[results/README.md](results/README.md) has every column and the pass table per task. Earlier measurements on
purpose-built fixtures and on single commands are in [history/fixtures.md](history/fixtures.md).
