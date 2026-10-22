Need to see how parser handles defaults with aliases.

Done. `src/_parser.ts` now applies defaults only after alias propagation, so `--foo-bar one` gives `fooBar` and `"foo-bar"` both `"one"`. Existing 63 tests pass. A throwaway check of your case passed and I deleted it. I added no permanent test.
