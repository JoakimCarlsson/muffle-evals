# Codex observations: five muffle evals

Ran five fresh tasks sequentially with the existing `muffle` setup (`muffle init --agent codex`), `gpt-6.1-sol`, low reasoning effort, and the installed release binary (`muffle 0.1.0`). These are run 16; earlier results were preserved. No muffle source changes were made.

All five agents exited successfully and all five hidden-test commands passed. This is a small diagnostic sample, not a SWE-bench measurement or evidence that any proposed change improves accuracy. No fresh baseline comparison was run.

## Results

- [go-decimal-numdigits](muffle/codex/go-decimal-numdigits-16/score.json): passed; 63 seconds; 26,051 uncached input tokens; 79,360 cached input tokens; 1,254 output tokens; 12,258 tool-output bytes.
- [python-feat-packaging-requirement-replace](muffle/codex/python-feat-packaging-requirement-replace-16/score.json): passed; 141 seconds; 33,852 uncached input tokens; 176,000 cached input tokens; 3,771 output tokens; 38,469 tool-output bytes.
- [python-tomlkit-aot-dotted-key](muffle/codex/python-tomlkit-aot-dotted-key-16/score.json): passed; 45 seconds; 26,434 uncached input tokens; 69,504 cached input tokens; 1,124 output tokens; 17,096 tool-output bytes.
- [rust-chrono-iter-days-rev](muffle/codex/rust-chrono-iter-days-rev-16/score.json): passed; 122 seconds; 23,018 uncached input tokens; 214,912 cached input tokens; 3,569 output tokens; 19,310 tool-output bytes.
- [ts-citty-kebab-default](muffle/codex/ts-citty-kebab-default-16/score.json): passed; 62 seconds; 34,644 uncached input tokens; 65,536 cached input tokens; 1,769 output tokens; 18,485 tool-output bytes.

Total agent time was 433 seconds, excluding harness lint and hidden-test scoring. Usage was 143,999 uncached input tokens, 605,312 cached input tokens, and 11,487 output tokens. The 40 completed shell calls returned 105,618 bytes. Input usage is cumulative across requests, not unique context size. Cached input and uncached input should be reported separately.

## Changes to try, in priority order

1. Improve retrieval before increasing compression. Packaging returned 30,498 bytes in one call by reading the requirement class, documentation, 180 test lines, specifier matches, and the whole project configuration together. That call alone contributed about 29% of all tool bytes in these five runs. Give the agent a concise search-and-read workflow: locate the symbol, read its body and direct callers, inspect the relevant tests, and expand only when needed. Start with exact symbol lookup and the existing skeleton machinery; evaluate embeddings later if exact lookup misses relevant code. Preserve an explicit way to read complete files. Do not silently truncate source contents.

2. Give the agent correct validation commands early. Citty first tried `pnpm test`, but `pnpm` was absent; its prepared dependencies included runnable local binaries. Tomlkit tried the whole suite, hit a missing `tests/toml-test/tests/files-toml-1.1.0` fixture, then reran while excluding that suite. Chrono ran all doctests and encountered three failures involving deprecated `std::i32::MAX`, then narrowed to the iterator doctests. In the evaluation harness, supply installed tools, the intended public validation command, and known preparation limitations without exposing hidden tests. For muffle itself, any project command hints must come from public project configuration, not benchmark metadata.

3. Reduce redundant validation with visible, trustworthy state. Packaging ran the full visible test suite twice, each time reporting 7,417 passing tests, around lint/type-check repairs. Citty ran all tests, then ran them again with coverage plus type, lint, and format checks. Record which checks passed against which file contents and show when edits invalidate them. Encourage a focused failing-case check during editing and one relevant final suite. Do not skip checks merely because their previous output was unchanged: the current rerun feature compresses repeated output, but does not avoid executing the command. Never suppress a requested check or reuse a stale pass result.

4. Investigate the existing Vitest filter against this output format. Citty still returned verbose test headers, timestamps, durations, and a coverage table. The registry already recognizes Vitest, including executable paths; this is not a request for another registry entry. Replay this exact output through the current parser and inspect why summaries remain verbose. Compact routine success metadata; retain failed assertions, type errors, coverage threshold failures, and meaningful coverage details, with the raw-output link for any lossy result. This should reduce output bytes; its effect on total tokens needs measurement.

5. Prevent avoidable edit-and-repair loops. Go formatting changed unrelated test alignment, followed by another diff read and a restoration command. Chrono used a string replacement that did not update a helper signature, then spent a failed compile and another read fixing the mismatch. Packaging repaired a test-message capitalization mismatch, then lint issues, then type-check issues. A concise agent instruction to make anchored edits, inspect the changed region, and use project formatting and type conventions may reduce these loops. Muffle must not reinterpret or rewrite mutation commands to enforce this.

## Accuracy and measurement limits

Passing hidden tests did not imply a minimal patch. Citty changed 17 non-test lines and removed 8, while its reference added 3 lines. Packaging added 85 non-test lines versus 54 in the reference. These comparisons warrant review; a larger patch is not itself proof of a bug.

The harness reported positive `lint_new` counts for packaging, tomlkit, and chrono. Treat these as output-line deltas, not verified new-warning counts: the Python lint logs include package-download messages, and packaging warnings name unchanged files. Chrono did have an explicit identity-operation warning in changed code. Stabilize lint versions and compare structured diagnostic identities against the baseline before using this metric as a quality gate.

Semicolon-separated shell batches can finish with status zero even when an earlier check failed. This happened with packaging lint followed by formatting and with chrono doctests followed by diff commands. Failure text was preserved and the agent recovered. Keep that diagnostic text; do not treat the final shell status as proof that every check passed.

Test each proposed change against the current setup on identical tasks and model settings, with repeated runs. Record hidden-test pass rate, uncached and cached tokens, output tokens, wall time, shell calls, validation retries, and diagnostic accuracy. Use additional unseen tasks and actual SWE-bench tasks before claiming higher SWE-bench scores. This five-task run demonstrates useful recovery with compressed failures; it does not justify more aggressive removal of error context.

## Evidence

Each linked run directory contains `score.json`, `diff.patch`, `reply.md`, `test.log`, and saved changed files. Full agent events remain in `~/.cache/muffle-evals/runs/muffle/codex/<task>-16/out.jsonl`; lint logs remain beside them. No global result report was regenerated, so unrelated existing results were left alone.

