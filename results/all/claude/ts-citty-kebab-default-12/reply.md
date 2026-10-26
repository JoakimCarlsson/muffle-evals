Done. `src/_parser.ts` now applies defaults after alias resolution, so `--foo-bar one` gives `fooBar: "one"` and `"foo-bar": "one"`. I added a test in `test/args.test.ts`, and all 64 tests pass.
