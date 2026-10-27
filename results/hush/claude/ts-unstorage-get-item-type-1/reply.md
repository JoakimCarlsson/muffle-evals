Implementing now: types first, then the read helpers, then `storage.ts`.

Types.

The formatter touched `s3.ts`; revert that and filter errors to the ones I caused.

Only pre-existing errors remain. Adding tests.

Done. `type` now works on `getItem()`, `get()` and `getItems()`, with the types exported and the docs updated. New runtime and type tests pass, and the full vitest run passes. `tsc` and vitest still report 36 type errors, which I believe predate this change. They look like `TS2307` module-resolution errors in `src/_drivers.ts` plus errors in the R2 and `node-fs` drivers. I didn't run lint, and `oxfmt` didn't run clean (it rewrote `src/drivers/s3.ts`, which I reverted).

- **Netlify:** its `getItem` no longer receives `{ type: "arrayBuffer" }`, since `type` is stripped. `getItemRaw` still defaults to `arrayBuffer`.
- **Result order:** `getItems()` now returns results in input order. It used to return them grouped by mount.
- **Other edits:** `prefixStorage` and `tracing.ts` changed to match the new signatures, and `src/storage.ts` gained read helpers. The new tests are in `test/get-item-type.test.ts` and `test/storage.test-d.ts`.
