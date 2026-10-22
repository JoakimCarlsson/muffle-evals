I accidentally ran a stray `cat` that blocked on stdin. I'm cleaning that up, then I'll go back to the parser.

Tool output is being elided; I'll run the tokenizer directly instead.

Fixed in the parser. Now I'll add a test and run the suite.

The `IMPOSSIBLE` error is fixed. Your Example 2.11 and the smaller `1: 2\n\n[3]: 4` case both parse correctly now.

**Cause:** this was a CST parser bug in `src/parse/parser.ts`. A blank or comment line before the flow collection had already created an empty map item. When the `[` arrived, the parser pushed a second empty item. The key then landed on that second item, and the composer saw the first one as stray content.

**Fix:** the parser now adds a new item for a block value only when the previous item already has a separator, a value or an explicit key. It no longer adds one when the previous item is just leftover blank-line or comment tokens.

I checked these inputs by hand, and all parse without errors:
- a blank line before `[3]: 4`
- a comment line before `[3]: 4`
- a mixed explicit and flow-key map
- a `{a: 1}` key
- an anchored `&a [3]` key

I added regression tests for the blank-line and comment-line cases in `tests/doc/parse.ts`.

**Tests:** all 956 tests that ran pass. Two test files, `json-test-suite.ts` and `yaml-test-suite.ts`, didn't run. Their fixture directories (`tests/json-test-suite/test_parsing` and `tests/yaml-test-suite/src`) aren't checked out here, so the full YAML test suite hasn't been run against this change.

Earlier I made a stray `cat` call that wrote to `/tmp`. I deleted that file and removed my scratch directory. Nothing is committed.

The background command from earlier, the one that hung on my stray `cat`, was stopped after hitting its time limit. I'm not restarting it because the fix doesn't need it. It had only printed source lines and tried to run a tokenizer script, and I re-ran that script successfully afterward.

The fix and the tests are unaffected. The only open item is that the YAML and JSON test-suite fixtures aren't checked out here, so those two files didn't run.
