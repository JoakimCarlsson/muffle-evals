Let me look at the block-map handler where a flow collection starts a key.

My test expectation was wrong (the key stringifies); the parse itself works. Checking the other failures and cleaning up.

Fixed. `1: 2\n\n[3]: 4` and the Example 2.11 document now parse without an `IMPOSSIBLE` error. Parsing `1: 2\n# c\n[3]: 4` also no longer throws.

**Cause:** in `src/parse/parser.ts`, `blockMap()` pushed a new empty map item whenever a flow collection started at the map's indent. After a blank line or comment, the previous item already held those leading tokens as an empty placeholder. The new item took the key, which left an orphan item behind. The composer then reported that orphan as a map comment with trailing content.

**Fix:** a flow collection that starts a key now reuses that placeholder item when it has no `sep` and isn't an explicit key. The change is a small extra condition on the `atMapIndent` push.

**Tests:**
- The existing suite passes: 954 tests.
- `tests/json-test-suite.ts` and `tests/yaml-test-suite.ts` can't run, because their test-suite directories are missing. They fail the same way without my change.
- I checked your cases with a throwaway test and then deleted it. I added no permanent regression test, since you didn't ask for one. The `[3]` key stringifies as `"[ 3 ]"` in a plain JS object, as before.
