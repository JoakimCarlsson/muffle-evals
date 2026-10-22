`--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. With no flag passed, `fooBar` is still `"two"`. The full test suite and `tsc` both pass.

**Cause:** `src/_parser.ts` handed the defaults to `node:util`'s `parseArgs`. `fooBar` was therefore already set to `"two"` before alias propagation ran. The propagation step only fills an alias that is still `undefined`, so it never copied `"foo-bar": "one"` over it.

**Fix:** The defaults are now applied after parsing and alias propagation, and only to names that are still unset. Propagation then runs once more so every alias form carries the default. A value passed under any spelling (camelCase, kebab-case or an alias) now wins over the default.

I added a regression test in `test/kebab-default.test.ts`. It covers the kebab-case override and the default when nothing is passed.

I didn't commit anything.
