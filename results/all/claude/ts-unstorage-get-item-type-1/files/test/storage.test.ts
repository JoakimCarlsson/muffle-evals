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

  describe("getItem type", () => {
    const decode = (v: Uint8Array) => new TextDecoder().decode(v);
    const drain = async (stream: ReadableStream<Uint8Array>) =>
      new Uint8Array(await new Response(stream).arrayBuffer());

    it("returns null for missing keys and undefined", async () => {
      const storage = createStorage({
        driver: { ...memory(), getItem: () => undefined as any, getItemRaw: () => undefined },
      });
      for (const type of [undefined, "text", "json", "bytes", "blob", "stream"] as const) {
        expect(await storage.getItem("x", (type ? { type } : {}) as any)).toBeNull();
      }
    });

    it("reads raw values in every format", async () => {
      const storage = createStorage();
      await storage.setItemRaw("a", new TextEncoder().encode('{"a":1}'));
      expect(await storage.getItem("a", { type: "text" })).toBe('{"a":1}');
      expect(await storage.getItem("a", { type: "json" })).toEqual({ a: 1 });
      expect(decode((await storage.getItem("a", { type: "bytes" }))!)).toBe('{"a":1}');
      expect(await (await storage.get("a", { type: "blob" }))!.text()).toBe('{"a":1}');
      expect(decode(await drain((await storage.getItem("a", { type: "stream" }))!))).toBe(
        '{"a":1}',
      );
    });

    it("decodes base64 strings from string-only drivers", async () => {
      const store = new Map<string, string>();
      const storage = createStorage({
        driver: {
          hasItem: (k) => store.has(k),
          getItem: (k) => store.get(k) ?? null,
          setItem: (k, v) => void store.set(k, v),
          getKeys: () => [...store.keys()],
        },
      });
      await storage.setItemRaw("a", new TextEncoder().encode("hello wörld"));
      expect(store.get("a")).toMatch(/^base64:/);
      expect(await storage.getItem("a", { type: "text" })).toBe("hello wörld");
      expect(await storage.getItem("a", { type: "json" })).toBe("hello wörld");
      expect(decode((await storage.getItem("a", { type: "bytes" }))!)).toBe("hello wörld");
    });

    it("normalizes binary-like values", async () => {
      const values: Record<string, any> = {
        buffer: Buffer.from("hi"),
        ab: new TextEncoder().encode("hi").buffer,
        view: new DataView(new TextEncoder().encode("hi").buffer),
        blob: new Blob(["hi"]),
        response: new Response("hi"),
        stream: new Response("hi").body,
        iter: (async function* () {
          yield new TextEncoder().encode("h");
          yield "i";
        })(),
        string: "hi",
      };
      const storage = createStorage();
      for (const [key, value] of Object.entries(values)) {
        await storage.setItemRaw(key, value);
        const bytes = (await storage.getItem(key, { type: "bytes" }))!;
        expect(bytes.constructor).toBe(Uint8Array);
        expect(decode(bytes)).toBe("hi");
      }
      await storage.setItemRaw("true", true);
      await storage.setItemRaw("obj", { a: 1 });
      expect(decode((await storage.getItem("true", { type: "bytes" }))!)).toBe("true");
      expect(decode((await storage.getItem("obj", { type: "bytes" }))!)).toBe('{"a":1}');
      await storage.setItemRaw("map", new Map());
      await expect(storage.getItem("map", { type: "bytes" })).rejects.toThrow(
        /Cannot convert `Map` to bytes/,
      );
    });

    it("returns Blob and ReadableStream as is", async () => {
      const blob = new Blob(["x"]);
      const stream = new Response("x").body!;
      const storage = createStorage();
      await storage.setItemRaw("blob", blob);
      await storage.setItemRaw("stream", stream);
      expect(await storage.getItem("blob", { type: "blob" })).toBe(blob);
      expect(await storage.getItem("stream", { type: "stream" })).toBe(stream);
    });

    it("releases the reader lock when draining fails", async () => {
      let stream!: ReadableStream;
      const storage = createStorage({
        driver: {
          ...memory(),
          getItemRaw: () => {
            stream = new ReadableStream({
              pull(c) {
                c.error(new Error("boom"));
              },
            });
            return stream;
          },
        },
      });
      await expect(storage.getItem("x", { type: "bytes" })).rejects.toThrow("boom");
      expect(stream.locked).toBe(false);
    });

    it("keeps plain values and does not forward type", async () => {
      const getItem = vi.fn((_k: string, _o?: any) => "plain");
      const storage = createStorage({ driver: { ...memory(), getItem } });
      expect(await storage.getItem("a", { type: "text", foo: 1 })).toBe("plain");
      expect(getItem.mock.calls[0]![1]).toEqual({ foo: 1 });
    });

    it("getItems applies types in input order", async () => {
      const storage = createStorage();
      storage.mount("m", memory());
      await storage.setItem("a", { n: 1 });
      await storage.setItem("m:b", { n: 2 });
      await storage.setItemRaw("c", new TextEncoder().encode("raw"));
      const result = await storage.getItems(
        ["a", { key: "m:b", options: { type: "text" } }, { key: "c", options: { type: "bytes" } }],
        { type: "json" },
      );
      expect(result.map((r) => r.key)).toEqual(["a", "m:b", "c"]);
      expect(result[0]!.value).toEqual({ n: 1 });
      expect(result[1]!.value).toBe('{"n":2}');
      expect(decode(result[2]!.value as Uint8Array)).toBe("raw");
    });

    it("getItems matches driver results by position", async () => {
      const storage = createStorage({
        driver: {
          ...memory(),
          getItems: (items) => items.map((i) => ({ key: i.key + "!", value: "base64:aGk=" })),
        },
      });
      expect(await storage.getItems(["a", "b"], { type: "text" })).toEqual([
        { key: "a!", value: "hi" },
        { key: "b!", value: "hi" },
      ]);
    });
  });
});
