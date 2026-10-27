I've finished reading the code. Next I'm writing the conversion helpers in `_utils.ts`, then the storage, types, docs and tests.

Those errors come from the unbuilt package. I'll filter them out.

Quick status: the tests pass. `oxfmt` also touched `s3.ts`, which I didn't mean to change, so I'm reverting that file and checking the 36 errors against the baseline.

`getItem()`, its alias `get()` and `getItems()` now take a `type` option (`text`, `json`, `bytes`, `blob`, `stream`). I ran all the tests, including the type tests, and the 10 new ones pass. The run reports 36 unhandled errors, and the same 36 appear with my changes stashed. `tsc` shows no new errors either; the two it reports (`cloudflare-r2-binding.ts`, `node-fs.ts`) were already there.

**What each part does**
- **Missing keys:** a missing key or a driver returning `undefined` gives `null`, with or without `type`.
- **Binary types:** `bytes`, `blob` and `stream` read `getItemRaw`, falling back to `getItem` plus `base64:` decoding. A `Blob` or `ReadableStream` the driver already holds comes back as is for `blob` and `stream`.
- **Accepted values:** `Uint8Array`, `Buffer`, `ArrayBuffer`, `DataView`, `Blob`, `ReadableStream`, `Response`, async iterables and strings are accepted. Numbers, booleans, plain objects and arrays are read as their text form.
- **Errors:** anything else rejects with ``Cannot convert `Map` to bytes`` (with the real constructor name). A failed stream drain releases the reader lock.
- **Text and JSON:** `text` and `json` decode `setItemRaw()` values, and `json` leaves a plain string as a string.
- **`getItems()`:**
  - `type` works in the common options and per item, and the per-item one wins.
  - Results keep input order, which they didn't before for items on different mounts.
  - Binary items are read one by one alongside the driver's batch.
  - `type` is applied by position when a driver's `getItems()` returns different keys.
- **Reserved option:** `type` is no longer forwarded to the driver.
- **Types:** the return types follow `type` as in your examples. `"buffer"` is a type error, also per item. The new types are exported from the package root.
- **Docs:** `docs/1.guide/1.index.md` documents the option.

I did not change `getItemRaw()`. The Netlify Blobs driver still reads `type` there, so `{ type: "arrayBuffer" }` keeps working on `getItemRaw()` but is no longer passed through `getItem()`.

I didn't run the driver-specific tests, since they need external services. The runtime code is in `src/_utils.ts` and `src/storage.ts`, and the types are in `src/types.ts`. Nothing is committed.
