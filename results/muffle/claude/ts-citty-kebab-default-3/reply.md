Passing `--foo-bar one` now sets both `fooBar` and `"foo-bar"` to `"one"`. With no flag, `fooBar` still gets its default of `"two"`. The full suite passes (64 tests), and that includes a new regression test for your exact case.

**Cause:** in `src/_parser.ts`, the defaults were handed to Node's `util.parseArgs`. Node filled in `fooBar: "two"` while the real value landed on `foo-bar`. The alias-sync step skips any key that is already set, so the default won.

**Fix:** `src/_parser.ts` now applies defaults after parsing and alias syncing. A default is used only if neither the option nor any of its aliases was given. This also fixes the same bug for short aliases such as `-f` on an option that has a default.

The new test is `test/kebab-default.test.ts`. I haven't committed anything.
