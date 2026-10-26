`--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. With no flag passed, `fooBar` still falls back to `"two"`.

**Cause:** `parseRawArgs` in `src/_parser.ts` gave every default to Node's `parseArgs`. That put `fooBar: "two"` in the results before the kebab alias `foo-bar` could copy its value across, so the default won.

**Fix:** I stopped passing defaults to Node's `parseArgs`. They are now applied after alias resolution, and only to names that are still undefined. Values are then copied between aliases once more, so the default reaches the other spellings.

I checked this with a temporary test covering the kebab-case flag, the default, and the `"foo-bar"` key, then deleted it. The existing suite also passes (64 tests). I didn't add a permanent regression test, so say if you want one.
