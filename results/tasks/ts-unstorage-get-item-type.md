# ts-unstorage-get-item-type

Source: https://github.com/unjs/unstorage/pull/610

## Prompt

> I want to read a stored value in a specific format with unstorage, without converting it by hand every time. Please add a `type` option to `getItem()` (and its alias `get()`) and to `getItems()`:
> 
> ```ts
> await storage.getItem("user:1", { type: "text" }); // string
> await storage.getItem("user:1", { type: "json" }); // JSONValue
> await storage.getItem("avatar.png", { type: "bytes" }); // Uint8Array
> await storage.getItem("avatar.png", { type: "blob" }); // Blob
> await storage.getItem("avatar.png", { type: "stream" }); // ReadableStream<Uint8Array>
> ```
> 
> - A missing key gives `null` for every type, and a driver returning `undefined` now gives `null` even without a `type`.
> - `bytes`, `blob` and `stream` read the driver's raw value (`getItemRaw`, falling back to `getItem` for drivers without it, where a `base64:` string is decoded). Values the driver already holds as a `Blob` or `ReadableStream` come back as is for `blob` and `stream`, without buffering. Everything binary-like is accepted and normalized: `Uint8Array`, `Buffer`, `ArrayBuffer`, `DataView`, `Blob`, `ReadableStream`, `Response`, async iterables of chunks, and strings (UTF-8). A number, boolean, plain object or array is read as its text form, the same text `type: "text"` gives (`true` gives the bytes of `"true"`, `{ a: 1 }` gives `{"a":1}`). Anything else (a `Map`, say) rejects with an error matching ``Cannot convert `Map` to bytes`` (the constructor name, or `Object`, in backticks). When draining a stream fails, the reader lock must be released.
> - `text` and `json` also decode values written with `setItemRaw()` (a `base64:` string from drivers that only store strings, or a `Uint8Array` that a driver such as memory keeps as is), so you get `"hello wörld"` instead of `"base64:..."`, and raw bytes holding JSON parse for `json`. `json` is lenient like the default read (`destr`): a plain string stays a string. Plain values, including a normal string, come back unchanged. Without `type`, behaviour is as before.
> - `getItems()` takes `type` in the common options for the whole call and/or per item (`{ key, options: { type } }`); a per-item `type` overrides the common one. Results keep input order, and `bytes`/`blob`/`stream` items are read one by one (in parallel with the driver's `getItems()` batch when the driver has one). The `type` must still be applied when a driver's `getItems()` returns keys that differ from the ones it was given (match results by position, not by key).
> - `type` is now reserved for this: it is not forwarded to the driver as a free-form option any more (a Netlify Blobs `{ type: "arrayBuffer" }` becomes `bytes`).
> 
> Types: the return type follows `type`, so `getItem(k, { type: "bytes" })` is `Promise<Uint8Array | null>`, `getItems(keys, { type: "text" })` is `Promise<{ key: string; value: string | null }[]>`, per-item types narrow too, mixed items give the union of what was requested (`JSONValue | Uint8Array | null`), items without a `type` fall back to the common options and then to `StorageValue`. An unknown `type` such as `"buffer"` is a type error, also per item. Export the new types `GetItemType`, `GetItemTypeMap`, `GetItemOptions`, `GetItemsInput`, `JSONValue`, `JSONObject` and `JSONArray` from the package root, and document the option in `docs/1.guide/1.index.md`.
> 
> Please add this.

## Upstream change (tests left out)

Files: 

```diff
diff --git a/docs/1.guide/1.index.md b/docs/1.guide/1.index.md
index 5b54950..c7d4b38 100644
--- a/docs/1.guide/1.index.md
+++ b/docs/1.guide/1.index.md
@@ -66,6 +66,29 @@ Returns the deserialized value, or `null` when the key does not exist.
 const value = await storage.getItem("user:1");
 ```
 
+Use the `type` option to get the value in a specific format. Values read as `bytes`, `blob` or
+`stream` use the driver's raw value (see [raw values](#raw-values)) and are normalized
+to the requested format.
+
+```ts
+const text = await storage.getItem("user:1", { type: "text" }); // string
+const json = await storage.getItem("user:1", { type: "json" }); // JSON value
+const bytes = await storage.getItem("avatar.png", { type: "bytes" }); // Uint8Array
+const blob = await storage.getItem("avatar.png", { type: "blob" }); // Blob
+const stream = await storage.getItem("avatar.png", { type: "stream" }); // ReadableStream
+```
+
+Any `type` also decodes [raw values](#raw-values) before converting them, so `text` and `json`
+never surface the `base64:` wrapper (or the byte array) that drivers store them under. Without a
+`type`, raw values are returned exactly as the driver holds them.
+
+```ts
+await storage.setItemRaw("greeting", new TextEncoder().encode("hello"));
+
+await storage.getItem("greeting", { type: "text" }); // "hello"
+await storage.getItem("greeting", { type: "bytes" }); // Uint8Array
+```
+
 Alias: `storage.get()`.
 
 #### `getItems(items, commonOptions?)`
@@ -84,6 +107,22 @@ const items = await storage.getItems([
 // [{ key: "user:1", value: ... }, { key: "user:2", value: ... }]
 ```
 
+The `type` option works the same as in [`getItem`](#getitemkey-options), either for the whole
+batch or per item. Keys read as `bytes`, `blob` or `stream` are resolved individually, since
+drivers have no batch equivalent for raw values.
+
+```ts
+const avatars = await storage.getItems(["avatar:1", "avatar:2"], { type: "bytes" });
+
+const mixed = await storage.getItems([
+  { key: "user:1", options: { type: "json" } },
+  { key: "avatar:1", options: { type: "bytes" } },
+]); // { key: string; value: JSONValue | Uint8Array | null }[]
+```
+
+Entries are returned in the order of the input keys, except that keys resolved from
+different [mountpoints](#mounting-multiple-drivers) are grouped together.
+
 ### Writing values
 
 #### `setItem(key, value, options?)`
@@ -134,7 +173,16 @@ await storage.setItemRaw("images:logo.png", new Uint8Array([1, 2, 3]));
 const bytes = await storage.getItemRaw<Uint8Array>("images:logo.png");
 ```
 
-When a driver does not implement raw operations, unstorage uses a serialized fallback.
+When a driver does not implement raw operations, unstorage uses a serialized fallback: the value is
+stored as a string prefixed with `base64:`.
+
+::warning
+That prefix is stored in-band, so a regular string value that happens to start with `base64:` is
+indistinguishable from a raw value. Such a value is returned untouched by `getItem(key)`, but
+`getItemRaw(key)` and `getItem(key, { type })` will try to decode it, yielding a corrupted result
+(or throwing where `atob` is used, such as in browsers and workers). Avoid storing strings with
+that prefix, or read them without a `type`.
+::
 
 ## Listing and clearing keys
 
diff --git a/src/_utils.ts b/src/_utils.ts
index e19ef0a..03501f0 100644
--- a/src/_utils.ts
+++ b/src/_utils.ts
@@ -30,6 +30,11 @@ function isPureObject(value: any) {
   return !proto || proto.isPrototypeOf(Object);
 }
 
+/** Whether `value` is a primitive, a plain object or an array. */
+function isPlainValue(value: any): boolean {
+  return isPrimitive(value) || isPureObject(value) || Array.isArray(value);
+}
+
 export function stringify(value: any): string {
   if (isPrimitive(value)) {
     return String(value);
@@ -80,3 +85,125 @@ function base64Encode(input: Uint8Array) {
   }
   return globalThis.btoa(String.fromCodePoint(...input));
 }
+
+/**
+ * Normalizes the possible raw values that drivers might emit to an `Uint8Array`.
+ *
+ * Supported inputs: `Uint8Array` (and `Buffer`), `ArrayBuffer`, `ArrayBufferView`,
+ * `string`, `Blob` (and any `.arrayBuffer()` like `Response`), `ReadableStream`
+ * and async iterables (Node.js streams). Other plain values (numbers, booleans,
+ * objects and arrays) are encoded as their `stringify()` text.
+ */
+export async function toBytes(value: any): Promise<Uint8Array> {
+  if (typeof value === "string") {
+    return new TextEncoder().encode(value);
+  }
+  if (ArrayBuffer.isView(value)) {
+    // Normalize Buffer, DataView and other typed arrays to a plain Uint8Array view (no copy)
+    return value.constructor === Uint8Array
+      ? (value as Uint8Array)
+      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+  }
+  if (value instanceof ArrayBuffer) {
+    return new Uint8Array(value);
+  }
+  if (typeof value?.arrayBuffer === "function") {
+    // Blob and Response like
+    return new Uint8Array(await value.arrayBuffer());
+  }
+  if (
+    typeof value?.getReader === "function" ||
+    typeof value?.[Symbol.asyncIterator] === "function"
+  ) {
+    return concatBytes(await readChunks(value));
+  }
+  if (isPlainValue(value)) {
+    // Drivers keeping values as-is are read as their text, same as `getItem(key, { type: "text" })`
+    return new TextEncoder().encode(stringify(value));
+  }
+  throw new TypeError(`[unstorage] Cannot convert \`${typeName(value)}\` to bytes.`);
+}
+
+/**
+ * Normalizes the possible raw values that drivers might emit to a `Blob`.
+ *
+ * @see {@link toBytes} for the supported inputs.
+ */
+export async function toBlob(value: any): Promise<Blob> {
+  if (value instanceof Blob) {
+    return value;
+  }
+  return new Blob([(await toBytes(value)) as BlobPart]);
+}
+
+/**
+ * Normalizes the possible raw values that drivers might emit to a `ReadableStream`.
+ *
+ * Streams and blobs are passed through without buffering their contents.
+ *
+ * @see {@link toBytes} for the supported inputs.
+ */
+export async function toStream(value: any): Promise<ReadableStream<Uint8Array>> {
+  if (value instanceof ReadableStream) {
+    return value;
+  }
+  if (value instanceof Blob) {
+    return value.stream();
+  }
+  const bytes = await toBytes(value);
+  return new ReadableStream<Uint8Array>({
+    start(controller) {
+      controller.enqueue(bytes);
+      controller.close();
+    },
+  });
+}
+
+async function readChunks(value: any): Promise<Uint8Array[]> {
+  const chunks: Uint8Array[] = [];
+  if (typeof value.getReader === "function") {
+    const reader = value.getReader();
+    try {
+      while (true) {
+        const { done, value: chunk } = await reader.read();
+        if (done) {
+          break;
+        }
+        chunks.push(await chunkToBytes(chunk));
+      }
+    } finally {
+      // Leave the stream unlocked if reading throws mid-way
+      reader.releaseLock();
+    }
+  } else {
+    for await (const chunk of value) {
+      chunks.push(await chunkToBytes(chunk));
+    }
+  }
+  return chunks;
+}
+
+/** Stream chunks must be binary or text, other values are not encoded as their text. */
+function chunkToBytes(chunk: any): Promise<Uint8Array> {
+  if (typeof chunk !== "string" && isPlainValue(chunk)) {
+    throw new TypeError(`[unstorage] Cannot convert \`${typeName(chunk)}\` to bytes.`);
+  }
+  return toBytes(chunk);
+}
+
+function concatBytes(chunks: Uint8Array[]): Uint8Array {
+  if (chunks.length === 1) {
+    return chunks[0]!;
+  }
+  const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
+  let offset = 0;
+  for (const chunk of chunks) {
+    bytes.set(chunk, offset);
+    offset += chunk.length;
+  }
+  return bytes;
+}
+
+function typeName(value: any): string {
+  return value?.constructor?.name || typeof value;
+}
diff --git a/src/storage.ts b/src/storage.ts
index 0c25ad8..3a1965e 100644
--- a/src/storage.ts
+++ b/src/storage.ts
@@ -2,6 +2,8 @@ import { destr } from "destr";
 import type {
   Storage,
   Driver,
+  GetItemOptions,
+  GetItemType,
   WatchCallback,
   Unwatch,
   StorageValue,
@@ -9,7 +11,16 @@ import type {
   TransactionOptions,
 } from "./types.ts";
 import memory from "./drivers/memory.ts";
-import { asyncCall, deserializeRaw, serializeRaw, stringify } from "./_utils.ts";
+import {
+  asyncCall,
+  BASE64_PREFIX,
+  deserializeRaw,
+  serializeRaw,
+  stringify,
+  toBlob,
+  toBytes,
+  toStream,
+} from "./_utils.ts";
 import {
   normalizeKey,
   normalizeBaseKey,
@@ -30,6 +41,84 @@ export interface CreateStorageOptions {
   driver?: Driver;
 }
 
+/** Types that are read from the driver's raw value instead of its serialized one. */
+type RawItemType = Extract<GetItemType, "bytes" | "blob" | "stream">;
+
+function isRawType(type: unknown): type is RawItemType {
+  return type === "bytes" || type === "blob" || type === "stream";
+}
+
+/**
+ * Values written with `setItemRaw`, which `text` and `json` decode back to text.
+ *
+ * Most drivers store them base64 encoded, drivers that can hold binary keep it as-is.
+ *
+ * The `base64:` prefix is stored in-band, so a regular string starting with it is
+ * indistinguishable from a raw value. See the "Raw values" section of the guide.
+ */
+function isRawValue(value: StorageValue): boolean {
+  return typeof value === "string"
+    ? value.startsWith(BASE64_PREFIX)
+    : ArrayBuffer.isView(value) ||
+        value instanceof ArrayBuffer ||
+        value instanceof Blob ||
+        value instanceof ReadableStream;
+}
+
+/** Converts a driver value to the requested `text`/`json` type. */
+async function toValueType(
+  value: StorageValue,
+  type: GetItemType | undefined,
+): Promise<StorageValue> {
+  if (value === null || value === undefined) {
+    return null;
+  }
+
+  // An explicit type never surfaces the `base64:` wrapper or a byte array. The default
+  // (no type) keeps returning raw values as-is for backwards compatibility.
+  if (type !== undefined && isRawValue(value)) {
+    value = new TextDecoder().decode(await toBytes(deserializeRaw(value)));
+  }
+
+  if (type === "text") {
+    return typeof value === "string" ? value : stringify(value);
+  }
+  // `json` is intentionally lenient (same as the default): values are stored with
+  // `stringify()` which keeps strings bare, so `JSON.parse` would throw on them.
+  return destr(value) as StorageValue;
+}
+
+/** Reads a single key from a driver and converts it to the `type` given in `opts`. */
+async function getTypedItem(
+  driver: Driver,
+  relativeKey: string,
+  opts: GetItemOptions = {},
+): Promise<StorageValue> {
+  const type = opts.type;
+
+  if (isRawType(type)) {
+    const raw = driver.getItemRaw
+      ? await asyncCall(driver.getItemRaw, relativeKey, opts)
+      : deserializeRaw(await asyncCall(driver.getItem, relativeKey, opts));
+    if (raw === null || raw === undefined) {
+      return null;
+    }
+    switch (type) {
+      case "bytes": {
+        return await toBytes(raw);
+      }
+      case "blob": {
+        return await toBlob(raw);
+      }
+      case "stream": {
+        return await toStream(raw);
+      }
+    }
+  }
+
+  return toValueType(await asyncCall(driver.getItem, relativeKey, opts), type);
+}
+
 export function createStorage<T extends StorageValue>(
   options: CreateStorageOptions = {},
 ): Storage<T> {
@@ -157,42 +246,82 @@ export function createStorage<T extends StorageValue>(
       const { relativeKey, driver } = getMount(key);
       return asyncCall(driver.hasItem, relativeKey, opts);
     },
-    getItem(key: string, opts = {}) {
+    getItem: (key: string, opts: TransactionOptions = {}) => {
       key = normalizeKey(key);
       const { relativeKey, driver } = getMount(key);
-      return asyncCall(driver.getItem, relativeKey, opts).then(
-        (value) => destr(value) as StorageValue,
-      );
+      return getTypedItem(driver, relativeKey, opts);
     },
     getItems(
-      items: (string | { key: string; options?: TransactionOptions })[],
-      commonOptions = {},
+      items: (string | { key: string; options?: GetItemOptions })[],
+      commonOptions: GetItemOptions = {},
     ) {
-      return runBatch(items, commonOptions, (batch) => {
-        if (batch.driver.getItems) {
-          return asyncCall(
-            batch.driver.getItems,
-            batch.items.map((item) => ({
-              key: item.relativeKey,
-              options: item.options,
-            })),
-            commonOptions,
-          ).then((r) =>
-            r.map((item) => ({
-              key: joinKeys(batch.base, item.key),
-              value: destr(item.value),
+      return runBatch(items, commonOptions, async (batch) => {
+        if (!batch.driver.getItems) {
+          return Promise.all(
+            batch.items.map(async (item) => ({
+              key: item.key,
+              value: await getTypedItem(batch.driver, item.relativeKey, item.options),
             })),
           );
         }
-        return Promise.all(
-          batch.items.map((item) => {
-            return asyncCall(batch.driver.getItem, item.relativeKey, item.options).then(
-              (value) => ({
-                key: item.key,
-                value: destr(value),
+
+        // `bytes`, `blob` and `stream` read the driver's raw value, which has no batch
+        // equivalent, so they are resolved one by one alongside the batch call.
+        const rawItems = batch.items.filter((item) => isRawType(item.options?.type));
+        const plainItems =
+          rawItems.length === 0
+            ? batch.items
+            : batch.items.filter((item) => !isRawType(item.options?.type));
+
+        const [plain, raw] = await Promise.all([
+          plainItems.length === 0
+            ? []
+            : asyncCall(
+                batch.driver.getItems,
+                plainItems.map((item) => ({
+                  key: item.relativeKey,
+                  options: item.options,
+                })),
+                commonOptions,
+              ).then((r) => {
+                // Drivers are expected to return one entry per requested key, in order. Only
+                // fall back to a key lookup (and then to `commonOptions`) when they do not,
+                // otherwise a driver echoing back a normalized key would drop the type.
+                const types =
+                  r.length === plainItems.length
+                    ? undefined
+                    : new Map(plainItems.map((item) => [item.relativeKey, item.options?.type]));
+                return Promise.all(
+                  r.map(async (item, index) => ({
+                    key: joinKeys(batch.base, item.key),
+                    value: await toValueType(
+                      item.value,
+                      types
+                        ? types.has(item.key)
+                          ? types.get(item.key)
+                          : commonOptions.type
+                        : plainItems[index]!.options?.type,
+                    ),
+                  })),
+                );
               }),
-            );
-          }),
+          Promise.all(
+            rawItems.map(async (item) => ({
+              key: item.key,
+              value: await getTypedItem(batch.driver, item.relativeKey, item.options),
+            })),
+          ),
+        ]);
+
+        if (rawItems.length === 0 || plain.length !== plainItems.length) {
+          return [...plain, ...raw];
+        }
+
+        // Raw values are resolved outside of the batch call, restore the input order.
+        let plainIndex = 0;
+        let rawIndex = 0;
+        return batch.items.map((item) =>
+          isRawType(item.options?.type) ? raw[rawIndex++]! : plain[plainIndex++]!,
         );
       });
     },
@@ -439,7 +568,7 @@ export function createStorage<T extends StorageValue>(
     },
     // Aliases
     keys: (base, opts = {}) => storage.getKeys(base, opts),
-    get: (key: string, opts = {}) => storage.getItem(key, opts),
+    get: (key: string, opts: TransactionOptions = {}) => storage.getItem(key, opts),
     set: (key: string, value: T, opts = {}) => storage.setItem(key, value, opts),
     has: (key: string, opts = {}) => storage.hasItem(key, opts),
     del: (key: string, opts = {}) => storage.removeItem(key, opts),
diff --git a/src/tracing.ts b/src/tracing.ts
index cd7401d..f6e4d32 100644
--- a/src/tracing.ts
+++ b/src/tracing.ts
@@ -133,7 +133,10 @@ export function withTracing<T extends StorageValue>(storage: MaybeTracedStorage<
       return normalizer(typeof i === "string" ? i : i.key);
     };
 
-    return Array.isArray(keyArg) ? keyArg.map((i) => getKeyValue(i)) : [getKeyValue(keyArg)];
+    return Array.isArray(keyArg)
+      ? keyArg.map((i) => getKeyValue(i))
+      : // `Array.isArray` does not narrow out the readonly array accepted by `getItems`
+        [getKeyValue(keyArg as string | { key: string })];
   };
 
   function wrapOperation<
diff --git a/src/types.ts b/src/types.ts
index 40f3988..5776d75 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -6,6 +6,23 @@ type MaybePromise<T> = T | Promise<T>;
 
 type MaybeDefined<T> = T extends any ? T : any;
 
+/** Types that {@link Storage.getItem} can convert the stored value to. */
+export type GetItemType = keyof GetItemTypeMap;
+
+export interface GetItemTypeMap {
+  text: string;
+  json: JSONValue;
+  bytes: Uint8Array;
+  stream: ReadableStream<Uint8Array>;
+  blob: Blob;
+}
+
+export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
+export interface JSONObject {
+  [key: string]: JSONValue;
+}
+export type JSONArray = JSONValue[];
+
 export type Unwatch = () => MaybePromise<void>;
 
 export interface StorageMeta {
@@ -18,6 +35,33 @@ export interface StorageMeta {
 // TODO: type ttl
 export type TransactionOptions = Record<string, any>;
 
+/** Options accepted when reading items, adding the `type` conversion option. */
+export type GetItemOptions<K extends GetItemType = GetItemType> = TransactionOptions & {
+  /** Convert the stored value to this type. Defaults to lenient JSON parsing. */
+  type?: K;
+};
+
+/** {@link GetItemOptions} with a `type` that is required, selecting the return type. */
+type TypedGetItemOptions<K extends GetItemType> = TransactionOptions & { type: K };
+
+/** {@link GetItemOptions} with no `type`, keeping the default return type. */
+type UntypedGetItemOptions = TransactionOptions & { type?: undefined };
+
+/** An entry accepted by {@link Storage.getItems}: a key, or a key with per item options. */
+export type GetItemsInput = string | { key: string; options?: GetItemOptions };
+
+/**
+ * Value type of a {@link GetItemsInput}, based on its per item `type`.
+ *
+ * Falls back to `Default` (the `type` of the common options, or the storage's value type)
+ * for entries that do not set one.
+ */
+type GetItemsValue<Item, Default> = Item extends {
+  options: { type: infer K extends GetItemType };
+}
+  ? GetItemTypeMap[K] | null
+  : Default;
+
 export type GetKeysOptions = TransactionOptions & {
   maxDepth?: number;
 };
@@ -114,18 +158,30 @@ export interface Storage<T extends StorageValue = StorageValue> {
 
   getItem<U extends Extract<T, StorageDefinition>, K extends string & keyof StorageItemMap<U>>(
     key: K,
-    ops?: TransactionOptions,
+    opts?: UntypedGetItemOptions,
   ): Promise<StorageItemType<T, K> | null>;
+
+  getItem<K extends GetItemType>(
+    key: string,
+    opts: TypedGetItemOptions<K>,
+  ): Promise<GetItemTypeMap[K] | null>;
+
   getItem<R = StorageItemType<T, string>>(
     key: string,
-    opts?: TransactionOptions,
+    opts?: UntypedGetItemOptions,
   ): Promise<R | null>;
 
   /** @experimental */
-  getItems: <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => Promise<{ key: string; value: U }[]>;
+  getItems<K extends GetItemType, const Items extends readonly GetItemsInput[] = GetItemsInput[]>(
+    items: Items,
+    commonOptions: TypedGetItemOptions<K>,
+  ): Promise<{ key: string; value: GetItemsValue<Items[number], GetItemTypeMap[K] | null> }[]>;
+
+  /** @experimental */
+  getItems<U extends T = T, const Items extends readonly GetItemsInput[] = GetItemsInput[]>(
+    items: Items,
+    commonOptions?: UntypedGetItemOptions,
+  ): Promise<{ key: string; value: GetItemsValue<Items[number], U> }[]>;
   /** @experimental See https://github.com/unjs/unstorage/issues/142 */
   getItemRaw: <T = any>(key: string, opts?: TransactionOptions) => Promise<MaybeDefined<T> | null>;
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | **FAIL** | +414/-50 | 189 | 20,978 | $0.482 |
| claude | muffle | **FAIL** | +338/-37 | 188 | 25,108 | $0.511 |
| claude | hush | **FAIL** | +330/-54 | 212 | 23,950 | $0.541 |
| claude | sloth | **FAIL** | +277/-41 | 190 | 20,143 | $0.454 |
| claude | all | **FAIL** | +285/-51 | 169 | 23,193 | $0.512 |
| codex | base | **FAIL** | +221/-44 | 119 | 5,187 | - |
| codex | muffle | **FAIL** | +232/-51 | 176 | 7,159 | - |
| codex | hush | **FAIL** | +206/-40 | 168 | 6,048 | - |
| codex | sloth | **FAIL** | +217/-47 | 216 | 7,475 | - |
| codex | all | **FAIL** | +219/-53 | 262 | 8,470 | - |

### claude, base: FAIL

Files: [docs/1.guide/1.index.md](../base/claude/ts-unstorage-get-item-type-1/files/docs/1.guide/1.index.md), [src/_utils.ts](../base/claude/ts-unstorage-get-item-type-1/files/src/_utils.ts), [src/drivers/netlify-blobs.ts](../base/claude/ts-unstorage-get-item-type-1/files/src/drivers/netlify-blobs.ts), [src/storage.ts](../base/claude/ts-unstorage-get-item-type-1/files/src/storage.ts), [src/tracing.ts](../base/claude/ts-unstorage-get-item-type-1/files/src/tracing.ts), [src/types.ts](../base/claude/ts-unstorage-get-item-type-1/files/src/types.ts), [src/utils.ts](../base/claude/ts-unstorage-get-item-type-1/files/src/utils.ts), [test/get-item-type.test.ts](../base/claude/ts-unstorage-get-item-type-1/files/test/get-item-type.test.ts), [test/storage.test-d.ts](../base/claude/ts-unstorage-get-item-type-1/files/test/storage.test-d.ts)

<details><summary>diff</summary>

```diff
diff --git a/docs/1.guide/1.index.md b/docs/1.guide/1.index.md
index 5b54950..d03192b 100644
--- a/docs/1.guide/1.index.md
+++ b/docs/1.guide/1.index.md
@@ -68,6 +68,20 @@ const value = await storage.getItem("user:1");
 
 Alias: `storage.get()`.
 
+Use the `type` option to read the value in a specific format. A missing key gives `null` for every type.
+
+```ts
+await storage.getItem("user:1", { type: "text" }); // string
+await storage.getItem("user:1", { type: "json" }); // JSONValue
+await storage.getItem("avatar.png", { type: "bytes" }); // Uint8Array
+await storage.getItem("avatar.png", { type: "blob" }); // Blob
+await storage.getItem("avatar.png", { type: "stream" }); // ReadableStream<Uint8Array>
+```
+
+- `bytes`, `blob` and `stream` read the driver's raw value (`getItemRaw`, or `getItem` for drivers without it, where a `base64:` string is decoded). A `Blob` or `ReadableStream` held by the driver is returned as is for `blob` and `stream`. Other binary-like values (`Uint8Array`, `Buffer`, `ArrayBuffer`, `DataView`, `Response`, async iterables, strings as UTF-8) are normalized; numbers, booleans, plain objects and arrays are read as their text form. Anything else rejects with an error.
+- `text` and `json` also decode values written with `setItemRaw()`. `json` is lenient like the default read: a plain string stays a string.
+- `type` is reserved and is not forwarded to the driver.
+
 #### `getItems(items, commonOptions?)`
 
 ::warning
@@ -84,6 +98,15 @@ const items = await storage.getItems([
 // [{ key: "user:1", value: ... }, { key: "user:2", value: ... }]
 ```
 
+`type` can be set in `commonOptions` for the whole call and/or per item (`{ key, options: { type } }`); a per-item `type` overrides the common one. Results keep the input order, and the return type follows the requested types.
+
+```ts
+const items = await storage.getItems(["a", { key: "b", options: { type: "bytes" } }], {
+  type: "json",
+});
+// { key: string; value: JSONValue | Uint8Array | null }[]
+```
+
 ### Writing values
 
 #### `setItem(key, value, options?)`
diff --git a/src/_utils.ts b/src/_utils.ts
index e19ef0a..6b88231 100644
--- a/src/_utils.ts
+++ b/src/_utils.ts
@@ -1,3 +1,6 @@
+import { destr } from "destr";
+import type { Driver } from "./types.ts";
+
 type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;
 type Promisified<T> = Promise<Awaited<T>>;
 
@@ -80,3 +83,233 @@ function base64Encode(input: Uint8Array) {
   }
   return globalThis.btoa(String.fromCodePoint(...input));
 }
+
+// --- Typed reads (`getItem(key, { type })`) ---
+
+const GET_ITEM_TYPES = new Set(["text", "json", "bytes", "blob", "stream"]);
+
+export function isRawGetItemType(type: string | undefined): boolean {
+  return type === "bytes" || type === "blob" || type === "stream";
+}
+
+/**
+ * Split the reserved `type` option from the options forwarded to drivers.
+ */
+export function splitGetItemOptions<T extends Record<string, any> | undefined>(
+  options: T,
+): { type: string | undefined; options: Record<string, any> } {
+  const { type, ...rest } = (options || {}) as Record<string, any>;
+  if (type !== undefined && !GET_ITEM_TYPES.has(type)) {
+    throw new Error(
+      `[unstorage] Unknown \`type\` option: ${String(type)} (expected one of ${[...GET_ITEM_TYPES].join(", ")})`,
+    );
+  }
+  return { type, options: rest };
+}
+
+function isAsyncIterable(value: any): value is AsyncIterable<unknown> {
+  return typeof value?.[Symbol.asyncIterator] === "function";
+}
+
+function isBinaryLike(value: any): boolean {
+  return (
+    value instanceof ArrayBuffer ||
+    (typeof SharedArrayBuffer !== "undefined" && value instanceof SharedArrayBuffer) ||
+    ArrayBuffer.isView(value) ||
+    (typeof Blob !== "undefined" && value instanceof Blob) ||
+    (typeof ReadableStream !== "undefined" && value instanceof ReadableStream) ||
+    (typeof Response !== "undefined" && value instanceof Response) ||
+    isAsyncIterable(value)
+  );
+}
+
+function concatBytes(chunks: Uint8Array[]): Uint8Array {
+  if (chunks.length === 1) {
+    return chunks[0]!;
+  }
+  let length = 0;
+  for (const chunk of chunks) {
+    length += chunk.byteLength;
+  }
+  const result = new Uint8Array(length);
+  let offset = 0;
+  for (const chunk of chunks) {
+    result.set(chunk, offset);
+    offset += chunk.byteLength;
+  }
+  return result;
+}
+
+async function drainStream(stream: ReadableStream<unknown>): Promise<Uint8Array> {
+  const reader = stream.getReader();
+  const chunks: Uint8Array[] = [];
+  try {
+    while (true) {
+      const { done, value } = await reader.read();
+      if (done) {
+        break;
+      }
+      chunks.push(await toBytes(value));
+    }
+  } finally {
+    reader.releaseLock();
+  }
+  return concatBytes(chunks);
+}
+
+/**
+ * Normalize any binary-like (or text-like) value to a `Uint8Array`.
+ */
+export async function toBytes(value: unknown): Promise<Uint8Array> {
+  if (value instanceof Uint8Array) {
+    // Normalize `Buffer` to a plain `Uint8Array` view (no copy)
+    return value.constructor === Uint8Array
+      ? value
+      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+  }
+  if (
+    value instanceof ArrayBuffer ||
+    (typeof SharedArrayBuffer !== "undefined" && value instanceof SharedArrayBuffer)
+  ) {
+    return new Uint8Array(value);
+  }
+  if (ArrayBuffer.isView(value)) {
+    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+  }
+  if (typeof Blob !== "undefined" && value instanceof Blob) {
+    return new Uint8Array(await value.arrayBuffer());
+  }
+  if (typeof ReadableStream !== "undefined" && value instanceof ReadableStream) {
+    return drainStream(value);
+  }
+  if (typeof Response !== "undefined" && value instanceof Response) {
+    return new Uint8Array(await value.arrayBuffer());
+  }
+  if (isAsyncIterable(value)) {
+    const chunks: Uint8Array[] = [];
+    for await (const chunk of value) {
+      chunks.push(await toBytes(chunk));
+    }
+    return concatBytes(chunks);
+  }
+  if (typeof value === "string") {
+    return new TextEncoder().encode(value);
+  }
+  if (isTextLike(value)) {
+    return new TextEncoder().encode(stringify(value));
+  }
+  const name = (value as any)?.constructor?.name || "Object";
+  throw new Error(`[unstorage] Cannot convert \`${name}\` to bytes`);
+}
+
+function isTextLike(value: unknown): boolean {
+  return (
+    isPrimitive(value) ||
+    Array.isArray(value) ||
+    (typeof value === "object" && value !== null && isPureObject(value))
+  );
+}
+
+async function toText(value: unknown): Promise<string> {
+  return new TextDecoder().decode(await toBytes(value));
+}
+
+async function toStream(value: unknown): Promise<ReadableStream<Uint8Array>> {
+  if (value instanceof ReadableStream) {
+    return value as ReadableStream<Uint8Array>;
+  }
+  if (value instanceof Blob) {
+    return value.stream() as ReadableStream<Uint8Array>;
+  }
+  if (value instanceof Response) {
+    return (
+      (value.body as ReadableStream<Uint8Array> | null) ??
+      new ReadableStream<Uint8Array>({ start: (controller) => controller.close() })
+    );
+  }
+  const bytes = await toBytes(value);
+  return new ReadableStream<Uint8Array>({
+    start(controller) {
+      if (bytes.byteLength > 0) {
+        controller.enqueue(bytes);
+      }
+      controller.close();
+    },
+  });
+}
+
+async function toBlob(value: unknown): Promise<Blob> {
+  if (value instanceof Blob) {
+    return value;
+  }
+  if (value instanceof Response) {
+    return value.blob();
+  }
+  return new Blob([(await toBytes(value)) as BlobPart]);
+}
+
+/**
+ * Convert a value read with the driver's `getItem` for `text` / `json` / no type.
+ */
+export async function convertItem(type: string | undefined, value: unknown): Promise<any> {
+  if (value === undefined || value === null) {
+    return null;
+  }
+  if (!type) {
+    return destr(value);
+  }
+  if (typeof value === "string" && value.startsWith(BASE64_PREFIX)) {
+    value = await toBytes(deserializeRaw(value));
+  }
+  if (type === "text") {
+    if (typeof value === "string") {
+      return value;
+    }
+    return isBinaryLike(value) ? toText(value) : stringify(value);
+  }
+  // json
+  if (typeof value === "string") {
+    return destr(value);
+  }
+  return isBinaryLike(value) ? destr(await toText(value)) : value;
+}
+
+/**
+ * Convert a raw value (from `getItemRaw`) for `bytes` / `blob` / `stream`.
+ */
+export async function convertRawItem(type: string | undefined, value: unknown): Promise<any> {
+  if (value === undefined || value === null) {
+    return null;
+  }
+  switch (type) {
+    case "blob": {
+      return toBlob(deserializeRaw(value));
+    }
+    case "stream": {
+      return toStream(deserializeRaw(value));
+    }
+    default: {
+      return toBytes(deserializeRaw(value));
+    }
+  }
+}
+
+/**
+ * Read a single item from a driver in the requested format.
+ * `options` must not contain the `type` option.
+ */
+export async function readItem(
+  driver: Driver,
+  key: string,
+  options: Record<string, any>,
+  type: string | undefined,
+): Promise<any> {
+  if (isRawGetItemType(type)) {
+    if (driver.getItemRaw) {
+      return convertRawItem(type, await asyncCall(driver.getItemRaw, key, options));
+    }
+    // `convertRawItem` decodes `base64:` strings
+    return convertRawItem(type, await asyncCall(driver.getItem, key, options));
+  }
+  return convertItem(type, await asyncCall(driver.getItem, key, options));
+}
diff --git a/src/drivers/netlify-blobs.ts b/src/drivers/netlify-blobs.ts
index ad81629..55f2c5f 100644
--- a/src/drivers/netlify-blobs.ts
+++ b/src/drivers/netlify-blobs.ts
@@ -95,7 +95,7 @@ const driver: DriverFactory<NetlifyStoreOptions, Promise<Store>> = (options) =>
     },
     async getItemRaw(key, topts?: GetOptions) {
       // @ts-expect-error has trouble with the overloaded types
-      return (await getClient()).get(key, { type: topts?.type ?? "arrayBuffer" });
+      return (await getClient()).get(key, { ...topts, type: "arrayBuffer" });
     },
     async setItem(key, value, topts?: SetOptions) {
       // NOTE: this returns either Promise<void> (pre-v10) or Promise<WriteResult> (v10+)
diff --git a/src/storage.ts b/src/storage.ts
index 0c25ad8..e725473 100644
--- a/src/storage.ts
+++ b/src/storage.ts
@@ -9,7 +9,16 @@ import type {
   TransactionOptions,
 } from "./types.ts";
 import memory from "./drivers/memory.ts";
-import { asyncCall, deserializeRaw, serializeRaw, stringify } from "./_utils.ts";
+import {
+  asyncCall,
+  convertItem,
+  deserializeRaw,
+  isRawGetItemType,
+  readItem,
+  serializeRaw,
+  splitGetItemOptions,
+  stringify,
+} from "./_utils.ts";
 import {
   normalizeKey,
   normalizeBaseKey,
@@ -157,44 +166,102 @@ export function createStorage<T extends StorageValue>(
       const { relativeKey, driver } = getMount(key);
       return asyncCall(driver.hasItem, relativeKey, opts);
     },
-    getItem(key: string, opts = {}) {
+    getItem(key: string, opts: TransactionOptions = {}) {
       key = normalizeKey(key);
       const { relativeKey, driver } = getMount(key);
-      return asyncCall(driver.getItem, relativeKey, opts).then(
-        (value) => destr(value) as StorageValue,
-      );
+      let split;
+      try {
+        split = splitGetItemOptions(opts);
+      } catch (error) {
+        return Promise.reject(error);
+      }
+      return readItem(driver, relativeKey, split.options, split.type);
     },
-    getItems(
+    async getItems(
       items: (string | { key: string; options?: TransactionOptions })[],
-      commonOptions = {},
+      commonOptions: TransactionOptions = {},
     ) {
-      return runBatch(items, commonOptions, (batch) => {
-        if (batch.driver.getItems) {
-          return asyncCall(
-            batch.driver.getItems,
-            batch.items.map((item) => ({
-              key: item.relativeKey,
-              options: item.options,
-            })),
-            commonOptions,
-          ).then((r) =>
-            r.map((item) => ({
-              key: joinKeys(batch.base, item.key),
-              value: destr(item.value),
-            })),
-          );
-        }
-        return Promise.all(
-          batch.items.map((item) => {
-            return asyncCall(batch.driver.getItem, item.relativeKey, item.options).then(
-              (value) => ({
-                key: item.key,
-                value: destr(value),
-              }),
-            );
-          }),
-        );
+      const common = splitGetItemOptions(commonOptions);
+      const results: { key: string; value: any }[] = [];
+      let index = 0;
+      const indexed = items.map((item) => {
+        const key = typeof item === "string" ? item : item.key;
+        const itemOptions = typeof item === "string" ? undefined : item.options;
+        const split = itemOptions ? splitGetItemOptions(itemOptions) : undefined;
+        return {
+          key,
+          options: split?.options,
+          type: split?.type ?? common.type,
+          index: index++,
+        };
       });
+      const typeByIndex = indexed.map((item) => item.type);
+      await runBatch(
+        indexed.map((item) => ({ key: item.key, options: item.options, value: item.index })),
+        common.options,
+        async (batch) => {
+          const entries = batch.items.map((item) => ({
+            ...item,
+            type: typeByIndex[item.value as unknown as number],
+            position: item.value as unknown as number,
+          }));
+          const raw = entries.filter((item) => isRawGetItemType(item.type));
+          const rest = entries.filter((item) => !isRawGetItemType(item.type));
+          await Promise.all([
+            ...raw.map(async (item) => {
+              results[item.position] = {
+                key: item.key,
+                value: await readItem(
+                  batch.driver,
+                  item.relativeKey,
+                  item.options || {},
+                  item.type,
+                ),
+              };
+            }),
+            (async () => {
+              if (rest.length === 0) {
+                return;
+              }
+              if (batch.driver.getItems) {
+                const found = await asyncCall(
+                  batch.driver.getItems,
+                  rest.map((item) => ({ key: item.relativeKey, options: item.options })),
+                  common.options,
+                );
+                // Match by position: drivers may return keys different from the requested ones
+                const byPosition = found.length === rest.length;
+                await Promise.all(
+                  rest.map(async (item, i) => {
+                    const entry = byPosition
+                      ? found[i]
+                      : found.find((f) => f.key === item.relativeKey);
+                    results[item.position] = {
+                      key: entry ? joinKeys(batch.base, entry.key) : item.key,
+                      value: await convertItem(item.type, entry?.value),
+                    };
+                  }),
+                );
+                return;
+              }
+              await Promise.all(
+                rest.map(async (item) => {
+                  results[item.position] = {
+                    key: item.key,
+                    value: await readItem(
+                      batch.driver,
+                      item.relativeKey,
+                      item.options || {},
+                      item.type,
+                    ),
+                  };
+                }),
+              );
+            })(),
+          ]);
+        },
+      );
+      return results;
     },
     getItemRaw(key, opts = {}) {
       key = normalizeKey(key);
diff --git a/src/tracing.ts b/src/tracing.ts
index cd7401d..3f98dc5 100644
--- a/src/tracing.ts
+++ b/src/tracing.ts
@@ -121,10 +121,7 @@ export function withTracing<T extends StorageValue>(storage: MaybeTracedStorage<
     };
   };
 
-  const prepKeys = (
-    keyArg: Parameters<(typeof storage)[TracedOperation]>[0],
-    operation: TracedOperation,
-  ) => {
+  const prepKeys = (keyArg: any, operation: TracedOperation) => {
     if (!keyArg) return [];
 
     const getKeyValue = (i: string | { key: string }) => {
diff --git a/src/types.ts b/src/types.ts
index 40f3988..00e54c7 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -18,6 +18,44 @@ export interface StorageMeta {
 // TODO: type ttl
 export type TransactionOptions = Record<string, any>;
 
+export type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
+export interface JSONObject {
+  [key: string]: JSONValue;
+}
+export interface JSONArray extends Array<JSONValue> {}
+
+/** Formats a stored value can be read as with the `type` option of `getItem()` and `getItems()`. */
+export interface GetItemTypeMap {
+  text: string;
+  json: JSONValue;
+  bytes: Uint8Array;
+  blob: Blob;
+  stream: ReadableStream<Uint8Array>;
+}
+
+export type GetItemType = keyof GetItemTypeMap;
+
+export type GetItemOptions<K extends GetItemType = GetItemType> = TransactionOptions & {
+  /** Format to read the value as. Reserved: not forwarded to the driver. */
+  type?: K;
+};
+
+export type GetItemsInput = string | { key: string; options?: GetItemOptions };
+
+type UntypedOptions = TransactionOptions & { type?: undefined };
+
+type GetItemsItemType<I, C> = I extends { options: { type: infer K extends GetItemType } }
+  ? K
+  : C extends { type: infer K extends GetItemType }
+    ? K
+    : never;
+
+type GetItemsItemValue<I, C> = I extends any
+  ? [GetItemsItemType<I, C>] extends [never]
+    ? StorageValue
+    : GetItemTypeMap[GetItemsItemType<I, C>] | null
+  : never;
+
 export type GetKeysOptions = TransactionOptions & {
   maxDepth?: number;
 };
@@ -112,20 +150,26 @@ export interface Storage<T extends StorageValue = StorageValue> {
   ): Promise<boolean>;
   hasItem(key: string, opts?: TransactionOptions): Promise<boolean>;
 
+  getItem<K extends GetItemType>(
+    key: string,
+    opts: GetItemOptions<K> & { type: K },
+  ): Promise<GetItemTypeMap[K] | null>;
   getItem<U extends Extract<T, StorageDefinition>, K extends string & keyof StorageItemMap<U>>(
     key: K,
-    ops?: TransactionOptions,
+    ops?: UntypedOptions,
   ): Promise<StorageItemType<T, K> | null>;
-  getItem<R = StorageItemType<T, string>>(
-    key: string,
-    opts?: TransactionOptions,
-  ): Promise<R | null>;
+  getItem<R = StorageItemType<T, string>>(key: string, opts?: UntypedOptions): Promise<R | null>;
 
   /** @experimental */
-  getItems: <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => Promise<{ key: string; value: U }[]>;
+  getItems<U extends T>(
+    items: (string | { key: string; options?: UntypedOptions })[],
+    commonOptions?: UntypedOptions,
+  ): Promise<{ key: string; value: U }[]>;
+  /** @experimental */
+  getItems<const I extends readonly GetItemsInput[], C extends GetItemOptions = {}>(
+    items: I,
+    commonOptions?: C,
+  ): Promise<{ key: string; value: GetItemsItemValue<I[number], C> }[]>;
   /** @experimental See https://github.com/unjs/unstorage/issues/142 */
   getItemRaw: <T = any>(key: string, opts?: TransactionOptions) => Promise<MaybeDefined<T> | null>;
 
diff --git a/src/utils.ts b/src/utils.ts
index eb44352..3e5929a 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -56,19 +56,19 @@ export function prefixStorage<T extends StorageValue>(
       }
     });
 
-  nsStorage.getItems = async <U extends T>(
+  nsStorage.getItems = (async (
     items: (string | { key: string; options?: TransactionOptions })[],
     commonOptions?: TransactionOptions,
   ) => {
     const prefixedItems = items.map((item) =>
       typeof item === "string" ? base + item : { ...item, key: base + item.key },
     );
-    const results = await storage.getItems<U>(prefixedItems, commonOptions);
+    const results = await storage.getItems(prefixedItems, commonOptions);
     return results.map((entry) => ({
       key: entry.key.slice(base.length),
       value: entry.value,
     }));
-  };
+  }) as Storage<T>["getItems"];
 
   nsStorage.setItems = async <U extends T>(
     items: { key: string; value: U; options?: TransactionOptions }[],
diff --git a/test/get-item-type.test.ts b/test/get-item-type.test.ts
new file mode 100644
index 0000000..e99345e
--- /dev/null
+++ b/test/get-item-type.test.ts
@@ -0,0 +1,156 @@
+import { describe, it, expect } from "vitest";
+import { createStorage } from "../src/index.ts";
+import memory from "../src/drivers/memory.ts";
+import type { Driver } from "../src/index.ts";
+
+const enc = new TextEncoder();
+const stringOnly = (): Driver => {
+  const data = new Map<string, string>();
+  return {
+    hasItem: (k) => data.has(k),
+    getItem: (k) => data.get(k) as any,
+    setItem: (k, v) => void data.set(k, v),
+    getKeys: () => [...data.keys()],
+  };
+};
+
+async function read(stream: ReadableStream<Uint8Array>) {
+  return new TextDecoder().decode(new Uint8Array(await new Response(stream).arrayBuffer()));
+}
+
+describe("getItem type option", () => {
+  it("missing keys and undefined are null", async () => {
+    const storage = createStorage({ driver: { ...memory(), getItem: () => undefined as any } });
+    expect(await storage.getItem("x")).toBeNull();
+    for (const type of ["text", "json", "bytes", "blob", "stream"] as const) {
+      expect(await storage.getItem("x", { type })).toBeNull();
+    }
+  });
+
+  for (const [name, driver] of [
+    ["memory", memory],
+    ["string-only", stringOnly],
+  ] as const) {
+    it(`decodes setItemRaw values (${name})`, async () => {
+      const storage = createStorage({ driver: driver() });
+      await storage.setItemRaw("a", enc.encode("hello wörld"));
+      expect(await storage.getItem("a", { type: "text" })).toBe("hello wörld");
+      expect(await storage.getItem("a", { type: "bytes" })).toEqual(enc.encode("hello wörld"));
+      expect(await read((await storage.getItem("a", { type: "stream" }))!)).toBe("hello wörld");
+      expect(await (await storage.getItem("a", { type: "blob" }))!.text()).toBe("hello wörld");
+      await storage.setItemRaw("j", enc.encode('{"a":1}'));
+      expect(await storage.getItem("j", { type: "json" })).toEqual({ a: 1 });
+      await storage.setItem("s", "plain");
+      expect(await storage.getItem("s", { type: "text" })).toBe("plain");
+      expect(await storage.getItem("s", { type: "json" })).toBe("plain");
+      expect(await storage.getItem("s", { type: "bytes" })).toEqual(enc.encode("plain"));
+    });
+  }
+
+  it("normalizes binary-like values", async () => {
+    const storage = createStorage();
+    const bytes = enc.encode("abc");
+    const values: unknown[] = [
+      bytes,
+      Buffer.from("abc"),
+      bytes.buffer.slice(0),
+      new DataView(bytes.buffer.slice(0)),
+      new Blob(["abc"]),
+      new Response("abc"),
+      new Blob(["abc"]).stream(),
+      (async function* () {
+        yield enc.encode("a");
+        yield "bc";
+      })(),
+      "abc",
+    ];
+    for (const value of values) {
+      await storage.setItemRaw("k", value);
+      const out = await storage.getItem("k", { type: "bytes" });
+      expect(out!.constructor).toBe(Uint8Array);
+      expect([...out!]).toEqual([...bytes]);
+    }
+    await storage.setItemRaw("k", true);
+    expect(await storage.getItem("k", { type: "bytes" })).toEqual(enc.encode("true"));
+    await storage.setItemRaw("k", { a: 1 });
+    expect(await storage.getItem("k", { type: "bytes" })).toEqual(enc.encode('{"a":1}'));
+    await storage.setItemRaw("k", new Map());
+    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow(
+      /Cannot convert `Map` to bytes/,
+    );
+  });
+
+  it("returns blobs and streams as is", async () => {
+    const storage = createStorage();
+    const blob = new Blob(["x"]);
+    const stream = new Blob(["x"]).stream();
+    await storage.setItemRaw("b", blob);
+    await storage.setItemRaw("s", stream);
+    expect(await storage.getItem("b", { type: "blob" })).toBe(blob);
+    expect(await storage.getItem("s", { type: "stream" })).toBe(stream);
+  });
+
+  it("releases the reader lock when draining fails", async () => {
+    const storage = createStorage();
+    const stream = new ReadableStream({
+      pull(controller) {
+        controller.error(new Error("boom"));
+      },
+    });
+    await storage.setItemRaw("k", stream);
+    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow("boom");
+    expect(stream.locked).toBe(false);
+  });
+
+  it("does not forward type to the driver", async () => {
+    let seen: any;
+    const storage = createStorage({
+      driver: { ...memory(), getItemRaw: (_k, o) => ((seen = o), null) },
+    });
+    await storage.getItem("k", { type: "bytes", foo: 1 });
+    expect(seen).toEqual({ foo: 1 });
+  });
+
+  it("getItems", async () => {
+    const storage = createStorage();
+    storage.mount("m", memory());
+    await storage.setItem("a", '{"n":1}');
+    await storage.setItem("m:b", "bee");
+    await storage.setItemRaw("m:c", enc.encode("see"));
+    const out = await storage.getItems(
+      [
+        "a",
+        { key: "m:b", options: { type: "bytes" } },
+        "m:c",
+        "missing",
+        { key: "a", options: { type: "text" } },
+      ],
+      { type: "json" },
+    );
+    expect(out).toEqual([
+      { key: "a", value: { n: 1 } },
+      { key: "m:b", value: enc.encode("bee") },
+      { key: "m:c", value: "see" },
+      { key: "missing", value: null },
+      { key: "a", value: '{"n":1}' },
+    ]);
+  });
+
+  it("getItems applies type by position with batch drivers renaming keys", async () => {
+    const storage = createStorage({
+      driver: {
+        ...memory(),
+        getItems: (items) => items.map((i) => ({ key: "renamed:" + i.key, value: "v:" + i.key })),
+        getItemRaw: (k) => "raw:" + k,
+      },
+    });
+    const out = await storage.getItems([
+      { key: "x", options: { type: "text" } },
+      { key: "y", options: { type: "bytes" } },
+      "z",
+    ]);
+    expect(out[0]).toEqual({ key: "renamed:x", value: "v:x" });
+    expect(out[1]).toEqual({ key: "y", value: enc.encode("raw:y") });
+    expect(out[2]).toEqual({ key: "renamed:z", value: "v:z" });
+  });
+});
diff --git a/test/storage.test-d.ts b/test/storage.test-d.ts
index 9d8933c..e9a46e2 100644
--- a/test/storage.test-d.ts
+++ b/test/storage.test-d.ts
@@ -1,6 +1,6 @@
 import { describe, it, expectTypeOf } from "vitest";
 import { createStorage, prefixStorage } from "../src/index.ts";
-import type { Storage, StorageValue } from "../src/index.ts";
+import type { JSONValue, Storage, StorageValue } from "../src/index.ts";
 
 describe("types", () => {
   it("default types for storage", async () => {
@@ -81,3 +81,35 @@ describe("types", () => {
     expectTypeOf(prefixedStorage3).toEqualTypeOf<Storage<number>>();
   });
 });
+
+describe("getItem type option", () => {
+  it("narrows return types", async () => {
+    const storage = createStorage();
+    expectTypeOf(await storage.getItem("k", { type: "text" })).toEqualTypeOf<string | null>();
+    expectTypeOf(await storage.get("k", { type: "json" })).toEqualTypeOf<JSONValue>();
+    expectTypeOf(await storage.getItem("k", { type: "bytes" })).toEqualTypeOf<Uint8Array | null>();
+    expectTypeOf(await storage.getItem("k", { type: "blob" })).toEqualTypeOf<Blob | null>();
+    expectTypeOf(
+      await storage.getItem("k", { type: "stream" }),
+    ).toEqualTypeOf<ReadableStream<Uint8Array> | null>();
+    // @ts-expect-error unknown type
+    await storage.getItem("k", { type: "buffer" });
+
+    expectTypeOf(await storage.getItems(["a"], { type: "text" })).toEqualTypeOf<
+      { key: string; value: string | null }[]
+    >();
+    expectTypeOf(await storage.getItems([{ key: "a", options: { type: "bytes" } }])).toEqualTypeOf<
+      { key: string; value: Uint8Array | null }[]
+    >();
+    expectTypeOf(
+      await storage.getItems(["a", { key: "b", options: { type: "bytes" } }], { type: "json" }),
+    ).toEqualTypeOf<{ key: string; value: JSONValue | Uint8Array | null }[]>();
+    expectTypeOf(await storage.getItems(["a"])).toEqualTypeOf<
+      { key: string; value: StorageValue }[]
+    >();
+    // @ts-expect-error unknown type
+    await storage.getItems([{ key: "a", options: { type: "buffer" } }]);
+    // @ts-expect-error unknown type
+    await storage.getItems(["a"], { type: "buffer" });
+  });
+});
```

</details>

<details><summary>reply</summary>

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

</details>

### claude, muffle: FAIL

Files: [docs/1.guide/1.index.md](../muffle/claude/ts-unstorage-get-item-type-1/files/docs/1.guide/1.index.md), [src/_convert.ts](../muffle/claude/ts-unstorage-get-item-type-1/files/src/_convert.ts), [src/storage.ts](../muffle/claude/ts-unstorage-get-item-type-1/files/src/storage.ts), [src/types.ts](../muffle/claude/ts-unstorage-get-item-type-1/files/src/types.ts), [src/utils.ts](../muffle/claude/ts-unstorage-get-item-type-1/files/src/utils.ts), [test/get-item-type.test.ts](../muffle/claude/ts-unstorage-get-item-type-1/files/test/get-item-type.test.ts), [test/storage.test-d.ts](../muffle/claude/ts-unstorage-get-item-type-1/files/test/storage.test-d.ts)

<details><summary>diff</summary>

```diff
diff --git a/docs/1.guide/1.index.md b/docs/1.guide/1.index.md
index 5b54950..fce9363 100644
--- a/docs/1.guide/1.index.md
+++ b/docs/1.guide/1.index.md
@@ -68,6 +68,24 @@ const value = await storage.getItem("user:1");
 
 Alias: `storage.get()`.
 
+Use the `type` option to read the value in a specific format:
+
+```ts
+await storage.getItem("user:1", { type: "text" }); // string
+await storage.getItem("user:1", { type: "json" }); // JSONValue
+await storage.getItem("avatar.png", { type: "bytes" }); // Uint8Array
+await storage.getItem("avatar.png", { type: "blob" }); // Blob
+await storage.getItem("avatar.png", { type: "stream" }); // ReadableStream<Uint8Array>
+```
+
+- A missing key gives `null` for every type.
+- `text` and `json` also decode values written with `setItemRaw()`, so you get the original text instead of `base64:...`. `json` is lenient like the default read: a plain string stays a string.
+- `bytes`, `blob` and `stream` read the driver's raw value (`getItemRaw`, falling back to `getItem` with `base64:` strings decoded). A `Blob` or `ReadableStream` held by the driver is returned as is for `blob` and `stream`, without buffering.
+- Binary-like values (`Uint8Array`, `Buffer`, `ArrayBuffer`, `DataView`, `Blob`, `ReadableStream`, `Response`, async iterables of chunks and strings) are normalized. Numbers, booleans, plain objects and arrays are read as their text form. Anything else rejects with an error.
+- `type` is reserved and not forwarded to the driver (for Netlify Blobs, `{ type: "arrayBuffer" }` becomes `bytes`).
+
+The return type follows `type`, and an unknown `type` is a type error.
+
 #### `getItems(items, commonOptions?)`
 
 ::warning
@@ -84,6 +102,16 @@ const items = await storage.getItems([
 // [{ key: "user:1", value: ... }, { key: "user:2", value: ... }]
 ```
 
+`type` can be set in the common options for the whole call and per item, where it overrides the common one. Results keep input order.
+
+```ts
+const items = await storage.getItems(
+  ["user:1", { key: "avatar.png", options: { type: "bytes" } }],
+  { type: "json" },
+);
+// [{ key: "user:1", value: JSONValue | null }, { key: "avatar.png", value: Uint8Array | null }]
+```
+
 ### Writing values
 
 #### `setItem(key, value, options?)`
diff --git a/src/_convert.ts b/src/_convert.ts
new file mode 100644
index 0000000..df8460d
--- /dev/null
+++ b/src/_convert.ts
@@ -0,0 +1,181 @@
+import { destr } from "destr";
+import type { GetItemType } from "./types.ts";
+import { BASE64_PREFIX, deserializeRaw } from "./_utils.ts";
+
+const GET_ITEM_TYPES = new Set<string>(["text", "json", "bytes", "blob", "stream"]);
+
+export function assertGetItemType(type: unknown): asserts type is GetItemType | undefined {
+  if (type !== undefined && !GET_ITEM_TYPES.has(type as string)) {
+    throw new Error(`[unstorage] Unknown \`type\` option: ${String(type)}`);
+  }
+}
+
+/** `bytes`, `blob` and `stream` read the driver's raw value. */
+export function isRawType(type: GetItemType | undefined): type is "bytes" | "blob" | "stream" {
+  return type === "bytes" || type === "blob" || type === "stream";
+}
+
+/** Remove the reserved `type` option before options are handed to a driver. */
+export function omitType<T extends Record<string, any> | undefined>(options: T): T {
+  if (!options || !("type" in options)) {
+    return options;
+  }
+  const { type: _type, ...rest } = options;
+  return rest as T;
+}
+
+function isPlainObject(value: any): boolean {
+  const proto = Object.getPrototypeOf(value);
+  return proto === null || proto === Object.prototype;
+}
+
+/** Text form of numbers, booleans, plain objects and arrays (`undefined` for anything else). */
+function plainText(value: unknown): string | undefined {
+  switch (typeof value) {
+    case "string":
+    case "number":
+    case "boolean":
+    case "bigint": {
+      return String(value);
+    }
+    case "object": {
+      if (value !== null && (Array.isArray(value) || isPlainObject(value))) {
+        return JSON.stringify(value);
+      }
+    }
+  }
+}
+
+const isInstance = (name: string, value: unknown) => {
+  const ctor = (globalThis as any)[name];
+  return typeof ctor === "function" && value instanceof ctor;
+};
+
+function concat(chunks: Uint8Array[]): Uint8Array {
+  if (chunks.length === 1) {
+    return chunks[0]!;
+  }
+  const result = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
+  let offset = 0;
+  for (const chunk of chunks) {
+    result.set(chunk, offset);
+    offset += chunk.length;
+  }
+  return result;
+}
+
+async function drainStream(stream: ReadableStream): Promise<Uint8Array> {
+  const reader = stream.getReader();
+  const chunks: Uint8Array[] = [];
+  try {
+    while (true) {
+      const { done, value } = await reader.read();
+      if (done) {
+        break;
+      }
+      chunks.push(await toBytes(value));
+    }
+  } finally {
+    reader.releaseLock();
+  }
+  return concat(chunks);
+}
+
+/** Normalize any binary-like value to a `Uint8Array`. */
+export async function toBytes(value: unknown): Promise<Uint8Array> {
+  const text = plainText(value);
+  if (text !== undefined) {
+    return new TextEncoder().encode(text);
+  }
+  if (ArrayBuffer.isView(value)) {
+    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+  }
+  if (value instanceof ArrayBuffer || isInstance("SharedArrayBuffer", value)) {
+    return new Uint8Array(value as ArrayBuffer);
+  }
+  if (isInstance("Blob", value)) {
+    return new Uint8Array(await (value as Blob).arrayBuffer());
+  }
+  if (isInstance("ReadableStream", value)) {
+    return drainStream(value as ReadableStream);
+  }
+  if (isInstance("Response", value)) {
+    return new Uint8Array(await (value as Response).arrayBuffer());
+  }
+  if (value && typeof (value as any)[Symbol.asyncIterator] === "function") {
+    const chunks: Uint8Array[] = [];
+    for await (const chunk of value as AsyncIterable<unknown>) {
+      chunks.push(await toBytes(chunk));
+    }
+    return concat(chunks);
+  }
+  const name = (value as any)?.constructor?.name || "Object";
+  throw new Error(`[unstorage] Cannot convert \`${name}\` to bytes`);
+}
+
+async function toText(value: unknown): Promise<string> {
+  if (typeof value === "string" && !value.startsWith(BASE64_PREFIX)) {
+    return value;
+  }
+  const text = plainText(value);
+  if (text !== undefined && typeof value !== "string") {
+    return text;
+  }
+  return new TextDecoder().decode(await toBytes(deserializeRaw(value)));
+}
+
+function bytesToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
+  return new ReadableStream<Uint8Array>({
+    start(controller) {
+      controller.enqueue(bytes);
+      controller.close();
+    },
+  });
+}
+
+/** Convert a value read with the driver's `getItem` (`text`, `json` or no type). */
+export async function convertValue(type: GetItemType | undefined, value: unknown): Promise<any> {
+  assertGetItemType(type);
+  if (value === undefined || value === null) {
+    return null;
+  }
+  if (type === "text") {
+    return toText(value);
+  }
+  if (type === "json") {
+    if (typeof value === "string" || plainText(value) === undefined) {
+      return destr(await toText(value));
+    }
+    return value;
+  }
+  return destr(value);
+}
+
+/** Convert a value read with the driver's raw reader (`bytes`, `blob` or `stream`). */
+export async function convertRaw(type: "bytes" | "blob" | "stream", value: unknown): Promise<any> {
+  if (value === undefined || value === null) {
+    return null;
+  }
+  if (type === "blob") {
+    if (isInstance("Blob", value)) {
+      return value;
+    }
+    if (isInstance("Response", value)) {
+      return (value as Response).blob();
+    }
+    return new Blob([(await toBytes(value)) as BlobPart]);
+  }
+  if (type === "stream") {
+    if (isInstance("ReadableStream", value)) {
+      return value;
+    }
+    if (isInstance("Blob", value)) {
+      return (value as Blob).stream();
+    }
+    if (isInstance("Response", value)) {
+      return (value as Response).body ?? bytesToStream(new Uint8Array());
+    }
+    return bytesToStream(await toBytes(value));
+  }
+  return toBytes(value);
+}
diff --git a/src/storage.ts b/src/storage.ts
index 0c25ad8..f4ea08a 100644
--- a/src/storage.ts
+++ b/src/storage.ts
@@ -7,9 +7,11 @@ import type {
   StorageValue,
   WatchEvent,
   TransactionOptions,
+  GetItemType,
 } from "./types.ts";
 import memory from "./drivers/memory.ts";
 import { asyncCall, deserializeRaw, serializeRaw, stringify } from "./_utils.ts";
+import { assertGetItemType, convertRaw, convertValue, isRawType, omitType } from "./_convert.ts";
 import {
   normalizeKey,
   normalizeBaseKey,
@@ -106,6 +108,7 @@ export function createStorage<T extends StorageValue>(
     driver: Driver;
     base: string;
     items: {
+      index: number;
       key: string;
       relativeKey: string;
       value?: StorageValue;
@@ -132,7 +135,7 @@ export function createStorage<T extends StorageValue>(
       return batch;
     };
 
-    for (const item of items) {
+    for (const [index, item] of items.entries()) {
       const isStringItem = typeof item === "string";
       const key = normalizeKey(isStringItem ? item : item.key);
       const value = isStringItem ? undefined : item.value;
@@ -140,6 +143,7 @@ export function createStorage<T extends StorageValue>(
         isStringItem || !item.options ? commonOptions : { ...commonOptions, ...item.options };
       const mount = getMount(key);
       getBatch(mount).items.push({
+        index,
         key,
         value,
         relativeKey: mount.relativeKey,
@@ -150,6 +154,22 @@ export function createStorage<T extends StorageValue>(
     return Promise.all([...batches.values()].map((batch) => cb(batch))).then((r) => r.flat());
   };
 
+  const readItem = async (
+    driver: Driver,
+    key: string,
+    type: GetItemType | undefined,
+    opts: TransactionOptions | undefined,
+  ) => {
+    assertGetItemType(type);
+    if (isRawType(type)) {
+      const raw = driver.getItemRaw
+        ? await asyncCall(driver.getItemRaw, key, opts)
+        : deserializeRaw(await asyncCall(driver.getItem, key, opts));
+      return convertRaw(type, raw);
+    }
+    return convertValue(type, await asyncCall(driver.getItem, key, opts));
+  };
+
   const storage: Storage = {
     // Item
     hasItem(key: string, opts = {}) {
@@ -157,44 +177,66 @@ export function createStorage<T extends StorageValue>(
       const { relativeKey, driver } = getMount(key);
       return asyncCall(driver.hasItem, relativeKey, opts);
     },
-    getItem(key: string, opts = {}) {
+    getItem(key: string, opts: TransactionOptions = {}) {
       key = normalizeKey(key);
       const { relativeKey, driver } = getMount(key);
-      return asyncCall(driver.getItem, relativeKey, opts).then(
-        (value) => destr(value) as StorageValue,
-      );
+      return readItem(driver, relativeKey, opts.type, omitType(opts));
     },
     getItems(
       items: (string | { key: string; options?: TransactionOptions })[],
       commonOptions = {},
     ) {
       return runBatch(items, commonOptions, (batch) => {
-        if (batch.driver.getItems) {
-          return asyncCall(
+        const typeOf = (item: BatchItem["items"][number]): GetItemType | undefined =>
+          item.options?.type;
+        const rawItems = batch.items.filter((item) => isRawType(typeOf(item)));
+        const plainItems = batch.items.filter((item) => !isRawType(typeOf(item)));
+
+        // Binary reads go one by one, next to the driver's batch read
+        const rawReads = rawItems.map((item) =>
+          readItem(batch.driver, item.relativeKey, typeOf(item), omitType(item.options)).then(
+            (value) => ({ index: item.index, key: item.key, value }),
+          ),
+        );
+
+        let plainReads: Promise<{ index: number; key: string; value: any }[]>;
+        if (plainItems.length === 0) {
+          plainReads = Promise.resolve([]);
+        } else if (batch.driver.getItems) {
+          plainReads = asyncCall(
             batch.driver.getItems,
-            batch.items.map((item) => ({
+            plainItems.map((item) => ({
               key: item.relativeKey,
-              options: item.options,
-            })),
-            commonOptions,
-          ).then((r) =>
-            r.map((item) => ({
-              key: joinKeys(batch.base, item.key),
-              value: destr(item.value),
+              options: omitType(item.options),
             })),
+            omitType(commonOptions),
+          ).then((results) =>
+            // Match by position: drivers may return keys that differ from the given ones
+            Promise.all(
+              results.map(async (result, position) => ({
+                index: plainItems[position]?.index ?? Number.MAX_SAFE_INTEGER,
+                key: joinKeys(batch.base, result.key),
+                value: await convertValue(
+                  plainItems[position] && typeOf(plainItems[position]),
+                  result.value,
+                ),
+              })),
+            ),
+          );
+        } else {
+          plainReads = Promise.all(
+            plainItems.map((item) =>
+              readItem(batch.driver, item.relativeKey, typeOf(item), omitType(item.options)).then(
+                (value) => ({ index: item.index, key: item.key, value }),
+              ),
+            ),
           );
         }
-        return Promise.all(
-          batch.items.map((item) => {
-            return asyncCall(batch.driver.getItem, item.relativeKey, item.options).then(
-              (value) => ({
-                key: item.key,
-                value: destr(value),
-              }),
-            );
-          }),
-        );
-      });
+
+        return Promise.all([plainReads, ...rawReads]).then(([plain, ...raw]) => [...plain, ...raw]);
+      }).then((results) =>
+        results.sort((a, b) => a.index - b.index).map(({ key, value }) => ({ key, value })),
+      );
     },
     getItemRaw(key, opts = {}) {
       key = normalizeKey(key);
diff --git a/src/types.ts b/src/types.ts
index 40f3988..b31d207 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -22,6 +22,47 @@ export type GetKeysOptions = TransactionOptions & {
   maxDepth?: number;
 };
 
+export type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
+export interface JSONObject {
+  [key: string]: JSONValue;
+}
+export interface JSONArray extends Array<JSONValue> {}
+
+/** Formats a stored value can be read in with the `type` option. */
+export interface GetItemTypeMap {
+  text: string;
+  json: JSONValue;
+  bytes: Uint8Array;
+  blob: Blob;
+  stream: ReadableStream<Uint8Array>;
+}
+
+export type GetItemType = keyof GetItemTypeMap;
+
+/** Options of `getItem()`. `type` is reserved and not forwarded to the driver. */
+export type GetItemOptions<Ty extends GetItemType = GetItemType> = TransactionOptions & {
+  type?: Ty;
+};
+
+/** Options of reads without a `type`. */
+type UntypedGetOptions = TransactionOptions & { type?: undefined };
+
+/** An entry of `getItems()`: a key or a key with per-item options. */
+export type GetItemsInput = string | { key: string; options?: GetItemOptions };
+
+type GetItemsEntryType<I, C> = I extends { options: { type: infer Ty extends GetItemType } }
+  ? Ty
+  : C extends { type: infer Ty extends GetItemType }
+    ? Ty
+    : undefined;
+
+type GetItemsValue<I, C, T> =
+  GetItemsEntryType<I, C> extends infer Ty
+    ? Ty extends GetItemType
+      ? GetItemTypeMap[Ty] | null
+      : T
+    : never;
+
 export interface DriverFlags {
   maxDepth?: boolean;
   ttl?: boolean;
@@ -112,20 +153,29 @@ export interface Storage<T extends StorageValue = StorageValue> {
   ): Promise<boolean>;
   hasItem(key: string, opts?: TransactionOptions): Promise<boolean>;
 
+  getItem<Ty extends GetItemType>(
+    key: string,
+    opts: TransactionOptions & { type: Ty },
+  ): Promise<GetItemTypeMap[Ty] | null>;
   getItem<U extends Extract<T, StorageDefinition>, K extends string & keyof StorageItemMap<U>>(
     key: K,
-    ops?: TransactionOptions,
+    ops?: UntypedGetOptions,
   ): Promise<StorageItemType<T, K> | null>;
-  getItem<R = StorageItemType<T, string>>(
+  getItem<R = StorageItemType<T, string>>(key: string, opts?: UntypedGetOptions): Promise<R | null>;
+  getItem(
     key: string,
-    opts?: TransactionOptions,
-  ): Promise<R | null>;
+    opts: GetItemOptions,
+  ): Promise<GetItemTypeMap[GetItemType] | StorageItemType<T, string> | null>;
 
   /** @experimental */
-  getItems: <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => Promise<{ key: string; value: U }[]>;
+  getItems<const Items extends readonly GetItemsInput[], C extends GetItemOptions = {}>(
+    items: Items,
+    commonOptions?: C,
+  ): Promise<{ key: string; value: GetItemsValue<Items[number], C, T> }[]>;
+  getItems<U extends T>(
+    items: (string | { key: string; options?: UntypedGetOptions })[],
+    commonOptions?: UntypedGetOptions,
+  ): Promise<{ key: string; value: U }[]>;
   /** @experimental See https://github.com/unjs/unstorage/issues/142 */
   getItemRaw: <T = any>(key: string, opts?: TransactionOptions) => Promise<MaybeDefined<T> | null>;
 
diff --git a/src/utils.ts b/src/utils.ts
index eb44352..c733b34 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -56,19 +56,19 @@ export function prefixStorage<T extends StorageValue>(
       }
     });
 
-  nsStorage.getItems = async <U extends T>(
+  nsStorage.getItems = (async (
     items: (string | { key: string; options?: TransactionOptions })[],
     commonOptions?: TransactionOptions,
   ) => {
     const prefixedItems = items.map((item) =>
       typeof item === "string" ? base + item : { ...item, key: base + item.key },
     );
-    const results = await storage.getItems<U>(prefixedItems, commonOptions);
+    const results = await storage.getItems(prefixedItems, commonOptions);
     return results.map((entry) => ({
       key: entry.key.slice(base.length),
       value: entry.value,
     }));
-  };
+  }) as typeof nsStorage.getItems;
 
   nsStorage.setItems = async <U extends T>(
     items: { key: string; value: U; options?: TransactionOptions }[],
diff --git a/test/get-item-type.test.ts b/test/get-item-type.test.ts
new file mode 100644
index 0000000..57a5f11
--- /dev/null
+++ b/test/get-item-type.test.ts
@@ -0,0 +1,143 @@
+import { describe, it, expect } from "vitest";
+import { createStorage, type Driver } from "../src/index.ts";
+import memory from "../src/drivers/memory.ts";
+
+const bytesOf = (s: string) => new TextEncoder().encode(s);
+
+describe("getItem type option", () => {
+  it("reads in the requested format", async () => {
+    const storage = createStorage();
+    await storage.setItem("user", { a: 1 });
+    await storage.setItemRaw("bin", bytesOf("hello wörld"));
+    expect(await storage.getItem("user", { type: "text" })).toBe('{"a":1}');
+    expect(await storage.getItem("user", { type: "json" })).toEqual({ a: 1 });
+    expect(await storage.getItem("bin", { type: "text" })).toBe("hello wörld");
+    expect(await storage.getItem("nope", { type: "json" })).toBeNull();
+    expect(await storage.getItem("nope", { type: "stream" })).toBeNull();
+    expect(await storage.getItem("nope")).toBeNull();
+    const bytes = await storage.getItem("bin", { type: "bytes" });
+    expect(bytes).toEqual(bytesOf("hello wörld"));
+    const blob = await storage.getItem("bin", { type: "blob" });
+    expect(await blob!.text()).toBe("hello wörld");
+    const stream = await storage.getItem("bin", { type: "stream" });
+    expect(await new Response(stream!).text()).toBe("hello wörld");
+  });
+
+  it("decodes base64 strings from string-only drivers", async () => {
+    const data = new Map<string, string>();
+    const driver: Driver = {
+      hasItem: (k) => data.has(k),
+      getItem: (k) => data.get(k) as any,
+      setItem: (k, v) => void data.set(k, v),
+      getKeys: () => [...data.keys()],
+    };
+    const storage = createStorage({ driver });
+    await storage.setItemRaw("a", bytesOf('{"x":1}'));
+    expect(data.get("a")).toMatch(/^base64:/);
+    expect(await storage.getItem("a", { type: "json" })).toEqual({ x: 1 });
+    expect(await storage.getItem("a", { type: "bytes" })).toEqual(bytesOf('{"x":1}'));
+    expect(await storage.getItem("missing", { type: "bytes" })).toBeNull();
+  });
+
+  it("normalizes binary-like values and rejects others", async () => {
+    const storage = createStorage();
+    const expected = bytesOf("abc");
+    const values: any[] = [
+      expected,
+      Buffer.from("abc"),
+      expected.buffer,
+      new DataView(expected.buffer),
+      new Blob(["abc"]),
+      new Response("abc"),
+      new Response("abc").body,
+      (async function* () {
+        yield bytesOf("a");
+        yield "bc";
+      })(),
+      "abc",
+    ];
+    for (const value of values) {
+      await storage.setItemRaw("k", value);
+      expect(await storage.getItem("k", { type: "bytes" })).toEqual(expected);
+    }
+    await storage.setItemRaw("k", true);
+    expect(await storage.getItem("k", { type: "bytes" })).toEqual(bytesOf("true"));
+    await storage.setItemRaw("k", { a: 1 });
+    expect(await storage.getItem("k", { type: "bytes" })).toEqual(bytesOf('{"a":1}'));
+    await storage.setItemRaw("k", new Map());
+    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow(
+      /Cannot convert `Map` to bytes/,
+    );
+    await storage.setItemRaw("k", Object.create(null, { x: { value: 1 } }));
+    await storage.setItemRaw("k", new (class {})());
+    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow(/`/);
+  });
+
+  it("returns blobs and streams as is and releases the lock on failure", async () => {
+    const storage = createStorage();
+    const blob = new Blob(["x"]);
+    const stream = new ReadableStream();
+    await storage.setItemRaw("b", blob);
+    await storage.setItemRaw("s", stream);
+    expect(await storage.getItem("b", { type: "blob" })).toBe(blob);
+    expect(await storage.getItem("s", { type: "stream" })).toBe(stream);
+
+    const failing = new ReadableStream({
+      pull(c) {
+        c.error(new Error("boom"));
+      },
+    });
+    await storage.setItemRaw("f", failing);
+    await expect(storage.getItem("f", { type: "bytes" })).rejects.toThrow("boom");
+    expect(failing.locked).toBe(false);
+  });
+
+  it("does not forward type to the driver and maps undefined to null", async () => {
+    let seen: any;
+    const driver: Driver = {
+      hasItem: () => false,
+      getItem: (_k, opts) => ((seen = opts), undefined as any),
+      getKeys: () => [],
+    };
+    const storage = createStorage({ driver });
+    expect(await storage.getItem("a", { type: "text", foo: 1 })).toBeNull();
+    expect(seen).toEqual({ foo: 1 });
+    expect(await storage.getItem("a")).toBeNull();
+  });
+
+  it("supports type in getItems in input order across mounts", async () => {
+    const storage = createStorage();
+    storage.mount("m", memory());
+    await storage.setItem("a", "1");
+    await storage.setItem("m:b", { x: 1 });
+    await storage.setItemRaw("c", bytesOf("hi"));
+    await storage.setItemRaw("m:d", bytesOf("yo"));
+    const res = await storage.getItems(
+      [
+        "a",
+        { key: "m:b", options: { type: "text" } },
+        "c",
+        { key: "m:d", options: { type: "bytes" } },
+      ],
+      { type: "json" },
+    );
+    expect(res).toEqual([
+      { key: "a", value: 1 },
+      { key: "m:b", value: '{"x":1}' },
+      { key: "c", value: "hi" },
+      { key: "m:d", value: bytesOf("yo") },
+    ]);
+  });
+
+  it("applies type by position when the driver renames keys", async () => {
+    const driver: Driver = {
+      hasItem: () => false,
+      getItem: () => null,
+      getKeys: () => [],
+      getItems: (items) => items.map((i) => ({ key: `x/${i.key}`, value: '{"a":1}' })),
+    };
+    const storage = createStorage({ driver });
+    const res = await storage.getItems(["a", { key: "b", options: { type: "text" } }]);
+    expect(res.map((r) => r.value)).toEqual([{ a: 1 }, '{"a":1}']);
+  });
+});
diff --git a/test/storage.test-d.ts b/test/storage.test-d.ts
index 9d8933c..3fc689e 100644
--- a/test/storage.test-d.ts
+++ b/test/storage.test-d.ts
@@ -1,6 +1,6 @@
 import { describe, it, expectTypeOf } from "vitest";
 import { createStorage, prefixStorage } from "../src/index.ts";
-import type { Storage, StorageValue } from "../src/index.ts";
+import type { JSONValue, Storage, StorageValue } from "../src/index.ts";
 
 describe("types", () => {
   it("default types for storage", async () => {
@@ -81,3 +81,47 @@ describe("types", () => {
     expectTypeOf(prefixedStorage3).toEqualTypeOf<Storage<number>>();
   });
 });
+
+describe("getItem type option", () => {
+  it("narrows by type", async () => {
+    const storage = createStorage();
+
+    expectTypeOf(await storage.getItem("k", { type: "text" })).toEqualTypeOf<string | null>();
+    expectTypeOf(await storage.get("k", { type: "json" })).toEqualTypeOf<JSONValue | null>();
+    expectTypeOf(await storage.getItem("k", { type: "bytes" })).toEqualTypeOf<Uint8Array | null>();
+    expectTypeOf(await storage.getItem("k", { type: "blob" })).toEqualTypeOf<Blob | null>();
+    expectTypeOf(
+      await storage.getItem("k", { type: "stream" }),
+    ).toEqualTypeOf<ReadableStream<Uint8Array> | null>();
+    expectTypeOf(await storage.getItem("k", { ttl: 1 })).toEqualTypeOf<StorageValue | null>();
+
+    // @ts-expect-error unknown type
+    await storage.getItem("k", { type: "buffer" });
+  });
+
+  it("narrows getItems", async () => {
+    const storage = createStorage();
+
+    expectTypeOf(await storage.getItems(["a"], { type: "text" })).toEqualTypeOf<
+      { key: string; value: string | null }[]
+    >();
+    expectTypeOf(await storage.getItems(["a"])).toEqualTypeOf<
+      { key: string; value: StorageValue }[]
+    >();
+    expectTypeOf(await storage.getItems([{ key: "a", options: { type: "bytes" } }])).toEqualTypeOf<
+      { key: string; value: Uint8Array | null }[]
+    >();
+    expectTypeOf(
+      await storage.getItems([
+        { key: "a", options: { type: "bytes" } },
+        { key: "b", options: { type: "json" } },
+      ]),
+    ).toEqualTypeOf<{ key: string; value: JSONValue | Uint8Array | null }[]>();
+    expectTypeOf(
+      await storage.getItems([{ key: "a", options: { type: "blob" } }, "b"], { type: "text" }),
+    ).toEqualTypeOf<{ key: string; value: Blob | string | null }[]>();
+
+    // @ts-expect-error unknown type
+    await storage.getItems([{ key: "a", options: { type: "buffer" } }]);
+  });
+});
```

</details>

<details><summary>reply</summary>

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

</details>

### claude, hush: FAIL

Files: [docs/1.guide/1.index.md](../hush/claude/ts-unstorage-get-item-type-1/files/docs/1.guide/1.index.md), [src/_utils.ts](../hush/claude/ts-unstorage-get-item-type-1/files/src/_utils.ts), [src/storage.ts](../hush/claude/ts-unstorage-get-item-type-1/files/src/storage.ts), [src/tracing.ts](../hush/claude/ts-unstorage-get-item-type-1/files/src/tracing.ts), [src/types.ts](../hush/claude/ts-unstorage-get-item-type-1/files/src/types.ts), [src/utils.ts](../hush/claude/ts-unstorage-get-item-type-1/files/src/utils.ts), [test/get-item-type.test.ts](../hush/claude/ts-unstorage-get-item-type-1/files/test/get-item-type.test.ts), [test/storage.test-d.ts](../hush/claude/ts-unstorage-get-item-type-1/files/test/storage.test-d.ts)

<details><summary>diff</summary>

```diff
diff --git a/docs/1.guide/1.index.md b/docs/1.guide/1.index.md
index 5b54950..056040c 100644
--- a/docs/1.guide/1.index.md
+++ b/docs/1.guide/1.index.md
@@ -68,6 +68,20 @@ const value = await storage.getItem("user:1");
 
 Alias: `storage.get()`.
 
+Pass `type` to read the value in a specific format. A missing key gives `null` for every type.
+
+```ts
+await storage.getItem("user:1", { type: "text" }); // string
+await storage.getItem("user:1", { type: "json" }); // JSONValue
+await storage.getItem("avatar.png", { type: "bytes" }); // Uint8Array
+await storage.getItem("avatar.png", { type: "blob" }); // Blob
+await storage.getItem("avatar.png", { type: "stream" }); // ReadableStream<Uint8Array>
+```
+
+- `bytes`, `blob` and `stream` read the driver's raw value (`getItemRaw`, or `getItem` with `base64:` strings decoded). A `Blob` or `ReadableStream` held by the driver is returned as is for `blob` and `stream`. Other binary-like values (`Uint8Array`, `Buffer`, `ArrayBuffer`, `DataView`, `Response`, async iterables, strings as UTF-8) are normalized. Numbers, booleans, plain objects and arrays use their text form. Anything else, such as a `Map`, throws.
+- `text` and `json` also decode values written with `setItemRaw()`. `json` is lenient: a plain string stays a string.
+- `type` is reserved and not forwarded to the driver.
+
 #### `getItems(items, commonOptions?)`
 
 ::warning
@@ -84,6 +98,12 @@ const items = await storage.getItems([
 // [{ key: "user:1", value: ... }, { key: "user:2", value: ... }]
 ```
 
+`type` works in the common options and per item (`{ key, options: { type } }`); a per-item `type` overrides the common one. Results keep input order.
+
+```ts
+await storage.getItems(["a", { key: "b", options: { type: "bytes" } }], { type: "text" });
+```
+
 ### Writing values
 
 #### `setItem(key, value, options?)`
diff --git a/src/_utils.ts b/src/_utils.ts
index e19ef0a..ee03b5d 100644
--- a/src/_utils.ts
+++ b/src/_utils.ts
@@ -1,3 +1,5 @@
+import { destr } from "destr";
+
 type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;
 type Promisified<T> = Promise<Awaited<T>>;
 
@@ -80,3 +82,151 @@ function base64Encode(input: Uint8Array) {
   }
   return globalThis.btoa(String.fromCodePoint(...input));
 }
+
+const textEncoder = /* @__PURE__ */ new TextEncoder();
+const textDecoder = /* @__PURE__ */ new TextDecoder();
+
+function isPlainValue(value: any): boolean {
+  const type = typeof value;
+  return (
+    type === "number" ||
+    type === "boolean" ||
+    (type === "object" && value !== null && (Array.isArray(value) || isPureObject(value)))
+  );
+}
+
+function asUint8Array(value: Uint8Array): Uint8Array {
+  // Normalize subclasses such as `Buffer` without copying
+  return value.constructor === Uint8Array
+    ? value
+    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+}
+
+async function drainStream(stream: ReadableStream): Promise<Uint8Array> {
+  const reader = stream.getReader();
+  const chunks: Uint8Array[] = [];
+  try {
+    while (true) {
+      const { done, value } = await reader.read();
+      if (done) {
+        break;
+      }
+      chunks.push((await toBytes(value))!);
+    }
+  } finally {
+    reader.releaseLock();
+  }
+  return concatBytes(chunks);
+}
+
+async function drainIterable(iterable: AsyncIterable<unknown>): Promise<Uint8Array> {
+  const chunks: Uint8Array[] = [];
+  for await (const chunk of iterable) {
+    chunks.push((await toBytes(chunk))!);
+  }
+  return concatBytes(chunks);
+}
+
+function concatBytes(chunks: Uint8Array[]): Uint8Array {
+  if (chunks.length === 1) {
+    return chunks[0]!;
+  }
+  const result = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.byteLength, 0));
+  let offset = 0;
+  for (const chunk of chunks) {
+    result.set(chunk, offset);
+    offset += chunk.byteLength;
+  }
+  return result;
+}
+
+/** Normalizes any binary-like value to a `Uint8Array`. */
+export async function toBytes(value: any): Promise<Uint8Array | null> {
+  if (value === null || value === undefined) {
+    return null;
+  }
+  if (typeof value === "string") {
+    return textEncoder.encode(value);
+  }
+  if (value instanceof Uint8Array) {
+    return asUint8Array(value);
+  }
+  if (value instanceof ArrayBuffer) {
+    return new Uint8Array(value);
+  }
+  if (ArrayBuffer.isView(value)) {
+    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+  }
+  if (typeof Blob !== "undefined" && value instanceof Blob) {
+    return new Uint8Array(await value.arrayBuffer());
+  }
+  if (typeof Response !== "undefined" && value instanceof Response) {
+    return new Uint8Array(await value.arrayBuffer());
+  }
+  if (typeof ReadableStream !== "undefined" && value instanceof ReadableStream) {
+    return drainStream(value);
+  }
+  if (typeof value[Symbol.asyncIterator] === "function") {
+    return drainIterable(value);
+  }
+  if (isPlainValue(value)) {
+    return textEncoder.encode(stringify(value));
+  }
+  const name = (typeof value === "object" && value.constructor?.name) || "Object";
+  throw new Error(`[unstorage] Cannot convert \`${name}\` to bytes`);
+}
+
+async function toText(value: any): Promise<string> {
+  if (typeof value === "string") {
+    return value.startsWith(BASE64_PREFIX)
+      ? textDecoder.decode(base64Decode(value.slice(BASE64_PREFIX.length)))
+      : value;
+  }
+  if (isPlainValue(value)) {
+    return stringify(value);
+  }
+  return textDecoder.decode((await toBytes(value))!);
+}
+
+/** Converts a value read through the driver's `getItem` to a `text`, `json` or untyped item. */
+export async function convertText(value: any, type: "text" | "json" | undefined): Promise<any> {
+  if (value === null || value === undefined) {
+    return null;
+  }
+  if (type === "text") {
+    return toText(value);
+  }
+  if (type === "json") {
+    return typeof value === "string" || !isPlainValue(value) ? destr(await toText(value)) : value;
+  }
+  return destr(value);
+}
+
+/** Converts a raw driver value to a `bytes`, `blob` or `stream` item. */
+export async function convertBinary(value: any, type: "bytes" | "blob" | "stream"): Promise<any> {
+  if (value === null || value === undefined) {
+    return null;
+  }
+  if (type === "blob") {
+    if (typeof Blob !== "undefined" && value instanceof Blob) {
+      return value;
+    }
+    return new Blob([(await toBytes(value))! as BlobPart]);
+  }
+  if (type === "stream") {
+    if (typeof ReadableStream !== "undefined" && value instanceof ReadableStream) {
+      return value;
+    }
+    if (typeof Blob !== "undefined" && value instanceof Blob) {
+      return value.stream();
+    }
+    const bytes = (await toBytes(value))!;
+    return new ReadableStream<Uint8Array>({
+      start(controller) {
+        controller.enqueue(bytes);
+        controller.close();
+      },
+    });
+  }
+  return toBytes(value);
+}
diff --git a/src/storage.ts b/src/storage.ts
index 0c25ad8..054791c 100644
--- a/src/storage.ts
+++ b/src/storage.ts
@@ -7,9 +7,19 @@ import type {
   StorageValue,
   WatchEvent,
   TransactionOptions,
+  GetItemOptions,
+  GetItemType,
+  GetItemsInput,
 } from "./types.ts";
 import memory from "./drivers/memory.ts";
-import { asyncCall, deserializeRaw, serializeRaw, stringify } from "./_utils.ts";
+import {
+  asyncCall,
+  convertBinary,
+  convertText,
+  deserializeRaw,
+  serializeRaw,
+  stringify,
+} from "./_utils.ts";
 import {
   normalizeKey,
   normalizeBaseKey,
@@ -30,6 +40,21 @@ export interface CreateStorageOptions {
   driver?: Driver;
 }
 
+const binaryTypes = new Set<unknown>(["bytes", "blob", "stream"]);
+
+function isBinaryType(type: unknown): type is "bytes" | "blob" | "stream" {
+  return binaryTypes.has(type);
+}
+
+// `type` is reserved for the read format and never forwarded to drivers
+function splitType(opts: GetItemOptions | undefined): {
+  type: GetItemType | undefined;
+  options: TransactionOptions;
+} {
+  const { type, ...options } = opts || {};
+  return { type, options };
+}
+
 export function createStorage<T extends StorageValue>(
   options: CreateStorageOptions = {},
 ): Storage<T> {
@@ -106,6 +131,7 @@ export function createStorage<T extends StorageValue>(
     driver: Driver;
     base: string;
     items: {
+      index: number;
       key: string;
       relativeKey: string;
       value?: StorageValue;
@@ -114,7 +140,10 @@ export function createStorage<T extends StorageValue>(
   };
 
   const runBatch = (
-    items: (string | { key: string; value?: StorageValue; options?: TransactionOptions })[],
+    items: readonly (
+      | string
+      | { key: string; value?: StorageValue; options?: TransactionOptions }
+    )[],
     commonOptions: undefined | TransactionOptions,
     cb: (batch: BatchItem) => Promise<any>,
   ) => {
@@ -132,7 +161,7 @@ export function createStorage<T extends StorageValue>(
       return batch;
     };
 
-    for (const item of items) {
+    for (const [index, item] of items.entries()) {
       const isStringItem = typeof item === "string";
       const key = normalizeKey(isStringItem ? item : item.key);
       const value = isStringItem ? undefined : item.value;
@@ -140,6 +169,7 @@ export function createStorage<T extends StorageValue>(
         isStringItem || !item.options ? commonOptions : { ...commonOptions, ...item.options };
       const mount = getMount(key);
       getBatch(mount).items.push({
+        index,
         key,
         value,
         relativeKey: mount.relativeKey,
@@ -150,6 +180,26 @@ export function createStorage<T extends StorageValue>(
     return Promise.all([...batches.values()].map((batch) => cb(batch))).then((r) => r.flat());
   };
 
+  const readRaw = (driver: Driver, key: string, opts: TransactionOptions) => {
+    if (driver.getItemRaw) {
+      return asyncCall(driver.getItemRaw, key, opts);
+    }
+    return asyncCall(driver.getItem, key, opts).then((value) => deserializeRaw(value));
+  };
+
+  const readItem = (
+    driver: Driver,
+    key: string,
+    type: GetItemType | undefined,
+    opts: TransactionOptions,
+  ) =>
+    isBinaryType(type)
+      ? readRaw(driver, key, opts).then((value) => convertBinary(value, type))
+      : asyncCall(driver.getItem, key, opts).then((value) => convertText(value, type));
+
+  const convertValue = (value: unknown, type: GetItemType | undefined) =>
+    isBinaryType(type) ? convertBinary(value, type) : convertText(value, type);
+
   const storage: Storage = {
     // Item
     hasItem(key: string, opts = {}) {
@@ -157,52 +207,69 @@ export function createStorage<T extends StorageValue>(
       const { relativeKey, driver } = getMount(key);
       return asyncCall(driver.hasItem, relativeKey, opts);
     },
-    getItem(key: string, opts = {}) {
+    getItem(key: string, opts: GetItemOptions = {}): Promise<any> {
       key = normalizeKey(key);
       const { relativeKey, driver } = getMount(key);
-      return asyncCall(driver.getItem, relativeKey, opts).then(
-        (value) => destr(value) as StorageValue,
-      );
+      const { type, options } = splitType(opts);
+      return readItem(driver, relativeKey, type, options);
     },
-    getItems(
-      items: (string | { key: string; options?: TransactionOptions })[],
-      commonOptions = {},
-    ) {
-      return runBatch(items, commonOptions, (batch) => {
-        if (batch.driver.getItems) {
-          return asyncCall(
-            batch.driver.getItems,
-            batch.items.map((item) => ({
-              key: item.relativeKey,
-              options: item.options,
-            })),
-            commonOptions,
-          ).then((r) =>
-            r.map((item) => ({
-              key: joinKeys(batch.base, item.key),
-              value: destr(item.value),
-            })),
-          );
-        }
-        return Promise.all(
-          batch.items.map((item) => {
-            return asyncCall(batch.driver.getItem, item.relativeKey, item.options).then(
-              (value) => ({
-                key: item.key,
-                value: destr(value),
-              }),
+    async getItems(items: readonly GetItemsInput[], commonOptions: GetItemOptions = {}) {
+      const results = await runBatch(items, commonOptions, async (batch) => {
+        const typed = batch.items.map((item) => ({ item, ...splitType(item.options) }));
+        const binary = typed.filter(({ type }) => isBinaryType(type));
+        const rest = typed.filter(({ type }) => !isBinaryType(type));
+        const read = (entry: (typeof typed)[number], value: StorageValue, key = entry.item.key) =>
+          convertValue(value, entry.type).then((value) => ({
+            index: entry.item.index,
+            key,
+            value,
+          }));
+
+        const tasks: Promise<{ index: number; key: string; value: any }[]>[] = [
+          Promise.all(
+            binary.map((entry) =>
+              readRaw(batch.driver, entry.item.relativeKey, entry.options).then((value) =>
+                read(entry, value),
+              ),
+            ),
+          ),
+        ];
+        if (rest.length > 0) {
+          if (batch.driver.getItems) {
+            tasks.push(
+              asyncCall(
+                batch.driver.getItems,
+                rest.map(({ item, options }) => ({ key: item.relativeKey, options })),
+                splitType(commonOptions).options,
+              ).then((r) =>
+                // Match by position, drivers may return different keys
+                Promise.all(
+                  rest.map((entry, i) =>
+                    read(entry, r[i]?.value as StorageValue, joinKeys(batch.base, r[i]?.key ?? "")),
+                  ),
+                ),
+              ),
             );
-          }),
-        );
+          } else {
+            tasks.push(
+              Promise.all(
+                rest.map((entry) =>
+                  asyncCall(batch.driver.getItem, entry.item.relativeKey, entry.options).then(
+                    (value) => read(entry, value),
+                  ),
+                ),
+              ),
+            );
+          }
+        }
+        return (await Promise.all(tasks)).flat();
       });
+      return results.sort((a, b) => a.index - b.index).map(({ key, value }) => ({ key, value }));
     },
     getItemRaw(key, opts = {}) {
       key = normalizeKey(key);
       const { relativeKey, driver } = getMount(key);
-      if (driver.getItemRaw) {
-        return asyncCall(driver.getItemRaw, relativeKey, opts);
-      }
-      return asyncCall(driver.getItem, relativeKey, opts).then((value) => deserializeRaw(value));
+      return readRaw(driver, relativeKey, opts);
     },
     async setItem(key: string, value: T, opts = {}) {
       if (value === undefined) {
diff --git a/src/tracing.ts b/src/tracing.ts
index cd7401d..e83e574 100644
--- a/src/tracing.ts
+++ b/src/tracing.ts
@@ -133,7 +133,9 @@ export function withTracing<T extends StorageValue>(storage: MaybeTracedStorage<
       return normalizer(typeof i === "string" ? i : i.key);
     };
 
-    return Array.isArray(keyArg) ? keyArg.map((i) => getKeyValue(i)) : [getKeyValue(keyArg)];
+    return Array.isArray(keyArg)
+      ? (keyArg as (string | { key: string })[]).map((i) => getKeyValue(i))
+      : [getKeyValue(keyArg as string)];
   };
 
   function wrapOperation<
diff --git a/src/types.ts b/src/types.ts
index 40f3988..cc6464e 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -18,6 +18,36 @@ export interface StorageMeta {
 // TODO: type ttl
 export type TransactionOptions = Record<string, any>;
 
+export type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
+export type JSONObject = { [key: string]: JSONValue };
+export type JSONArray = JSONValue[];
+
+/** Formats `getItem()` and `getItems()` can read a value as. */
+export interface GetItemTypeMap {
+  text: string;
+  json: JSONValue;
+  bytes: Uint8Array;
+  blob: Blob;
+  stream: ReadableStream<Uint8Array>;
+}
+
+export type GetItemType = keyof GetItemTypeMap;
+
+export type GetItemOptions<K extends GetItemType = GetItemType> = TransactionOptions & {
+  /** Format to read the value as. Not forwarded to the driver. */
+  type?: K;
+};
+
+export type GetItemsInput<K extends GetItemType = GetItemType> =
+  | string
+  | { key: string; options?: GetItemOptions<K> };
+
+type ItemValueType<I, C> = I extends { options: { type: infer K extends GetItemType } }
+  ? GetItemTypeMap[K] | null
+  : C extends { type: infer K extends GetItemType }
+    ? GetItemTypeMap[K] | null
+    : StorageValue;
+
 export type GetKeysOptions = TransactionOptions & {
   maxDepth?: number;
 };
@@ -112,20 +142,24 @@ export interface Storage<T extends StorageValue = StorageValue> {
   ): Promise<boolean>;
   hasItem(key: string, opts?: TransactionOptions): Promise<boolean>;
 
+  getItem<K extends GetItemType>(
+    key: string,
+    opts: TransactionOptions & { type: K },
+  ): Promise<GetItemTypeMap[K] | null>;
   getItem<U extends Extract<T, StorageDefinition>, K extends string & keyof StorageItemMap<U>>(
     key: K,
-    ops?: TransactionOptions,
+    ops?: TransactionOptions & { type?: undefined },
   ): Promise<StorageItemType<T, K> | null>;
   getItem<R = StorageItemType<T, string>>(
     key: string,
-    opts?: TransactionOptions,
+    opts?: TransactionOptions & { type?: undefined },
   ): Promise<R | null>;
 
   /** @experimental */
-  getItems: <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => Promise<{ key: string; value: U }[]>;
+  getItems: <I extends readonly GetItemsInput[], C extends GetItemOptions | undefined = undefined>(
+    items: I,
+    commonOptions?: C,
+  ) => Promise<{ key: string; value: ItemValueType<I[number], C> }[]>;
   /** @experimental See https://github.com/unjs/unstorage/issues/142 */
   getItemRaw: <T = any>(key: string, opts?: TransactionOptions) => Promise<MaybeDefined<T> | null>;
 
diff --git a/src/utils.ts b/src/utils.ts
index eb44352..9694e1f 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,4 +1,10 @@
-import type { Storage, StorageValue, TransactionOptions } from "./types.ts";
+import type {
+  GetItemOptions,
+  GetItemsInput,
+  Storage,
+  StorageValue,
+  TransactionOptions,
+} from "./types.ts";
 
 type StorageKeys = Array<keyof Storage>;
 
@@ -56,19 +62,16 @@ export function prefixStorage<T extends StorageValue>(
       }
     });
 
-  nsStorage.getItems = async <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => {
+  nsStorage.getItems = (async (items: readonly GetItemsInput[], commonOptions?: GetItemOptions) => {
     const prefixedItems = items.map((item) =>
       typeof item === "string" ? base + item : { ...item, key: base + item.key },
     );
-    const results = await storage.getItems<U>(prefixedItems, commonOptions);
+    const results = await storage.getItems(prefixedItems, commonOptions);
     return results.map((entry) => ({
       key: entry.key.slice(base.length),
       value: entry.value,
     }));
-  };
+  }) as Storage<T>["getItems"];
 
   nsStorage.setItems = async <U extends T>(
     items: { key: string; value: U; options?: TransactionOptions }[],
diff --git a/test/get-item-type.test.ts b/test/get-item-type.test.ts
new file mode 100644
index 0000000..4534641
--- /dev/null
+++ b/test/get-item-type.test.ts
@@ -0,0 +1,178 @@
+import { describe, it, expect } from "vitest";
+import { createStorage } from "../src/index.ts";
+import memory from "../src/drivers/memory.ts";
+import type { Driver } from "../src/index.ts";
+
+const enc = (s: string) => new TextEncoder().encode(s);
+const dec = (b: Uint8Array) => new TextDecoder().decode(b);
+
+describe("getItem type", () => {
+  it("missing key and undefined give null", async () => {
+    const storage = createStorage();
+    for (const type of ["text", "json", "bytes", "blob", "stream"] as const) {
+      expect(await storage.getItem("nope", { type })).toBeNull();
+    }
+    const undef = createStorage({
+      driver: {
+        getItem: () => undefined as any,
+        hasItem: () => false,
+        getKeys: () => [],
+      } as Driver,
+    });
+    expect(await undef.getItem("x")).toBeNull();
+  });
+
+  it("text and json", async () => {
+    const storage = createStorage();
+    await storage.setItem("user", { a: 1 });
+    await storage.setItem("n", 12);
+    expect(await storage.getItem("user", { type: "text" })).toBe('{"a":1}');
+    expect(await storage.getItem("user", { type: "json" })).toEqual({ a: 1 });
+    expect(await storage.getItem("n", { type: "text" })).toBe("12");
+    await storage.setItem("s", "plain");
+    expect(await storage.getItem("s", { type: "json" })).toBe("plain");
+    expect(await storage.get("s", { type: "text" })).toBe("plain");
+  });
+
+  it("decodes setItemRaw values", async () => {
+    const storage = createStorage();
+    await storage.setItemRaw("a", enc("hello wörld"));
+    await storage.setItemRaw("j", enc('{"x":[1]}'));
+    expect(await storage.getItem("a", { type: "text" })).toBe("hello wörld");
+    expect(await storage.getItem("j", { type: "json" })).toEqual({ x: [1] });
+
+    const strings = new Map<string, string>();
+    const str = createStorage({
+      driver: {
+        hasItem: (k) => strings.has(k),
+        getItem: (k) => strings.get(k) ?? null,
+        setItem: (k, v) => void strings.set(k, v),
+        getKeys: () => [],
+      },
+    });
+    await str.setItemRaw("a", enc("hello wörld"));
+    expect(strings.get("a")).toMatch(/^base64:/);
+    expect(await str.getItem("a", { type: "text" })).toBe("hello wörld");
+    expect(dec((await str.getItem("a", { type: "bytes" }))!)).toBe("hello wörld");
+  });
+
+  it("bytes, blob, stream normalization", async () => {
+    const storage = createStorage();
+    const bytes = new Uint8Array([1, 2, 3]);
+    await storage.setItemRaw("b", Buffer.from(bytes));
+    const out = (await storage.getItem("b", { type: "bytes" }))!;
+    expect(out.constructor).toBe(Uint8Array);
+    expect([...out]).toEqual([1, 2, 3]);
+    const blob = (await storage.getItem("b", { type: "blob" }))!;
+    expect(blob).toBeInstanceOf(Blob);
+    expect(blob.size).toBe(3);
+    const stream = (await storage.getItem("b", { type: "stream" }))!;
+    expect(stream).toBeInstanceOf(ReadableStream);
+    expect([...new Uint8Array(await new Response(stream).arrayBuffer())]).toEqual([1, 2, 3]);
+  });
+
+  it("accepts many binary-like inputs", async () => {
+    const storage = createStorage();
+    const source = enc("abc");
+    const inputs: any[] = [
+      source.buffer.slice(0),
+      new DataView(source.buffer.slice(0)),
+      new Blob(["abc"]),
+      new Response("abc"),
+      new ReadableStream({
+        start(c) {
+          c.enqueue(enc("a"));
+          c.enqueue("bc");
+          c.close();
+        },
+      }),
+      (async function* () {
+        yield enc("ab");
+        yield enc("c");
+      })(),
+      "abc",
+    ];
+    for (const input of inputs) {
+      await storage.setItemRaw("k", input);
+      expect(dec((await storage.getItem("k", { type: "bytes" }))!)).toBe("abc");
+    }
+    await storage.setItemRaw("k", true);
+    expect(dec((await storage.getItem("k", { type: "bytes" }))!)).toBe("true");
+    await storage.setItemRaw("k", { a: 1 });
+    expect(dec((await storage.getItem("k", { type: "bytes" }))!)).toBe('{"a":1}');
+    await storage.setItemRaw("k", new Map());
+    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow(
+      "Cannot convert `Map` to bytes",
+    );
+  });
+
+  it("returns blob and stream as is", async () => {
+    const storage = createStorage();
+    const blob = new Blob(["x"]);
+    const stream = new ReadableStream();
+    await storage.setItemRaw("blob", blob);
+    await storage.setItemRaw("stream", stream);
+    expect(await storage.getItem("blob", { type: "blob" })).toBe(blob);
+    expect(await storage.getItem("stream", { type: "stream" })).toBe(stream);
+    expect(stream.locked).toBe(false);
+  });
+
+  it("releases the reader lock when a stream fails", async () => {
+    const storage = createStorage();
+    const stream = new ReadableStream({
+      pull(c) {
+        c.error(new Error("boom"));
+      },
+    });
+    await storage.setItemRaw("s", stream);
+    await expect(storage.getItem("s", { type: "bytes" })).rejects.toThrow("boom");
+    expect(stream.locked).toBe(false);
+  });
+
+  it("does not forward type to the driver", async () => {
+    const seen: any[] = [];
+    const storage = createStorage({
+      driver: {
+        hasItem: () => false,
+        getItem: (_k, o) => (seen.push(o), "v"),
+        getKeys: () => [],
+      },
+    });
+    await storage.getItem("a", { type: "text", foo: 1 });
+    expect(seen).toEqual([{ foo: 1 }]);
+  });
+});
+
+describe("getItems type", () => {
+  it("keeps order and per-item types", async () => {
+    const storage = createStorage();
+    storage.mount("m", memory());
+    await storage.setItem("a", { n: 1 });
+    await storage.setItem("m:b", { n: 2 });
+    await storage.setItem("c", { n: 3 });
+    const res = await storage.getItems(["a", { key: "m:b", options: { type: "bytes" } }, "c"], {
+      type: "text",
+    });
+    expect(res.map((r) => r.key)).toEqual(["a", "m:b", "c"]);
+    expect(res[0]!.value).toBe('{"n":1}');
+    expect(dec(res[1]!.value as Uint8Array)).toBe('{"n":2}');
+    expect(res[2]!.value).toBe('{"n":3}');
+    expect((await storage.getItems(["nope"], { type: "blob" }))[0]!.value).toBeNull();
+  });
+
+  it("applies type by position when driver keys differ", async () => {
+    const storage = createStorage({
+      driver: {
+        hasItem: () => false,
+        getItem: () => null,
+        getItems: (items) => items.map((i) => ({ key: i.key + "!", value: enc("hi") })),
+        getKeys: () => [],
+      },
+    });
+    const res = await storage.getItems(["a", "b"], { type: "text" });
+    expect(res).toEqual([
+      { key: "a!", value: "hi" },
+      { key: "b!", value: "hi" },
+    ]);
+  });
+});
diff --git a/test/storage.test-d.ts b/test/storage.test-d.ts
index 9d8933c..610cfed 100644
--- a/test/storage.test-d.ts
+++ b/test/storage.test-d.ts
@@ -1,6 +1,6 @@
 import { describe, it, expectTypeOf } from "vitest";
 import { createStorage, prefixStorage } from "../src/index.ts";
-import type { Storage, StorageValue } from "../src/index.ts";
+import type { JSONValue, Storage, StorageValue } from "../src/index.ts";
 
 describe("types", () => {
   it("default types for storage", async () => {
@@ -81,3 +81,36 @@ describe("types", () => {
     expectTypeOf(prefixedStorage3).toEqualTypeOf<Storage<number>>();
   });
 });
+
+describe("getItem type option", () => {
+  it("narrows return types", async () => {
+    const storage = createStorage();
+    expectTypeOf(await storage.getItem("k", { type: "text" })).toEqualTypeOf<string | null>();
+    expectTypeOf(await storage.get("k", { type: "json" })).toEqualTypeOf<JSONValue | null>();
+    expectTypeOf(await storage.getItem("k", { type: "bytes" })).toEqualTypeOf<Uint8Array | null>();
+    expectTypeOf(await storage.getItem("k", { type: "blob" })).toEqualTypeOf<Blob | null>();
+    expectTypeOf(
+      await storage.getItem("k", { type: "stream" }),
+    ).toEqualTypeOf<ReadableStream<Uint8Array> | null>();
+    // @ts-expect-error unknown type
+    await storage.getItem("k", { type: "buffer" });
+  });
+
+  it("narrows getItems", async () => {
+    const storage = createStorage();
+    expectTypeOf(await storage.getItems(["a"], { type: "text" })).toEqualTypeOf<
+      { key: string; value: string | null }[]
+    >();
+    expectTypeOf(
+      (await storage.getItems([{ key: "a", options: { type: "bytes" } }]))[0]!.value,
+    ).toEqualTypeOf<Uint8Array | null>();
+    expectTypeOf(
+      (
+        await storage.getItems(["a", { key: "a", options: { type: "bytes" } }], { type: "json" })
+      )[0]!.value,
+    ).toEqualTypeOf<JSONValue | Uint8Array | null>();
+    expectTypeOf((await storage.getItems(["a"]))[0]!.value).toEqualTypeOf<StorageValue>();
+    // @ts-expect-error unknown per-item type
+    await storage.getItems([{ key: "a", options: { type: "buffer" } }]);
+  });
+});
```

</details>

<details><summary>reply</summary>

Implementing now: types first, then the read helpers, then `storage.ts`.

Types.

The formatter touched `s3.ts`; revert that and filter errors to the ones I caused.

Only pre-existing errors remain. Adding tests.

Done. `type` now works on `getItem()`, `get()` and `getItems()`, with the types exported and the docs updated. New runtime and type tests pass, and the full vitest run passes. `tsc` and vitest still report 36 type errors, which I believe predate this change. They look like `TS2307` module-resolution errors in `src/_drivers.ts` plus errors in the R2 and `node-fs` drivers. I didn't run lint, and `oxfmt` didn't run clean (it rewrote `src/drivers/s3.ts`, which I reverted).

- **Netlify:** its `getItem` no longer receives `{ type: "arrayBuffer" }`, since `type` is stripped. `getItemRaw` still defaults to `arrayBuffer`.
- **Result order:** `getItems()` now returns results in input order. It used to return them grouped by mount.
- **Other edits:** `prefixStorage` and `tracing.ts` changed to match the new signatures, and `src/storage.ts` gained read helpers. The new tests are in `test/get-item-type.test.ts` and `test/storage.test-d.ts`.

</details>

### claude, sloth: FAIL

Files: [docs/1.guide/1.index.md](../sloth/claude/ts-unstorage-get-item-type-1/files/docs/1.guide/1.index.md), [src/_utils.ts](../sloth/claude/ts-unstorage-get-item-type-1/files/src/_utils.ts), [src/storage.ts](../sloth/claude/ts-unstorage-get-item-type-1/files/src/storage.ts), [src/types.ts](../sloth/claude/ts-unstorage-get-item-type-1/files/src/types.ts), [test/storage.test-d.ts](../sloth/claude/ts-unstorage-get-item-type-1/files/test/storage.test-d.ts), [test/storage.test.ts](../sloth/claude/ts-unstorage-get-item-type-1/files/test/storage.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/docs/1.guide/1.index.md b/docs/1.guide/1.index.md
index 5b54950..a4b0866 100644
--- a/docs/1.guide/1.index.md
+++ b/docs/1.guide/1.index.md
@@ -68,6 +68,20 @@ const value = await storage.getItem("user:1");
 
 Alias: `storage.get()`.
 
+Pass `type` to read the value in a specific format. A missing key gives `null` for every type.
+
+```ts
+await storage.getItem("user:1", { type: "text" }); // string
+await storage.getItem("user:1", { type: "json" }); // JSONValue
+await storage.getItem("avatar.png", { type: "bytes" }); // Uint8Array
+await storage.getItem("avatar.png", { type: "blob" }); // Blob
+await storage.getItem("avatar.png", { type: "stream" }); // ReadableStream<Uint8Array>
+```
+
+- `bytes`, `blob` and `stream` read the driver's raw value (like `getItemRaw`). Binary-like values (`Uint8Array`, `Buffer`, `ArrayBuffer`, `Blob`, `ReadableStream`, `Response`, async iterables) and strings (UTF-8) are accepted; a `Blob` or `ReadableStream` is returned as is for `blob` and `stream`.
+- `text` and `json` also decode values written with `setItemRaw()`. `json` is lenient: a plain string stays a string.
+- `type` is reserved and not forwarded to the driver.
+
 #### `getItems(items, commonOptions?)`
 
 ::warning
@@ -84,6 +98,13 @@ const items = await storage.getItems([
 // [{ key: "user:1", value: ... }, { key: "user:2", value: ... }]
 ```
 
+`type` can be set in the common options and per item (the per-item `type` wins). Results keep the input order.
+
+```ts
+await storage.getItems(["a", { key: "b", options: { type: "bytes" } }], { type: "text" });
+// [{ key: "a", value: string | null }, { key: "b", value: Uint8Array | null }]
+```
+
 ### Writing values
 
 #### `setItem(key, value, options?)`
@@ -263,6 +284,9 @@ const user = await storage.getItem<User>("user:1");
 
 const bytes = await storage.getItemRaw<Uint8Array>("logo");
 // Uint8Array | null
+
+const text = await storage.getItem("user:1", { type: "text" });
+// string | null
 ```
 
 ### Type the whole storage
diff --git a/src/_utils.ts b/src/_utils.ts
index e19ef0a..5a1cd49 100644
--- a/src/_utils.ts
+++ b/src/_utils.ts
@@ -1,3 +1,5 @@
+import { destr } from "destr";
+
 type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;
 type Promisified<T> = Promise<Awaited<T>>;
 
@@ -80,3 +82,132 @@ function base64Encode(input: Uint8Array) {
   }
   return globalThis.btoa(String.fromCodePoint(...input));
 }
+
+const isBinaryLike = (value: any): boolean =>
+  typeof value === "object" &&
+  value !== null &&
+  (ArrayBuffer.isView(value) ||
+    value instanceof ArrayBuffer ||
+    value instanceof Blob ||
+    value instanceof ReadableStream ||
+    (typeof Response !== "undefined" && value instanceof Response) ||
+    typeof value[Symbol.asyncIterator] === "function");
+
+const concatBytes = (chunks: Uint8Array[]): Uint8Array => {
+  const bytes = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
+  let offset = 0;
+  for (const chunk of chunks) {
+    bytes.set(chunk, offset);
+    offset += chunk.length;
+  }
+  return bytes;
+};
+
+/**
+ * Normalizes any binary-like or text-like value to a `Uint8Array`.
+ */
+export async function toBytes(value: any): Promise<Uint8Array> {
+  if (typeof value === "string") {
+    return new TextEncoder().encode(value);
+  }
+  if (value instanceof Uint8Array && value.constructor === Uint8Array) {
+    return value;
+  }
+  if (ArrayBuffer.isView(value)) {
+    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+  }
+  if (value instanceof ArrayBuffer) {
+    return new Uint8Array(value);
+  }
+  if (value instanceof Blob || (typeof Response !== "undefined" && value instanceof Response)) {
+    return new Uint8Array(await value.arrayBuffer());
+  }
+  if (value instanceof ReadableStream) {
+    const reader = value.getReader();
+    const chunks: Uint8Array[] = [];
+    try {
+      for (;;) {
+        const { done, value: chunk } = await reader.read();
+        if (done) {
+          break;
+        }
+        chunks.push(await toBytes(chunk));
+      }
+    } finally {
+      reader.releaseLock();
+    }
+    return concatBytes(chunks);
+  }
+  if (value && typeof value[Symbol.asyncIterator] === "function") {
+    const chunks: Uint8Array[] = [];
+    for await (const chunk of value) {
+      chunks.push(await toBytes(chunk));
+    }
+    return concatBytes(chunks);
+  }
+  if (
+    typeof value === "number" ||
+    typeof value === "boolean" ||
+    typeof value === "bigint" ||
+    Array.isArray(value) ||
+    (value && typeof value === "object" && isPureObject(value))
+  ) {
+    return new TextEncoder().encode(stringify(value));
+  }
+  throw new Error(
+    `[unstorage] Cannot convert \`${value?.constructor?.name || "Object"}\` to bytes`,
+  );
+}
+
+/**
+ * Converts a driver's raw value to the requested binary `type`.
+ * `Blob` and `ReadableStream` values are returned as is when asked for.
+ */
+export async function toBinaryType(value: any, type: "bytes" | "blob" | "stream"): Promise<any> {
+  if (value === null || value === undefined) {
+    return null;
+  }
+  if (type === "blob" && value instanceof Blob) {
+    return value;
+  }
+  if (type === "stream" && value instanceof ReadableStream) {
+    return value;
+  }
+  const bytes = await toBytes(value);
+  if (type === "bytes") {
+    return bytes;
+  }
+  if (type === "blob") {
+    return new Blob([bytes as BlobPart]);
+  }
+  return new ReadableStream<Uint8Array>({
+    start(controller) {
+      if (bytes.length > 0) {
+        controller.enqueue(bytes);
+      }
+      controller.close();
+    },
+  });
+}
+
+/**
+ * Converts a value returned by a driver's `getItem` for the `text`/`json` types
+ * (or no type), decoding `setItemRaw` values (`base64:` strings, binary).
+ */
+export async function toTextOrJson(value: any, type?: "text" | "json"): Promise<any> {
+  if (value === null || value === undefined) {
+    return null;
+  }
+  if (!type) {
+    return destr(value);
+  }
+  if (typeof value === "string" && value.startsWith(BASE64_PREFIX)) {
+    value = base64Decode(value.slice(BASE64_PREFIX.length));
+  }
+  if (isBinaryLike(value)) {
+    value = new TextDecoder().decode(await toBytes(value));
+  } else if (type === "text" && typeof value !== "string") {
+    value = stringify(value);
+  }
+  return type === "json" && typeof value === "string" ? destr(value) : value;
+}
diff --git a/src/storage.ts b/src/storage.ts
index 0c25ad8..52f540b 100644
--- a/src/storage.ts
+++ b/src/storage.ts
@@ -7,9 +7,17 @@ import type {
   StorageValue,
   WatchEvent,
   TransactionOptions,
+  GetItemType,
 } from "./types.ts";
 import memory from "./drivers/memory.ts";
-import { asyncCall, deserializeRaw, serializeRaw, stringify } from "./_utils.ts";
+import {
+  asyncCall,
+  deserializeRaw,
+  serializeRaw,
+  stringify,
+  toBinaryType,
+  toTextOrJson,
+} from "./_utils.ts";
 import {
   normalizeKey,
   normalizeBaseKey,
@@ -108,6 +116,7 @@ export function createStorage<T extends StorageValue>(
     items: {
       key: string;
       relativeKey: string;
+      index: number;
       value?: StorageValue;
       options?: TransactionOptions;
     }[];
@@ -132,7 +141,7 @@ export function createStorage<T extends StorageValue>(
       return batch;
     };
 
-    for (const item of items) {
+    for (const [index, item] of items.entries()) {
       const isStringItem = typeof item === "string";
       const key = normalizeKey(isStringItem ? item : item.key);
       const value = isStringItem ? undefined : item.value;
@@ -143,6 +152,7 @@ export function createStorage<T extends StorageValue>(
         key,
         value,
         relativeKey: mount.relativeKey,
+        index,
         options,
       });
     }
@@ -150,6 +160,25 @@ export function createStorage<T extends StorageValue>(
     return Promise.all([...batches.values()].map((batch) => cb(batch))).then((r) => r.flat());
   };
 
+  const binaryTypes = new Set<GetItemType | undefined>(["bytes", "blob", "stream"]);
+
+  const omitType = (opts: TransactionOptions = {}) => {
+    const { type: _type, ...rest } = opts;
+    return rest;
+  };
+
+  const readItem = async (driver: Driver, key: string, opts: TransactionOptions = {}) => {
+    const type: GetItemType | undefined = opts.type;
+    const driverOpts = omitType(opts);
+    if (type === "bytes" || type === "blob" || type === "stream") {
+      const raw = driver.getItemRaw
+        ? await asyncCall(driver.getItemRaw, key, driverOpts)
+        : deserializeRaw(await asyncCall(driver.getItem, key, driverOpts));
+      return toBinaryType(raw, type);
+    }
+    return toTextOrJson(await asyncCall(driver.getItem, key, driverOpts), type);
+  };
+
   const storage: Storage = {
     // Item
     hasItem(key: string, opts = {}) {
@@ -160,41 +189,47 @@ export function createStorage<T extends StorageValue>(
     getItem(key: string, opts = {}) {
       key = normalizeKey(key);
       const { relativeKey, driver } = getMount(key);
-      return asyncCall(driver.getItem, relativeKey, opts).then(
-        (value) => destr(value) as StorageValue,
-      );
+      return readItem(driver, relativeKey, opts);
     },
-    getItems(
+    async getItems(
       items: (string | { key: string; options?: TransactionOptions })[],
       commonOptions = {},
     ) {
-      return runBatch(items, commonOptions, (batch) => {
-        if (batch.driver.getItems) {
-          return asyncCall(
-            batch.driver.getItems,
-            batch.items.map((item) => ({
-              key: item.relativeKey,
-              options: item.options,
-            })),
-            commonOptions,
-          ).then((r) =>
-            r.map((item) => ({
-              key: joinKeys(batch.base, item.key),
-              value: destr(item.value),
-            })),
-          );
-        }
-        return Promise.all(
-          batch.items.map((item) => {
-            return asyncCall(batch.driver.getItem, item.relativeKey, item.options).then(
-              (value) => ({
-                key: item.key,
-                value: destr(value),
-              }),
-            );
-          }),
-        );
+      const results: { key: string; value: StorageValue }[] = [];
+      await runBatch(items, commonOptions, async (batch) => {
+        const store = (item: { index: number }, key: string, value: StorageValue) => {
+          results[item.index] = { key, value };
+        };
+        const readOne = async (item: (typeof batch.items)[number]) =>
+          store(item, item.key, await readItem(batch.driver, item.relativeKey, item.options));
+        const isBinary = (item: (typeof batch.items)[number]) =>
+          binaryTypes.has(item.options?.type);
+        const batched = batch.driver.getItems ? batch.items.filter((i) => !isBinary(i)) : [];
+        const single = batch.items.filter((i) => !batched.includes(i));
+        await Promise.all([
+          ...single.map(readOne),
+          batched.length > 0 &&
+            asyncCall(
+              batch.driver.getItems!,
+              batched.map((item) => ({
+                key: item.relativeKey,
+                options: omitType(item.options),
+              })),
+              omitType(commonOptions),
+            ).then((r) =>
+              Promise.all(
+                batched.map(async (item, i) =>
+                  store(
+                    item,
+                    joinKeys(batch.base, r[i]!.key),
+                    await toTextOrJson(r[i]!.value, item.options?.type),
+                  ),
+                ),
+              ),
+            ),
+        ]);
       });
+      return results;
     },
     getItemRaw(key, opts = {}) {
       key = normalizeKey(key);
diff --git a/src/types.ts b/src/types.ts
index 40f3988..b3d7b99 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -18,6 +18,45 @@ export interface StorageMeta {
 // TODO: type ttl
 export type TransactionOptions = Record<string, any>;
 
+export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
+export type JSONObject = { [key: string]: JSONValue };
+export type JSONArray = JSONValue[];
+
+/** Value type returned by `getItem()` for each `type` option. */
+export interface GetItemTypeMap {
+  text: string;
+  json: JSONValue;
+  bytes: Uint8Array;
+  blob: Blob;
+  stream: ReadableStream<Uint8Array>;
+}
+
+export type GetItemType = keyof GetItemTypeMap;
+
+export interface GetItemOptions<Ty extends GetItemType = GetItemType> {
+  [key: string]: any;
+  type?: Ty;
+}
+
+type UntypedGetOptions = TransactionOptions & { type?: never };
+
+export type GetItemsInput = string | { key: string; options?: GetItemOptions };
+
+type GetItemsItemType<Item, Common> = Item extends {
+  options: { type: infer Ty extends GetItemType };
+}
+  ? Ty
+  : Common extends { type: infer Ty extends GetItemType }
+    ? Ty
+    : undefined;
+
+type GetItemsValue<Item, Common, Fallback> =
+  GetItemsItemType<Item, Common> extends infer Ty
+    ? Ty extends GetItemType
+      ? GetItemTypeMap[Ty] | null
+      : Fallback
+    : never;
+
 export type GetKeysOptions = TransactionOptions & {
   maxDepth?: number;
 };
@@ -112,20 +151,27 @@ export interface Storage<T extends StorageValue = StorageValue> {
   ): Promise<boolean>;
   hasItem(key: string, opts?: TransactionOptions): Promise<boolean>;
 
+  getItem<Ty extends GetItemType>(
+    key: string,
+    opts: GetItemOptions<Ty> & { type: Ty },
+  ): Promise<GetItemTypeMap[Ty] | null>;
   getItem<U extends Extract<T, StorageDefinition>, K extends string & keyof StorageItemMap<U>>(
     key: K,
-    ops?: TransactionOptions,
+    ops?: UntypedGetOptions,
   ): Promise<StorageItemType<T, K> | null>;
-  getItem<R = StorageItemType<T, string>>(
-    key: string,
-    opts?: TransactionOptions,
-  ): Promise<R | null>;
+  getItem<R = StorageItemType<T, string>>(key: string, opts?: UntypedGetOptions): Promise<R | null>;
 
   /** @experimental */
-  getItems: <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => Promise<{ key: string; value: U }[]>;
+  getItems: {
+    <const I extends readonly GetItemsInput[], C extends GetItemOptions = {}>(
+      items: I,
+      commonOptions?: C,
+    ): Promise<{ key: string; value: GetItemsValue<I[number], C, StorageItemType<T, string>> }[]>;
+    <U extends T>(
+      items: (string | { key: string; options?: UntypedGetOptions })[],
+      commonOptions?: UntypedGetOptions,
+    ): Promise<{ key: string; value: U }[]>;
+  };
   /** @experimental See https://github.com/unjs/unstorage/issues/142 */
   getItemRaw: <T = any>(key: string, opts?: TransactionOptions) => Promise<MaybeDefined<T> | null>;
 
diff --git a/test/storage.test-d.ts b/test/storage.test-d.ts
index 9d8933c..cc24796 100644
--- a/test/storage.test-d.ts
+++ b/test/storage.test-d.ts
@@ -1,6 +1,6 @@
 import { describe, it, expectTypeOf } from "vitest";
 import { createStorage, prefixStorage } from "../src/index.ts";
-import type { Storage, StorageValue } from "../src/index.ts";
+import type { Storage, StorageValue, JSONValue } from "../src/index.ts";
 
 describe("types", () => {
   it("default types for storage", async () => {
@@ -80,4 +80,35 @@ describe("types", () => {
     const prefixedStorage3 = prefixStorage<number>(storage3, "foo");
     expectTypeOf(prefixedStorage3).toEqualTypeOf<Storage<number>>();
   });
+
+  it("getItem and getItems type option", async () => {
+    const storage = createStorage();
+
+    expectTypeOf(await storage.getItem("k", { type: "text" })).toEqualTypeOf<string | null>();
+    expectTypeOf(await storage.get("k", { type: "json" })).toEqualTypeOf<JSONValue | null>();
+    expectTypeOf(await storage.getItem("k", { type: "bytes" })).toEqualTypeOf<Uint8Array | null>();
+    expectTypeOf(await storage.getItem("k", { type: "blob" })).toEqualTypeOf<Blob | null>();
+    expectTypeOf(
+      await storage.getItem("k", { type: "stream" }),
+    ).toEqualTypeOf<ReadableStream<Uint8Array> | null>();
+    // @ts-expect-error unknown type
+    await storage.getItem("k", { type: "buffer" });
+
+    expectTypeOf(await storage.getItems(["a"], { type: "text" })).toEqualTypeOf<
+      { key: string; value: string | null }[]
+    >();
+    expectTypeOf(await storage.getItems([{ key: "a", options: { type: "bytes" } }])).toEqualTypeOf<
+      { key: string; value: Uint8Array | null }[]
+    >();
+    expectTypeOf(
+      await storage.getItems([{ key: "a", options: { type: "bytes" } }, "b"], { type: "json" }),
+    ).toEqualTypeOf<{ key: string; value: JSONValue | Uint8Array | null }[]>();
+    expectTypeOf(
+      await storage.getItems(["a", { key: "b", options: { type: "bytes" } }]),
+    ).toEqualTypeOf<{ key: string; value: StorageValue | Uint8Array | null }[]>();
+    // @ts-expect-error unknown per-item type
+    await storage.getItems([{ key: "a", options: { type: "buffer" } }]);
+    // @ts-expect-error unknown common type
+    await storage.getItems(["a"], { type: "buffer" });
+  });
 });
diff --git a/test/storage.test.ts b/test/storage.test.ts
index 8ad7b9f..5763348 100644
--- a/test/storage.test.ts
+++ b/test/storage.test.ts
@@ -293,4 +293,162 @@ describe("Regression", () => {
       { key: "key2", value: "value2" },
     ]);
   });
+
+  describe("getItem type option", () => {
+    const bytes = new TextEncoder().encode("hello wörld");
+    const drain = async (stream: ReadableStream<Uint8Array>) =>
+      new Uint8Array(await new Response(stream).arrayBuffer());
+
+    it("missing key and undefined give null", async () => {
+      const storage = createStorage({
+        driver: { ...memory(), getItem: () => undefined as any },
+      });
+      expect(await storage.getItem("x")).toBeNull();
+      for (const type of ["text", "json", "bytes", "blob", "stream"] as const) {
+        expect(await storage.getItem("x", { type })).toBeNull();
+        expect(await createStorage().getItem("x", { type })).toBeNull();
+      }
+    });
+
+    it("reads text, json, bytes, blob and stream", async () => {
+      const storage = createStorage();
+      await storage.setItem("user", { a: 1 });
+      expect(await storage.getItem("user", { type: "text" })).toBe('{"a":1}');
+      expect(await storage.get("user", { type: "json" })).toEqual({ a: 1 });
+      expect(await storage.getItem("user", { type: "bytes" })).toEqual(
+        new TextEncoder().encode('{"a":1}'),
+      );
+      const blob = await storage.getItem("user", { type: "blob" });
+      expect(await blob!.text()).toBe('{"a":1}');
+      expect(await drain((await storage.getItem("user", { type: "stream" }))!)).toEqual(
+        new TextEncoder().encode('{"a":1}'),
+      );
+    });
+
+    it("decodes raw values for text and json", async () => {
+      for (const driver of [
+        memory(),
+        { ...memory(), getItemRaw: undefined, setItemRaw: undefined },
+      ]) {
+        const storage = createStorage({ driver: driver as any });
+        await storage.setItemRaw("a", bytes);
+        expect(await storage.getItem("a", { type: "text" })).toBe("hello wörld");
+        expect(await storage.getItem("a", { type: "bytes" })).toEqual(bytes);
+        await storage.setItemRaw("j", new TextEncoder().encode('{"a":1}'));
+        expect(await storage.getItem("j", { type: "json" })).toEqual({ a: 1 });
+        await storage.setItem("s", "plain");
+        expect(await storage.getItem("s", { type: "json" })).toBe("plain");
+        expect(await storage.getItem("s", { type: "text" })).toBe("plain");
+      }
+    });
+
+    it("normalizes binary-like and plain values", async () => {
+      const values: Record<string, any> = {
+        buf: Buffer.from("hi"),
+        ab: bytes.buffer.slice(0) && new TextEncoder().encode("hi").buffer,
+        dv: new DataView(new TextEncoder().encode("hi").buffer),
+        blob: new Blob(["hi"]),
+        stream: new Blob(["hi"]).stream(),
+        res: new Response("hi"),
+        iter: (async function* () {
+          yield "h";
+          yield new TextEncoder().encode("i");
+        })(),
+        str: "hi",
+      };
+      for (const [key, value] of Object.entries(values)) {
+        const storage = createStorage({
+          driver: { ...memory(), getItemRaw: () => value },
+        });
+        const result = await storage.getItem(key, { type: "bytes" });
+        expect(result!.constructor).toBe(Uint8Array);
+        expect(new TextDecoder().decode(result!)).toBe("hi");
+      }
+      const plain = async (value: any) =>
+        createStorage({ driver: { ...memory(), getItemRaw: () => value } }).getItem("k", {
+          type: "bytes",
+        });
+      expect(new TextDecoder().decode((await plain(true))!)).toBe("true");
+      expect(new TextDecoder().decode((await plain({ a: 1 }))!)).toBe('{"a":1}');
+      expect(new TextDecoder().decode((await plain(12))!)).toBe("12");
+      await expect(plain(new Map())).rejects.toThrow("Cannot convert `Map` to bytes");
+      await expect(plain(Symbol("x"))).rejects.toThrow("Cannot convert `Symbol` to bytes");
+    });
+
+    it("returns Blob and ReadableStream as is, and releases lock on failure", async () => {
+      const blob = new Blob(["hi"]);
+      const stream = new Blob(["hi"]).stream();
+      const storage = createStorage({
+        driver: { ...memory(), getItemRaw: (key: string) => (key === "b" ? blob : stream) },
+      });
+      expect(await storage.getItem("b", { type: "blob" })).toBe(blob);
+      expect(await storage.getItem("s", { type: "stream" })).toBe(stream);
+
+      const failing = new ReadableStream({
+        pull(controller) {
+          controller.error(new Error("boom"));
+        },
+      });
+      const failingStorage = createStorage({
+        driver: { ...memory(), getItemRaw: () => failing },
+      });
+      await expect(failingStorage.getItem("k", { type: "bytes" })).rejects.toThrow("boom");
+      expect(failing.locked).toBe(false);
+    });
+
+    it("does not forward type to the driver", async () => {
+      const getItem = vi.fn(() => "v");
+      const storage = createStorage({ driver: { ...memory(), getItem } });
+      await storage.getItem("k", { type: "text", other: 1 });
+      expect(getItem).toHaveBeenCalledWith("k", { other: 1 });
+    });
+
+    it("getItems applies common and per-item types in order", async () => {
+      const storage = createStorage();
+      await storage.mount("m", memory()).setItem("m:a", { a: 1 });
+      await storage.setItem("b", "x");
+      await storage.setItemRaw("c", bytes);
+      const items = ["m:a", { key: "b", options: { type: "bytes" as const } }, "c", "none"];
+      const result = await storage.getItems(items, { type: "text" });
+      expect(result.map((r) => r.key)).toEqual(["m:a", "b", "c", "none"]);
+      expect(result.map((r) => r.value)).toEqual([
+        '{"a":1}',
+        new TextEncoder().encode("x"),
+        "hello wörld",
+        null,
+      ]);
+    });
+
+    it("getItems applies type by position when a driver changes keys", async () => {
+      const getItems = vi.fn((items: { key: string }[], common: any) => {
+        expect(common).toEqual({});
+        return items.map((i) => ({ key: "other-" + i.key, value: "base64:aGk=" }));
+      });
+      const storage = createStorage({ driver: { ...memory(), getItems } });
+      const result = await storage.getItems(["a", "b"], { type: "text" });
+      expect(result).toEqual([
+        { key: "other-a", value: "hi" },
+        { key: "other-b", value: "hi" },
+      ]);
+      expect(getItems.mock.calls[0]![0]).toEqual([
+        { key: "a", options: {} },
+        { key: "b", options: {} },
+      ]);
+    });
+
+    it("getItems reads binary items one by one next to a driver batch", async () => {
+      const getItems = vi.fn((items: { key: string }[]) =>
+        items.map((i) => ({ key: i.key, value: "t" })),
+      );
+      const getItemRaw = vi.fn(() => new TextEncoder().encode("raw"));
+      const storage = createStorage({ driver: { ...memory(), getItems, getItemRaw } });
+      const result = await storage.getItems(["a", { key: "b", options: { type: "bytes" } }]);
+      expect(result).toEqual([
+        { key: "a", value: "t" },
+        { key: "b", value: new TextEncoder().encode("raw") },
+      ]);
+      expect(getItems.mock.calls[0]![0]).toHaveLength(1);
+      expect(getItemRaw).toHaveBeenCalledTimes(1);
+    });
+  });
 });
```

</details>

<details><summary>reply</summary>

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

</details>

### claude, all: FAIL

Files: [docs/1.guide/1.index.md](../all/claude/ts-unstorage-get-item-type-1/files/docs/1.guide/1.index.md), [src/_utils.ts](../all/claude/ts-unstorage-get-item-type-1/files/src/_utils.ts), [src/storage.ts](../all/claude/ts-unstorage-get-item-type-1/files/src/storage.ts), [src/tracing.ts](../all/claude/ts-unstorage-get-item-type-1/files/src/tracing.ts), [src/types.ts](../all/claude/ts-unstorage-get-item-type-1/files/src/types.ts), [src/utils.ts](../all/claude/ts-unstorage-get-item-type-1/files/src/utils.ts), [test/storage.test-d.ts](../all/claude/ts-unstorage-get-item-type-1/files/test/storage.test-d.ts), [test/storage.test.ts](../all/claude/ts-unstorage-get-item-type-1/files/test/storage.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/docs/1.guide/1.index.md b/docs/1.guide/1.index.md
index 5b54950..052a4a2 100644
--- a/docs/1.guide/1.index.md
+++ b/docs/1.guide/1.index.md
@@ -66,6 +66,20 @@ Returns the deserialized value, or `null` when the key does not exist.
 const value = await storage.getItem("user:1");
 ```
 
+Set `options.type` to read the value in a specific format. The return type follows `type`, and a missing key gives `null` for every type.
+
+```ts
+await storage.getItem("user:1", { type: "text" }); // string
+await storage.getItem("user:1", { type: "json" }); // JSONValue
+await storage.getItem("avatar.png", { type: "bytes" }); // Uint8Array
+await storage.getItem("avatar.png", { type: "blob" }); // Blob
+await storage.getItem("avatar.png", { type: "stream" }); // ReadableStream<Uint8Array>
+```
+
+- `text` and `json` also decode values written with `setItemRaw()`. `json` is lenient: a plain string stays a string.
+- `bytes`, `blob` and `stream` read the driver's raw value (`getItemRaw`, or `getItem` for drivers without it, decoding `base64:` strings). Binary-like values (`Uint8Array`, `Buffer`, `ArrayBuffer`, `DataView`, `Blob`, `ReadableStream`, `Response`, async iterables) and strings (UTF-8) are accepted; a `Blob` or `ReadableStream` held by the driver is returned as is for `blob` and `stream`.
+- `type` is not forwarded to the driver.
+
 Alias: `storage.get()`.
 
 #### `getItems(items, commonOptions?)`
@@ -84,6 +98,14 @@ const items = await storage.getItems([
 // [{ key: "user:1", value: ... }, { key: "user:2", value: ... }]
 ```
 
+`type` can be set in `commonOptions` for all items and per item in `options`; a per-item `type` wins. Results keep input order.
+
+```ts
+await storage.getItems(["user:1", { key: "avatar.png", options: { type: "bytes" } }], {
+  type: "json",
+});
+```
+
 ### Writing values
 
 #### `setItem(key, value, options?)`
diff --git a/src/_utils.ts b/src/_utils.ts
index e19ef0a..529fffc 100644
--- a/src/_utils.ts
+++ b/src/_utils.ts
@@ -1,3 +1,6 @@
+import { destr } from "destr";
+import type { GetItemType } from "./types.ts";
+
 type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;
 type Promisified<T> = Promise<Awaited<T>>;
 
@@ -80,3 +83,132 @@ function base64Encode(input: Uint8Array) {
   }
   return globalThis.btoa(String.fromCodePoint(...input));
 }
+
+const GET_ITEM_TYPES = ["text", "json", "bytes", "blob", "stream"];
+const encoder = new TextEncoder();
+const decoder = new TextDecoder();
+
+/** Whether `type` reads the driver's raw value. */
+export function isBinaryType(type?: GetItemType): boolean {
+  return type === "bytes" || type === "blob" || type === "stream";
+}
+
+export function assertGetItemType(type: unknown): void {
+  if (type !== undefined && !GET_ITEM_TYPES.includes(type as string)) {
+    throw new Error(`[unstorage] Unsupported type \`${String(type)}\``);
+  }
+}
+
+function isTextLike(value: unknown): boolean {
+  return (
+    typeof value === "number" ||
+    typeof value === "boolean" ||
+    (typeof value === "object" && value !== null && (Array.isArray(value) || isPureObject(value)))
+  );
+}
+
+function concatBytes(parts: Uint8Array[]): Uint8Array {
+  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
+  let offset = 0;
+  for (const part of parts) {
+    result.set(part, offset);
+    offset += part.length;
+  }
+  return result;
+}
+
+async function toBytes(value: any): Promise<Uint8Array> {
+  if (typeof value === "string") {
+    return encoder.encode(value);
+  }
+  if (value instanceof Uint8Array && value.constructor === Uint8Array) {
+    return value;
+  }
+  if (ArrayBuffer.isView(value)) {
+    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+  }
+  if (
+    value instanceof ArrayBuffer ||
+    (typeof SharedArrayBuffer !== "undefined" && value instanceof SharedArrayBuffer)
+  ) {
+    return new Uint8Array(value);
+  }
+  if (value instanceof Blob || value instanceof Response) {
+    return new Uint8Array(await value.arrayBuffer());
+  }
+  if (value instanceof ReadableStream) {
+    const reader = value.getReader();
+    const parts: Uint8Array[] = [];
+    try {
+      for (;;) {
+        const { done, value: chunk } = await reader.read();
+        if (done) {
+          break;
+        }
+        parts.push(await toBytes(chunk));
+      }
+    } finally {
+      reader.releaseLock();
+    }
+    return concatBytes(parts);
+  }
+  if (value && typeof value[Symbol.asyncIterator] === "function") {
+    const parts: Uint8Array[] = [];
+    for await (const chunk of value) {
+      parts.push(await toBytes(chunk));
+    }
+    return concatBytes(parts);
+  }
+  if (isTextLike(value)) {
+    return encoder.encode(stringify(value));
+  }
+  throw new Error(
+    `[unstorage] Cannot convert \`${value?.constructor?.name || "Object"}\` to bytes`,
+  );
+}
+
+async function toText(value: any): Promise<string> {
+  if (typeof value === "string") {
+    return value.startsWith(BASE64_PREFIX) ? decoder.decode(deserializeRaw(value)) : value;
+  }
+  if (isTextLike(value)) {
+    return stringify(value);
+  }
+  return decoder.decode(await toBytes(value));
+}
+
+/**
+ * Converts a value read from a driver to the requested `type`.
+ * `null` and `undefined` give `null`; without `type` the value is only parsed leniently.
+ */
+export async function convertItem(value: unknown, type?: GetItemType): Promise<unknown> {
+  if (value === undefined || value === null) {
+    return null;
+  }
+  switch (type) {
+    case "text":
+      return toText(value);
+    case "json":
+      return typeof value === "string" || !isTextLike(value) ? destr(await toText(value)) : value;
+    case "bytes":
+      return toBytes(value);
+    case "blob":
+      return value instanceof Blob ? value : new Blob([(await toBytes(value)) as BlobPart]);
+    case "stream":
+      if (value instanceof ReadableStream) {
+        return value;
+      }
+      if (value instanceof Blob) {
+        return value.stream();
+      }
+      const bytes = await toBytes(value);
+      return new ReadableStream<Uint8Array>({
+        start(controller) {
+          controller.enqueue(bytes);
+          controller.close();
+        },
+      });
+    default:
+      return destr(value);
+  }
+}
diff --git a/src/storage.ts b/src/storage.ts
index 0c25ad8..13e6cda 100644
--- a/src/storage.ts
+++ b/src/storage.ts
@@ -7,9 +7,19 @@ import type {
   StorageValue,
   WatchEvent,
   TransactionOptions,
+  GetItemType,
+  GetItemsInput,
 } from "./types.ts";
 import memory from "./drivers/memory.ts";
-import { asyncCall, deserializeRaw, serializeRaw, stringify } from "./_utils.ts";
+import {
+  asyncCall,
+  assertGetItemType,
+  convertItem,
+  deserializeRaw,
+  isBinaryType,
+  serializeRaw,
+  stringify,
+} from "./_utils.ts";
 import {
   normalizeKey,
   normalizeBaseKey,
@@ -106,6 +116,7 @@ export function createStorage<T extends StorageValue>(
     driver: Driver;
     base: string;
     items: {
+      index: number;
       key: string;
       relativeKey: string;
       value?: StorageValue;
@@ -114,7 +125,10 @@ export function createStorage<T extends StorageValue>(
   };
 
   const runBatch = (
-    items: (string | { key: string; value?: StorageValue; options?: TransactionOptions })[],
+    items: readonly (
+      | string
+      | { key: string; value?: StorageValue; options?: TransactionOptions }
+    )[],
     commonOptions: undefined | TransactionOptions,
     cb: (batch: BatchItem) => Promise<any>,
   ) => {
@@ -132,7 +146,7 @@ export function createStorage<T extends StorageValue>(
       return batch;
     };
 
-    for (const item of items) {
+    for (const [index, item] of items.entries()) {
       const isStringItem = typeof item === "string";
       const key = normalizeKey(isStringItem ? item : item.key);
       const value = isStringItem ? undefined : item.value;
@@ -140,6 +154,7 @@ export function createStorage<T extends StorageValue>(
         isStringItem || !item.options ? commonOptions : { ...commonOptions, ...item.options };
       const mount = getMount(key);
       getBatch(mount).items.push({
+        index,
         key,
         value,
         relativeKey: mount.relativeKey,
@@ -150,6 +165,23 @@ export function createStorage<T extends StorageValue>(
     return Promise.all([...batches.values()].map((batch) => cb(batch))).then((r) => r.flat());
   };
 
+  const readItem = async (
+    driver: Driver,
+    relativeKey: string,
+    type: GetItemType | undefined,
+    opts: TransactionOptions,
+  ) => {
+    assertGetItemType(type);
+    const binary = isBinaryType(type);
+    const value =
+      binary && driver.getItemRaw
+        ? await asyncCall(driver.getItemRaw, relativeKey, opts)
+        : await asyncCall(driver.getItem, relativeKey, opts).then((v) =>
+            binary ? deserializeRaw(v) : v,
+          );
+    return convertItem(value, type);
+  };
+
   const storage: Storage = {
     // Item
     hasItem(key: string, opts = {}) {
@@ -157,44 +189,55 @@ export function createStorage<T extends StorageValue>(
       const { relativeKey, driver } = getMount(key);
       return asyncCall(driver.hasItem, relativeKey, opts);
     },
-    getItem(key: string, opts = {}) {
+    getItem(key: string, opts: TransactionOptions = {}) {
       key = normalizeKey(key);
       const { relativeKey, driver } = getMount(key);
-      return asyncCall(driver.getItem, relativeKey, opts).then(
-        (value) => destr(value) as StorageValue,
-      );
+      const { type, ...driverOpts } = opts;
+      return readItem(driver, relativeKey, type, driverOpts) as Promise<any>;
     },
-    getItems(
-      items: (string | { key: string; options?: TransactionOptions })[],
-      commonOptions = {},
-    ) {
-      return runBatch(items, commonOptions, (batch) => {
-        if (batch.driver.getItems) {
-          return asyncCall(
-            batch.driver.getItems,
-            batch.items.map((item) => ({
-              key: item.relativeKey,
-              options: item.options,
-            })),
-            commonOptions,
-          ).then((r) =>
-            r.map((item) => ({
-              key: joinKeys(batch.base, item.key),
-              value: destr(item.value),
-            })),
-          );
-        }
-        return Promise.all(
-          batch.items.map((item) => {
-            return asyncCall(batch.driver.getItem, item.relativeKey, item.options).then(
-              (value) => ({
-                key: item.key,
-                value: destr(value),
-              }),
-            );
-          }),
+    getItems(items: readonly GetItemsInput[], commonOptions: TransactionOptions = {}) {
+      const { type: _commonType, ...driverCommonOptions } = commonOptions;
+      return runBatch(items, commonOptions, async (batch) => {
+        const entries = batch.items.map((item) => {
+          const { type, ...options } = item.options || {};
+          return { item, type: type as GetItemType | undefined, options };
+        });
+        const batched = batch.driver.getItems
+          ? entries.filter((entry) => !isBinaryType(entry.type))
+          : [];
+        const singles = entries.filter((entry) => !batched.includes(entry));
+        const [batchResults, singleValues] = await Promise.all([
+          batched.length
+            ? asyncCall(
+                batch.driver.getItems!,
+                batched.map((entry) => ({ key: entry.item.relativeKey, options: entry.options })),
+                driverCommonOptions,
+              )
+            : [],
+          Promise.all(
+            singles.map((entry) =>
+              readItem(batch.driver, entry.item.relativeKey, entry.type, entry.options),
+            ),
+          ),
+        ]);
+        const results = await Promise.all(
+          batched.map(async (entry, i) => ({
+            index: entry.item.index,
+            key: batchResults[i] ? joinKeys(batch.base, batchResults[i]!.key) : entry.item.key,
+            value: await convertItem(batchResults[i]?.value, entry.type),
+          })),
         );
-      });
+        for (const [i, entry] of singles.entries()) {
+          results.push({
+            index: entry.item.index,
+            key: entry.item.key,
+            value: singleValues[i],
+          });
+        }
+        return results;
+      }).then((results) =>
+        results.sort((a, b) => a.index - b.index).map(({ key, value }) => ({ key, value })),
+      );
     },
     getItemRaw(key, opts = {}) {
       key = normalizeKey(key);
diff --git a/src/tracing.ts b/src/tracing.ts
index cd7401d..aff3c8e 100644
--- a/src/tracing.ts
+++ b/src/tracing.ts
@@ -133,7 +133,9 @@ export function withTracing<T extends StorageValue>(storage: MaybeTracedStorage<
       return normalizer(typeof i === "string" ? i : i.key);
     };
 
-    return Array.isArray(keyArg) ? keyArg.map((i) => getKeyValue(i)) : [getKeyValue(keyArg)];
+    return Array.isArray(keyArg)
+      ? (keyArg as (string | { key: string })[]).map((i) => getKeyValue(i))
+      : [getKeyValue(keyArg as string | { key: string })];
   };
 
   function wrapOperation<
diff --git a/src/types.ts b/src/types.ts
index 40f3988..f941539 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -1,4 +1,32 @@
 export type StorageValue = null | string | number | boolean | object;
+export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
+export interface JSONObject {
+  [key: string]: JSONValue;
+}
+export type JSONArray = JSONValue[];
+
+export interface GetItemTypeMap {
+  text: string;
+  json: JSONValue;
+  bytes: Uint8Array;
+  blob: Blob;
+  stream: ReadableStream<Uint8Array>;
+}
+export type GetItemType = keyof GetItemTypeMap;
+
+/** Options of `getItem()`; `type` selects the format of the returned value. */
+export type GetItemOptions<Type extends GetItemType = GetItemType> = TransactionOptions & {
+  type?: Type;
+};
+
+export type GetItemsInput = string | { key: string; options?: GetItemOptions };
+
+type GetItemsValue<I, C, T> = I extends { options: { type: infer Ty extends GetItemType } }
+  ? GetItemTypeMap[Ty] | null
+  : C extends { type: infer Ty extends GetItemType }
+    ? GetItemTypeMap[Ty] | null
+    : T;
+
 export type WatchEvent = "update" | "remove";
 export type WatchCallback = (event: WatchEvent, key: string) => any;
 
@@ -112,20 +140,24 @@ export interface Storage<T extends StorageValue = StorageValue> {
   ): Promise<boolean>;
   hasItem(key: string, opts?: TransactionOptions): Promise<boolean>;
 
+  getItem<Ty extends GetItemType>(
+    key: string,
+    opts: GetItemOptions<Ty> & { type: Ty },
+  ): Promise<GetItemTypeMap[Ty] | null>;
   getItem<U extends Extract<T, StorageDefinition>, K extends string & keyof StorageItemMap<U>>(
     key: K,
-    ops?: TransactionOptions,
+    ops?: TransactionOptions & { type?: undefined },
   ): Promise<StorageItemType<T, K> | null>;
   getItem<R = StorageItemType<T, string>>(
     key: string,
-    opts?: TransactionOptions,
+    opts?: TransactionOptions & { type?: undefined },
   ): Promise<R | null>;
 
   /** @experimental */
-  getItems: <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => Promise<{ key: string; value: U }[]>;
+  getItems: <const I extends readonly GetItemsInput[], const C extends GetItemOptions = {}>(
+    items: I,
+    commonOptions?: C,
+  ) => Promise<{ key: string; value: GetItemsValue<I[number], C, T> }[]>;
   /** @experimental See https://github.com/unjs/unstorage/issues/142 */
   getItemRaw: <T = any>(key: string, opts?: TransactionOptions) => Promise<MaybeDefined<T> | null>;
 
diff --git a/src/utils.ts b/src/utils.ts
index eb44352..9694e1f 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,4 +1,10 @@
-import type { Storage, StorageValue, TransactionOptions } from "./types.ts";
+import type {
+  GetItemOptions,
+  GetItemsInput,
+  Storage,
+  StorageValue,
+  TransactionOptions,
+} from "./types.ts";
 
 type StorageKeys = Array<keyof Storage>;
 
@@ -56,19 +62,16 @@ export function prefixStorage<T extends StorageValue>(
       }
     });
 
-  nsStorage.getItems = async <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => {
+  nsStorage.getItems = (async (items: readonly GetItemsInput[], commonOptions?: GetItemOptions) => {
     const prefixedItems = items.map((item) =>
       typeof item === "string" ? base + item : { ...item, key: base + item.key },
     );
-    const results = await storage.getItems<U>(prefixedItems, commonOptions);
+    const results = await storage.getItems(prefixedItems, commonOptions);
     return results.map((entry) => ({
       key: entry.key.slice(base.length),
       value: entry.value,
     }));
-  };
+  }) as Storage<T>["getItems"];
 
   nsStorage.setItems = async <U extends T>(
     items: { key: string; value: U; options?: TransactionOptions }[],
diff --git a/test/storage.test-d.ts b/test/storage.test-d.ts
index 9d8933c..3bd9632 100644
--- a/test/storage.test-d.ts
+++ b/test/storage.test-d.ts
@@ -1,6 +1,6 @@
 import { describe, it, expectTypeOf } from "vitest";
 import { createStorage, prefixStorage } from "../src/index.ts";
-import type { Storage, StorageValue } from "../src/index.ts";
+import type { JSONValue, Storage, StorageValue } from "../src/index.ts";
 
 describe("types", () => {
   it("default types for storage", async () => {
@@ -80,4 +80,32 @@ describe("types", () => {
     const prefixedStorage3 = prefixStorage<number>(storage3, "foo");
     expectTypeOf(prefixedStorage3).toEqualTypeOf<Storage<number>>();
   });
+
+  it("getItem and getItems type option", async () => {
+    const storage = createStorage();
+    expectTypeOf(await storage.getItem("k", { type: "text" })).toEqualTypeOf<string | null>();
+    expectTypeOf(await storage.get("k", { type: "json" })).toEqualTypeOf<JSONValue | null>();
+    expectTypeOf(await storage.getItem("k", { type: "bytes" })).toEqualTypeOf<Uint8Array | null>();
+    expectTypeOf(await storage.getItem("k", { type: "blob" })).toEqualTypeOf<Blob | null>();
+    expectTypeOf(
+      await storage.getItem("k", { type: "stream" }),
+    ).toEqualTypeOf<ReadableStream<Uint8Array> | null>();
+    // @ts-expect-error unknown type
+    await storage.getItem("k", { type: "buffer" });
+
+    expectTypeOf(await storage.getItems(["a"], { type: "text" })).toEqualTypeOf<
+      { key: string; value: string | null }[]
+    >();
+    expectTypeOf(await storage.getItems([{ key: "a", options: { type: "bytes" } }])).toEqualTypeOf<
+      { key: string; value: Uint8Array | null }[]
+    >();
+    expectTypeOf(
+      await storage.getItems([{ key: "a", options: { type: "bytes" } }, "b"], { type: "json" }),
+    ).toEqualTypeOf<{ key: string; value: JSONValue | Uint8Array | null }[]>();
+    expectTypeOf(await storage.getItems(["a"])).toEqualTypeOf<
+      { key: string; value: StorageValue }[]
+    >();
+    // @ts-expect-error unknown per-item type
+    await storage.getItems([{ key: "a", options: { type: "buffer" } }]);
+  });
 });
diff --git a/test/storage.test.ts b/test/storage.test.ts
index 8ad7b9f..430ac25 100644
--- a/test/storage.test.ts
+++ b/test/storage.test.ts
@@ -293,4 +293,144 @@ describe("Regression", () => {
       { key: "key2", value: "value2" },
     ]);
   });
+
+  describe("getItem type", () => {
+    const decode = (v: Uint8Array) => new TextDecoder().decode(v);
+    const drain = async (stream: ReadableStream<Uint8Array>) =>
+      new Uint8Array(await new Response(stream).arrayBuffer());
+
+    it("returns null for missing keys and undefined", async () => {
+      const storage = createStorage({
+        driver: { ...memory(), getItem: () => undefined as any, getItemRaw: () => undefined },
+      });
+      for (const type of [undefined, "text", "json", "bytes", "blob", "stream"] as const) {
+        expect(await storage.getItem("x", (type ? { type } : {}) as any)).toBeNull();
+      }
+    });
+
+    it("reads raw values in every format", async () => {
+      const storage = createStorage();
+      await storage.setItemRaw("a", new TextEncoder().encode('{"a":1}'));
+      expect(await storage.getItem("a", { type: "text" })).toBe('{"a":1}');
+      expect(await storage.getItem("a", { type: "json" })).toEqual({ a: 1 });
+      expect(decode((await storage.getItem("a", { type: "bytes" }))!)).toBe('{"a":1}');
+      expect(await (await storage.get("a", { type: "blob" }))!.text()).toBe('{"a":1}');
+      expect(decode(await drain((await storage.getItem("a", { type: "stream" }))!))).toBe(
+        '{"a":1}',
+      );
+    });
+
+    it("decodes base64 strings from string-only drivers", async () => {
+      const store = new Map<string, string>();
+      const storage = createStorage({
+        driver: {
+          hasItem: (k) => store.has(k),
+          getItem: (k) => store.get(k) ?? null,
+          setItem: (k, v) => void store.set(k, v),
+          getKeys: () => [...store.keys()],
+        },
+      });
+      await storage.setItemRaw("a", new TextEncoder().encode("hello wörld"));
+      expect(store.get("a")).toMatch(/^base64:/);
+      expect(await storage.getItem("a", { type: "text" })).toBe("hello wörld");
+      expect(await storage.getItem("a", { type: "json" })).toBe("hello wörld");
+      expect(decode((await storage.getItem("a", { type: "bytes" }))!)).toBe("hello wörld");
+    });
+
+    it("normalizes binary-like values", async () => {
+      const values: Record<string, any> = {
+        buffer: Buffer.from("hi"),
+        ab: new TextEncoder().encode("hi").buffer,
+        view: new DataView(new TextEncoder().encode("hi").buffer),
+        blob: new Blob(["hi"]),
+        response: new Response("hi"),
+        stream: new Response("hi").body,
+        iter: (async function* () {
+          yield new TextEncoder().encode("h");
+          yield "i";
+        })(),
+        string: "hi",
+      };
+      const storage = createStorage();
+      for (const [key, value] of Object.entries(values)) {
+        await storage.setItemRaw(key, value);
+        const bytes = (await storage.getItem(key, { type: "bytes" }))!;
+        expect(bytes.constructor).toBe(Uint8Array);
+        expect(decode(bytes)).toBe("hi");
+      }
+      await storage.setItemRaw("true", true);
+      await storage.setItemRaw("obj", { a: 1 });
+      expect(decode((await storage.getItem("true", { type: "bytes" }))!)).toBe("true");
+      expect(decode((await storage.getItem("obj", { type: "bytes" }))!)).toBe('{"a":1}');
+      await storage.setItemRaw("map", new Map());
+      await expect(storage.getItem("map", { type: "bytes" })).rejects.toThrow(
+        /Cannot convert `Map` to bytes/,
+      );
+    });
+
+    it("returns Blob and ReadableStream as is", async () => {
+      const blob = new Blob(["x"]);
+      const stream = new Response("x").body!;
+      const storage = createStorage();
+      await storage.setItemRaw("blob", blob);
+      await storage.setItemRaw("stream", stream);
+      expect(await storage.getItem("blob", { type: "blob" })).toBe(blob);
+      expect(await storage.getItem("stream", { type: "stream" })).toBe(stream);
+    });
+
+    it("releases the reader lock when draining fails", async () => {
+      let stream!: ReadableStream;
+      const storage = createStorage({
+        driver: {
+          ...memory(),
+          getItemRaw: () => {
+            stream = new ReadableStream({
+              pull(c) {
+                c.error(new Error("boom"));
+              },
+            });
+            return stream;
+          },
+        },
+      });
+      await expect(storage.getItem("x", { type: "bytes" })).rejects.toThrow("boom");
+      expect(stream.locked).toBe(false);
+    });
+
+    it("keeps plain values and does not forward type", async () => {
+      const getItem = vi.fn((_k: string, _o?: any) => "plain");
+      const storage = createStorage({ driver: { ...memory(), getItem } });
+      expect(await storage.getItem("a", { type: "text", foo: 1 })).toBe("plain");
+      expect(getItem.mock.calls[0]![1]).toEqual({ foo: 1 });
+    });
+
+    it("getItems applies types in input order", async () => {
+      const storage = createStorage();
+      storage.mount("m", memory());
+      await storage.setItem("a", { n: 1 });
+      await storage.setItem("m:b", { n: 2 });
+      await storage.setItemRaw("c", new TextEncoder().encode("raw"));
+      const result = await storage.getItems(
+        ["a", { key: "m:b", options: { type: "text" } }, { key: "c", options: { type: "bytes" } }],
+        { type: "json" },
+      );
+      expect(result.map((r) => r.key)).toEqual(["a", "m:b", "c"]);
+      expect(result[0]!.value).toEqual({ n: 1 });
+      expect(result[1]!.value).toBe('{"n":2}');
+      expect(decode(result[2]!.value as Uint8Array)).toBe("raw");
+    });
+
+    it("getItems matches driver results by position", async () => {
+      const storage = createStorage({
+        driver: {
+          ...memory(),
+          getItems: (items) => items.map((i) => ({ key: i.key + "!", value: "base64:aGk=" })),
+        },
+      });
+      expect(await storage.getItems(["a", "b"], { type: "text" })).toEqual([
+        { key: "a!", value: "hi" },
+        { key: "b!", value: "hi" },
+      ]);
+    });
+  });
 });
```

</details>

<details><summary>reply</summary>

Implementing now: types first, then the read helpers, then storage and docs.

Pre-existing noise (unbuilt drivers); filter it.

oxfmt touched s3.ts; revert that, then add tests and docs.

Done. `type` option added to `getItem()`, `get()` and `getItems()`, with the new types exported, docs updated and tests added. The vitest suite and `tsc` pass for the touched files. I did not run `pnpm lint` or `pnpm test`.

- **Drivers:** `oxfmt --check` flags one file, probably the pre-existing `src/drivers/s3.ts` (I did not check). Drivers that read `opts.type` no longer receive it. This affects `cloudflare-r2-binding`, and the Netlify Blobs `getItem` path no longer gets a `type` either. I did not touch the driver files.
- **`getItems` ordering:** it now returns results in input order, which also changes the previous order across mounts.
- **`getItems` fallback type:** items without a `type` fall back to the storage's `T`, which is `StorageValue` by default.
- **Unknown `type` at runtime:** a `type` outside the five values (JS callers) throws `Unsupported type`.

</details>

### codex, base: FAIL

Files: [docs/1.guide/1.index.md](../base/codex/ts-unstorage-get-item-type-1/files/docs/1.guide/1.index.md), [src/_read.ts](../base/codex/ts-unstorage-get-item-type-1/files/src/_read.ts), [src/storage.ts](../base/codex/ts-unstorage-get-item-type-1/files/src/storage.ts), [src/types.ts](../base/codex/ts-unstorage-get-item-type-1/files/src/types.ts), [src/utils.ts](../base/codex/ts-unstorage-get-item-type-1/files/src/utils.ts), [test/read-types.test.ts](../base/codex/ts-unstorage-get-item-type-1/files/test/read-types.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/docs/1.guide/1.index.md b/docs/1.guide/1.index.md
index 5b54950..b4ec994 100644
--- a/docs/1.guide/1.index.md
+++ b/docs/1.guide/1.index.md
@@ -296,3 +296,35 @@ const visits = await appStorage.getItem("visitCount");
 Unknown string keys still use the general `StorageValue` type.
 
 For a typed namespace, use [`prefixStorage`](/guide/utils#namespaces).
+
+### Read formats
+
+`getItem()` (also available as `get()`) accepts a reserved `type` option:
+
+```ts
+await storage.getItem("user:1", { type: "text" }); // string | null
+await storage.get("user:1", { type: "json" }); // JSONValue | null
+await storage.getItem("avatar.png", { type: "bytes" }); // Uint8Array | null
+await storage.getItem("avatar.png", { type: "blob" }); // Blob | null
+await storage.getItem("avatar.png", { type: "stream" }); // ReadableStream<Uint8Array> | null
+```
+
+Missing values return `null`. Without `type`, reads keep their default deserialization.
+`text` decodes raw UTF-8 data and `json` parses it leniently, leaving ordinary strings
+unchanged. Both support values written with `setItemRaw()`, including base64 storage.
+Binary formats use the driver's raw read when available and normalize binary values
+and UTF-8 text. Existing blobs and streams are returned directly for their matching
+format. Numbers, booleans, plain objects and arrays use their text representation.
+Unsupported values reject with a conversion error.
+
+`getItems()` accepts a common format and per-item overrides, preserving input order:
+
+```ts
+await storage.getItems(["user:1", { key: "avatar.png", options: { type: "bytes" } }], {
+  type: "json",
+});
+```
+
+Binary items use individual reads alongside any driver batch read. The `type` option
+is consumed by unstorage and is not forwarded to drivers. For example, replace a
+Netlify Blobs `{ type: "arrayBuffer" }` read option with `{ type: "bytes" }`.
diff --git a/src/_read.ts b/src/_read.ts
new file mode 100644
index 0000000..8426b71
--- /dev/null
+++ b/src/_read.ts
@@ -0,0 +1,86 @@
+import { destr } from "destr";
+import { deserializeRaw, stringify } from "./_utils.ts";
+import type { GetItemType } from "./types.ts";
+
+export async function toBytes(value: any): Promise<Uint8Array> {
+  if (value instanceof Uint8Array) return value;
+  if (value instanceof ArrayBuffer) return new Uint8Array(value);
+  if (ArrayBuffer.isView(value))
+    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+  if (value instanceof Blob || value instanceof Response)
+    return new Uint8Array(await value.arrayBuffer());
+  if (value instanceof ReadableStream) {
+    const reader = value.getReader();
+    const chunks: Uint8Array[] = [];
+    try {
+      while (true) {
+        const { done, value: chunk } = await reader.read();
+        if (done) break;
+        chunks.push(await toBytes(chunk));
+      }
+    } finally {
+      reader.releaseLock();
+    }
+    return concat(chunks);
+  }
+  if (value && typeof value[Symbol.asyncIterator] === "function") {
+    const chunks: Uint8Array[] = [];
+    for await (const chunk of value) chunks.push(await toBytes(chunk));
+    return concat(chunks);
+  }
+  if (
+    typeof value === "string" ||
+    typeof value === "number" ||
+    typeof value === "boolean" ||
+    Array.isArray(value) ||
+    (value &&
+      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null))
+  ) {
+    return new TextEncoder().encode(stringify(value));
+  }
+  throw new TypeError(`Cannot convert \`${value?.constructor?.name || "Object"}\` to bytes`);
+}
+
+function concat(chunks: Uint8Array[]): Uint8Array {
+  const result = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
+  let offset = 0;
+  for (const chunk of chunks) {
+    result.set(chunk, offset);
+    offset += chunk.byteLength;
+  }
+  return result;
+}
+
+export async function convertRead(value: any, type?: GetItemType): Promise<any> {
+  if (value == null) return null;
+  if (!type) return destr(value) ?? null;
+  value = deserializeRaw(value);
+  if (type === "blob" && value instanceof Blob) return value;
+  if (type === "stream" && value instanceof ReadableStream) return value;
+  if (
+    type === "json" &&
+    (typeof value !== "object" ||
+      Array.isArray(value) ||
+      Object.getPrototypeOf(value) === Object.prototype ||
+      Object.getPrototypeOf(value) === null)
+  )
+    return destr(value);
+  const bytes = await toBytes(value);
+  switch (type) {
+    case "bytes":
+      return bytes;
+    case "blob":
+      return new Blob([bytes as Uint8Array<ArrayBuffer>]);
+    case "stream":
+      return new ReadableStream({
+        start(controller) {
+          controller.enqueue(bytes);
+          controller.close();
+        },
+      });
+    case "text":
+      return new TextDecoder().decode(bytes);
+    case "json":
+      return destr(new TextDecoder().decode(bytes));
+  }
+}
diff --git a/src/storage.ts b/src/storage.ts
index 0c25ad8..10cd851 100644
--- a/src/storage.ts
+++ b/src/storage.ts
@@ -7,7 +7,9 @@ import type {
   StorageValue,
   WatchEvent,
   TransactionOptions,
+  GetItemOptions,
 } from "./types.ts";
+import { convertRead } from "./_read.ts";
 import memory from "./drivers/memory.ts";
 import { asyncCall, deserializeRaw, serializeRaw, stringify } from "./_utils.ts";
 import {
@@ -157,44 +159,83 @@ export function createStorage<T extends StorageValue>(
       const { relativeKey, driver } = getMount(key);
       return asyncCall(driver.hasItem, relativeKey, opts);
     },
-    getItem(key: string, opts = {}) {
+    getItem(key: string, opts: GetItemOptions = {}) {
       key = normalizeKey(key);
       const { relativeKey, driver } = getMount(key);
-      return asyncCall(driver.getItem, relativeKey, opts).then(
-        (value) => destr(value) as StorageValue,
-      );
+      const { type, ...driverOptions } = opts;
+      const raw = type === "bytes" || type === "blob" || type === "stream";
+      return asyncCall(
+        raw && driver.getItemRaw ? driver.getItemRaw : driver.getItem,
+        relativeKey,
+        driverOptions,
+      ).then((value) => convertRead(value, type));
     },
-    getItems(
-      items: (string | { key: string; options?: TransactionOptions })[],
-      commonOptions = {},
+    async getItems(
+      items: (string | { key: string; options?: GetItemOptions })[],
+      commonOptions: GetItemOptions = {},
     ) {
-      return runBatch(items, commonOptions, (batch) => {
-        if (batch.driver.getItems) {
-          return asyncCall(
-            batch.driver.getItems,
-            batch.items.map((item) => ({
-              key: item.relativeKey,
-              options: item.options,
-            })),
-            commonOptions,
-          ).then((r) =>
-            r.map((item) => ({
-              key: joinKeys(batch.base, item.key),
-              value: destr(item.value),
-            })),
+      const { type: commonType, ...driverCommonOptions } = commonOptions;
+      const results: { key: string; value: any }[] = [];
+      const batchMap = new Map<
+        string,
+        {
+          driver: Driver;
+          base: string;
+          entries: {
+            index: number;
+            key: string;
+            relativeKey: string;
+            type?: GetItemOptions["type"];
+            options: TransactionOptions;
+          }[];
+        }
+      >();
+      const reads: Promise<any>[] = [];
+      items.forEach((item, index) => {
+        const key = normalizeKey(typeof item === "string" ? item : item.key);
+        const { type = commonType, ...options } = {
+          ...commonOptions,
+          ...(typeof item === "string" ? {} : item.options),
+        };
+        const { driver, base, relativeKey } = getMount(key);
+        if (!driver.getItems || type === "bytes" || type === "blob" || type === "stream") {
+          reads.push(
+            storage.getItem(key, { ...options, type } as any).then((value) => {
+              results[index] = { key, value };
+            }),
           );
+        } else {
+          // Keep separate mount batches even when a driver is mounted more than once.
+          const batchKey = base;
+          let batch = batchMap.get(batchKey);
+          if (!batch) {
+            batch = { driver, base, entries: [] };
+            batchMap.set(batchKey, batch);
+          }
+          batch.entries.push({ index, key, relativeKey, type, options });
         }
-        return Promise.all(
-          batch.items.map((item) => {
-            return asyncCall(batch.driver.getItem, item.relativeKey, item.options).then(
-              (value) => ({
-                key: item.key,
-                value: destr(value),
+      });
+      for (const batch of batchMap.values()) {
+        reads.push(
+          asyncCall(
+            batch.driver.getItems!,
+            batch.entries.map((e) => ({ key: e.relativeKey, options: e.options })),
+            driverCommonOptions,
+          ).then(async (values) => {
+            await Promise.all(
+              values.map(async (item, index) => {
+                const entry = batch.entries[index]!;
+                results[entry.index] = {
+                  key: joinKeys(batch.base, item.key),
+                  value: await convertRead(item.value, entry.type),
+                };
               }),
             );
           }),
         );
-      });
+      }
+      await Promise.all(reads);
+      return results;
     },
     getItemRaw(key, opts = {}) {
       key = normalizeKey(key);
diff --git a/src/types.ts b/src/types.ts
index 40f3988..da43504 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -1,4 +1,24 @@
 export type StorageValue = null | string | number | boolean | object;
+export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
+export interface JSONObject {
+  [key: string]: JSONValue;
+}
+export interface JSONArray extends Array<JSONValue> {}
+export interface GetItemTypeMap {
+  text: string;
+  json: JSONValue;
+  bytes: Uint8Array;
+  blob: Blob;
+  stream: ReadableStream<Uint8Array>;
+}
+export type GetItemType = keyof GetItemTypeMap;
+export type GetItemOptions = TransactionOptions & { type?: GetItemType };
+export type GetItemsInput = string | { key: string; options?: GetItemOptions };
+type ReadResult<O, F> = O extends { type: infer R extends GetItemType } ? GetItemTypeMap[R] : F;
+type ItemsResult<I, O, F> = I extends { options: infer P }
+  ? ReadResult<P, ReadResult<O, F>>
+  : ReadResult<O, F>;
+
 export type WatchEvent = "update" | "remove";
 export type WatchCallback = (event: WatchEvent, key: string) => any;
 
@@ -112,20 +132,24 @@ export interface Storage<T extends StorageValue = StorageValue> {
   ): Promise<boolean>;
   hasItem(key: string, opts?: TransactionOptions): Promise<boolean>;
 
+  getItem<R extends GetItemType>(
+    key: string,
+    opts: GetItemOptions & { type: R },
+  ): Promise<GetItemTypeMap[R] | null>;
   getItem<U extends Extract<T, StorageDefinition>, K extends string & keyof StorageItemMap<U>>(
     key: K,
-    ops?: TransactionOptions,
+    opts?: GetItemOptions & { type?: undefined },
   ): Promise<StorageItemType<T, K> | null>;
   getItem<R = StorageItemType<T, string>>(
     key: string,
-    opts?: TransactionOptions,
+    opts?: GetItemOptions & { type?: undefined },
   ): Promise<R | null>;
 
   /** @experimental */
-  getItems: <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => Promise<{ key: string; value: U }[]>;
+  getItems<const I extends GetItemsInput[], const O extends GetItemOptions = {}>(
+    items: I,
+    commonOptions?: O,
+  ): Promise<{ key: string; value: ItemsResult<I[number], O, StorageValue> | null }[]>;
   /** @experimental See https://github.com/unjs/unstorage/issues/142 */
   getItemRaw: <T = any>(key: string, opts?: TransactionOptions) => Promise<MaybeDefined<T> | null>;
 
diff --git a/src/utils.ts b/src/utils.ts
index eb44352..cab894a 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -56,19 +56,13 @@ export function prefixStorage<T extends StorageValue>(
       }
     });
 
-  nsStorage.getItems = async <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => {
+  nsStorage.getItems = (async (items, commonOptions) => {
     const prefixedItems = items.map((item) =>
       typeof item === "string" ? base + item : { ...item, key: base + item.key },
     );
-    const results = await storage.getItems<U>(prefixedItems, commonOptions);
-    return results.map((entry) => ({
-      key: entry.key.slice(base.length),
-      value: entry.value,
-    }));
-  };
+    const results = await storage.getItems(prefixedItems, commonOptions);
+    return results.map((entry) => ({ key: entry.key.slice(base.length), value: entry.value }));
+  }) as Storage<T>["getItems"];
 
   nsStorage.setItems = async <U extends T>(
     items: { key: string; value: U; options?: TransactionOptions }[],
diff --git a/test/read-types.test.ts b/test/read-types.test.ts
new file mode 100644
index 0000000..2395f3d
--- /dev/null
+++ b/test/read-types.test.ts
@@ -0,0 +1,119 @@
+import { describe, it, expect, vi, expectTypeOf } from "vitest";
+import { createStorage, type JSONValue, type StorageValue } from "../src/index.ts";
+import memory from "../src/drivers/memory.ts";
+
+describe("read formats", () => {
+  it("decodes raw UTF-8 and JSON with raw and string-only drivers", async () => {
+    for (const raw of [true, false]) {
+      const driver = memory();
+      if (!raw) {
+        delete driver.getItemRaw;
+        delete driver.setItemRaw;
+      }
+      const storage = createStorage({ driver });
+      await storage.setItemRaw("text", new TextEncoder().encode("hello wörld"));
+      await storage.setItemRaw("json", new TextEncoder().encode('{"a":1}'));
+      expect(await storage.get("text", { type: "text" })).toBe("hello wörld");
+      expect(await storage.getItem("json", { type: "json" })).toEqual({ a: 1 });
+      for (const type of ["text", "json", "bytes", "blob", "stream"] as const) {
+        expect(await storage.getItem("missing", { type })).toBeNull();
+      }
+    }
+  });
+
+  it("normalizes binary and plain values", async () => {
+    const driver = memory();
+    const storage = createStorage({ driver });
+    for (const value of [true, 123, { a: 1 }, [1, 2], "hello"]) {
+      driver.getItem = () => value;
+      driver.getItemRaw = () => value;
+      const text = await storage.getItem("k", { type: "text" });
+      expect(await storage.getItem("k", { type: "bytes" })).toEqual(
+        new TextEncoder().encode(text!),
+      );
+    }
+    for (const value of [
+      new Uint8Array([1, 2]),
+      new Uint8Array([1, 2]).buffer,
+      new DataView(new Uint8Array([1, 2]).buffer),
+      new Blob([new Uint8Array([1, 2])]),
+      new Response(new Uint8Array([1, 2])),
+      (async function* () {
+        yield new Uint8Array([1]);
+        yield new Uint8Array([2]);
+      })(),
+    ]) {
+      driver.getItemRaw = () => value;
+      expect(await storage.getItem("k", { type: "bytes" })).toEqual(new Uint8Array([1, 2]));
+    }
+    driver.getItemRaw = () => new Map();
+    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow(
+      "Cannot convert `Map` to bytes",
+    );
+    driver.getItem = () => undefined as any;
+    expect(await storage.getItem("k")).toBeNull();
+  });
+
+  it("preserves blobs and streams and releases failed readers", async () => {
+    const driver = memory();
+    const storage = createStorage({ driver });
+    const blob = new Blob(["hello"]);
+    driver.getItemRaw = () => blob;
+    expect(await storage.getItem("k", { type: "blob" })).toBe(blob);
+    const stream = new ReadableStream<Uint8Array>({
+      pull(c) {
+        c.error(new Error("failed"));
+      },
+    });
+    driver.getItemRaw = () => stream;
+    expect(await storage.getItem("k", { type: "stream" })).toBe(stream);
+    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow("failed");
+    expect(stream.locked).toBe(false);
+  });
+
+  it("batches by position, strips type, and keeps mixed mount order", async () => {
+    const driver = memory();
+    driver.getItems = vi.fn(async (items, common) => {
+      expect(common).toEqual({ flag: true });
+      expect(items.map((i) => i.options)).toEqual([{ flag: true }, { flag: true }]);
+      return items.map(() => ({ key: "changed", value: "123" }));
+    });
+    driver.getItemRaw = vi.fn(() => "raw");
+    const storage = createStorage({ driver }).mount("other", memory());
+    const result = await storage.getItems(
+      [
+        "a",
+        { key: "other:missing", options: { type: "bytes" } },
+        { key: "b", options: { type: "json" } },
+        { key: "c", options: { type: "bytes" } },
+      ],
+      { type: "text", flag: true },
+    );
+    expect(result.map((i) => i.value)).toEqual(["123", null, 123, new TextEncoder().encode("raw")]);
+    expect(driver.getItemRaw).toHaveBeenCalledWith("c", { flag: true });
+  });
+
+  it("infers requested formats", async () => {
+    const storage = createStorage();
+    expectTypeOf(storage.getItem("k", { type: "bytes" })).toEqualTypeOf<
+      Promise<Uint8Array | null>
+    >();
+    expectTypeOf(storage.get("k", { type: "json" })).toEqualTypeOf<Promise<JSONValue | null>>();
+    expectTypeOf(storage.getItems(["a"], { type: "text" })).toEqualTypeOf<
+      Promise<{ key: string; value: string | null }[]>
+    >();
+    expectTypeOf(
+      storage.getItems([
+        { key: "a", options: { type: "bytes" } },
+        { key: "b", options: { type: "json" } },
+      ]),
+    ).toEqualTypeOf<Promise<{ key: string; value: JSONValue | Uint8Array | null }[]>>();
+    expectTypeOf(storage.getItems(["a"])).toEqualTypeOf<
+      Promise<{ key: string; value: StorageValue }[]>
+    >();
+    // @ts-expect-error unknown format
+    storage.getItem("k", { type: "buffer" });
+    // @ts-expect-error unknown per-item format
+    storage.getItems([{ key: "k", options: { type: "buffer" } }]);
+  });
+});
```

</details>

<details><summary>reply</summary>

I’ll inspect the read paths and type definitions, add the conversions and type inference, then run the relevant tests.

The conversion and batch-read paths are in place. I’m adding tests for raw UTF-8 decoding, mixed batch types, stream lock release, and return-type inference. The type check also found existing package-resolution errors in this checkout; I’ll distinguish those from any errors introduced here.

Implemented `type` for `getItem()`, `get()`, and `getItems()`, with binary normalization, raw decoding, ordered mixed batches, inferred return types, root type exports, and documentation.

Validation: 100 tests passed; changed-file lint passed. Full type checking remains blocked by existing package-resolution and driver typing errors.

</details>

### codex, muffle: FAIL

Files: [docs/1.guide/1.index.md](../muffle/codex/ts-unstorage-get-item-type-1/files/docs/1.guide/1.index.md), [src/_read.ts](../muffle/codex/ts-unstorage-get-item-type-1/files/src/_read.ts), [src/storage.ts](../muffle/codex/ts-unstorage-get-item-type-1/files/src/storage.ts), [src/tracing.ts](../muffle/codex/ts-unstorage-get-item-type-1/files/src/tracing.ts), [src/types.ts](../muffle/codex/ts-unstorage-get-item-type-1/files/src/types.ts), [src/utils.ts](../muffle/codex/ts-unstorage-get-item-type-1/files/src/utils.ts), [test/get-item-type.test.ts](../muffle/codex/ts-unstorage-get-item-type-1/files/test/get-item-type.test.ts), [test/storage.test-d.ts](../muffle/codex/ts-unstorage-get-item-type-1/files/test/storage.test-d.ts)

<details><summary>diff</summary>

```diff
diff --git a/docs/1.guide/1.index.md b/docs/1.guide/1.index.md
index 5b54950..9c2b5d3 100644
--- a/docs/1.guide/1.index.md
+++ b/docs/1.guide/1.index.md
@@ -68,6 +68,22 @@ const value = await storage.getItem("user:1");
 
 Alias: `storage.get()`.
 
+Use `type` to choose the return format. The return type is inferred automatically, and missing keys return `null` for every format.
+
+```ts
+await storage.getItem("user:1", { type: "text" }); // string | null
+await storage.getItem("user:1", { type: "json" }); // JSONValue
+await storage.getItem("avatar.png", { type: "bytes" }); // Uint8Array | null
+await storage.getItem("avatar.png", { type: "blob" }); // Blob | null
+await storage.getItem("avatar.png", { type: "stream" }); // ReadableStream<Uint8Array> | null
+```
+
+`text` serializes plain values and decodes raw bytes as UTF-8. `json` parses text leniently, like the default read: an ordinary string stays a string. Both decode raw values written with `setItemRaw()`.
+
+`bytes`, `blob`, and `stream` use the driver's raw read method, falling back to its normal read method and decoding serialized raw data. Binary values, responses, streams, and async iterables of chunks are normalized; strings use UTF-8, and plain values use their text form. An existing `Blob` or `ReadableStream` is returned directly for its matching format without buffering.
+
+Without `type`, reads keep the default deserialization behavior. Driver values of `undefined` are returned as `null`. The `type` option is reserved by unstorage and is removed before calling drivers; replace Netlify Blobs `{ type: "arrayBuffer" }` reads with `{ type: "bytes" }`.
+
 #### `getItems(items, commonOptions?)`
 
 ::warning
@@ -84,6 +100,16 @@ const items = await storage.getItems([
 // [{ key: "user:1", value: ... }, { key: "user:2", value: ... }]
 ```
 
+Set a common `type` for the whole batch, or override it per item. Results keep input order. Binary formats read each item individually, alongside the driver's batch read for other items.
+
+```ts
+const items = await storage.getItems(
+  ["user:1", { key: "avatar.png", options: { type: "bytes" } }],
+  { type: "json" },
+);
+// Each value is JSONValue | Uint8Array.
+```
+
 ### Writing values
 
 #### `setItem(key, value, options?)`
diff --git a/src/_read.ts b/src/_read.ts
new file mode 100644
index 0000000..c0bdb2a
--- /dev/null
+++ b/src/_read.ts
@@ -0,0 +1,90 @@
+import { destr } from "destr";
+import { deserializeRaw, stringify } from "./_utils.ts";
+import type { GetItemType } from "./types.ts";
+
+export function isRawType(type?: GetItemType): boolean {
+  return type === "bytes" || type === "blob" || type === "stream";
+}
+
+function isInstance<T>(value: unknown, ctor: { new (...args: any[]): T } | undefined): value is T {
+  return !!ctor && value instanceof ctor;
+}
+
+export async function toBytes(value: any): Promise<Uint8Array> {
+  if (value instanceof Uint8Array)
+    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+  if (value instanceof ArrayBuffer) return new Uint8Array(value);
+  if (ArrayBuffer.isView(value)) {
+    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+  }
+  if (isInstance(value, globalThis.Blob) || isInstance(value, globalThis.Response)) {
+    return new Uint8Array(await value.arrayBuffer());
+  }
+  const chunks: Uint8Array[] = [];
+  if (isInstance(value, globalThis.ReadableStream)) {
+    const reader = value.getReader();
+    try {
+      while (true) {
+        const { done, value: chunk } = await reader.read();
+        if (done) break;
+        chunks.push(await toBytes(chunk));
+      }
+    } finally {
+      reader.releaseLock();
+    }
+  } else if (value && typeof value[Symbol.asyncIterator] === "function") {
+    for await (const chunk of value) chunks.push(await toBytes(chunk));
+  } else {
+    const proto = value && typeof value === "object" ? Object.getPrototypeOf(value) : undefined;
+    if (
+      typeof value === "string" ||
+      typeof value === "number" ||
+      typeof value === "boolean" ||
+      Array.isArray(value) ||
+      proto === null ||
+      proto === Object.prototype
+    ) {
+      return new TextEncoder().encode(stringify(value));
+    }
+    throw new Error(
+      `[unstorage] Cannot convert \`${value?.constructor?.name || "Object"}\` to bytes`,
+    );
+  }
+  const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
+  let offset = 0;
+  for (const chunk of chunks) {
+    bytes.set(chunk, offset);
+    offset += chunk.byteLength;
+  }
+  return bytes;
+}
+
+export async function convertValue(value: any, type?: GetItemType): Promise<any> {
+  if (value === null || value === undefined) return null;
+  if (!type) return destr(value);
+  value = deserializeRaw(value);
+  if (type === "blob" && isInstance(value, globalThis.Blob)) return value;
+  if (type === "stream" && isInstance(value, globalThis.ReadableStream)) return value;
+  if (type === "json" || type === "text") {
+    const proto = typeof value === "object" ? Object.getPrototypeOf(value) : undefined;
+    const plain =
+      typeof value !== "object" ||
+      Array.isArray(value) ||
+      proto === null ||
+      proto === Object.prototype;
+    if (plain) return type === "json" ? destr(value) : stringify(value);
+    const text = new TextDecoder().decode(await toBytes(value));
+    return type === "json" ? destr(text) : text;
+  }
+  const bytes = await toBytes(value);
+  if (type === "blob") return new Blob([bytes as Uint8Array<ArrayBuffer>]);
+  if (type === "stream") {
+    return new ReadableStream<Uint8Array>({
+      start(controller) {
+        controller.enqueue(bytes);
+        controller.close();
+      },
+    });
+  }
+  return bytes;
+}
diff --git a/src/storage.ts b/src/storage.ts
index 0c25ad8..8ebf542 100644
--- a/src/storage.ts
+++ b/src/storage.ts
@@ -1,4 +1,5 @@
 import { destr } from "destr";
+import { convertValue, isRawType } from "./_read.ts";
 import type {
   Storage,
   Driver,
@@ -7,6 +8,8 @@ import type {
   StorageValue,
   WatchEvent,
   TransactionOptions,
+  GetItemOptions,
+  GetItemsInput,
 } from "./types.ts";
 import memory from "./drivers/memory.ts";
 import { asyncCall, deserializeRaw, serializeRaw, stringify } from "./_utils.ts";
@@ -150,6 +153,13 @@ export function createStorage<T extends StorageValue>(
     return Promise.all([...batches.values()].map((batch) => cb(batch))).then((r) => r.flat());
   };
 
+  const readItem = async (key: string, opts: GetItemOptions = {}) => {
+    const { relativeKey, driver } = getMount(normalizeKey(key));
+    const { type, ...driverOptions } = opts;
+    const read = isRawType(type) ? driver.getItemRaw || driver.getItem : driver.getItem;
+    return convertValue(await asyncCall(read, relativeKey, driverOptions), type);
+  };
+
   const storage: Storage = {
     // Item
     hasItem(key: string, opts = {}) {
@@ -157,44 +167,69 @@ export function createStorage<T extends StorageValue>(
       const { relativeKey, driver } = getMount(key);
       return asyncCall(driver.hasItem, relativeKey, opts);
     },
-    getItem(key: string, opts = {}) {
-      key = normalizeKey(key);
-      const { relativeKey, driver } = getMount(key);
-      return asyncCall(driver.getItem, relativeKey, opts).then(
-        (value) => destr(value) as StorageValue,
-      );
-    },
-    getItems(
-      items: (string | { key: string; options?: TransactionOptions })[],
-      commonOptions = {},
-    ) {
-      return runBatch(items, commonOptions, (batch) => {
-        if (batch.driver.getItems) {
-          return asyncCall(
-            batch.driver.getItems,
-            batch.items.map((item) => ({
-              key: item.relativeKey,
-              options: item.options,
-            })),
-            commonOptions,
-          ).then((r) =>
-            r.map((item) => ({
-              key: joinKeys(batch.base, item.key),
-              value: destr(item.value),
-            })),
-          );
-        }
-        return Promise.all(
-          batch.items.map((item) => {
-            return asyncCall(batch.driver.getItem, item.relativeKey, item.options).then(
-              (value) => ({
-                key: item.key,
-                value: destr(value),
-              }),
-            );
-          }),
-        );
+    getItem: readItem,
+    async getItems(items: readonly GetItemsInput[], commonOptions: GetItemOptions = {}) {
+      const results: { key: string; value: any }[] = [];
+      // Track positions separately from keys: duplicate keys and rewritten driver keys are valid.
+      const batches = new Map<
+        Driver,
+        { index: number; key: string; relativeKey: string; base: string; options: GetItemOptions }[]
+      >();
+      items.forEach((item, index) => {
+        const key = normalizeKey(typeof item === "string" ? item : item.key);
+        const mount = getMount(key);
+        const options = { ...commonOptions, ...(typeof item === "string" ? {} : item.options) };
+        const batch = batches.get(mount.driver) || [];
+        batch.push({ index, key, relativeKey: mount.relativeKey, base: mount.base, options });
+        batches.set(mount.driver, batch);
       });
+      const { type: _type, ...driverCommonOptions } = commonOptions;
+      await Promise.all(
+        [...batches].map(async ([driver, items]) => {
+          const normal = items.filter((item) => !isRawType(item.options.type));
+          const raw = items.filter((item) => isRawType(item.options.type));
+          await Promise.all([
+            ...raw.map(async (item) => {
+              results[item.index] = {
+                key: item.key,
+                value: await readItem(item.key, item.options),
+              };
+            }),
+            (async () => {
+              if (!normal.length) return;
+              if (driver.getItems) {
+                const values = await asyncCall(
+                  driver.getItems,
+                  normal.map((item) => {
+                    const { type: _type, ...options } = item.options;
+                    return { key: item.relativeKey, options };
+                  }),
+                  driverCommonOptions,
+                );
+                await Promise.all(
+                  normal.map(async (item, index) => {
+                    const result = values[index];
+                    results[item.index] = {
+                      key: result ? joinKeys(item.base, result.key) : item.key,
+                      value: await convertValue(result?.value, item.options.type),
+                    };
+                  }),
+                );
+              } else {
+                await Promise.all(
+                  normal.map(async (item) => {
+                    results[item.index] = {
+                      key: item.key,
+                      value: await readItem(item.key, item.options),
+                    };
+                  }),
+                );
+              }
+            })(),
+          ]);
+        }),
+      );
+      return results;
     },
     getItemRaw(key, opts = {}) {
       key = normalizeKey(key);
diff --git a/src/tracing.ts b/src/tracing.ts
index cd7401d..5f28958 100644
--- a/src/tracing.ts
+++ b/src/tracing.ts
@@ -133,7 +133,9 @@ export function withTracing<T extends StorageValue>(storage: MaybeTracedStorage<
       return normalizer(typeof i === "string" ? i : i.key);
     };
 
-    return Array.isArray(keyArg) ? keyArg.map((i) => getKeyValue(i)) : [getKeyValue(keyArg)];
+    return Array.isArray(keyArg)
+      ? keyArg.map((i) => getKeyValue(i))
+      : [getKeyValue(keyArg as string | { key: string })];
   };
 
   function wrapOperation<
diff --git a/src/types.ts b/src/types.ts
index 40f3988..4e21b5d 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -1,3 +1,24 @@
+export type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
+export type JSONObject = { [key: string]: JSONValue };
+export type JSONArray = JSONValue[];
+export interface GetItemTypeMap {
+  text: string;
+  json: JSONValue;
+  bytes: Uint8Array;
+  blob: Blob;
+  stream: ReadableStream<Uint8Array>;
+}
+export type GetItemType = keyof GetItemTypeMap;
+export type GetItemOptions = TransactionOptions & { type?: GetItemType };
+export type GetItemsInput = string | { key: string; options?: GetItemOptions };
+type GetItemsValue<I, C> = I extends unknown
+  ? I extends { options: { type: infer P extends GetItemType } }
+    ? GetItemTypeMap[P]
+    : C extends GetItemType
+      ? GetItemTypeMap[C]
+      : StorageValue
+  : never;
+
 export type StorageValue = null | string | number | boolean | object;
 export type WatchEvent = "update" | "remove";
 export type WatchCallback = (event: WatchEvent, key: string) => any;
@@ -112,20 +133,24 @@ export interface Storage<T extends StorageValue = StorageValue> {
   ): Promise<boolean>;
   hasItem(key: string, opts?: TransactionOptions): Promise<boolean>;
 
+  getItem<P extends GetItemType>(
+    key: string,
+    opts: GetItemOptions & { type: P },
+  ): Promise<GetItemTypeMap[P] | null>;
   getItem<U extends Extract<T, StorageDefinition>, K extends string & keyof StorageItemMap<U>>(
     key: K,
-    ops?: TransactionOptions,
+    ops?: GetItemOptions & { type?: undefined },
   ): Promise<StorageItemType<T, K> | null>;
   getItem<R = StorageItemType<T, string>>(
     key: string,
-    opts?: TransactionOptions,
+    opts?: GetItemOptions & { type?: undefined },
   ): Promise<R | null>;
 
   /** @experimental */
-  getItems: <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => Promise<{ key: string; value: U }[]>;
+  getItems<const I extends readonly GetItemsInput[], C extends GetItemType | undefined = undefined>(
+    items: I,
+    commonOptions?: GetItemOptions & { type?: C },
+  ): Promise<{ key: string; value: GetItemsValue<I[number], C> | null }[]>;
   /** @experimental See https://github.com/unjs/unstorage/issues/142 */
   getItemRaw: <T = any>(key: string, opts?: TransactionOptions) => Promise<MaybeDefined<T> | null>;
 
diff --git a/src/utils.ts b/src/utils.ts
index eb44352..e01dd20 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,4 +1,10 @@
-import type { Storage, StorageValue, TransactionOptions } from "./types.ts";
+import type {
+  Storage,
+  StorageValue,
+  TransactionOptions,
+  GetItemsInput,
+  GetItemOptions,
+} from "./types.ts";
 
 type StorageKeys = Array<keyof Storage>;
 
@@ -56,19 +62,16 @@ export function prefixStorage<T extends StorageValue>(
       }
     });
 
-  nsStorage.getItems = async <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => {
+  nsStorage.getItems = (async (items: readonly GetItemsInput[], commonOptions?: GetItemOptions) => {
     const prefixedItems = items.map((item) =>
       typeof item === "string" ? base + item : { ...item, key: base + item.key },
     );
-    const results = await storage.getItems<U>(prefixedItems, commonOptions);
+    const results = await storage.getItems(prefixedItems, commonOptions);
     return results.map((entry) => ({
       key: entry.key.slice(base.length),
       value: entry.value,
     }));
-  };
+  }) as Storage<T>["getItems"];
 
   nsStorage.setItems = async <U extends T>(
     items: { key: string; value: U; options?: TransactionOptions }[],
diff --git a/test/get-item-type.test.ts b/test/get-item-type.test.ts
new file mode 100644
index 0000000..da2ed5b
--- /dev/null
+++ b/test/get-item-type.test.ts
@@ -0,0 +1,146 @@
+import { describe, it, expect, vi } from "vitest";
+import { createStorage, prefixStorage } from "../src/index.ts";
+import memory from "../src/drivers/memory.ts";
+
+const encode = (value: string) => new TextEncoder().encode(value);
+
+describe("read types", () => {
+  it("decodes raw values and preserves default reads", async () => {
+    for (const raw of [true, false]) {
+      const driver = memory();
+      if (!raw) {
+        delete driver.getItemRaw;
+        delete driver.setItemRaw;
+      }
+      const storage = createStorage({ driver });
+      await storage.setItemRaw("greeting", encode("hello wörld"));
+      expect(await storage.get("greeting", { type: "text" })).toBe("hello wörld");
+      await storage.setItemRaw("json", encode('{"a":1}'));
+      expect(await storage.getItem("json", { type: "json" })).toEqual({ a: 1 });
+      for (const type of ["text", "json", "bytes", "blob", "stream"] as const) {
+        expect(await storage.getItem("missing", { type })).toBeNull();
+      }
+      expect(await storage.getItem("missing")).toBeNull();
+    }
+    const driver = memory();
+    driver.getItem = () => undefined as any;
+    expect(await createStorage({ driver }).getItem("missing")).toBeNull();
+  });
+
+  it("normalizes binary and plain values", async () => {
+    const bytes = encode("hello wörld");
+    const values = [
+      bytes,
+      Buffer.from(bytes),
+      bytes.buffer,
+      new DataView(bytes.buffer),
+      new Blob([bytes]),
+      new Response(bytes),
+      new Blob([bytes]).stream(),
+      (async function* () {
+        yield bytes.subarray(0, 2);
+        yield bytes.subarray(2);
+      })(),
+    ];
+    for (const value of values) {
+      const driver = memory();
+      driver.getItemRaw = () => value;
+      expect(await createStorage({ driver }).getItem("key", { type: "bytes" })).toEqual(bytes);
+    }
+    for (const value of [true, 42, { a: 1 }, [1, 2], "hello wörld"]) {
+      const driver = memory();
+      driver.getItemRaw = () => value;
+      driver.getItem = () => value;
+      const storage = createStorage({ driver });
+      expect(await storage.getItem("key", { type: "bytes" })).toEqual(
+        encode((await storage.getItem("key", { type: "text" }))!),
+      );
+    }
+    const driver = memory();
+    driver.getItemRaw = () => new Map();
+    await expect(createStorage({ driver }).getItem("key", { type: "bytes" })).rejects.toThrow(
+      "Cannot convert `Map` to bytes",
+    );
+  });
+
+  it("preserves blobs and streams and releases failed stream readers", async () => {
+    const storage = createStorage();
+    const blob = new Blob(["hello"]);
+    const stream = blob.stream();
+    await storage.setItemRaw("blob", blob);
+    await storage.setItemRaw("stream", stream);
+    expect(await storage.getItem("blob", { type: "blob" })).toBe(blob);
+    expect(await storage.getItem("stream", { type: "stream" })).toBe(stream);
+    const failing = new ReadableStream({
+      pull(controller) {
+        controller.error(new Error("broken"));
+      },
+    });
+    await storage.setItemRaw("bad", failing);
+    await expect(storage.getItem("bad", { type: "bytes" })).rejects.toThrow("broken");
+    expect(failing.locked).toBe(false);
+    await storage.setItem("value", "hello");
+    expect(await (await storage.getItem("value", { type: "blob" }))!.text()).toBe("hello");
+    expect(await new Response((await storage.getItem("value", { type: "stream" }))!).text()).toBe(
+      "hello",
+    );
+  });
+
+  it("starts raw reads alongside the driver batch", async () => {
+    const driver = memory();
+    let release!: () => void;
+    const rawStarted = new Promise<void>((resolve) => {
+      release = resolve;
+    });
+    driver.getItems = async () => {
+      await rawStarted;
+      return [{ key: "text", value: "hello" }];
+    };
+    driver.getItemRaw = () => {
+      release();
+      return encode("raw");
+    };
+    const storage = createStorage({ driver });
+    expect(await storage.getItems(["text", { key: "raw", options: { type: "bytes" } }])).toEqual([
+      { key: "text", value: "hello" },
+      { key: "raw", value: encode("raw") },
+    ]);
+  });
+
+  it("uses positional batch types, strips type, and keeps order across mounts", async () => {
+    const driver = memory();
+    driver.getItems = vi.fn(async (items, common) => {
+      expect(common).toEqual({ consistency: "strong" });
+      expect(items).toEqual([
+        { key: "a", options: { consistency: "strong" } },
+        { key: "a", options: { consistency: "strong" } },
+      ]);
+      return items.map(() => ({ key: "rewritten", value: '{"a":1}' }));
+    });
+    driver.getItemRaw = vi.fn((_key, options) => {
+      expect(options).toEqual({ consistency: "strong" });
+      return encode("raw");
+    });
+    const storage = createStorage({ driver });
+    storage.mount("other", memory());
+    await storage.setItem("other:b", 42);
+    const result = await storage.getItems(
+      [
+        "a",
+        "other:b",
+        { key: "binary", options: { type: "bytes" } },
+        { key: "a", options: { type: "json" } },
+      ],
+      { type: "text", consistency: "strong" },
+    );
+    expect(result).toEqual([
+      { key: "rewritten", value: '{"a":1}' },
+      { key: "other:b", value: "42" },
+      { key: "binary", value: encode("raw") },
+      { key: "rewritten", value: { a: 1 } },
+    ]);
+    expect(driver.getItemRaw).toHaveBeenCalledOnce();
+    const prefixed = prefixStorage(storage, "other");
+    expect(await prefixed.getItems(["b"], { type: "text" })).toEqual([{ key: "b", value: "42" }]);
+  });
+});
diff --git a/test/storage.test-d.ts b/test/storage.test-d.ts
index 9d8933c..a43c93f 100644
--- a/test/storage.test-d.ts
+++ b/test/storage.test-d.ts
@@ -81,3 +81,33 @@ describe("types", () => {
     expectTypeOf(prefixedStorage3).toEqualTypeOf<Storage<number>>();
   });
 });
+
+it("infers read formats", async () => {
+  const storage = createStorage();
+  expectTypeOf(await storage.getItem("key", { type: "bytes" })).toEqualTypeOf<Uint8Array | null>();
+  expectTypeOf(await storage.get("key", { type: "blob" })).toEqualTypeOf<Blob | null>();
+  expectTypeOf(
+    await storage.getItem("key", { type: "stream" }),
+  ).toEqualTypeOf<ReadableStream<Uint8Array> | null>();
+  expectTypeOf(await storage.getItem("key", { type: "json" })).toEqualTypeOf<
+    import("../src/index.ts").JSONValue
+  >();
+  expectTypeOf(await storage.getItems(["key"], { type: "text" })).toEqualTypeOf<
+    { key: string; value: string | null }[]
+  >();
+  expectTypeOf(await storage.getItems([{ key: "key", options: { type: "bytes" } }])).toEqualTypeOf<
+    { key: string; value: Uint8Array | null }[]
+  >();
+  expectTypeOf(
+    await storage.getItems(["key", { key: "other", options: { type: "bytes" } }], { type: "json" }),
+  ).toEqualTypeOf<{ key: string; value: import("../src/index.ts").JSONValue | Uint8Array }[]>();
+  expectTypeOf(
+    await storage.getItems(["key", { key: "other", options: { type: "bytes" } }]),
+  ).toEqualTypeOf<{ key: string; value: StorageValue | Uint8Array }[]>();
+  // @ts-expect-error unknown format
+  storage.getItem("key", { type: "buffer" });
+  // @ts-expect-error unknown format
+  storage.getItems([{ key: "key", options: { type: "buffer" } }]);
+  // @ts-expect-error unknown common format
+  storage.getItems(["key"], { type: "buffer" });
+});
```

</details>

<details><summary>reply</summary>

I’ll check the read paths and types, add the conversions and option handling, then verify them with runtime and type tests.

The conversion paths and batch handling are in place. Binary reads use the driver’s raw method, and batch results are matched by position to preserve order and per-item types. I’ll now test raw decoding, stream failures, and TypeScript inference.

The runtime tests pass, including raw UTF-8 decoding, Blob and stream identity, reader-lock release on failure, and positional batch conversion. The new type assertions also pass. The full type check reports an existing `node-fs.ts` error involving an optional encoding argument; I’ll leave that unrelated code unchanged and finish verification.

Added `type` support to `getItem()`, `get()`, and `getItems()`, including conversions, inferred return types, exported types, and documentation.

Validation: build succeeded and 164 runtime tests passed. New type assertions passed; the full type check remains blocked by an existing optional-encoding error in `src/drivers/utils/node-fs.ts`.

</details>

### codex, hush: FAIL

Files: [docs/1.guide/1.index.md](../hush/codex/ts-unstorage-get-item-type-1/files/docs/1.guide/1.index.md), [src/_read.ts](../hush/codex/ts-unstorage-get-item-type-1/files/src/_read.ts), [src/storage.ts](../hush/codex/ts-unstorage-get-item-type-1/files/src/storage.ts), [src/types.ts](../hush/codex/ts-unstorage-get-item-type-1/files/src/types.ts), [src/utils.ts](../hush/codex/ts-unstorage-get-item-type-1/files/src/utils.ts), [test/read-types.test.ts](../hush/codex/ts-unstorage-get-item-type-1/files/test/read-types.test.ts), [test/storage.test-d.ts](../hush/codex/ts-unstorage-get-item-type-1/files/test/storage.test-d.ts)

<details><summary>diff</summary>

```diff
diff --git a/docs/1.guide/1.index.md b/docs/1.guide/1.index.md
index 5b54950..5bcb94e 100644
--- a/docs/1.guide/1.index.md
+++ b/docs/1.guide/1.index.md
@@ -68,6 +68,18 @@ const value = await storage.getItem("user:1");
 
 Alias: `storage.get()`.
 
+Use `type` to choose the returned format. Missing values return `null` for every format.
+
+```ts
+await storage.getItem("user:1", { type: "text" }); // string | null
+await storage.getItem("user:1", { type: "json" }); // JSONValue | null
+await storage.getItem("avatar.png", { type: "bytes" }); // Uint8Array | null
+await storage.getItem("avatar.png", { type: "blob" }); // Blob | null
+await storage.get("avatar.png", { type: "stream" }); // ReadableStream<Uint8Array> | null
+```
+
+`text` and `json` decode raw bytes and base64 values written by `setItemRaw()`. JSON parsing is lenient: ordinary strings stay strings. Binary formats use the driver's raw read when available and normalize binary values or UTF-8 text. Existing blobs and streams are returned directly for their matching format. Without `type`, reads keep their default deserialization behavior. The `type` option is reserved and is not passed to drivers; use `bytes` instead of driver-specific options such as Netlify Blobs' `arrayBuffer`.
+
 #### `getItems(items, commonOptions?)`
 
 ::warning
@@ -84,6 +96,18 @@ const items = await storage.getItems([
 // [{ key: "user:1", value: ... }, { key: "user:2", value: ... }]
 ```
 
+Results preserve input order. Set a common `type` or override it per item:
+
+```ts
+const items = await storage.getItems(
+  ["user:1", { key: "avatar.png", options: { type: "bytes" } }],
+  { type: "json" },
+);
+// Values: JSONValue | Uint8Array | null
+```
+
+Binary items are read individually, in parallel with any driver batch for other items.
+
 ### Writing values
 
 #### `setItem(key, value, options?)`
diff --git a/src/_read.ts b/src/_read.ts
new file mode 100644
index 0000000..35508ff
--- /dev/null
+++ b/src/_read.ts
@@ -0,0 +1,88 @@
+import { destr } from "destr";
+import { deserializeRaw, stringify } from "./_utils.ts";
+import type { GetItemType } from "./types.ts";
+
+export function isBinaryType(type?: GetItemType) {
+  return type === "bytes" || type === "blob" || type === "stream";
+}
+
+export async function toBytes(value: any): Promise<Uint8Array> {
+  if (value instanceof Uint8Array) return value;
+  if (value instanceof ArrayBuffer) return new Uint8Array(value);
+  if (ArrayBuffer.isView(value)) {
+    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+  }
+  if (value instanceof Blob || value instanceof Response) {
+    return new Uint8Array(await value.arrayBuffer());
+  }
+  if (value instanceof ReadableStream) {
+    const reader = value.getReader();
+    const chunks: Uint8Array[] = [];
+    try {
+      while (true) {
+        const { done, value: chunk } = await reader.read();
+        if (done) break;
+        chunks.push(await toBytes(chunk));
+      }
+    } finally {
+      reader.releaseLock();
+    }
+    return concat(chunks);
+  }
+  if (value?.[Symbol.asyncIterator]) {
+    const chunks: Uint8Array[] = [];
+    for await (const chunk of value) chunks.push(await toBytes(chunk));
+    return concat(chunks);
+  }
+  if (
+    typeof value === "string" ||
+    typeof value === "number" ||
+    typeof value === "boolean" ||
+    value === null ||
+    Array.isArray(value) ||
+    (typeof value === "object" &&
+      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null))
+  ) {
+    return new TextEncoder().encode(stringify(value));
+  }
+  throw new TypeError(`Cannot convert \`${value?.constructor?.name || "Object"}\` to bytes`);
+}
+
+function concat(chunks: Uint8Array[]) {
+  const result = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
+  let offset = 0;
+  for (const chunk of chunks) {
+    result.set(chunk, offset);
+    offset += chunk.byteLength;
+  }
+  return result;
+}
+
+export async function readValue(value: any, type?: GetItemType): Promise<any> {
+  if (value == null) return null;
+  if (!type) return destr(value);
+  value = deserializeRaw(value);
+  if (type === "blob" && value instanceof Blob) return value;
+  if (type === "stream" && value instanceof ReadableStream) return value;
+  if (isBinaryType(type)) {
+    const bytes = await toBytes(value);
+    if (type === "blob") return new Blob([bytes as Uint8Array<ArrayBuffer>]);
+    if (type === "stream")
+      return new ReadableStream({
+        start(controller) {
+          controller.enqueue(bytes);
+          controller.close();
+        },
+      });
+    return bytes;
+  }
+  const binary =
+    value instanceof ArrayBuffer ||
+    ArrayBuffer.isView(value) ||
+    value instanceof Blob ||
+    value instanceof ReadableStream ||
+    value instanceof Response ||
+    value?.[Symbol.asyncIterator];
+  if (binary) value = new TextDecoder().decode(await toBytes(value));
+  return type === "text" ? (typeof value === "string" ? value : stringify(value)) : destr(value);
+}
diff --git a/src/storage.ts b/src/storage.ts
index 0c25ad8..74c9c70 100644
--- a/src/storage.ts
+++ b/src/storage.ts
@@ -7,7 +7,10 @@ import type {
   StorageValue,
   WatchEvent,
   TransactionOptions,
+  GetItemOptions,
+  GetItemsInput,
 } from "./types.ts";
+import { isBinaryType, readValue } from "./_read.ts";
 import memory from "./drivers/memory.ts";
 import { asyncCall, deserializeRaw, serializeRaw, stringify } from "./_utils.ts";
 import {
@@ -157,44 +160,67 @@ export function createStorage<T extends StorageValue>(
       const { relativeKey, driver } = getMount(key);
       return asyncCall(driver.hasItem, relativeKey, opts);
     },
-    getItem(key: string, opts = {}) {
+    getItem(key: string, opts: GetItemOptions = {}) {
       key = normalizeKey(key);
       const { relativeKey, driver } = getMount(key);
-      return asyncCall(driver.getItem, relativeKey, opts).then(
-        (value) => destr(value) as StorageValue,
-      );
+      const { type, ...driverOptions } = opts;
+      const getter = isBinaryType(type) ? driver.getItemRaw || driver.getItem : driver.getItem;
+      return asyncCall(getter, relativeKey, driverOptions).then((value) => readValue(value, type));
     },
-    getItems(
-      items: (string | { key: string; options?: TransactionOptions })[],
-      commonOptions = {},
-    ) {
-      return runBatch(items, commonOptions, (batch) => {
-        if (batch.driver.getItems) {
-          return asyncCall(
-            batch.driver.getItems,
-            batch.items.map((item) => ({
-              key: item.relativeKey,
-              options: item.options,
-            })),
-            commonOptions,
-          ).then((r) =>
-            r.map((item) => ({
-              key: joinKeys(batch.base, item.key),
-              value: destr(item.value),
-            })),
+    async getItems(items: GetItemsInput[], commonOptions: GetItemOptions = {}) {
+      const { type: commonType, ...driverCommonOptions } = commonOptions;
+      const results: { key: string; value: any }[] = [];
+      const batches = new Map<
+        Driver,
+        {
+          key: string;
+          base: string;
+          index: number;
+          options: TransactionOptions;
+          type?: GetItemOptions["type"];
+        }[]
+      >();
+      const reads: Promise<any>[] = [];
+      for (const [index, item] of items.entries()) {
+        const key = normalizeKey(typeof item === "string" ? item : item.key);
+        const { relativeKey, base, driver } = getMount(key);
+        const { type = commonType, ...options } = {
+          ...commonOptions,
+          ...(typeof item === "string" ? {} : item.options),
+        };
+        if (isBinaryType(type) || !driver.getItems) {
+          reads.push(
+            storage.getItem(key, { ...options, type } as any).then((value) => {
+              results[index] = { key, value };
+            }),
           );
+        } else {
+          let batch = batches.get(driver);
+          if (!batch) batches.set(driver, (batch = []));
+          batch.push({ key: relativeKey, base, index, options, type });
         }
-        return Promise.all(
-          batch.items.map((item) => {
-            return asyncCall(batch.driver.getItem, item.relativeKey, item.options).then(
-              (value) => ({
-                key: item.key,
-                value: destr(value),
+      }
+      for (const [driver, batch] of batches) {
+        reads.push(
+          asyncCall(
+            driver.getItems!,
+            batch.map(({ key, options }) => ({ key, options })),
+            driverCommonOptions,
+          ).then(async (values) => {
+            await Promise.all(
+              values.map(async (item, position) => {
+                const input = batch[position]!;
+                results[input.index] = {
+                  key: joinKeys(input.base, item.key),
+                  value: await readValue(item.value, input.type),
+                };
               }),
             );
           }),
         );
-      });
+      }
+      await Promise.all(reads);
+      return results;
     },
     getItemRaw(key, opts = {}) {
       key = normalizeKey(key);
diff --git a/src/types.ts b/src/types.ts
index 40f3988..5c0a7f5 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -1,4 +1,24 @@
 export type StorageValue = null | string | number | boolean | object;
+export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
+export interface JSONObject {
+  [key: string]: JSONValue;
+}
+export interface JSONArray extends Array<JSONValue> {}
+export interface GetItemTypeMap {
+  text: string;
+  json: JSONValue;
+  bytes: Uint8Array;
+  blob: Blob;
+  stream: ReadableStream<Uint8Array>;
+}
+export type GetItemType = keyof GetItemTypeMap;
+export type GetItemOptions<T extends GetItemType = GetItemType> = TransactionOptions & { type?: T };
+export type GetItemsInput = string | { key: string; options?: GetItemOptions };
+type ReadValue<O, F> = O extends { type: infer R extends GetItemType } ? GetItemTypeMap[R] : F;
+type ItemReadValue<I, O, F> = I extends { options: infer P }
+  ? ReadValue<P, ReadValue<O, F>>
+  : ReadValue<O, F>;
+
 export type WatchEvent = "update" | "remove";
 export type WatchCallback = (event: WatchEvent, key: string) => any;
 
@@ -112,20 +132,28 @@ export interface Storage<T extends StorageValue = StorageValue> {
   ): Promise<boolean>;
   hasItem(key: string, opts?: TransactionOptions): Promise<boolean>;
 
+  getItem<R extends GetItemType>(
+    key: string,
+    opts: GetItemOptions<R> & { type: R },
+  ): Promise<GetItemTypeMap[R] | null>;
   getItem<U extends Extract<T, StorageDefinition>, K extends string & keyof StorageItemMap<U>>(
     key: K,
-    ops?: TransactionOptions,
+    ops?: GetItemOptions<never>,
   ): Promise<StorageItemType<T, K> | null>;
   getItem<R = StorageItemType<T, string>>(
     key: string,
-    opts?: TransactionOptions,
+    opts?: GetItemOptions<never>,
   ): Promise<R | null>;
 
   /** @experimental */
-  getItems: <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => Promise<{ key: string; value: U }[]>;
+  getItems<const I extends GetItemsInput[], const O extends GetItemOptions = {}>(
+    items: I,
+    commonOptions?: O,
+  ): Promise<{ key: string; value: ItemReadValue<I[number], O, StorageValue> | null }[]>;
+  getItems<U extends T>(
+    items: GetItemsInput[],
+    commonOptions?: GetItemOptions<never>,
+  ): Promise<{ key: string; value: U | null }[]>;
   /** @experimental See https://github.com/unjs/unstorage/issues/142 */
   getItemRaw: <T = any>(key: string, opts?: TransactionOptions) => Promise<MaybeDefined<T> | null>;
 
diff --git a/src/utils.ts b/src/utils.ts
index eb44352..d27b1d6 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -56,19 +56,19 @@ export function prefixStorage<T extends StorageValue>(
       }
     });
 
-  nsStorage.getItems = async <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
+  nsStorage.getItems = (async (
+    items: import("./types.ts").GetItemsInput[],
+    commonOptions?: import("./types.ts").GetItemOptions,
   ) => {
     const prefixedItems = items.map((item) =>
       typeof item === "string" ? base + item : { ...item, key: base + item.key },
     );
-    const results = await storage.getItems<U>(prefixedItems, commonOptions);
+    const results = await storage.getItems(prefixedItems, commonOptions);
     return results.map((entry) => ({
       key: entry.key.slice(base.length),
       value: entry.value,
     }));
-  };
+  }) as Storage<T>["getItems"];
 
   nsStorage.setItems = async <U extends T>(
     items: { key: string; value: U; options?: TransactionOptions }[],
diff --git a/test/read-types.test.ts b/test/read-types.test.ts
new file mode 100644
index 0000000..5b79615
--- /dev/null
+++ b/test/read-types.test.ts
@@ -0,0 +1,139 @@
+import { describe, it, expect } from "vitest";
+import { createStorage, type Driver } from "../src/index.ts";
+
+const encoder = new TextEncoder();
+const decoder = new TextDecoder();
+
+describe("read formats", () => {
+  it("decodes raw data and preserves missing values", async () => {
+    for (const raw of [true, false]) {
+      const values = new Map();
+      const storage = raw
+        ? createStorage()
+        : createStorage({
+            driver: {
+              hasItem: (key) => values.has(key),
+              getKeys: () => [...values.keys()],
+              getItem: (key) => values.get(key),
+              setItem: (key, value) => {
+                values.set(key, value);
+              },
+            },
+          });
+      await storage.setItemRaw("text", encoder.encode("hello wörld"));
+      await storage.setItemRaw("json", encoder.encode('{"a":1}'));
+      expect(await storage.get("text", { type: "text" })).toBe("hello wörld");
+      expect(await storage.getItem("json", { type: "json" })).toEqual({ a: 1 });
+      expect(await (await storage.getItem("text", { type: "blob" }))!.text()).toBe("hello wörld");
+      expect(await new Response((await storage.getItem("text", { type: "stream" }))!).text()).toBe(
+        "hello wörld",
+      );
+
+      for (const type of [undefined, "text", "json", "bytes", "blob", "stream"] as const) {
+        expect(await storage.getItem("missing", { type } as any)).toBeNull();
+      }
+    }
+  });
+
+  it("normalizes binary and plain values", async () => {
+    const bytes = encoder.encode("hello");
+    for (const value of [
+      bytes,
+      bytes.buffer,
+      new DataView(bytes.buffer),
+      new Blob([bytes]),
+      new Response(bytes),
+      new ReadableStream({
+        start(c) {
+          c.enqueue(bytes);
+          c.close();
+        },
+      }),
+      (async function* () {
+        yield bytes;
+      })(),
+      "hello",
+      true,
+      42,
+      { a: 1 },
+      [1],
+    ]) {
+      const storage = createStorage({
+        driver: {
+          hasItem: () => true,
+          getKeys: () => [],
+          getItem: () => null,
+          getItemRaw: () => value,
+        },
+      });
+      const expected =
+        typeof value === "boolean"
+          ? "true"
+          : typeof value === "number"
+            ? "42"
+            : Array.isArray(value)
+              ? "[1]"
+              : value?.constructor === Object
+                ? '{"a":1}'
+                : "hello";
+      expect(decoder.decode((await storage.getItem("x", { type: "bytes" }))!)).toBe(expected);
+    }
+  });
+
+  it("preserves matching blobs and streams and releases failing readers", async () => {
+    const storage = createStorage();
+    const blob = new Blob(["hello"]);
+    const stream = new ReadableStream();
+    await storage.setItemRaw("blob", blob);
+    await storage.setItemRaw("stream", stream);
+    expect(await storage.getItem("blob", { type: "blob" })).toBe(blob);
+    expect(await storage.getItem("stream", { type: "stream" })).toBe(stream);
+    const broken = new ReadableStream({
+      pull(c) {
+        c.error(new Error("broken"));
+      },
+    });
+    await storage.setItemRaw("broken", broken);
+    await expect(storage.getItem("broken", { type: "bytes" })).rejects.toThrow("broken");
+    expect(broken.locked).toBe(false);
+    await storage.setItemRaw("map", new Map());
+    await expect(storage.getItem("map", { type: "bytes" })).rejects.toThrow(
+      "Cannot convert `Map` to bytes",
+    );
+  });
+
+  it("mixes batches with raw reads, strips types, and matches positions", async () => {
+    const driver: Driver = {
+      hasItem: () => true,
+      getKeys: () => [],
+      getItem: () => "fallback",
+      getItemRaw: (key, options) => {
+        expect(options).not.toHaveProperty("type");
+        return encoder.encode(key);
+      },
+      getItems: (items, options) => {
+        expect(options).not.toHaveProperty("type");
+        for (const item of items) expect(item.options).not.toHaveProperty("type");
+        return items.map(({ key }) => ({ key: "changed-" + key, value: "42" }));
+      },
+    };
+    const storage = createStorage({ driver });
+    storage.mount("mount", { ...driver });
+    const results = await storage.getItems(
+      [
+        "a",
+        { key: "raw", options: { type: "bytes" } },
+        "mount:b",
+        { key: "c", options: { type: "json" } },
+      ],
+      { type: "text" },
+    );
+    expect(results.map((item) => item.key)).toEqual([
+      "changed-a",
+      "raw",
+      "mount:changed-b",
+      "changed-c",
+    ]);
+    expect(results.map((item) => item.value)).toEqual(["42", encoder.encode("raw"), "42", 42]);
+  });
+});
diff --git a/test/storage.test-d.ts b/test/storage.test-d.ts
index 9d8933c..dd4e0a0 100644
--- a/test/storage.test-d.ts
+++ b/test/storage.test-d.ts
@@ -81,3 +81,32 @@ describe("types", () => {
     expectTypeOf(prefixedStorage3).toEqualTypeOf<Storage<number>>();
   });
 });
+
+it("read format inference", async () => {
+  const storage = createStorage();
+  expectTypeOf(await storage.getItem("x", { type: "bytes" })).toEqualTypeOf<Uint8Array | null>();
+  expectTypeOf(await storage.get("x", { type: "blob" })).toEqualTypeOf<Blob | null>();
+  expectTypeOf(
+    await storage.getItem("x", { type: "stream" }),
+  ).toEqualTypeOf<ReadableStream<Uint8Array> | null>();
+  expectTypeOf(await storage.getItems(["x"], { type: "text" })).toEqualTypeOf<
+    { key: string; value: string | null }[]
+  >();
+  expectTypeOf(
+    await storage.getItems([{ key: "x", options: { type: "bytes" } }, "y"], { type: "json" }),
+  ).toEqualTypeOf<
+    { key: string; value: import("../src/index.ts").JSONValue | Uint8Array | null }[]
+  >();
+  expectTypeOf(await storage.getItems([{ key: "x", options: { type: "bytes" } }])).toEqualTypeOf<
+    { key: string; value: Uint8Array | null }[]
+  >();
+  expectTypeOf(await storage.getItems(["x"])).toEqualTypeOf<
+    { key: string; value: StorageValue | null }[]
+  >();
+  // @ts-expect-error unknown format
+  storage.getItem("x", { type: "buffer" });
+  // @ts-expect-error unknown item format
+  storage.getItems([{ key: "x", options: { type: "buffer" } }]);
+  // @ts-expect-error unknown common format
+  storage.getItems(["x"], { type: "buffer" });
+});
```

</details>

<details><summary>reply</summary>

Done.
Added typed reads, binary normalization, ordered batches, exports, docs, and tests. 54 targeted tests pass; full typecheck blocked by existing errors.

</details>

### codex, sloth: FAIL

Files: [docs/1.guide/1.index.md](../sloth/codex/ts-unstorage-get-item-type-1/files/docs/1.guide/1.index.md), [src/_utils.ts](../sloth/codex/ts-unstorage-get-item-type-1/files/src/_utils.ts), [src/storage.ts](../sloth/codex/ts-unstorage-get-item-type-1/files/src/storage.ts), [src/types.ts](../sloth/codex/ts-unstorage-get-item-type-1/files/src/types.ts), [src/utils.ts](../sloth/codex/ts-unstorage-get-item-type-1/files/src/utils.ts), [test/storage.test-d.ts](../sloth/codex/ts-unstorage-get-item-type-1/files/test/storage.test-d.ts), [test/storage.test.ts](../sloth/codex/ts-unstorage-get-item-type-1/files/test/storage.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/docs/1.guide/1.index.md b/docs/1.guide/1.index.md
index 5b54950..afcc0ed 100644
--- a/docs/1.guide/1.index.md
+++ b/docs/1.guide/1.index.md
@@ -68,6 +68,20 @@ const value = await storage.getItem("user:1");
 
 Alias: `storage.get()`.
 
+Use `type` to choose the returned format. Missing values return `null` for every format.
+
+```ts
+await storage.getItem("user:1", { type: "text" }); // string | null
+await storage.getItem("user:1", { type: "json" }); // JSONValue | null
+await storage.getItem("avatar.png", { type: "bytes" }); // Uint8Array | null
+await storage.getItem("avatar.png", { type: "blob" }); // Blob | null
+await storage.getItem("avatar.png", { type: "stream" }); // ReadableStream<Uint8Array> | null
+```
+
+`json` uses lenient parsing: ordinary strings remain strings. `text` and `json` also decode raw bytes and `base64:` values written with `setItemRaw()`. Binary formats read the driver's raw value, falling back to its regular read. Existing blobs and streams are returned directly for their matching format. Without `type`, reads use the default deserialization.
+
+`type` is reserved and is not passed to drivers. Replace driver-specific read options such as Netlify Blobs `{ type: "arrayBuffer" }` with `{ type: "bytes" }`.
+
 #### `getItems(items, commonOptions?)`
 
 ::warning
@@ -84,6 +98,14 @@ const items = await storage.getItems([
 // [{ key: "user:1", value: ... }, { key: "user:2", value: ... }]
 ```
 
+Pass `type` in `commonOptions` for all items or in an item's `options` to override it. Results retain input order. Binary formats are read individually, in parallel with any driver batch read.
+
+```ts
+await storage.getItems(["user:1", { key: "avatar.png", options: { type: "bytes" } }], {
+  type: "json",
+});
+```
+
 ### Writing values
 
 #### `setItem(key, value, options?)`
diff --git a/src/_utils.ts b/src/_utils.ts
index e19ef0a..9450de9 100644
--- a/src/_utils.ts
+++ b/src/_utils.ts
@@ -1,3 +1,6 @@
+import { destr } from "destr";
+import type { GetItemType } from "./types.ts";
+
 type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;
 type Promisified<T> = Promise<Awaited<T>>;
 
@@ -80,3 +83,93 @@ function base64Encode(input: Uint8Array) {
   }
   return globalThis.btoa(String.fromCodePoint(...input));
 }
+
+/** Normalize a stored value to bytes, releasing stream readers on failure. */
+export async function toBytes(value: any): Promise<Uint8Array> {
+  if (value instanceof Uint8Array) {
+    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+  }
+  if (value instanceof ArrayBuffer) {
+    return new Uint8Array(value);
+  }
+  if (ArrayBuffer.isView(value)) {
+    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+  }
+  if (value instanceof Blob || value instanceof Response) {
+    return new Uint8Array(await value.arrayBuffer());
+  }
+  if (value instanceof ReadableStream || value?.[Symbol.asyncIterator]) {
+    const chunks: Uint8Array[] = [];
+    if (value instanceof ReadableStream) {
+      const reader = value.getReader();
+      try {
+        while (true) {
+          const { done, value: chunk } = await reader.read();
+          if (done) break;
+          chunks.push(await toBytes(chunk));
+        }
+      } finally {
+        reader.releaseLock();
+      }
+    } else {
+      for await (const chunk of value) {
+        chunks.push(await toBytes(chunk));
+      }
+    }
+    const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
+    let offset = 0;
+    for (const chunk of chunks) {
+      bytes.set(chunk, offset);
+      offset += chunk.byteLength;
+    }
+    return bytes;
+  }
+  if (
+    typeof value === "string" ||
+    typeof value === "number" ||
+    typeof value === "boolean" ||
+    (value &&
+      (Array.isArray(value) ||
+        Object.getPrototypeOf(value) === Object.prototype ||
+        Object.getPrototypeOf(value) === null))
+  ) {
+    return new TextEncoder().encode(stringify(value));
+  }
+  throw new Error(`Cannot convert \`${value?.constructor?.name || "Object"}\` to bytes`);
+}
+
+/** Convert a driver value to the requested read format. */
+export async function convertValue(value: any, type?: GetItemType): Promise<any> {
+  if (value === null || value === undefined) return null;
+  if (!type) return destr(value);
+  value = deserializeRaw(value);
+  if (type === "blob" && value instanceof Blob) return value;
+  if (type === "stream" && value instanceof ReadableStream) return value;
+  if (
+    type === "json" &&
+    (typeof value !== "object" ||
+      Array.isArray(value) ||
+      Object.getPrototypeOf(value) === Object.prototype ||
+      Object.getPrototypeOf(value) === null)
+  ) {
+    return destr(value);
+  }
+  const bytes = await toBytes(value);
+  switch (type) {
+    case "bytes":
+      return bytes;
+    case "blob":
+      return new Blob([bytes as Uint8Array<ArrayBuffer>]);
+    case "stream":
+      return new ReadableStream({
+        start(controller) {
+          controller.enqueue(bytes);
+          controller.close();
+        },
+      });
+    case "text":
+      return new TextDecoder().decode(bytes);
+    case "json":
+      return destr(new TextDecoder().decode(bytes));
+  }
+}
diff --git a/src/storage.ts b/src/storage.ts
index 0c25ad8..06590c8 100644
--- a/src/storage.ts
+++ b/src/storage.ts
@@ -7,9 +7,11 @@ import type {
   StorageValue,
   WatchEvent,
   TransactionOptions,
+  GetItemOptions,
+  GetItemsInput,
 } from "./types.ts";
 import memory from "./drivers/memory.ts";
-import { asyncCall, deserializeRaw, serializeRaw, stringify } from "./_utils.ts";
+import { asyncCall, deserializeRaw, serializeRaw, stringify, convertValue } from "./_utils.ts";
 import {
   normalizeKey,
   normalizeBaseKey,
@@ -106,6 +108,7 @@ export function createStorage<T extends StorageValue>(
     driver: Driver;
     base: string;
     items: {
+      index: number;
       key: string;
       relativeKey: string;
       value?: StorageValue;
@@ -132,7 +135,7 @@ export function createStorage<T extends StorageValue>(
       return batch;
     };
 
-    for (const item of items) {
+    for (const [index, item] of items.entries()) {
       const isStringItem = typeof item === "string";
       const key = normalizeKey(isStringItem ? item : item.key);
       const value = isStringItem ? undefined : item.value;
@@ -140,6 +143,7 @@ export function createStorage<T extends StorageValue>(
         isStringItem || !item.options ? commonOptions : { ...commonOptions, ...item.options };
       const mount = getMount(key);
       getBatch(mount).items.push({
+        index,
         key,
         value,
         relativeKey: mount.relativeKey,
@@ -157,44 +161,60 @@ export function createStorage<T extends StorageValue>(
       const { relativeKey, driver } = getMount(key);
       return asyncCall(driver.hasItem, relativeKey, opts);
     },
-    getItem(key: string, opts = {}) {
+    getItem(key: string, opts: GetItemOptions = {}) {
       key = normalizeKey(key);
       const { relativeKey, driver } = getMount(key);
-      return asyncCall(driver.getItem, relativeKey, opts).then(
-        (value) => destr(value) as StorageValue,
-      );
+      const { type, ...driverOptions } = opts;
+      const raw = type === "bytes" || type === "blob" || type === "stream";
+      return asyncCall(
+        raw && driver.getItemRaw ? driver.getItemRaw : driver.getItem,
+        relativeKey,
+        driverOptions,
+      ).then((value) => convertValue(value, type));
     },
-    getItems(
-      items: (string | { key: string; options?: TransactionOptions })[],
-      commonOptions = {},
-    ) {
-      return runBatch(items, commonOptions, (batch) => {
-        if (batch.driver.getItems) {
-          return asyncCall(
-            batch.driver.getItems,
-            batch.items.map((item) => ({
-              key: item.relativeKey,
-              options: item.options,
-            })),
-            commonOptions,
-          ).then((r) =>
-            r.map((item) => ({
-              key: joinKeys(batch.base, item.key),
-              value: destr(item.value),
-            })),
-          );
-        }
-        return Promise.all(
-          batch.items.map((item) => {
-            return asyncCall(batch.driver.getItem, item.relativeKey, item.options).then(
-              (value) => ({
-                key: item.key,
-                value: destr(value),
-              }),
-            );
-          }),
+    getItems(items: GetItemsInput[], commonOptions: GetItemOptions = {}) {
+      const { type: _type, ...driverOptions } = commonOptions;
+      return runBatch([...items], commonOptions, async (batch) => {
+        const binary = batch.items.filter((item) =>
+          ["bytes", "blob", "stream"].includes(item.options?.type),
         );
-      });
+        const regular = batch.items.filter((item) => !binary.includes(item));
+        const singles = Promise.all(
+          binary.map(async (item) => ({
+            index: item.index,
+            key: item.key,
+            value: await storage.getItem(item.key, item.options),
+          })),
+        );
+        const batched =
+          batch.driver.getItems && regular.length
+            ? asyncCall(
+                batch.driver.getItems,
+                regular.map((item) => {
+                  const { type: _type, ...options } = item.options || {};
+                  return { key: item.relativeKey, options };
+                }),
+                driverOptions,
+              ).then((results) =>
+                Promise.all(
+                  results.map(async (result, index) => ({
+                    index: regular[index]!.index,
+                    key: joinKeys(batch.base, result.key),
+                    value: await convertValue(result.value, regular[index]!.options?.type),
+                  })),
+                ),
+              )
+            : Promise.all(
+                regular.map(async (item) => ({
+                  index: item.index,
+                  key: item.key,
+                  value: await storage.getItem(item.key, item.options),
+                })),
+              );
+        return (await Promise.all([singles, batched])).flat();
+      }).then((results) =>
+        results.sort((a, b) => a.index - b.index).map(({ key, value }) => ({ key, value })),
+      );
     },
     getItemRaw(key, opts = {}) {
       key = normalizeKey(key);
diff --git a/src/types.ts b/src/types.ts
index 40f3988..28b7551 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -18,6 +18,27 @@ export interface StorageMeta {
 // TODO: type ttl
 export type TransactionOptions = Record<string, any>;
 
+export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
+export type JSONObject = { [key: string]: JSONValue };
+export type JSONArray = JSONValue[];
+
+export interface GetItemTypeMap {
+  text: string;
+  json: JSONValue;
+  bytes: Uint8Array;
+  blob: Blob;
+  stream: ReadableStream<Uint8Array>;
+}
+export type GetItemType = keyof GetItemTypeMap;
+export type GetItemOptions = TransactionOptions & { type?: GetItemType };
+export type GetItemsInput = string | { key: string; options?: GetItemOptions };
+
+type GetItemsValue<I, C> = I extends { options: { type: infer F extends GetItemType } }
+  ? GetItemTypeMap[F]
+  : C extends GetItemType
+    ? GetItemTypeMap[C]
+    : StorageValue;
+
 export type GetKeysOptions = TransactionOptions & {
   maxDepth?: number;
 };
@@ -112,20 +133,24 @@ export interface Storage<T extends StorageValue = StorageValue> {
   ): Promise<boolean>;
   hasItem(key: string, opts?: TransactionOptions): Promise<boolean>;
 
+  getItem<F extends GetItemType>(
+    key: string,
+    opts: GetItemOptions & { type: F },
+  ): Promise<GetItemTypeMap[F] | null>;
   getItem<U extends Extract<T, StorageDefinition>, K extends string & keyof StorageItemMap<U>>(
     key: K,
-    ops?: TransactionOptions,
+    ops?: GetItemOptions & { type?: undefined },
   ): Promise<StorageItemType<T, K> | null>;
   getItem<R = StorageItemType<T, string>>(
     key: string,
-    opts?: TransactionOptions,
+    opts?: GetItemOptions & { type?: undefined },
   ): Promise<R | null>;
 
   /** @experimental */
-  getItems: <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => Promise<{ key: string; value: U }[]>;
+  getItems: <const I extends GetItemsInput[], C extends GetItemType | undefined = undefined>(
+    items: I,
+    commonOptions?: GetItemOptions & { type?: C },
+  ) => Promise<{ key: string; value: GetItemsValue<I[number], C> | null }[]>;
   /** @experimental See https://github.com/unjs/unstorage/issues/142 */
   getItemRaw: <T = any>(key: string, opts?: TransactionOptions) => Promise<MaybeDefined<T> | null>;
 
diff --git a/src/utils.ts b/src/utils.ts
index eb44352..7c6cf14 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,4 +1,11 @@
-import type { Storage, StorageValue, TransactionOptions } from "./types.ts";
+import type {
+  Storage,
+  StorageValue,
+  TransactionOptions,
+  GetItemsInput,
+  GetItemType,
+  GetItemOptions,
+} from "./types.ts";
 
 type StorageKeys = Array<keyof Storage>;
 
@@ -56,14 +63,17 @@ export function prefixStorage<T extends StorageValue>(
       }
     });
 
-  nsStorage.getItems = async <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
+  nsStorage.getItems = async <
+    const I extends GetItemsInput[],
+    C extends GetItemType | undefined = undefined,
+  >(
+    items: I,
+    commonOptions?: GetItemOptions & { type?: C },
   ) => {
     const prefixedItems = items.map((item) =>
       typeof item === "string" ? base + item : { ...item, key: base + item.key },
     );
-    const results = await storage.getItems<U>(prefixedItems, commonOptions);
+    const results = await storage.getItems<I, C>(prefixedItems as I, commonOptions);
     return results.map((entry) => ({
       key: entry.key.slice(base.length),
       value: entry.value,
diff --git a/test/storage.test-d.ts b/test/storage.test-d.ts
index 9d8933c..a675522 100644
--- a/test/storage.test-d.ts
+++ b/test/storage.test-d.ts
@@ -81,3 +81,29 @@ describe("types", () => {
     expectTypeOf(prefixedStorage3).toEqualTypeOf<Storage<number>>();
   });
 });
+
+it("infers read formats", async () => {
+  const storage = createStorage();
+  expectTypeOf(await storage.getItem("k", { type: "bytes" })).toEqualTypeOf<Uint8Array | null>();
+  expectTypeOf(await storage.get("k", { type: "blob" })).toEqualTypeOf<Blob | null>();
+  expectTypeOf(
+    await storage.getItem("k", { type: "stream" }),
+  ).toEqualTypeOf<ReadableStream<Uint8Array> | null>();
+  expectTypeOf(await storage.getItems(["k"], { type: "text" })).toEqualTypeOf<
+    { key: string; value: string | null }[]
+  >();
+  expectTypeOf(
+    await storage.getItems([{ key: "k", options: { type: "bytes" } }, "j"], { type: "json" }),
+  ).toEqualTypeOf<
+    { key: string; value: import("../src/index.ts").JSONValue | Uint8Array | null }[]
+  >();
+  expectTypeOf(
+    await storage.getItems([{ key: "k", options: { type: "bytes" } }, "j"]),
+  ).toEqualTypeOf<{ key: string; value: StorageValue | Uint8Array | null }[]>();
+  // @ts-expect-error unknown read format
+  storage.getItem("k", { type: "buffer" });
+  // @ts-expect-error unknown common read format
+  storage.getItems(["k"], { type: "buffer" });
+  // @ts-expect-error unknown per-item read format
+  storage.getItems([{ key: "k", options: { type: "buffer" } }]);
+});
diff --git a/test/storage.test.ts b/test/storage.test.ts
index 8ad7b9f..53b1ac4 100644
--- a/test/storage.test.ts
+++ b/test/storage.test.ts
@@ -294,3 +294,193 @@ describe("Regression", () => {
     ]);
   });
 });
+
+describe("read formats", () => {
+  const encoder = new TextEncoder();
+  const types = ["text", "json", "bytes", "blob", "stream"] as const;
+
+  it("normalizes missing and undefined values", async () => {
+    const storage = createStorage({
+      driver: { ...memory(), getItem: () => undefined as any, getItemRaw: () => undefined },
+    });
+    expect(await storage.getItem("missing")).toBeNull();
+    for (const type of types) {
+      expect(await storage.get("missing", { type })).toBeNull();
+      expect(await storage.getItems(["missing"], { type })).toEqual([
+        { key: "missing", value: null },
+      ]);
+    }
+  });
+
+  it("reads raw text and JSON with native and string-only drivers", async () => {
+    for (const raw of [true, false]) {
+      const driver = memory();
+      if (!raw) {
+        delete driver.getItemRaw;
+        delete driver.setItemRaw;
+      }
+      const storage = createStorage({ driver });
+      await storage.setItemRaw("text", encoder.encode("hello wörld"));
+      await storage.setItemRaw("json", encoder.encode('{"a":1}'));
+      expect(await storage.get("text", { type: "text" })).toBe("hello wörld");
+      expect(await storage.getItem("json", { type: "json" })).toEqual({ a: 1 });
+      expect(await storage.getItem("text", { type: "bytes" })).toEqual(
+        encoder.encode("hello wörld"),
+      );
+      expect(await storage.getItem("text")).toEqual(
+        raw ? encoder.encode("hello wörld") : "base64:aGVsbG8gd8O2cmxk",
+      );
+      expect(await storage.getItems(["text"], { type: "text" })).toEqual([
+        { key: "text", value: "hello wörld" },
+      ]);
+      await storage.setItem("plain", "hello");
+      expect(await storage.getItem("plain", { type: "json" })).toBe("hello");
+    }
+  });
+
+  it("runs individual binary reads in parallel with batches", async () => {
+    let finishRaw!: () => void;
+    let finishBatch!: () => void;
+    const rawStarted = new Promise<void>((resolve) => {
+      finishRaw = resolve;
+    });
+    const batchStarted = new Promise<void>((resolve) => {
+      finishBatch = resolve;
+    });
+    const storage = createStorage({
+      driver: {
+        ...memory(),
+        async getItemRaw() {
+          finishRaw();
+          await batchStarted;
+          return "raw";
+        },
+        async getItems() {
+          finishBatch();
+          await rawStarted;
+          return [{ key: "text", value: "text" }];
+        },
+      },
+    });
+    expect(await storage.getItems([{ key: "raw", options: { type: "bytes" } }, "text"])).toEqual([
+      { key: "raw", value: encoder.encode("raw") },
+      { key: "text", value: "text" },
+    ]);
+    expect(await storage.getItems([], { type: "bytes" })).toEqual([]);
+  });
+
+  it("normalizes binary and plain values", async () => {
+    const bytes = encoder.encode("hello wörld");
+    const values = [
+      bytes,
+      Buffer.from(bytes),
+      bytes.buffer,
+      new DataView(bytes.buffer),
+      new DataView(new Uint8Array([0, ...bytes, 0]).buffer, 1, bytes.length),
+      new Blob([bytes]),
+      new Response(bytes),
+      new ReadableStream({
+        start(c) {
+          c.enqueue(bytes);
+          c.close();
+        },
+      }),
+      (async function* () {
+        yield bytes.subarray(0, 3);
+        yield bytes.subarray(3);
+      })(),
+      "hello wörld",
+      true,
+      42,
+      { a: 1 },
+      [1, 2],
+      new Uint8Array(),
+    ];
+    for (const value of values) {
+      const storage = createStorage({ driver: { ...memory(), getItemRaw: () => value } });
+      const result = await storage.getItem("value", { type: "bytes" });
+      const expected =
+        value === true
+          ? "true"
+          : value === 42
+            ? "42"
+            : Array.isArray(value)
+              ? "[1,2]"
+              : value?.constructor === Object
+                ? '{"a":1}'
+                : value instanceof Uint8Array && !value.length
+                  ? ""
+                  : "hello wörld";
+      expect(result).toBeInstanceOf(Uint8Array);
+      expect(new TextDecoder().decode(result!)).toBe(expected);
+    }
+    const storage = createStorage({ driver: { ...memory(), getItemRaw: () => new Map() } });
+    await expect(storage.getItem("value", { type: "bytes" })).rejects.toThrow(
+      "Cannot convert `Map` to bytes",
+    );
+  });
+
+  it("preserves blobs and streams and releases a failing reader", async () => {
+    const blob = new Blob(["hello"]);
+    const stream = new ReadableStream<Uint8Array>({
+      start(c) {
+        c.error(new Error("broken"));
+      },
+    });
+    const storage = createStorage({
+      driver: { ...memory(), getItemRaw: (key) => (key === "blob" ? blob : stream) },
+    });
+    expect(await storage.getItem("blob", { type: "blob" })).toBe(blob);
+    expect(await storage.getItem("stream", { type: "stream" })).toBe(stream);
+    await expect(storage.getItem("stream", { type: "bytes" })).rejects.toThrow("broken");
+    expect(stream.locked).toBe(false);
+    await storage.setItem("text", "hello");
+    const normal = createStorage();
+    await normal.setItem("text", "hello");
+    expect(await (await normal.getItem("text", { type: "blob" }))!.text()).toBe("hello");
+    expect(await new Response(await normal.getItem("text", { type: "stream" })).text()).toBe(
+      "hello",
+    );
+  });
+
+  it("applies batch types by position, strips options and preserves order across mounts", async () => {
+    const getItem = vi.fn(() => "fallback");
+    const getItemRaw = vi.fn(() => encoder.encode("raw"));
+    const getItems = vi.fn((items) =>
+      items.map((_: unknown, index: number) => ({
+        key: `renamed${index}`,
+        value: "base64:aGVsbG8=",
+      })),
+    );
+    const storage = createStorage({ driver: { ...memory(), getItem, getItemRaw, getItems } });
+    storage.mount("mounted", memory());
+    await storage.setItem("mounted:value", "mounted");
+    const result = await storage.getItems(
+      [
+        "a",
+        "mounted:value",
+        { key: "b", options: { type: "bytes", ttl: 1 } },
+        { key: "c", options: { type: "json" } },
+      ],
+      { type: "text", consistency: "strong" },
+    );
+    expect(result).toEqual([
+      { key: "renamed0", value: "hello" },
+      { key: "mounted:value", value: "mounted" },
+      { key: "b", value: encoder.encode("raw") },
+      { key: "renamed1", value: "hello" },
+    ]);
+    expect(getItem).not.toHaveBeenCalled();
+    expect(getItemRaw).toHaveBeenCalledWith("b", { ttl: 1, consistency: "strong" });
+    expect(getItems).toHaveBeenCalledWith(
+      [
+        { key: "a", options: { consistency: "strong" } },
+        { key: "c", options: { consistency: "strong" } },
+      ],
+      { consistency: "strong" },
+    );
+    expect(await prefixStorage(storage, "prefix").getItems(["a"], { type: "text" })).toEqual([
+      { key: "0", value: "hello" },
+    ]);
+  });
+});
```

</details>

<details><summary>reply</summary>

I’ll check the read paths, types, and existing tests, then add the option in shared code and verify the requested conversions and type inference.

The shared storage layer handles both single and batch reads. I’ll put conversion there, strip `type` before driver calls, and track batch positions so results keep input order across mounts and driver key rewrites.

The conversion tests pass; one batch test has an incorrect expected key after prefix removal, which I’m fixing. The type check also needs generated package declarations and reports two errors in untouched driver files. I’ll build next, then rerun the focused checks.

All 102 focused runtime and type tests pass, including concurrent batch/raw reads, stream lock release, and Netlify Blobs compatibility. The build passes too. Repository-wide type checking still reports one error in the untouched `src/drivers/utils/node-fs.ts`; I’ll leave that outside this change.

Added `type` support to `getItem()`, `get()`, and `getItems()`, with conversions, inferred return types, root exports, and documentation.

Build, focused lint/format checks, and 102 tests passed. Full type checking reports an existing error in `src/drivers/utils/node-fs.ts`; focused tests passed with source errors ignored.

No dependencies or unrelated features added. Full test suite not run.

</details>

### codex, all: FAIL

Files: [docs/1.guide/1.index.md](../all/codex/ts-unstorage-get-item-type-1/files/docs/1.guide/1.index.md), [src/_utils.ts](../all/codex/ts-unstorage-get-item-type-1/files/src/_utils.ts), [src/storage.ts](../all/codex/ts-unstorage-get-item-type-1/files/src/storage.ts), [src/types.ts](../all/codex/ts-unstorage-get-item-type-1/files/src/types.ts), [src/utils.ts](../all/codex/ts-unstorage-get-item-type-1/files/src/utils.ts), [test/storage.test-d.ts](../all/codex/ts-unstorage-get-item-type-1/files/test/storage.test-d.ts), [test/storage.test.ts](../all/codex/ts-unstorage-get-item-type-1/files/test/storage.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/docs/1.guide/1.index.md b/docs/1.guide/1.index.md
index 5b54950..6c7b75f 100644
--- a/docs/1.guide/1.index.md
+++ b/docs/1.guide/1.index.md
@@ -66,6 +66,22 @@ Returns the deserialized value, or `null` when the key does not exist.
 const value = await storage.getItem("user:1");
 ```
 
+Use `type` to select the returned format. Missing values return `null` in every format.
+
+```ts
+await storage.getItem("user:1", { type: "text" }); // string | null
+await storage.getItem("user:1", { type: "json" }); // JSONValue | null
+await storage.getItem("avatar.png", { type: "bytes" }); // Uint8Array | null
+await storage.getItem("avatar.png", { type: "blob" }); // Blob | null
+await storage.getItem("avatar.png", { type: "stream" }); // ReadableStream<Uint8Array> | null
+```
+
+`text` decodes raw bytes as UTF-8. `json` also decodes raw bytes and parses leniently: ordinary strings remain strings and plain values remain unchanged. Both decode `base64:` values written by `setItemRaw()`. Without `type`, reads keep the default deserialization.
+
+`bytes`, `blob`, and `stream` use the driver's raw reader when available. They accept binary values, responses, streams, async iterables of chunks, and UTF-8 strings. Numbers, booleans, plain objects, and arrays use their text representation. Existing blobs and streams are returned directly for their matching format. Unsupported values reject with ``Cannot convert `Map` to bytes`` (using the value's constructor name).
+
+`type` is reserved and is not passed to drivers. Replace Netlify Blobs `{ type: "arrayBuffer" }` reads with `{ type: "bytes" }`.
+
 Alias: `storage.get()`.
 
 #### `getItems(items, commonOptions?)`
@@ -84,6 +100,14 @@ const items = await storage.getItems([
 // [{ key: "user:1", value: ... }, { key: "user:2", value: ... }]
 ```
 
+Pass `type` in common options or per item; per-item formats take precedence. Results keep input order. Binary formats read each item individually, alongside the driver's batch read for other formats.
+
+```ts
+await storage.getItems(["user:1", { key: "avatar.png", options: { type: "bytes" } }], {
+  type: "json",
+});
+```
+
 ### Writing values
 
 #### `setItem(key, value, options?)`
diff --git a/src/_utils.ts b/src/_utils.ts
index e19ef0a..a192fef 100644
--- a/src/_utils.ts
+++ b/src/_utils.ts
@@ -1,3 +1,4 @@
+import { destr } from "destr";
 type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;
 type Promisified<T> = Promise<Awaited<T>>;
 
@@ -80,3 +81,90 @@ function base64Encode(input: Uint8Array) {
   }
   return globalThis.btoa(String.fromCodePoint(...input));
 }
+
+/** Normalize supported raw values to bytes. */
+export async function toBytes(value: any): Promise<Uint8Array> {
+  if (value instanceof Uint8Array)
+    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+  if (value instanceof ArrayBuffer) return new Uint8Array(value);
+  if (ArrayBuffer.isView(value))
+    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
+  if (value instanceof Blob || value instanceof Response)
+    return new Uint8Array(await value.arrayBuffer());
+  if (value instanceof ReadableStream) {
+    const reader = value.getReader();
+    try {
+      const chunks: Uint8Array[] = [];
+      while (true) {
+        const { done, value: chunk } = await reader.read();
+        if (done) break;
+        chunks.push(await toBytes(chunk));
+      }
+      return concatBytes(chunks);
+    } finally {
+      reader.releaseLock();
+    }
+  }
+  if (value && typeof value[Symbol.asyncIterator] === "function") {
+    const chunks: Uint8Array[] = [];
+    for await (const chunk of value) chunks.push(await toBytes(chunk));
+    return concatBytes(chunks);
+  }
+  if (
+    typeof value === "string" ||
+    typeof value === "number" ||
+    typeof value === "boolean" ||
+    (value &&
+      (Array.isArray(value) ||
+        Object.getPrototypeOf(value) === Object.prototype ||
+        Object.getPrototypeOf(value) === null))
+  ) {
+    return new TextEncoder().encode(stringify(value));
+  }
+  throw new Error(`Cannot convert \`${value?.constructor?.name || "Object"}\` to bytes`);
+}
+
+/** Join byte chunks in their original order. */
+function concatBytes(chunks: Uint8Array[]): Uint8Array {
+  const result = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
+  let offset = 0;
+  for (const chunk of chunks) {
+    result.set(chunk, offset);
+    offset += chunk.byteLength;
+  }
+  return result;
+}
+
+/** Convert a driver value to the requested read format. */
+export async function convertValue(
+  value: any,
+  type?: import("./types.ts").GetItemType,
+): Promise<any> {
+  if (value === null || value === undefined) return null;
+  if (!type) return destr(value);
+  value = deserializeRaw(value);
+  if (type === "json") {
+    if (typeof value === "string") return destr(value);
+    if (
+      typeof value !== "object" ||
+      Array.isArray(value) ||
+      Object.getPrototypeOf(value) === Object.prototype ||
+      Object.getPrototypeOf(value) === null
+    )
+      return value;
+    return destr(new TextDecoder().decode(await toBytes(value)));
+  }
+  if (type === "text") return new TextDecoder().decode(await toBytes(value));
+  if (type === "blob" && value instanceof Blob) return value;
+  if (type === "stream" && value instanceof ReadableStream) return value;
+  const bytes = await toBytes(value);
+  if (type === "blob") return new Blob([bytes as Uint8Array<ArrayBuffer>]);
+  if (type === "stream")
+    return new ReadableStream({
+      start(controller) {
+        controller.enqueue(bytes);
+        controller.close();
+      },
+    });
+  return bytes;
+}
diff --git a/src/storage.ts b/src/storage.ts
index 0c25ad8..b6dd33a 100644
--- a/src/storage.ts
+++ b/src/storage.ts
@@ -7,9 +7,11 @@ import type {
   StorageValue,
   WatchEvent,
   TransactionOptions,
+  GetItemOptions,
+  GetItemsInput,
 } from "./types.ts";
 import memory from "./drivers/memory.ts";
-import { asyncCall, deserializeRaw, serializeRaw, stringify } from "./_utils.ts";
+import { asyncCall, deserializeRaw, serializeRaw, stringify, convertValue } from "./_utils.ts";
 import {
   normalizeKey,
   normalizeBaseKey,
@@ -110,11 +112,15 @@ export function createStorage<T extends StorageValue>(
       relativeKey: string;
       value?: StorageValue;
       options?: TransactionOptions;
+      index?: number;
     }[];
   };
 
   const runBatch = (
-    items: (string | { key: string; value?: StorageValue; options?: TransactionOptions })[],
+    items: (
+      | string
+      | { key: string; value?: StorageValue; options?: TransactionOptions; index?: number }
+    )[],
     commonOptions: undefined | TransactionOptions,
     cb: (batch: BatchItem) => Promise<any>,
   ) => {
@@ -142,6 +148,7 @@ export function createStorage<T extends StorageValue>(
       getBatch(mount).items.push({
         key,
         value,
+        index: isStringItem ? undefined : item.index,
         relativeKey: mount.relativeKey,
         options,
       });
@@ -157,44 +164,62 @@ export function createStorage<T extends StorageValue>(
       const { relativeKey, driver } = getMount(key);
       return asyncCall(driver.hasItem, relativeKey, opts);
     },
-    getItem(key: string, opts = {}) {
+    async getItem(key: string, opts: GetItemOptions = {}) {
       key = normalizeKey(key);
       const { relativeKey, driver } = getMount(key);
-      return asyncCall(driver.getItem, relativeKey, opts).then(
-        (value) => destr(value) as StorageValue,
+      const { type, ...driverOptions } = opts;
+      const raw = type === "bytes" || type === "blob" || type === "stream";
+      const value = await asyncCall(
+        raw && driver.getItemRaw ? driver.getItemRaw : driver.getItem,
+        relativeKey,
+        driverOptions,
       );
+      return convertValue(value, type);
     },
-    getItems(
-      items: (string | { key: string; options?: TransactionOptions })[],
-      commonOptions = {},
-    ) {
-      return runBatch(items, commonOptions, (batch) => {
-        if (batch.driver.getItems) {
-          return asyncCall(
-            batch.driver.getItems,
-            batch.items.map((item) => ({
-              key: item.relativeKey,
-              options: item.options,
-            })),
-            commonOptions,
-          ).then((r) =>
-            r.map((item) => ({
-              key: joinKeys(batch.base, item.key),
-              value: destr(item.value),
-            })),
+    async getItems(items: GetItemsInput[], commonOptions: GetItemOptions = {}) {
+      const results: { key: string; value: any }[] = Array.from({ length: items.length });
+      const indexed = items.map((item, index) => ({
+        key: typeof item === "string" ? item : item.key,
+        options: { ...commonOptions, ...(typeof item === "string" ? {} : item.options) },
+        index,
+      }));
+      const binary = indexed.filter((item) =>
+        ["bytes", "blob", "stream"].includes(item.options.type!),
+      );
+      const ordinary = indexed.filter((item) => !binary.includes(item));
+      const { type: _type, ...driverCommonOptions } = commonOptions;
+      await Promise.all([
+        ...binary.map(async (item) => {
+          results[item.index] = {
+            key: normalizeKey(item.key),
+            value: await storage.getItem(item.key, item.options),
+          };
+        }),
+        runBatch(ordinary, commonOptions, async (batch) => {
+          const inputs = batch.items.map((item) => {
+            const { type: _type, ...options } = item.options || {};
+            return { key: item.relativeKey, options };
+          });
+          const values = batch.driver.getItems
+            ? await asyncCall(batch.driver.getItems, inputs, driverCommonOptions)
+            : await Promise.all(
+                inputs.map(async (item) => ({
+                  key: item.key,
+                  value: await asyncCall(batch.driver.getItem, item.key, item.options),
+                })),
+              );
+          await Promise.all(
+            values.map(async (value, index) => {
+              const item = batch.items[index]!;
+              results[item.index!] = {
+                key: joinKeys(batch.base, value.key),
+                value: await convertValue(value.value, item.options?.type),
+              };
+            }),
           );
-        }
-        return Promise.all(
-          batch.items.map((item) => {
-            return asyncCall(batch.driver.getItem, item.relativeKey, item.options).then(
-              (value) => ({
-                key: item.key,
-                value: destr(value),
-              }),
-            );
-          }),
-        );
-      });
+        }),
+      ]);
+      return results;
     },
     getItemRaw(key, opts = {}) {
       key = normalizeKey(key);
diff --git a/src/types.ts b/src/types.ts
index 40f3988..f47d00d 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -1,4 +1,25 @@
 export type StorageValue = null | string | number | boolean | object;
+export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
+export interface JSONObject {
+  [key: string]: JSONValue;
+}
+export type JSONArray = JSONValue[];
+export interface GetItemTypeMap {
+  text: string;
+  json: JSONValue;
+  bytes: Uint8Array;
+  blob: Blob;
+  stream: ReadableStream<Uint8Array>;
+}
+export type GetItemType = keyof GetItemTypeMap;
+export type GetItemOptions = TransactionOptions & { type?: GetItemType };
+export type GetItemsInput = string | { key: string; options?: GetItemOptions };
+type GetItemsValue<I, O, F> = I extends { options: { type: infer K extends GetItemType } }
+  ? GetItemTypeMap[K]
+  : O extends { type: infer K extends GetItemType }
+    ? GetItemTypeMap[K]
+    : F;
+
 export type WatchEvent = "update" | "remove";
 export type WatchCallback = (event: WatchEvent, key: string) => any;
 
@@ -112,20 +133,25 @@ export interface Storage<T extends StorageValue = StorageValue> {
   ): Promise<boolean>;
   hasItem(key: string, opts?: TransactionOptions): Promise<boolean>;
 
+  getItem<K extends GetItemType>(
+    key: string,
+    opts: GetItemOptions & { type: K },
+  ): Promise<GetItemTypeMap[K] | null>;
   getItem<U extends Extract<T, StorageDefinition>, K extends string & keyof StorageItemMap<U>>(
     key: K,
-    ops?: TransactionOptions,
+    ops?: GetItemOptions,
   ): Promise<StorageItemType<T, K> | null>;
-  getItem<R = StorageItemType<T, string>>(
-    key: string,
-    opts?: TransactionOptions,
-  ): Promise<R | null>;
-
-  /** @experimental */
-  getItems: <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => Promise<{ key: string; value: U }[]>;
+  getItem<R = StorageItemType<T, string>>(key: string, opts?: GetItemOptions): Promise<R | null>;
+
+  /** Read items with per-item formats overriding the common format. */
+  getItems<const I extends readonly GetItemsInput[], const O extends GetItemOptions = {}>(
+    items: I,
+    commonOptions?: O,
+  ): Promise<{ key: string; value: GetItemsValue<I[number], O, StorageValue> | null }[]>;
+  getItems<U extends T>(
+    items: GetItemsInput[],
+    commonOptions?: GetItemOptions & { type?: never },
+  ): Promise<{ key: string; value: U }[]>;
   /** @experimental See https://github.com/unjs/unstorage/issues/142 */
   getItemRaw: <T = any>(key: string, opts?: TransactionOptions) => Promise<MaybeDefined<T> | null>;
 
diff --git a/src/utils.ts b/src/utils.ts
index eb44352..5576090 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,4 +1,10 @@
-import type { Storage, StorageValue, TransactionOptions } from "./types.ts";
+import type {
+  Storage,
+  StorageValue,
+  TransactionOptions,
+  GetItemsInput,
+  GetItemOptions,
+} from "./types.ts";
 
 type StorageKeys = Array<keyof Storage>;
 
@@ -56,19 +62,16 @@ export function prefixStorage<T extends StorageValue>(
       }
     });
 
-  nsStorage.getItems = async <U extends T>(
-    items: (string | { key: string; options?: TransactionOptions })[],
-    commonOptions?: TransactionOptions,
-  ) => {
+  nsStorage.getItems = (async (items: GetItemsInput[], commonOptions?: GetItemOptions) => {
     const prefixedItems = items.map((item) =>
       typeof item === "string" ? base + item : { ...item, key: base + item.key },
     );
-    const results = await storage.getItems<U>(prefixedItems, commonOptions);
+    const results = await storage.getItems(prefixedItems, commonOptions);
     return results.map((entry) => ({
       key: entry.key.slice(base.length),
       value: entry.value,
     }));
-  };
+  }) as Storage<T>["getItems"];
 
   nsStorage.setItems = async <U extends T>(
     items: { key: string; value: U; options?: TransactionOptions }[],
diff --git a/test/storage.test-d.ts b/test/storage.test-d.ts
index 9d8933c..95f822b 100644
--- a/test/storage.test-d.ts
+++ b/test/storage.test-d.ts
@@ -81,3 +81,40 @@ describe("types", () => {
     expectTypeOf(prefixedStorage3).toEqualTypeOf<Storage<number>>();
   });
 });
+
+describe("read format types", () => {
+  it("infers single and batch formats", async () => {
+    const storage = createStorage();
+    expectTypeOf(await storage.getItem("k", { type: "text" })).toEqualTypeOf<string | null>();
+    expectTypeOf(await storage.getItem("k", { type: "json" })).toEqualTypeOf<
+      import("../src/index.ts").JSONValue
+    >();
+    expectTypeOf(await storage.get("k", { type: "bytes" })).toEqualTypeOf<Uint8Array | null>();
+    expectTypeOf(await storage.getItem("k", { type: "blob" })).toEqualTypeOf<Blob | null>();
+    expectTypeOf(
+      await storage.getItem("k", { type: "stream" }),
+    ).toEqualTypeOf<ReadableStream<Uint8Array> | null>();
+    expectTypeOf(await storage.getItems(["k"], { type: "text" })).toEqualTypeOf<
+      { key: string; value: string | null }[]
+    >();
+    expectTypeOf(await storage.getItems([{ key: "k", options: { type: "bytes" } }])).toEqualTypeOf<
+      { key: string; value: Uint8Array | null }[]
+    >();
+    expectTypeOf(
+      await storage.getItems(["k", { key: "b", options: { type: "bytes" } }], { type: "json" }),
+    ).toEqualTypeOf<
+      { key: string; value: import("../src/index.ts").JSONValue | Uint8Array | null }[]
+    >();
+    expectTypeOf(await storage.getItems(["k"])).toEqualTypeOf<
+      { key: string; value: StorageValue }[]
+    >();
+    // @ts-expect-error Unknown format
+    storage.getItem("k", { type: "buffer" });
+    // @ts-expect-error Unknown alias format
+    storage.get("k", { type: "buffer" });
+    // @ts-expect-error Unknown common format
+    storage.getItems(["k"], { type: "buffer" });
+    // @ts-expect-error Unknown item format
+    storage.getItems([{ key: "k", options: { type: "buffer" } }]);
+  });
+});
diff --git a/test/storage.test.ts b/test/storage.test.ts
index 8ad7b9f..ad7d845 100644
--- a/test/storage.test.ts
+++ b/test/storage.test.ts
@@ -294,3 +294,228 @@ describe("Regression", () => {
     ]);
   });
 });
+
+describe("read formats", () => {
+  const encoder = new TextEncoder();
+  const text = "hello wörld";
+  const bytes = encoder.encode(text);
+
+  it("reads all formats and normalizes missing values", async () => {
+    const storage = createStorage();
+    await storage.setItem("user:1", { a: 1 });
+    expect(await storage.getItem("user:1", { type: "text" })).toBe('{"a":1}');
+    expect(await storage.get("user:1", { type: "json" })).toEqual({ a: 1 });
+    expect(await storage.getItem("user:1", { type: "bytes" })).toEqual(encoder.encode('{"a":1}'));
+    expect(await (await storage.getItem("user:1", { type: "blob" }))!.text()).toBe('{"a":1}');
+    expect(await new Response(await storage.getItem("user:1", { type: "stream" })).text()).toBe(
+      '{"a":1}',
+    );
+    for (const type of [undefined, "text", "json", "bytes", "blob", "stream"] as const) {
+      expect(await storage.getItem("missing", { type })).toBeNull();
+      const undefinedStorage = createStorage({
+        driver: { ...memory(), getItem: () => undefined as any },
+      });
+      expect(await undefinedStorage.getItem("missing", { type })).toBeNull();
+    }
+  });
+
+  it("decodes raw writes from binary and string-only drivers", async () => {
+    const stringDriver = memory();
+    delete stringDriver.getItemRaw;
+    delete stringDriver.setItemRaw;
+    for (const driver of [memory(), stringDriver]) {
+      const storage = createStorage({ driver });
+      await storage.setItemRaw("raw", bytes);
+      expect(await storage.getItem("raw", { type: "text" })).toBe(text);
+      expect(await storage.getItem("raw", { type: "json" })).toBe(text);
+      expect(await storage.getItem("raw", { type: "bytes" })).toEqual(bytes);
+      await storage.setItemRaw("json", encoder.encode('{"a":1}'));
+      expect(await storage.getItem("json", { type: "json" })).toEqual({ a: 1 });
+      await storage.setItem("plain", text);
+      expect(await storage.getItem("plain", { type: "json" })).toBe(text);
+    }
+  });
+
+  it("accepts binary values and text-compatible values", async () => {
+    const padded = new Uint8Array([0, ...bytes, 0]);
+    const values = [
+      bytes,
+      Buffer.from(bytes),
+      bytes.buffer,
+      new DataView(padded.buffer, 1, bytes.length),
+      new Blob([bytes]),
+      new ReadableStream({
+        start(c) {
+          c.enqueue(bytes);
+          c.close();
+        },
+      }),
+      new Response(bytes),
+      (async function* () {
+        yield bytes.subarray(0, 3);
+        yield bytes.subarray(3);
+      })(),
+      text,
+      true,
+      42,
+      { a: 1 },
+      [1, 2],
+    ];
+    for (const value of values) {
+      const expected =
+        typeof value === "boolean"
+          ? "true"
+          : typeof value === "number"
+            ? "42"
+            : Array.isArray(value)
+              ? "[1,2]"
+              : value?.constructor === Object
+                ? '{"a":1}'
+                : text;
+      const driver = { ...memory(), getItemRaw: () => value };
+      expect(await createStorage({ driver }).getItem("raw", { type: "bytes" })).toEqual(
+        encoder.encode(expected),
+      );
+    }
+    for (const value of [true, 42, { a: 1 }, [1, 2]]) {
+      const storage = createStorage({
+        driver: { ...memory(), getItem: () => value, getItemRaw: () => value },
+      });
+      expect(await storage.getItem("k", { type: "bytes" })).toEqual(
+        encoder.encode((await storage.getItem("k", { type: "text" }))!),
+      );
+      expect(await storage.getItem("k", { type: "json" })).toBe(value);
+    }
+  });
+
+  it("preserves blobs and streams and releases failed readers", async () => {
+    const blob = new Blob([bytes]);
+    const stream = new ReadableStream<Uint8Array>();
+    expect(
+      await createStorage({ driver: { ...memory(), getItemRaw: () => blob } }).getItem("k", {
+        type: "blob",
+      }),
+    ).toBe(blob);
+    expect(
+      await createStorage({ driver: { ...memory(), getItemRaw: () => stream } }).getItem("k", {
+        type: "stream",
+      }),
+    ).toBe(stream);
+    const broken = new ReadableStream({
+      pull(c) {
+        c.error(new Error("broken"));
+      },
+    });
+    const storage = createStorage({ driver: { ...memory(), getItemRaw: () => broken } });
+    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow("broken");
+    expect(broken.locked).toBe(false);
+    await expect(
+      createStorage({ driver: { ...memory(), getItemRaw: () => new Map() } }).getItem("k", {
+        type: "bytes",
+      }),
+    ).rejects.toThrow("Cannot convert `Map` to bytes");
+  });
+
+  it("applies formats by position, strips driver options, and preserves batch order", async () => {
+    const driver = {
+      ...memory(),
+      getItem: vi.fn(() => "true"),
+      getItemRaw: vi.fn(() => bytes),
+      getItems: vi.fn(async () => [
+        { key: "renamed", value: '{"a":1}' },
+        { key: "other", value: "true" },
+      ]),
+    };
+    const storage = createStorage({ driver });
+    storage.mount("mount", memory());
+    await storage.setItem("mount:k", 2);
+    const result = await storage.getItems(
+      [
+        { key: "mount:k", options: { type: "text" } },
+        { key: "a", options: { type: "json" } },
+        { key: "b", options: { type: "bytes" } },
+        "c",
+      ],
+      { type: "text", custom: 1 },
+    );
+    expect(result).toEqual([
+      { key: "mount:k", value: "2" },
+      { key: "renamed", value: { a: 1 } },
+      { key: "b", value: bytes },
+      { key: "other", value: "true" },
+    ]);
+    expect(driver.getItems).toHaveBeenCalledWith(
+      [
+        { key: "a", options: { custom: 1 } },
+        { key: "c", options: { custom: 1 } },
+      ],
+      { custom: 1 },
+    );
+    expect(driver.getItemRaw).toHaveBeenCalledWith("b", { custom: 1 });
+    await storage.getItem("a", { type: "json", custom: 1 });
+    expect(driver.getItem).toHaveBeenCalledWith("a", { custom: 1 });
+    expect(await storage.getItems([])).toEqual([]);
+    const prefixed = prefixStorage(storage, "mount");
+    expect(await prefixed.getItems(["k"], { type: "text" })).toEqual([{ key: "k", value: "2" }]);
+  });
+});
+
+describe("batch raw reads", () => {
+  it("starts binary reads alongside the driver batch", async () => {
+    let release!: () => void;
+    const gate = new Promise<void>((resolve) => {
+      release = resolve;
+    });
+    const driver = {
+      ...memory(),
+      getItems: vi.fn(async () => {
+        await gate;
+        return [{ key: "json", value: "true" }];
+      }),
+      getItemRaw: vi.fn(() => {
+        release();
+        return new Uint8Array([1]);
+      }),
+    };
+    const storage = createStorage({ driver });
+    expect(
+      await storage.getItems(["json", { key: "bytes", options: { type: "bytes" } }], {
+        type: "json",
+      }),
+    ).toEqual([
+      { key: "json", value: true },
+      { key: "bytes", value: new Uint8Array([1]) },
+    ]);
+    expect(driver.getItems).toHaveBeenCalledOnce();
+    expect(driver.getItemRaw).toHaveBeenCalledOnce();
+  });
+
+  it("handles duplicate keys, individual binary formats, and undefined batch values", async () => {
+    const storage = createStorage();
+    await storage.setItem("a", true);
+    const result = await storage.getItems(
+      [
+        "a",
+        { key: "a", options: { type: "json" } },
+        { key: "a", options: { type: "blob" } },
+        { key: "a", options: { type: "stream" } },
+        "missing",
+      ],
+      { type: "text" },
+    );
+    expect(result.slice(0, 2)).toEqual([
+      { key: "a", value: "true" },
+      { key: "a", value: true },
+    ]);
+    expect(await (result[2]!.value as Blob).text()).toBe("true");
+    expect(await new Response(result[3]!.value as ReadableStream<Uint8Array>).text()).toBe("true");
+    expect(result[4]!.value).toBeNull();
+    const driver = {
+      ...memory(),
+      getItems: async () => [{ key: "missing", value: undefined as any }],
+    };
+    expect(await createStorage({ driver }).getItems(["missing"])).toEqual([
+      { key: "missing", value: null },
+    ]);
+  });
+});
```

</details>

<details><summary>reply</summary>

Done.
Added typed formats, conversions, batching, exports, docs. Build and focused tests passed; full typecheck blocked by existing `src/drivers/utils/node-fs.ts:64` error.

</details>
