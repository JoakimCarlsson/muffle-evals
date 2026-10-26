I want to read a stored value in a specific format with unstorage, without converting it by hand every time. Please add a `type` option to `getItem()` (and its alias `get()`) and to `getItems()`:

```ts
await storage.getItem("user:1", { type: "text" }); // string
await storage.getItem("user:1", { type: "json" }); // JSONValue
await storage.getItem("avatar.png", { type: "bytes" }); // Uint8Array
await storage.getItem("avatar.png", { type: "blob" }); // Blob
await storage.getItem("avatar.png", { type: "stream" }); // ReadableStream<Uint8Array>
```

- A missing key gives `null` for every type, and a driver returning `undefined` now gives `null` even without a `type`.
- `bytes`, `blob` and `stream` read the driver's raw value (`getItemRaw`, falling back to `getItem` for drivers without it, where a `base64:` string is decoded). Values the driver already holds as a `Blob` or `ReadableStream` come back as is for `blob` and `stream`, without buffering. Everything binary-like is accepted and normalized: `Uint8Array`, `Buffer`, `ArrayBuffer`, `DataView`, `Blob`, `ReadableStream`, `Response`, async iterables of chunks, and strings (UTF-8). A number, boolean, plain object or array is read as its text form, the same text `type: "text"` gives (`true` gives the bytes of `"true"`, `{ a: 1 }` gives `{"a":1}`). Anything else (a `Map`, say) rejects with an error matching ``Cannot convert `Map` to bytes`` (the constructor name, or `Object`, in backticks). When draining a stream fails, the reader lock must be released.
- `text` and `json` also decode values written with `setItemRaw()` (a `base64:` string from drivers that only store strings, or a `Uint8Array` that a driver such as memory keeps as is), so you get `"hello wörld"` instead of `"base64:..."`, and raw bytes holding JSON parse for `json`. `json` is lenient like the default read (`destr`): a plain string stays a string. Plain values, including a normal string, come back unchanged. Without `type`, behaviour is as before.
- `getItems()` takes `type` in the common options for the whole call and/or per item (`{ key, options: { type } }`); a per-item `type` overrides the common one. Results keep input order, and `bytes`/`blob`/`stream` items are read one by one (in parallel with the driver's `getItems()` batch when the driver has one). The `type` must still be applied when a driver's `getItems()` returns keys that differ from the ones it was given (match results by position, not by key).
- `type` is now reserved for this: it is not forwarded to the driver as a free-form option any more (a Netlify Blobs `{ type: "arrayBuffer" }` becomes `bytes`).

Types: the return type follows `type`, so `getItem(k, { type: "bytes" })` is `Promise<Uint8Array | null>`, `getItems(keys, { type: "text" })` is `Promise<{ key: string; value: string | null }[]>`, per-item types narrow too, mixed items give the union of what was requested (`JSONValue | Uint8Array | null`), items without a `type` fall back to the common options and then to `StorageValue`. An unknown `type` such as `"buffer"` is a type error, also per item. Export the new types `GetItemType`, `GetItemTypeMap`, `GetItemOptions`, `GetItemsInput`, `JSONValue`, `JSONObject` and `JSONArray` from the package root, and document the option in `docs/1.guide/1.index.md`.

Please add this.
