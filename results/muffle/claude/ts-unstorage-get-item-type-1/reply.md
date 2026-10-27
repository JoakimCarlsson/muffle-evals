Reading is done. I'm now writing the conversion module, then the storage, types and docs changes.

Status: the code and tests pass. I need to undo an unrelated `s3.ts` reformat, fix a test edit that failed, and write the docs.

`getItem()`, `get()` and `getItems()` now take a `type` option (`text`, `json`, `bytes`, `blob`, `stream`) with the behaviour you described. The full vitest run passes, including the new tests. In that run `tsc` still reports errors in files I didn't change (`_drivers.ts`, `node-fs.ts`, `cloudflare-r2-binding.ts` and the `unstorage` self-imports). The same files had errors before my changes. The only remaining `oxfmt --check` issue is `src/drivers/s3.ts`, which I didn't touch.

- **Conversions** are in the new `src/_convert.ts`, and `src/storage.ts` uses them.
- **Results order:** `getItems()` now returns results in input order. Before, results from different mounts came back grouped by mount, so this also changes untyped calls.
- **Netlify:** `type` is no longer forwarded to drivers, so a Netlify Blobs `{ type: "arrayBuffer" }` has to become `bytes`. I left the Netlify driver code unchanged, and the public `getItemRaw()` still passes its options through untouched.
- **Types:** the new types are exported from the package root. Overloads on `getItem` and `getItems` narrow the return type, and an unknown `type` such as `"buffer"` is a type error, including per item.
- **Docs:** the option is documented in `docs/1.guide/1.index.md`.
- **Tests:** `test/get-item-type.test.ts` covers the runtime behaviour and `test/storage.test-d.ts` the types.

Extra choices where your spec was silent:
- An unknown `type` at runtime throws `[unstorage] Unknown \`type\` option`.
- With `type: "text"`, a plain string that starts with `base64:` is decoded, since I can't tell it from raw bytes.
- A `getItems()` entry with an explicit `options: { type: undefined }` does not fall back to the common `type`.
- Untyped `getItems()` results are typed as the storage's `T`, not always `StorageValue`, so `createStorage<string>()` keeps its old typing.

Nothing is committed.
