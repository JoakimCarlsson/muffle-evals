Cause: blank line leaves empty `{start:[newline]}` item. Flow-collection key then pushes a second item. Fixing in the parser.

Done. `src/parse/parser.ts` `blockMap`: the fallback branch now pushes a new item on `atNextItem`, not `atMapIndent`, so a flow-collection key reuses the blank-line item. I checked your example, `1: 2\n\n[3]: 4`, a comment-line variant and a `{a: b}` key, and all parse correctly. 954 tests pass. The two suite files fail to load because the `tests/json-test-suite` and `tests/yaml-test-suite` directories are missing. I added no regression test.
