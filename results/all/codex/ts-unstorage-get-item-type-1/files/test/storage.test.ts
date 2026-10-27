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
  const text = "hello wörld";
  const bytes = encoder.encode(text);

  it("reads all formats and normalizes missing values", async () => {
    const storage = createStorage();
    await storage.setItem("user:1", { a: 1 });
    expect(await storage.getItem("user:1", { type: "text" })).toBe('{"a":1}');
    expect(await storage.get("user:1", { type: "json" })).toEqual({ a: 1 });
    expect(await storage.getItem("user:1", { type: "bytes" })).toEqual(encoder.encode('{"a":1}'));
    expect(await (await storage.getItem("user:1", { type: "blob" }))!.text()).toBe('{"a":1}');
    expect(await new Response(await storage.getItem("user:1", { type: "stream" })).text()).toBe(
      '{"a":1}',
    );
    for (const type of [undefined, "text", "json", "bytes", "blob", "stream"] as const) {
      expect(await storage.getItem("missing", { type })).toBeNull();
      const undefinedStorage = createStorage({
        driver: { ...memory(), getItem: () => undefined as any },
      });
      expect(await undefinedStorage.getItem("missing", { type })).toBeNull();
    }
  });

  it("decodes raw writes from binary and string-only drivers", async () => {
    const stringDriver = memory();
    delete stringDriver.getItemRaw;
    delete stringDriver.setItemRaw;
    for (const driver of [memory(), stringDriver]) {
      const storage = createStorage({ driver });
      await storage.setItemRaw("raw", bytes);
      expect(await storage.getItem("raw", { type: "text" })).toBe(text);
      expect(await storage.getItem("raw", { type: "json" })).toBe(text);
      expect(await storage.getItem("raw", { type: "bytes" })).toEqual(bytes);
      await storage.setItemRaw("json", encoder.encode('{"a":1}'));
      expect(await storage.getItem("json", { type: "json" })).toEqual({ a: 1 });
      await storage.setItem("plain", text);
      expect(await storage.getItem("plain", { type: "json" })).toBe(text);
    }
  });

  it("accepts binary values and text-compatible values", async () => {
    const padded = new Uint8Array([0, ...bytes, 0]);
    const values = [
      bytes,
      Buffer.from(bytes),
      bytes.buffer,
      new DataView(padded.buffer, 1, bytes.length),
      new Blob([bytes]),
      new ReadableStream({
        start(c) {
          c.enqueue(bytes);
          c.close();
        },
      }),
      new Response(bytes),
      (async function* () {
        yield bytes.subarray(0, 3);
        yield bytes.subarray(3);
      })(),
      text,
      true,
      42,
      { a: 1 },
      [1, 2],
    ];
    for (const value of values) {
      const expected =
        typeof value === "boolean"
          ? "true"
          : typeof value === "number"
            ? "42"
            : Array.isArray(value)
              ? "[1,2]"
              : value?.constructor === Object
                ? '{"a":1}'
                : text;
      const driver = { ...memory(), getItemRaw: () => value };
      expect(await createStorage({ driver }).getItem("raw", { type: "bytes" })).toEqual(
        encoder.encode(expected),
      );
    }
    for (const value of [true, 42, { a: 1 }, [1, 2]]) {
      const storage = createStorage({
        driver: { ...memory(), getItem: () => value, getItemRaw: () => value },
      });
      expect(await storage.getItem("k", { type: "bytes" })).toEqual(
        encoder.encode((await storage.getItem("k", { type: "text" }))!),
      );
      expect(await storage.getItem("k", { type: "json" })).toBe(value);
    }
  });

  it("preserves blobs and streams and releases failed readers", async () => {
    const blob = new Blob([bytes]);
    const stream = new ReadableStream<Uint8Array>();
    expect(
      await createStorage({ driver: { ...memory(), getItemRaw: () => blob } }).getItem("k", {
        type: "blob",
      }),
    ).toBe(blob);
    expect(
      await createStorage({ driver: { ...memory(), getItemRaw: () => stream } }).getItem("k", {
        type: "stream",
      }),
    ).toBe(stream);
    const broken = new ReadableStream({
      pull(c) {
        c.error(new Error("broken"));
      },
    });
    const storage = createStorage({ driver: { ...memory(), getItemRaw: () => broken } });
    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow("broken");
    expect(broken.locked).toBe(false);
    await expect(
      createStorage({ driver: { ...memory(), getItemRaw: () => new Map() } }).getItem("k", {
        type: "bytes",
      }),
    ).rejects.toThrow("Cannot convert `Map` to bytes");
  });

  it("applies formats by position, strips driver options, and preserves batch order", async () => {
    const driver = {
      ...memory(),
      getItem: vi.fn(() => "true"),
      getItemRaw: vi.fn(() => bytes),
      getItems: vi.fn(async () => [
        { key: "renamed", value: '{"a":1}' },
        { key: "other", value: "true" },
      ]),
    };
    const storage = createStorage({ driver });
    storage.mount("mount", memory());
    await storage.setItem("mount:k", 2);
    const result = await storage.getItems(
      [
        { key: "mount:k", options: { type: "text" } },
        { key: "a", options: { type: "json" } },
        { key: "b", options: { type: "bytes" } },
        "c",
      ],
      { type: "text", custom: 1 },
    );
    expect(result).toEqual([
      { key: "mount:k", value: "2" },
      { key: "renamed", value: { a: 1 } },
      { key: "b", value: bytes },
      { key: "other", value: "true" },
    ]);
    expect(driver.getItems).toHaveBeenCalledWith(
      [
        { key: "a", options: { custom: 1 } },
        { key: "c", options: { custom: 1 } },
      ],
      { custom: 1 },
    );
    expect(driver.getItemRaw).toHaveBeenCalledWith("b", { custom: 1 });
    await storage.getItem("a", { type: "json", custom: 1 });
    expect(driver.getItem).toHaveBeenCalledWith("a", { custom: 1 });
    expect(await storage.getItems([])).toEqual([]);
    const prefixed = prefixStorage(storage, "mount");
    expect(await prefixed.getItems(["k"], { type: "text" })).toEqual([{ key: "k", value: "2" }]);
  });
});

describe("batch raw reads", () => {
  it("starts binary reads alongside the driver batch", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const driver = {
      ...memory(),
      getItems: vi.fn(async () => {
        await gate;
        return [{ key: "json", value: "true" }];
      }),
      getItemRaw: vi.fn(() => {
        release();
        return new Uint8Array([1]);
      }),
    };
    const storage = createStorage({ driver });
    expect(
      await storage.getItems(["json", { key: "bytes", options: { type: "bytes" } }], {
        type: "json",
      }),
    ).toEqual([
      { key: "json", value: true },
      { key: "bytes", value: new Uint8Array([1]) },
    ]);
    expect(driver.getItems).toHaveBeenCalledOnce();
    expect(driver.getItemRaw).toHaveBeenCalledOnce();
  });

  it("handles duplicate keys, individual binary formats, and undefined batch values", async () => {
    const storage = createStorage();
    await storage.setItem("a", true);
    const result = await storage.getItems(
      [
        "a",
        { key: "a", options: { type: "json" } },
        { key: "a", options: { type: "blob" } },
        { key: "a", options: { type: "stream" } },
        "missing",
      ],
      { type: "text" },
    );
    expect(result.slice(0, 2)).toEqual([
      { key: "a", value: "true" },
      { key: "a", value: true },
    ]);
    expect(await (result[2]!.value as Blob).text()).toBe("true");
    expect(await new Response(result[3]!.value as ReadableStream<Uint8Array>).text()).toBe("true");
    expect(result[4]!.value).toBeNull();
    const driver = {
      ...memory(),
      getItems: async () => [{ key: "missing", value: undefined as any }],
    };
    expect(await createStorage({ driver }).getItems(["missing"])).toEqual([
      { key: "missing", value: null },
    ]);
  });
});
