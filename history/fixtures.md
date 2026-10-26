# Earlier benchmarks

Measured on fixtures written for muffle (small projects with planted bugs) and on command output alone, before the
real-task evals in [BENCHMARK.md](../BENCHMARK.md). Kept for the per-command numbers.

What muffle saves on real command output, and whether an agent still gets its work done with the compressed output.
All runs were made on Linux with the release build: Rust stable, Go 1.27.1, Node 26.11.1 with npm 12.2.0, Bun 1.3.11,
Python 3.14.7 with pytest 9.1.1, ruff 0.17.1 and mypy 2.4.0, TypeScript 6.0.3, ESLint 10.13.0, Vitest 5.0.5, GCC 16.2.1,
Docker 29.9.0 and gh 2.102.0.

## Command output

The same commands in the same build state, standard output and standard error combined, sizes in bytes. The large
repository is a 7,689-commit clone of a Rust editor; the workspace is a 24,600-line Rust game engine. The Python,
C and C++, TypeScript and Docker rows come from small projects with deliberate errors and failing tests, and the `gh`
rows from a pull request and a failed workflow run of a public repository.

| Command | Raw | muffle | Saved |
|---|---:|---:|---:|
| `git status`, 3 changed files and 1 new | 413 | 71 | 83% |
| `git diff`, 3 files | 1,406 | 954 | 32% |
| `git diff HEAD~30`, 160 files | 83,127 | 18,348 | 78% |
| `git log -10` | 2,908 | 1,737 | 40% |
| `git log`, 7,689 commits | 2,506,104 | 1,758 | 100% |
| `git log -p -3` | 7,227 | 4,645 | 36% |
| `git show`, one commit | 873 | 523 | 40% |
| `git blame`, 137-line file | 12,179 | 5,473 | 55% |
| `git grep -n "fn "`, 24,600-line workspace | 109,649 | 12,060 | 89% |
| `cargo build`, 24 warnings | 4,701 | 1,332 | 72% |
| `cargo check`, 24 warnings | 4,701 | 1,332 | 72% |
| `cargo clippy`, 10 warnings | 4,165 | 863 | 79% |
| `cargo build`, 3 errors | 2,402 | 1,088 | 55% |
| `cargo test`, 1 failing, 24 warnings | 7,055 | 1,561 | 78% |
| `cargo test`, all passing | 884 | 19 | 98% |
| `cargo build`, nothing to rebuild | 72 | 22 | 69% |
| `go build ./...`, 5 errors | 481 | 459 | 5% |
| `go test ./...`, 1 failing test and a panic | 5,136 | 1,268 | 75% |
| `go test ./...`, all passing | 82 | 14 | 83% |
| `go test -v ./...`, 122 tests passing | 8,396 | 14 | 100% |
| `npm install`, 4 dependencies | 680 | 312 | 54% |
| `npm ci` | 680 | 312 | 54% |
| `npm install`, up to date | 258 | 161 | 38% |
| `npm test`, 602 tests, 2 failing | 20,126 | 656 | 97% |
| `npm test`, 36 tests, 3 failing | 4,391 | 1,091 | 75% |
| `npm run lint` | 98 | 98 | 0% |
| `bun install`, 4 dependencies | 183 | 145 | 21% |
| `bun test`, 82 tests, 2 failing | 312 | 250 | 20% |
| `bun test`, all passing | 102 | 55 | 46% |
| `npx tsc`, 4 errors | 399 | 332 | 17% |
| `npx eslint`, 4 problems | 534 | 405 | 24% |
| `npx vitest run`, 42 tests, 2 failing | 1,592 | 562 | 65% |
| `pytest`, 121 tests, 1 failing | 862 | 207 | 76% |
| `ruff check`, 7 problems | 2,135 | 503 | 76% |
| `mypy`, 3 errors | 352 | 342 | 3% |
| `gcc -Wall -Wextra`, 3 errors and 4 warnings | 1,087 | 617 | 43% |
| `g++`, STL template error | 9,220 | 473 | 95% |
| `make -k`, both of the above | 10,487 | 1,191 | 89% |
| `docker build`, failing step | 1,612 | 808 | 50% |
| `docker compose build` | 1,743 | 216 | 88% |
| `docker pull`, new image | 892 | 114 | 87% |
| `docker compose pull`, 2 images | 2,823 | 90 | 97% |
| `docker compose up -d`, 3 services | 560 | 130 | 77% |
| `docker compose down` | 491 | 130 | 74% |
| `docker ps` | 1,548 | 1,068 | 31% |
| `docker compose ps` | 437 | 319 | 27% |
| `docker images`, 20 images | 2,289 | 1,141 | 50% |
| `docker logs`, repeated lines | 158 | 38 | 76% |
| `docker compose logs`, 3 services | 10,087 | 8,433 | 16% |
| `gh pr view` | 5,850 | 2,776 | 53% |
| `gh pr diff` | 77,486 | 14,957 | 81% |
| `gh pr checks`, 18 checks | 1,922 | 60 | 97% |
| `gh issue view` | 603 | 486 | 19% |
| `gh run view --log` | 82,832 | 7,821 | 91% |
| `gh run view --log-failed` | 55,166 | 4,498 | 92% |
| `grep -rn "fn " crates`, same workspace | 109,603 | 12,360 | 89% |
| `rg -n "fn " crates`, same workspace | 109,603 | 12,129 | 89% |
| `find . -name "*.rs"`, same workspace | 4,791 | 2,304 | 52% |
| `ls -la`, 44 entries | 2,708 | 665 | 75% |
| `ls -l`, 38 entries | 2,218 | 683 | 69% |
| `ls -R`, 9 directories | 821 | 745 | 9% |
| `cat` of a 137-line file read again in the same session | 4,366 | 71 | 98% |
| `cat` of a 1,393-line source file | 46,195 | 16,159 | 65% |
| `cat` of the same file again in the session | 46,195 | 39,880 | 14% |

`grep`, `rg` and `git grep` show the first 25 lines of each file and 200 in all, and `go test` the first 10 failing
subtests of each test; past that the rest is counted and the raw output kept. `find` keeps every path, grouped by
directory. A file printed twice through the hook in one session has its lines already shown replaced by one line
saying so the second time. A source file of 400 lines or more is printed as its skeleton first, every line numbered and
function bodies left out; printed again, it shows the bodies, with the skeleton's runs of lines marked as already
shown.

## Claude Code

Claude Code 2.1.305 with Sonnet 5.5, signed in with a subscription. Twelve tasks, each run three times without muffle
and three times with the hooks from `muffle init --agent claude`; all 72 runs passed their check. Cost is what Claude
Code reports for the run at API prices.

| Task | Cost without | Cost with muffle | Change | Tool output without | With muffle |
|---|---:|---:|---:|---:|---:|
| Rust workspace, fix 10 clippy warnings | $0.096 | $0.062 | −35% | 13,633 | 2,799 |
| Node project, 602 tests, 2 failing | $0.066 | $0.050 | −24% | 7,581 | 1,787 |
| Go module, failing table test and a panic | $0.059 | $0.051 | −14% | 6,333 | 2,640 |
| Rust crate, 400 tests, 2 failing, 24 warnings | $0.078 | $0.070 | −10% | 8,185 | 6,125 |
| Rust workspace, explain one physics step | $0.152 | $0.144 | −5% | 45,167 | 40,270 |
| Node project, 36 tests, 3 failing | $0.054 | $0.052 | −4% | 3,184 | 2,544 |
| Rust crate, uncommitted change broke a test | $0.049 | $0.048 | −3% | 2,544 | 1,563 |
| Bun project, 82 tests, 2 failing | $0.046 | $0.045 | −2% | 572 | 456 |
| Go module, 5 compile errors | $0.051 | $0.049 | −2% | 1,936 | 1,548 |
| Rust workspace, rename two functions, 54 call sites | $0.057 | $0.057 | −1% | 7,724 | 6,694 |
| Rust crate, two logic bugs | $0.054 | $0.054 | 0% | 3,724 | 3,542 |
| Rust crate, 3 compile errors | $0.057 | $0.067 | +17% | 4,443 | 4,451 |
| All twelve | $0.819 | $0.749 | −8% | 105,025 | 74,420 |

Costs and tool output are averages per run, tool output in bytes. Over all twelve tasks muffle cut uncached input
tokens by 9%, total input tokens by 7% and output tokens by 4%. Most of each run's input is Claude Code's own cached
instructions, so the savings grow with the output a task produces. The compile-error task is the one that cost more:
in one of its runs the agent's own `sed` edit failed halfway and took four more requests to repair.

## Long sessions

The long session reads the 78 source files of three crates of the workspace one at a time and writes a note on each:
about 84 requests, its conversation passing 300,000 tokens. `muffle claude` runs Claude Code behind muffle's proxy,
which leaves older tool results out of the request once 600 KB of them have built up.

| | Cost per run | Change |
|---|---:|---:|
| Without muffle, 3 runs | $3.27 | |
| muffle hooks, 3 runs | $3.27 | 0% |
| muffle hooks and `muffle claude`, 3 runs of about 85 requests | $2.81 | −14% |
| muffle hooks and `muffle claude`, a 4th run of 135 requests | $3.61 | +10% |

The hooks change nothing here, since the session reads files rather than running commands. In the three runs of
about 85 requests, the proxy cut the session's cache reads by about 40%. In the fourth run the agent made one tool call
per request instead of two from the start, long before the proxy changed anything, and so made 135 requests; counting
it, the four proxy runs average $3.01, 8% less than without muffle.

## Files read again

Agents read the same files again and again within a session. Replaying muffle's rules for repeated lines (runs of five
or more unchanged lines, shown within the last half hour, the same range returned in full when asked for twice in a row)
over 1,180 recorded Claude Code sessions with 47.5 MB of tool output:

| | Bytes | Share |
|---|---:|---:|
| All tool output | 47,511,102 | 100% |
| File reads (`Read`, `cat`, `sed -n`, `head`) | 12,849,495 | 27% |
| Left out as already shown | 1,948,760 | 15% of file reads, 4.1% of all tool output |

## Short replies and lean code

Claude Code 2.1.305 with Sonnet 5.5, 2026-10-21. Every run started from an empty Claude Code configuration
directory, so no user instructions, hooks, plugins or memory took part. Three setups: Claude Code alone; `muffle claude`
with the hooks from `muffle init --agent claude`; and the same with `muffle init --agent claude --hush --sloth`.

Eleven of the tasks above, the rename left out, three runs each. Every one of the 99 runs passed its check, and the code
changes matched across setups: 33 lines added and 66 to 69 removed outside the tests in all eleven tasks together, no
test file changed. Totals of the per-task averages:

| | Alone | muffle | muffle, hush and sloth |
|---|---:|---:|---:|
| Cost | $0.651 | $0.633 (−3%) | $0.711 (+9%) |
| Uncached input tokens | 115,665 | 112,251 (−3%) | 137,062 (+18%) |
| Total input tokens | 1,021,136 | 950,481 (−7%) | 1,069,194 (+5%) |
| Output tokens | 9,820 | 10,072 (+3%) | 6,968 (−29%) |
| Tool output, bytes | 79,147 | 64,125 (−19%) | 52,866 (−33%) |
| Reply words | 1,533 | 1,495 (−2%) | 516 (−66%) |

These tasks take one prompt and about five requests, so the hush and sloth instructions, about 1,800 tokens written to the
prompt cache at the start of every run, cost more than the shorter replies save; only the explanation task, with the
longest reply, came out cheaper (−11%). The saving in output grows with the number of prompts and the length of the
replies, while the instructions are written to the cache once per session.

Fourteen code-writing tasks, two runs each, with the shell tool switched off so that only the instructions differ:
seven functions with a hidden check against hostile input (path traversal, a shared rate limit, a forged token, a
malformed CSV row, a cache that must work, and two traced bugs), a rename and a format change that must reach every
caller, a helper to reuse instead of rewrite, and four open requests where the agent picks the scope. Source lines
exclude tests.

| | Alone | muffle | muffle, hush and sloth |
|---|---:|---:|---:|
| Passed the check, 28 runs | 28 | 28 | 28 |
| Passed the hostile input | 28 | 28 | 28 |
| Source lines written | 1,363 | 1,203 (−12%) | 614 (−55%) |
| Runs that wrote tests | 17 | 9 | 2 |
| Output tokens | 55,962 | 47,323 (−15%) | 26,381 (−53%) |
| Reply words | 4,129 | 3,932 (−5%) | 1,377 (−67%) |
| Cost | $1.331 | $1.295 (−3%) | $1.246 (−6%) |

Without the shell tool the muffle hooks do almost nothing here, so the differences between the first two columns are
run-to-run noise. With the hush and sloth instructions the agent wrote under half the code with every check still passing;
most of the cut came from the four open requests (1,000 source lines against 339), and the agent wrote tests in 2 of
28 runs, since the instructions ask for tests only when the user does.

## A long session

Claude Code 2.1.305 with Sonnet 5.5, 2026-10-21, three runs per setup, each from an empty configuration directory.
One session of twelve prompts in a Rust game engine workspace: three questions about its entity component system, a
document of the answers with file and line references, two planted bugs to find, fix and lint, an overview of its
color crate, a new `contrast_ratio` method, a review round asking for symmetry and tests, a test and lint run, and a
commit message. A run passes when the bug fixes pass the crate's tests with the tests unchanged, a hidden test of
`contrast_ratio` passes, clippy is clean, and the document's references resolve. All 12 runs passed.

| Per session | Claude Code alone | muffle, hush and sloth |
|---|---:|---:|
| Cost | $0.691 | $0.437 (−37%) |
| Total input tokens | 2,247,383 | 1,551,323 (−31%) |
| Output tokens | 20,633 | 11,778 (−43%) |
| Tool output, bytes | 82,406 | 39,145 (−52%) |
| Reply words | 2,637 | 841 (−68%) |
| Lines added | 247 | 92 |

These sessions sent about 40 KB of tool output in total, far below the 200 KB at which the proxy starts leaving items out,
so the proxy changed nothing here.

## Repeat runs, MCP results and instruction files

Claude Code 2.1.305 with Sonnet 5.5 and Codex 0.163.0 with gpt-6.1-sol at low effort, 2026-10-22, every run from an
empty configuration directory set up with `muffle init --agent <agent> --hush --sloth`. "Before" is muffle without
repeat runs, MCP compaction and `muffle compress`; "after" has all three, with the `AGENTS.md` of the rules task
rewritten once by `muffle compress --agent claude` (5,369 bytes to 2,050). Fourteen tasks, three runs each per agent
and setup: the eleven above and three new ones:

- MCP issues: a Python project with three planted bugs, described in issues that an MCP server returns as
  pretty-printed JSON shaped like a code host's API; one requirement is only in an issue comment.
- Rules: a feature in a Python project whose 5.4 KB `AGENTS.md` sets six rules, each checked: docstrings, one error
  type, a naming convention, a changelog entry, no new tests, no new dependencies.
- Rerun session: a Rust crate with 21 clippy warnings in five files and two failing tests, fixed one file at a time
  with clippy and the tests run after each.

| Totals of the per-task averages | Claude Code before | after | Codex before | after |
|---|---:|---:|---:|---:|
| Passed the check | 40/42 | 39/42 | 42/42 | 42/42 |
| Cost | $0.909 | $0.842 (−7%) | | |
| Input tokens, uncached | 172,891 | 159,024 (−8%) | 313,912 | 270,160 (−14%) |
| Input tokens, total | 1,110,113 | 1,008,026 (−9%) | 1,255,523 | 1,233,232 (−2%) |
| Output tokens | 12,440 | 12,142 (−2%) | 8,550 | 8,833 (+3%) |
| Tool output, bytes | 102,022 | 86,836 (−15%) | 264,060 | 239,890 (−9%) |
| Lines added, removed | 100, 109 | 100, 105 | 119, 111 | 112, 111 |

Claude Code's uncached input counts the tokens written to the prompt cache. All failed runs are Claude Code on the
MCP task, where the agent listed the issues but never opened the one whose comment holds a requirement: one of three
runs before passed, none after, the same mistake either way. The six rules of the rules task held in all 24 runs.

| Task | Change |
|---|---|
| Rerun session | Claude Code: cost −11%, cache reads −25%; Codex: tool output −54% |
| Rules, with the rewritten `AGENTS.md` | Claude Code: cost −13%, cache reads −35%; Codex: tool output −36% |
| MCP issues | Claude Code: tool output −41%, cost −34%; Codex through `muffle codex`: cached input −21% |

Codex's hook cannot replace an MCP result except by reporting the call as failed, so the hooks leave Codex's MCP
results alone and its "after" column shows no change there; the last row is three more runs through `muffle codex`,
whose proxy compacts them. Single tasks of a few requests swing by 10% or more from run to run, Codex's split of
uncached and cached input most of all; the totals and the three tasks above are the measurements to read.

Two more settings were measured and left out of muffle. Claude Code at low effort (`--effort low`) passed the same
39 of 42 runs, but cost 3% more than "after" without it. Subagents on the small model
(`CLAUDE_CODE_SUBAGENT_MODEL=haiku`), on a task that asks for two subagents, cost 7% less with all three runs
passing; in 99 runs of the other tasks no subagent was started, and in a month of real sessions subagents took 12%
of input tokens, mostly general-purpose ones doing real work, so the saving is small and the risk to their work is
not measured.
