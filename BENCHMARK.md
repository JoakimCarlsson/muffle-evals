# Benchmark

Does muffle save tokens without making the agent's code worse? Measured on 20 real changes, each made upstream in an
open-source project in 2025 or 2026 (the list is in [tasks/](tasks/)): 6 bug fixes, 4 small features and 10 long tasks
(a change of 150 to 600 lines across several files that takes an agent many turns).
The agent gets the bug report or feature request and the project as it was before the change, without git history.
The tests the upstream change added are hidden from it and decide pass or fail; the agent's own test changes are
undone before they run. A feature request names the functions and options the tests call, never how to build them.

Claude Code with Sonnet and Codex 0.163.0 with gpt-6.1-sol at low effort, one run per task, agent and setup: 200 runs,
made on 2026-10-26 and 27. Each run is one whole session, from the prompt to the final reply, and its tokens, turns and
tool calls are summed over all of it. Every run has its own cache folder, and a run is thrown out when muffle ran in a
setup without it, or did not run in a setup with it.
Three Claude Code runs (`python-feat-tenacity-wait-exception`, `ts-feat-pathe-reverse-alias` and
`ts-citty-kebab-default`) hung for about 12 minutes on a command the agent wrote itself, a `cat` with no file that waits
for input. Such a run says nothing about the setup, so each is left out of the Claude Code means below together with
that task in the other setups: 17 tasks for Claude Code, 20 for Codex. All three hangs were in setups with muffle and
none in base; with so few I cannot tell chance from cause.
Codex's cost and turns are not reported, so only its tokens and tool calls are compared.
To judge the code itself, each task has a page in [results/tasks/](results/tasks/) with the bug report, the upstream
change and every agent's diff next to it.

| Setup | `muffle init` flags |
|---|---|
| base | none: the agent without muffle |
| muffle | none |
| hush | `--hush` |
| sloth | `--sloth` |
| all | `--hush --sloth` |

## Command output

In every task's project, in a failing and a fixed state, the commands an agent typically runs (its tests, build, lint,
`git`, `ls`, `find`, `grep`, `cat` of the longest source file) were run once as they are and once as muffle's hook
rewrites them. A command muffle leaves alone counts its raw output on both sides.

| Program | Commands | Raw bytes | With muffle | Saved |
|---|---:|---:|---:|---:|
| git | 224 | 37,062,847 | 2,995,195 | 92% |
| grep | 31 | 2,208,347 | 268,273 | 88% |
| cat | 32 | 1,641,446 | 1,082,651 | 35% |
| uvx | 16 | 1,022,764 | 1,022,764 | 0% |
| cargo | 32 | 1,017,014 | 237,475 | 77% |
| task tests | 32 | 80,377 | 38,765 | 52% |
| find | 32 | 73,111 | 41,434 | 44% |
| ls | 32 | 42,581 | 12,396 | 71% |
| go | 24 | 11,253 | 5,570 | 51% |
| npx | 8 | 5,798 | 5,706 | 2% |
| **All** | **463** | **43,165,538** | **5,710,229** | **87%** |

Most of the git bytes are `git show` of the large upstream commits, so the 87% total overstates what a typical session
saves; the whole-session numbers below are the measure that counts.

Each output, raw and with muffle, is in [commands/](commands/), listed in [commands/README.md](commands/README.md).

## Whole sessions, Claude Code

Means per run. Input tokens count cached and uncached input together. Lines added leave out test files.

### Long tasks (10)

| Setup | Passed | Turns | Tool calls | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|---:|---:|
| base | 7/10 | 16.0 | 15.9 | 1,025,142 | 24,097 | 322 | 365 |
| muffle | 5/10 | 13.9 (−13%) | 13.8 (−13%) | 726,951 (−29%) | 22,814 (−5%) | 313 (−3%) | 323 (−11%) |
| hush | 7/10 | 15.3 (−4%) | 16.0 (+1%) | 820,969 (−20%) | 20,596 (−15%) | 115 (−64%) | 337 (−8%) |
| sloth | 6/10 | 15.8 (−1%) | 16.2 (+2%) | 840,984 (−18%) | 20,991 (−13%) | 275 (−15%) | 217 (−41%) |
| all | 6/10 | 14.3 (−11%) | 14.3 (−10%) | 780,429 (−24%) | 19,226 (−20%) | 142 (−56%) | 270 (−26%) |

### Bug fixes (5)

| Setup | Passed | Turns | Tool calls | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|---:|---:|
| base | 4/5 | 6.0 | 5.2 | 138,749 | 2,445 | 138 | 26 |
| muffle | 4/5 | 6.4 (+7%) | 6.2 (+19%) | 145,011 (+5%) | 2,713 (+11%) | 160 (+15%) | 26 (0%) |
| hush | 5/5 | 5.6 (−7%) | 5.0 (−4%) | 128,489 (−7%) | 1,920 (−21%) | 58 (−58%) | 15 (−44%) |
| sloth | 4/5 | 6.2 (+3%) | 5.4 (+4%) | 136,467 (−2%) | 2,656 (+9%) | 130 (−6%) | 18 (−30%) |
| all | 5/5 | 5.8 (−3%) | 5.2 (0%) | 138,853 (0%) | 2,236 (−9%) | 57 (−59%) | 15 (−43%) |

### Features (2)

| Setup | Passed | Turns | Tool calls | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|---:|---:|
| base | 2/2 | 4.5 | 4.5 | 105,320 | 2,893 | 156 | 57 |
| muffle | 2/2 | 4.5 (0%) | 4.0 (−11%) | 98,930 (−6%) | 2,929 (+1%) | 160 (+3%) | 53 (−7%) |
| hush | 2/2 | 5.0 (+11%) | 4.5 (0%) | 106,414 (+1%) | 2,585 (−11%) | 57 (−64%) | 58 (+2%) |
| sloth | 2/2 | 7.0 (+56%) | 6.0 (+33%) | 167,448 (+59%) | 3,486 (+20%) | 150 (−4%) | 43 (−25%) |
| all | 2/2 | 4.0 (−11%) | 4.0 (−11%) | 93,336 (−11%) | 2,221 (−23%) | 36 (−77%) | 38 (−33%) |

Seven short tasks are too few to say anything about them.

### All 17 tasks

| Setup | Passed | Turns | Tool calls | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|---:|---:|
| base | 13/17 | 11.7 | 11.4 | 656,224 | 15,234 | 248 | 229 |
| muffle | 11/17 | 10.6 (−10%) | 10.4 (−9%) | 481,908 (−27%) | 14,563 (−4%) | 250 (+1%) | 204 (−11%) |
| hush | 14/17 | 11.2 (−4%) | 11.4 (0%) | 533,233 (−19%) | 12,985 (−15%) | 91 (−63%) | 209 (−9%) |
| sloth | 12/17 | 11.9 (+2%) | 11.8 (+4%) | 554,534 (−15%) | 13,539 (−11%) | 217 (−12%) | 138 (−40%) |
| all | 13/17 | 10.6 (−10%) | 10.4 (−9%) | 510,895 (−22%) | 12,229 (−20%) | 104 (−58%) | 168 (−27%) |

## Whole sessions, Codex

### Long tasks (10)

| Setup | Passed | Tool calls | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|---:|
| base | 7/10 | 15.4 | 518,009 | 6,315 | 136 | 242 |
| muffle | 8/10 | 15.7 (+2%) | 447,863 (−14%) | 6,033 (−4%) | 134 (−2%) | 260 (+8%) |
| hush | 7/10 | 13.9 (−10%) | 429,444 (−17%) | 5,466 (−13%) | 20 (−85%) | 241 (0%) |
| sloth | 8/10 | 15.0 (−3%) | 554,086 (+7%) | 6,871 (+9%) | 152 (+11%) | 231 (−5%) |
| all | 8/10 | 16.3 (+6%) | 575,115 (+11%) | 6,832 (+8%) | 26 (−81%) | 238 (−1%) |

### Bug fixes and features (10)

| Setup | Passed | Tool calls | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|---:|
| base | 9/10 | 7.1 | 163,417 | 1,612 | 92 | 30 |
| muffle | 9/10 | 7.8 (+10%) | 134,456 (−18%) | 1,734 (+8%) | 98 (+6%) | 31 (+3%) |
| hush | 9/10 | 7.6 (+7%) | 132,863 (−19%) | 1,410 (−13%) | 21 (−77%) | 26 (−13%) |
| sloth | 10/10 | 7.1 (0%) | 160,946 (−2%) | 1,782 (+11%) | 112 (+21%) | 25 (−17%) |
| all | 10/10 | 5.9 (−17%) | 156,495 (−4%) | 1,421 (−12%) | 23 (−75%) | 22 (−27%) |

### All 20 tasks

| Setup | Passed | Tool calls | Input tokens | Output tokens | Reply words | Lines of code added |
|---|---:|---:|---:|---:|---:|---:|
| base | 16/20 | 11.2 | 340,713 | 3,964 | 114 | 136 |
| muffle | 17/20 | 11.8 (+4%) | 291,160 (−15%) | 3,883 (−2%) | 116 (+1%) | 146 (+7%) |
| hush | 16/20 | 10.8 (−4%) | 281,154 (−17%) | 3,438 (−13%) | 21 (−82%) | 134 (−2%) |
| sloth | 18/20 | 11.1 (−2%) | 357,516 (+5%) | 4,327 (+9%) | 132 (+15%) | 128 (−6%) |
| all | 18/20 | 11.1 (−1%) | 365,805 (+7%) | 4,126 (+4%) | 24 (−79%) | 130 (−4%) |

## Reading the numbers

- **Claude Code: `--hush --sloth` is the best setup.** It used 22% less input than base, with 9% fewer tool calls and
  16% lower cost, and passed as many tasks as base (13 of 17). On long tasks it is −24% input.
- **Codex: use `--hush`.** It used 17% less input and 4% fewer tool calls and passed as many tasks as base. `muffle init`
  alone saves 15% and passed 17 of 20. `--sloth` and `--hush --sloth` passed the most tasks (18 of 20), but used 5 and
  7% more input than base, so on Codex they trade tokens for correctness.
- **`--sloth` asks the agent to check each requirement in the request before it stops.** That is what brought its pass
  rate back to base's level; an earlier text that stopped once its own tests passed saved more tokens (−28 to −40% on
  Codex) and failed more tasks. The extra checking costs input.
- **Long tasks gain most.** With Claude Code every setup used 18 to 29% less input on them; a long task sends about a
  million input tokens, a short one about 130,000.
- **Muffle does not send the agent back for more.** No agent opened a file muffle had saved the full output to, in any
  of the 200 runs, and tool calls stayed level or fell.
- **`--hush` cuts replies by 58 to 85%** and **`--sloth` writes 4 to 40% fewer lines of code**.
- **Pass rates are close, with one worry.** With Claude Code `muffle` alone and `--sloth` alone passed 11 and 12 of 17
  against 13 for base; the failures were `ts-hono-define-handler` and `ts-ky-force-retry` for `muffle`, whose runs read
  the same files as the passing base runs. One run per task cannot tell chance from cause.
- Earlier versions of this page used other tasks and other `--hush` and `--sloth` texts; their numbers are not
  comparable.

## Reproducing

```sh
cd ../muffle && cargo build --release && cd ../muffle-evals
./evals.py prepare $(ls tasks) && ./evals.py matrix base,muffle,hush,sloth,all claude,codex 1 && ./evals.py report
```

[results/README.md](results/README.md) has every column and the pass table per task. The shell commands the agents ran
are ranked in [results/commands.md](results/commands.md). Earlier measurements on purpose-built fixtures and on single
commands are in [history/fixtures.md](history/fixtures.md).
