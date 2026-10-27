import { describe, it, expect, vi } from "vitest";
import { resolve } from "node:path";
import { createStorage, snapshot, restoreSnapshot, prefixStorage } from "../src/index.ts";
import memory from "../src/drivers/memory.ts";
import fs from "../src/drivers/fs.ts";

const data = {
  "etc:conf": "test",
  "data:foo": 123,
};

describe("storage", () => {
  it("mount/unmount", async () => {
    const storage = createStorage().mount("/mnt", memory());
    await restoreSnapshot(storage, data, "mnt");
    expect(await snapshot(storage, "/mnt")).toMatchObject(data);
  });

  it("getMount and getMounts", () => {
    const storage = createStorage();

    storage.mount("/mnt", memory());

    storage.mount("cache", memory());
    storage.mount("cache:sub", memory());
    expect(storage.getMount("/cache:").base).toBe("cache:");
    expect(storage.getMount("/cache:foo").base).toBe("cache:");
    expect(storage.getMount("/cache:sub").base).toBe("cache:sub:");
    expect(storage.getMount("/cache:sub:foo").base).toBe("cache:sub:");

    expect(storage.getMounts("/cache").map((m) => m.base)).toMatchInlineSnapshot(`
        [
          "cache:sub:",
          "cache:",
        ]
      `);
    expect(storage.getMounts("/cache:sub").map((m) => m.base)).toMatchInlineSnapshot(`
        [
          "cache:sub:",
        ]
      `);
    expect(storage.getMounts("/cache:sub", { parents: true }).map((m) => m.base))
      .toMatchInlineSnapshot(`
      [
        "cache:sub:",
        "cache:",
        "",
      ]
    `);

    expect(storage.getMounts().map((m) => m.base)).toMatchInlineSnapshot(`
      [
        "cache:sub:",
        "cache:",
        "mnt:",
        "",
      ]
    `);
  });

  it("snapshot", async () => {
    const storage = createStorage();
    await restoreSnapshot(storage, data);
    expect(await snapshot(storage, "")).toMatchObject(data);
  });

  it("watch", async () => {
    const onChange = vi.fn();
    const storage = createStorage().mount("/mnt", memory());
    await storage.watch(onChange);
    await restoreSnapshot(storage, data, "mnt");
    expect(onChange).toHaveBeenCalledWith("update", "mnt:etc:conf");
    expect(onChange).toHaveBeenCalledWith("update", "mnt:data:foo");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("unwatch return", async () => {
    const onChange = vi.fn();
    const storage = createStorage().mount("/mnt", memory());
    const unwatch = await storage.watch(onChange);
    await storage.setItem("mnt:data:foo", 42);
    await unwatch();
    await storage.setItem("mnt:data:foo", 41);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("unwatch all", async () => {
    const onChange = vi.fn();
    const storage = createStorage().mount("/mnt", memory());
    await storage.watch(onChange);
    await storage.setItem("mnt:data:foo", 42);
    await storage.unwatch();
    await storage.setItem("mnt:data:foo", 41);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("mount overides", async () => {
    const mainStorage = memory();
    const storage = createStorage({ driver: mainStorage });
    await storage.setItem("/mnt/test.txt", "v1");
    await storage.setItem("/mnt/test.base.txt", "v1");

    const initialKeys = await storage.getKeys();
    expect(initialKeys).toMatchInlineSnapshot(`
      [
        "mnt:test.txt",
        "mnt:test.base.txt",
      ]
    `);

    storage.mount("/mnt", memory());
    await storage.setItem("/mnt/test.txt", "v2");

    await storage.setItem("/mnt/foo/test.txt", "v3");
    storage.mount("/mnt/foo", memory());
    expect(await storage.getItem("/mnt/foo/test.txt")).toBe(null);

    expect(await storage.getItem("/mnt/test.txt")).toBe("v2");
    expect(await storage.getKeys()).toMatchInlineSnapshot(`
      [
        "mnt:test.txt",
      ]
    `);

    await storage.clear("/mnt");
    await storage.unmount("/mnt");
    expect(await storage.getKeys()).toMatchObject(initialKeys);
    expect(await storage.getItem("/mnt/test.txt")).toBe("v1");
  });
});

describe("utils", () => {
  it("prefixStorage", async () => {
    const storage = createStorage();
    const pStorage = prefixStorage(storage, "foo");
    await pStorage.setItem("x", "bar");
    await pStorage.setItem("y", "baz");
    expect(await storage.getItem("foo:x")).toBe("bar");
    expect(await pStorage.getItem("x")).toBe("bar");
    expect(await pStorage.getKeys()).toStrictEqual(["x", "y"]);

    // Higher order storage
    const secondStorage = createStorage();
    secondStorage.mount("/mnt", storage);
    const mntStorage = prefixStorage(secondStorage, "mnt");

    expect(await mntStorage.getKeys()).toStrictEqual(["foo:x", "foo:y"]);
    // Get keys from sub-storage
    expect(await mntStorage.getKeys("foo")).toStrictEqual(["foo:x", "foo:y"]);
  });

  it("prefixStorage watch strips base from callback key", async () => {
    const storage = createStorage();
    const pStorage = prefixStorage(storage, "foo");
    const onChange = vi.fn();

    await pStorage.watch(onChange);
    await pStorage.setItem("x", "bar");
    await storage.setItem("foo:y", "baz");
    await storage.setItem("bar:x", "ignored");
    await pStorage.removeItem("x");

    expect(onChange).toHaveBeenCalledWith("update", "x");
    expect(onChange).toHaveBeenCalledWith("update", "y");
    expect(onChange).toHaveBeenCalledWith("remove", "x");
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("stringify", () => {
    const storage = createStorage();
    expect(async () => await storage.setItem("foo", [])).not.toThrow();
  });

  it("has aliases", async () => {
    const storage = createStorage();

    await storage.setItem("foo", "bar");
    expect(await storage.has("foo")).toBe(true);
    expect(await storage.get("foo")).toBe("bar");
    expect(await storage.keys()).toEqual(["foo"]);
    await storage.del("foo");
    expect(await storage.has("foo")).toBe(false);
    await storage.setItem("bar", "baz");
    await storage.remove("bar");
    expect(await storage.has("bar")).toBe(false);
  });
});

describe("Regression", () => {
  it("setItems doeesn't upload twice", async () => {
    /**
     * https://github.com/unjs/unstorage/pull/392
     */

    const setItem = vi.fn();
    const setItems = vi.fn();

    const driver = memory();
    const storage = createStorage({
      driver: {
        ...driver,
        setItem: (...args) => {
          setItem(...args);
          return driver.setItem?.(...args);
        },
        setItems: (...args) => {
          setItems(...args);
          return driver.setItems?.(...args);
        },
      },
    });

    await storage.setItems([{ key: "foo.txt", value: "bar" }]);
    expect(setItem).toHaveBeenCalledTimes(0);
    expect(setItems).toHaveBeenCalledTimes(1);
  });

  it("prefixed storage supports aliases", async () => {
    const storage = createStorage();
    const pStorage = prefixStorage(storage, "foo");

    await pStorage.set("x", "foo");
    await pStorage.set("y", "bar");

    expect(await pStorage.get("x")).toBe("foo");
    expect(await pStorage.get("x")).toBe("foo");
    expect(await pStorage.has("x")).toBe(true);
    expect(await pStorage.get("y")).toBe("bar");

    expect(await pStorage.keys()).toStrictEqual(["x", "y"]);

    await pStorage.del("x");
    expect(await pStorage.has("x")).toBe(false);

    await pStorage.remove("y");
    expect(await pStorage.has("y")).toBe(false);
  });

  it("getKeys supports maxDepth with mixed native support", async () => {
    const base = resolve(__dirname, "tmp/fs");
    const mainStorage = memory();
    const secondaryStorage = fs({ base });
    const storage = createStorage({ driver: mainStorage });

    storage.mount("/storage_b", secondaryStorage);

    try {
      await storage.setItem("/storage_a/file_depth1", "contents");
      await storage.setItem("/storage_a/depth1/file_depth2", "contents");
      await storage.setItem("/storage_b/file_depth1", "contents");
      await storage.setItem("/storage_b/depth1/file_depth2", "contents");

      const keys = await storage.getKeys(undefined, { maxDepth: 1 });

      expect(keys.sort()).toMatchObject(["storage_a:file_depth1", "storage_b:file_depth1"]);
    } finally {
      await storage.clear();
    }
  });

  it("prefixStorage getItems to not returns null (issue #396)", async () => {
    const storage = createStorage();
    await storage.setItem("namespace:key", "value");

    const plainResult = await storage.getItems(["namespace:key"]);
    expect(plainResult).toEqual([{ key: "namespace:key", value: "value" }]);

    const prefixed = prefixStorage(storage, "namespace");

    const prefixedResult = await prefixed.getItems(["key"]);
    expect(prefixedResult).toEqual([{ key: "key", value: "value" }]);
  });

  it("prefixStorage setItems works correctly (related to issue #396)", async () => {
    const storage = createStorage();

    const prefixed = prefixStorage(storage, "namespace");

    await prefixed.setItems([
      { key: "key1", value: "value1" },
      { key: "key2", value: "value2" },
    ]);

    const plainResult = await storage.getItems(["namespace:key1", "namespace:key2"]);
    expect(plainResult).toEqual([
      { key: "namespace:key1", value: "value1" },
      { key: "namespace:key2", value: "value2" },
    ]);

    const prefixedResult = await prefixed.getItems(["key1", "key2"]);
    expect(prefixedResult).toEqual([
      { key: "key1", value: "value1" },
      { key: "key2", value: "value2" },
    ]);
  });
});

describe("read formats", () => {
  const encoder = new TextEncoder();
  const types = ["text", "json", "bytes", "blob", "stream"] as const;

  it("normalizes missing and undefined values", async () => {
    const storage = createStorage({
      driver: { ...memory(), getItem: () => undefined as any, getItemRaw: () => undefined },
    });
    expect(await storage.getItem("missing")).toBeNull();
    for (const type of types) {
      expect(await storage.get("missing", { type })).toBeNull();
      expect(await storage.getItems(["missing"], { type })).toEqual([
        { key: "missing", value: null },
      ]);
    }
  });

  it("reads raw text and JSON with native and string-only drivers", async () => {
    for (const raw of [true, false]) {
      const driver = memory();
      if (!raw) {
        delete driver.getItemRaw;
        delete driver.setItemRaw;
      }
      const storage = createStorage({ driver });
      await storage.setItemRaw("text", encoder.encode("hello wörld"));
      await storage.setItemRaw("json", encoder.encode('{"a":1}'));
      expect(await storage.get("text", { type: "text" })).toBe("hello wörld");
      expect(await storage.getItem("json", { type: "json" })).toEqual({ a: 1 });
      expect(await storage.getItem("text", { type: "bytes" })).toEqual(
        encoder.encode("hello wörld"),
      );
      expect(await storage.getItem("text")).toEqual(
        raw ? encoder.encode("hello wörld") : "base64:aGVsbG8gd8O2cmxk",
      );
      expect(await storage.getItems(["text"], { type: "text" })).toEqual([
        { key: "text", value: "hello wörld" },
      ]);
      await storage.setItem("plain", "hello");
      expect(await storage.getItem("plain", { type: "json" })).toBe("hello");
    }
  });

  it("runs individual binary reads in parallel with batches", async () => {
    let finishRaw!: () => void;
    let finishBatch!: () => void;
    const rawStarted = new Promise<void>((resolve) => {
      finishRaw = resolve;
    });
    const batchStarted = new Promise<void>((resolve) => {
      finishBatch = resolve;
    });
    const storage = createStorage({
      driver: {
        ...memory(),
        async getItemRaw() {
          finishRaw();
          await batchStarted;
          return "raw";
        },
        async getItems() {
          finishBatch();
          await rawStarted;
          return [{ key: "text", value: "text" }];
        },
      },
    });
    expect(await storage.getItems([{ key: "raw", options: { type: "bytes" } }, "text"])).toEqual([
      { key: "raw", value: encoder.encode("raw") },
      { key: "text", value: "text" },
    ]);
    expect(await storage.getItems([], { type: "bytes" })).toEqual([]);
  });

  it("normalizes binary and plain values", async () => {
    const bytes = encoder.encode("hello wörld");
    const values = [
      bytes,
      Buffer.from(bytes),
      bytes.buffer,
      new DataView(bytes.buffer),
      new DataView(new Uint8Array([0, ...bytes, 0]).buffer, 1, bytes.length),
      new Blob([bytes]),
      new Response(bytes),
      new ReadableStream({
        start(c) {
          c.enqueue(bytes);
          c.close();
        },
      }),
      (async function* () {
        yield bytes.subarray(0, 3);
        yield bytes.subarray(3);
      })(),
      "hello wörld",
      true,
      42,
      { a: 1 },
      [1, 2],
      new Uint8Array(),
    ];
    for (const value of values) {
      const storage = createStorage({ driver: { ...memory(), getItemRaw: () => value } });
      const result = await storage.getItem("value", { type: "bytes" });
      const expected =
        value === true
          ? "true"
          : value === 42
            ? "42"
            : Array.isArray(value)
              ? "[1,2]"
              : value?.constructor === Object
                ? '{"a":1}'
                : value instanceof Uint8Array && !value.length
                  ? ""
                  : "hello wörld";
      expect(result).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(result!)).toBe(expected);
    }
    const storage = createStorage({ driver: { ...memory(), getItemRaw: () => new Map() } });
    await expect(storage.getItem("value", { type: "bytes" })).rejects.toThrow(
      "Cannot convert `Map` to bytes",
    );
  });

  it("preserves blobs and streams and releases a failing reader", async () => {
    const blob = new Blob(["hello"]);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.error(new Error("broken"));
      },
    });
    const storage = createStorage({
      driver: { ...memory(), getItemRaw: (key) => (key === "blob" ? blob : stream) },
    });
    expect(await storage.getItem("blob", { type: "blob" })).toBe(blob);
    expect(await storage.getItem("stream", { type: "stream" })).toBe(stream);
    await expect(storage.getItem("stream", { type: "bytes" })).rejects.toThrow("broken");
    expect(stream.locked).toBe(false);
    await storage.setItem("text", "hello");
    const normal = createStorage();
    await normal.setItem("text", "hello");
    expect(await (await normal.getItem("text", { type: "blob" }))!.text()).toBe("hello");
    expect(await new Response(await normal.getItem("text", { type: "stream" })).text()).toBe(
      "hello",
    );
  });

  it("applies batch types by position, strips options and preserves order across mounts", async () => {
    const getItem = vi.fn(() => "fallback");
    const getItemRaw = vi.fn(() => encoder.encode("raw"));
    const getItems = vi.fn((items) =>
      items.map((_: unknown, index: number) => ({
        key: `renamed${index}`,
        value: "base64:aGVsbG8=",
      })),
    );
    const storage = createStorage({ driver: { ...memory(), getItem, getItemRaw, getItems } });
    storage.mount("mounted", memory());
    await storage.setItem("mounted:value", "mounted");
    const result = await storage.getItems(
      [
        "a",
        "mounted:value",
        { key: "b", options: { type: "bytes", ttl: 1 } },
        { key: "c", options: { type: "json" } },
      ],
      { type: "text", consistency: "strong" },
    );
    expect(result).toEqual([
      { key: "renamed0", value: "hello" },
      { key: "mounted:value", value: "mounted" },
      { key: "b", value: encoder.encode("raw") },
      { key: "renamed1", value: "hello" },
    ]);
    expect(getItem).not.toHaveBeenCalled();
    expect(getItemRaw).toHaveBeenCalledWith("b", { ttl: 1, consistency: "strong" });
    expect(getItems).toHaveBeenCalledWith(
      [
        { key: "a", options: { consistency: "strong" } },
        { key: "c", options: { consistency: "strong" } },
      ],
      { consistency: "strong" },
    );
    expect(await prefixStorage(storage, "prefix").getItems(["a"], { type: "text" })).toEqual([
      { key: "0", value: "hello" },
    ]);
  });
});
