Tracing how the parser builds the CST for a flow-collection key after a blank line.

Root `/` was a bad idea. I'll run it from the project instead.

The fix works on my samples. I'm now checking whether the 2 failing test files were already failing before my change.

The two failing files fail without my change too. They need the `json-test-suite` and `yaml-test-suite` submodules, which aren't checked out here. Now I'll add a regression test.

This failure is in my test. `contents` is `undefined` in this version, so I'll assert on the parsed value instead.

Your YAML example and the smaller `1: 2\n\n[3]: 4` case now parse without the `IMPOSSIBLE` error. The `tests/doc` tests and the type checks pass.

**Cause:** in `blockMap()` in `src/parse/parser.ts`, a flow collection used as a key at the map's indent always started a new item. A blank line or comment line before it had already created an item holding just that whitespace, so the empty item was left behind and `resolveBlockMap` reported it as a stray comment.

**Fix:** the parser now starts a new item only when the previous one is finished, meaning it has a separator or a value. This is the same rule the scalar-key case already uses. Otherwise the flow collection joins the whitespace-only item.

**Tests:** I added a regression test in `tests/doc/parse.ts`. It covers a blank line before `[3]: 4`, a comment line before it, and a `{a: b}` key. Your Example 2.11 file also parses correctly with the fix.

The full `vitest run` has two failing files, `tests/json-test-suite.ts` and `tests/yaml-test-suite.ts`. They fail the same way without my change, because the test-suite submodules aren't checked out here. The other 954 tests pass.

I haven't committed anything.
