Fixed. `--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`, and with no flag, `fooBar` still gets the default `"two"`.

**Cause:** `parseRawArgs` in `src/_parser.ts` passed defaults to `node:util` `parseArgs`. That filled in the default for `fooBar`, and the later step that copies values between aliases skips a key that already has a value. So the passed `foo-bar` value never overwrote the default.

**Fix:** Defaults are no longer passed to `node:util`. They're applied after alias propagation, and only to keys that are still undefined. After that, the alias copy runs once more so every variant of the name gets the default.

**Tests:** The existing 63 tests pass. I also ran a throwaway test for your exact case: explicit `--foo-bar one`, and no flag giving the default. It passed, and I deleted it afterwards. I didn't add a permanent regression test. I can add one to `test/` if you want it.

I haven't committed anything.
