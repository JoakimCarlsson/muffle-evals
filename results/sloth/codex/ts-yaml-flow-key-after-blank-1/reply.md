I’ll trace how blank lines and comments affect flow collection keys, fix the shared parser path, then build and run the existing tests.

The parser creates an extra map item when a flow collection follows a blank or comment line, leaving the preceding item looking like a trailing comment. The fix belongs in the shared block-map parser, used by both public parsing and CST parsing. No exports, configuration, or fixtures need changes; I’ll use the existing suites and direct checks for both flow sequences and flow maps.

Fixed in [src/parse/parser.ts:701](/home/jdaddy/.cache/muffle-evals/runs/sloth/codex/ts-yaml-flow-key-after-blank-1/work/src/parse/parser.ts:701). Flow collection keys now reuse the pending map item after blank lines or comments, preventing the `IMPOSSIBLE` error.

Validated your example and 48 related cases, including nested maps and lossless CST round trips. Build, type checks, and 954 existing tests passed. Two fixture-based suites could not run because their fixture directories are missing.
