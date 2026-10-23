Exporting new `MultiCookies` type; then rechecking types and tests.

Done. `parse()` now takes `allowMultiple`; repeated names become arrays in order, single names stay strings, and the default is still first value wins. I added `MultiCookies` as the return type for `allowMultiple: true` (via an overload) and exported it.

The 100 tests pass, including new ones for your two examples, `%1` decoding and the default. `tsc` reports 5 errors, all in `test/split-cookies-string.test.ts` and identical with my changes stashed. It also needs `--ignoreDeprecations 6.0` to run at all.

One edge case: a duplicate whose custom `decode` returns `undefined` is skipped rather than added to the array.

I didn't touch the README, since it doesn't document `parse` options.
