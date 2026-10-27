Core conversion helpers are written; now wiring them into `storage.ts`.

Writing runtime tests now.

Formatter touched s3.ts unintentionally; revert it, then docs.

`getItem()`, `get()` and `getItems()` now take a `type` option (`text`, `json`, `bytes`, `blob`, `stream`) and return the type you asked for, as specified.

The full test suite passes. `tsc` reports no errors in the touched files. It does report 37 errors, but they are the same 37 as before my change, from missing modules and driver types. `oxfmt --check` flags `src/drivers/s3.ts`, which I didn't modify. I haven't run the whole lint command, only `oxlint`.

- **Read paths:** the conversion helpers are in `src/_utils.ts`, and `getItem` and `getItems` in `src/storage.ts` use them.
- **Types:** the new types are in `src/types.ts` and are exported from the package root, since `index.ts` already re-exports that file. I added overloads for `getItem` and `getItems`. Unknown types such as `"buffer"` are type errors, including per item.
- **`prefixStorage`:** `getItems` now goes through a cast so the new overloads type-check.
- **Netlify Blobs:** `getItemRaw` now always reads as `arrayBuffer`, because `type` is no longer forwarded to the driver.
- **Docs:** the option is documented in `docs/1.guide/1.index.md`.
- **Tests:** runtime tests are in the new `test/get-item-type.test.ts`, and type tests are added to `test/storage.test-d.ts`.

Choices beyond the spec:
- An unknown `type` at runtime rejects with an error naming the allowed values.
- If a driver's `getItems()` returns a different number of entries than requested, I match by key instead of position and fill missing ones with `null`.
- `getItems()` without any `type` now returns results in input order, where before they came back grouped by mount.

I did not commit anything.
