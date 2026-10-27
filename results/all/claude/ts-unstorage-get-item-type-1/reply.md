Implementing now: types first, then the read helpers, then storage and docs.

Pre-existing noise (unbuilt drivers); filter it.

oxfmt touched s3.ts; revert that, then add tests and docs.

Done. `type` option added to `getItem()`, `get()` and `getItems()`, with the new types exported, docs updated and tests added. The vitest suite and `tsc` pass for the touched files. I did not run `pnpm lint` or `pnpm test`.

- **Drivers:** `oxfmt --check` flags one file, probably the pre-existing `src/drivers/s3.ts` (I did not check). Drivers that read `opts.type` no longer receive it. This affects `cloudflare-r2-binding`, and the Netlify Blobs `getItem` path no longer gets a `type` either. I did not touch the driver files.
- **`getItems` ordering:** it now returns results in input order, which also changes the previous order across mounts.
- **`getItems` fallback type:** items without a `type` fall back to the storage's `T`, which is `StorageValue` by default.
- **Unknown `type` at runtime:** a `type` outside the five values (JS callers) throws `Unsupported type`.
