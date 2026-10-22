Need to see the parser's alias/default handling.

Done. `src/_parser.ts` now applies defaults after alias resolution, so `--foo-bar one` gives `fooBar: "one"` and `"foo-bar": "one"`. I added `test/_kebab.test.ts`; the full suite passes (64 tests).
