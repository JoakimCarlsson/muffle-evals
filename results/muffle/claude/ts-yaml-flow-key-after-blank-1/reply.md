Found it: the parser puts the blank line in its own map item and then starts a second item for the flow key. I'm reading `blockMap` in the parser to see why.

Fixed. Your example, `1: 2\n\n[3]: 4`, and the version with a comment line instead of the blank line now parse with no errors.

**Cause:** the bug was in the CST parser, not the composer. When a block map got a flow collection key after a blank or comment line, `blockMap` in `src/parse/parser.ts` always started a new map item for the key. The empty item holding the blank line was left behind. The composer then took that leftover item for trailing map-comment content and raised `IMPOSSIBLE`.

**Fix:** at `src/parse/parser.ts:701`, a new item is now pushed only when the current item already has a separator, an explicit key or a value. Otherwise the key goes into the current item, which is how scalar keys already behave.

**Verification:**
- **Spec example:** I ran Example 2.11 (mapping between sequences) with a blank line before the flow-key line. It parses correctly, as does `{a: 1}` as a key.
- **New test:** I added one in `tests/doc/parse.ts` covering the blank-line and comment-line cases.
- **Test run:** 954 tests pass. The two suites that failed to load, `json-test-suite` and `yaml-test-suite`, need their test-data directories, which aren't in this checkout, so those cases did not run.

Nothing is committed.
