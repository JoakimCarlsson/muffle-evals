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

  describe("getItem type option", () => {
    const bytes = new TextEncoder().encode("hello wörld");
    const drain = async (stream: ReadableStream<Uint8Array>) =>
      new Uint8Array(await new Response(stream).arrayBuffer());

    it("missing key and undefined give null", async () => {
      const storage = createStorage({
        driver: { ...memory(), getItem: () => undefined as any },
      });
      expect(await storage.getItem("x")).toBeNull();
      for (const type of ["text", "json", "bytes", "blob", "stream"] as const) {
        expect(await storage.getItem("x", { type })).toBeNull();
        expect(await createStorage().getItem("x", { type })).toBeNull();
      }
    });

    it("reads text, json, bytes, blob and stream", async () => {
      const storage = createStorage();
      await storage.setItem("user", { a: 1 });
      expect(await storage.getItem("user", { type: "text" })).toBe('{"a":1}');
      expect(await storage.get("user", { type: "json" })).toEqual({ a: 1 });
      expect(await storage.getItem("user", { type: "bytes" })).toEqual(
        new TextEncoder().encode('{"a":1}'),
      );
      const blob = await storage.getItem("user", { type: "blob" });
      expect(await blob!.text()).toBe('{"a":1}');
      expect(await drain((await storage.getItem("user", { type: "stream" }))!)).toEqual(
        new TextEncoder().encode('{"a":1}'),
      );
    });

    it("decodes raw values for text and json", async () => {
      for (const driver of [
        memory(),
        { ...memory(), getItemRaw: undefined, setItemRaw: undefined },
      ]) {
        const storage = createStorage({ driver: driver as any });
        await storage.setItemRaw("a", bytes);
        expect(await storage.getItem("a", { type: "text" })).toBe("hello wörld");
        expect(await storage.getItem("a", { type: "bytes" })).toEqual(bytes);
        await storage.setItemRaw("j", new TextEncoder().encode('{"a":1}'));
        expect(await storage.getItem("j", { type: "json" })).toEqual({ a: 1 });
        await storage.setItem("s", "plain");
        expect(await storage.getItem("s", { type: "json" })).toBe("plain");
        expect(await storage.getItem("s", { type: "text" })).toBe("plain");
      }
    });

    it("normalizes binary-like and plain values", async () => {
      const values: Record<string, any> = {
        buf: Buffer.from("hi"),
        ab: bytes.buffer.slice(0) && new TextEncoder().encode("hi").buffer,
        dv: new DataView(new TextEncoder().encode("hi").buffer),
        blob: new Blob(["hi"]),
        stream: new Blob(["hi"]).stream(),
        res: new Response("hi"),
        iter: (async function* () {
          yield "h";
          yield new TextEncoder().encode("i");
        })(),
        str: "hi",
      };
      for (const [key, value] of Object.entries(values)) {
        const storage = createStorage({
          driver: { ...memory(), getItemRaw: () => value },
        });
        const result = await storage.getItem(key, { type: "bytes" });
        expect(result!.constructor).toBe(Uint8Array);
        expect(new TextDecoder().decode(result!)).toBe("hi");
      }
      const plain = async (value: any) =>
        createStorage({ driver: { ...memory(), getItemRaw: () => value } }).getItem("k", {
          type: "bytes",
        });
      expect(new TextDecoder().decode((await plain(true))!)).toBe("true");
      expect(new TextDecoder().decode((await plain({ a: 1 }))!)).toBe('{"a":1}');
      expect(new TextDecoder().decode((await plain(12))!)).toBe("12");
      await expect(plain(new Map())).rejects.toThrow("Cannot convert `Map` to bytes");
      await expect(plain(Symbol("x"))).rejects.toThrow("Cannot convert `Symbol` to bytes");
    });

    it("returns Blob and ReadableStream as is, and releases lock on failure", async () => {
      const blob = new Blob(["hi"]);
      const stream = new Blob(["hi"]).stream();
      const storage = createStorage({
        driver: { ...memory(), getItemRaw: (key: string) => (key === "b" ? blob : stream) },
      });
      expect(await storage.getItem("b", { type: "blob" })).toBe(blob);
      expect(await storage.getItem("s", { type: "stream" })).toBe(stream);

      const failing = new ReadableStream({
        pull(controller) {
          controller.error(new Error("boom"));
        },
      });
      const failingStorage = createStorage({
        driver: { ...memory(), getItemRaw: () => failing },
      });
      await expect(failingStorage.getItem("k", { type: "bytes" })).rejects.toThrow("boom");
      expect(failing.locked).toBe(false);
    });

    it("does not forward type to the driver", async () => {
      const getItem = vi.fn(() => "v");
      const storage = createStorage({ driver: { ...memory(), getItem } });
      await storage.getItem("k", { type: "text", other: 1 });
      expect(getItem).toHaveBeenCalledWith("k", { other: 1 });
    });

    it("getItems applies common and per-item types in order", async () => {
      const storage = createStorage();
      await storage.mount("m", memory()).setItem("m:a", { a: 1 });
      await storage.setItem("b", "x");
      await storage.setItemRaw("c", bytes);
      const items = ["m:a", { key: "b", options: { type: "bytes" as const } }, "c", "none"];
      const result = await storage.getItems(items, { type: "text" });
      expect(result.map((r) => r.key)).toEqual(["m:a", "b", "c", "none"]);
      expect(result.map((r) => r.value)).toEqual([
        '{"a":1}',
        new TextEncoder().encode("x"),
        "hello wörld",
        null,
      ]);
    });

    it("getItems applies type by position when a driver changes keys", async () => {
      const getItems = vi.fn((items: { key: string }[], common: any) => {
        expect(common).toEqual({});
        return items.map((i) => ({ key: "other-" + i.key, value: "base64:aGk=" }));
      });
      const storage = createStorage({ driver: { ...memory(), getItems } });
      const result = await storage.getItems(["a", "b"], { type: "text" });
      expect(result).toEqual([
        { key: "other-a", value: "hi" },
        { key: "other-b", value: "hi" },
      ]);
      expect(getItems.mock.calls[0]![0]).toEqual([
        { key: "a", options: {} },
        { key: "b", options: {} },
      ]);
    });

    it("getItems reads binary items one by one next to a driver batch", async () => {
      const getItems = vi.fn((items: { key: string }[]) =>
        items.map((i) => ({ key: i.key, value: "t" })),
      );
      const getItemRaw = vi.fn(() => new TextEncoder().encode("raw"));
      const storage = createStorage({ driver: { ...memory(), getItems, getItemRaw } });
      const result = await storage.getItems(["a", { key: "b", options: { type: "bytes" } }]);
      expect(result).toEqual([
        { key: "a", value: "t" },
        { key: "b", value: new TextEncoder().encode("raw") },
      ]);
      expect(getItems.mock.calls[0]![0]).toHaveLength(1);
      expect(getItemRaw).toHaveBeenCalledTimes(1);
    });
  });
});
