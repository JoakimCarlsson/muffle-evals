Done. `src/analyze.ts` now skips generic call and `new` arguments like `<A, B>(...)`, and `EXPORT_DECAL_RE` captures the rest of the line. All 194 tests pass, including 5 new ones in `test/exports.test.ts` covering each case you listed.

One risk: a comparison like `a<b, c>(d)` would be read as a generic call.
