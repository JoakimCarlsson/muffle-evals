import { describe, it, expect } from "vitest";
import { createStorage, type Driver } from "../src/index.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe("read formats", () => {
  it("decodes raw data and preserves missing values", async () => {
    for (const raw of [true, false]) {
      const values = new Map();
      const storage = raw
        ? createStorage()
        : createStorage({
            driver: {
              hasItem: (key) => values.has(key),
              getKeys: () => [...values.keys()],
              getItem: (key) => values.get(key),
              setItem: (key, value) => {
                values.set(key, value);
              },
            },
          });
      await storage.setItemRaw("text", encoder.encode("hello wörld"));
      await storage.setItemRaw("json", encoder.encode('{"a":1}'));
      expect(await storage.get("text", { type: "text" })).toBe("hello wörld");
      expect(await storage.getItem("json", { type: "json" })).toEqual({ a: 1 });
      expect(await (await storage.getItem("text", { type: "blob" }))!.text()).toBe("hello wörld");
      expect(await new Response((await storage.getItem("text", { type: "stream" }))!).text()).toBe(
        "hello wörld",
      );

      for (const type of [undefined, "text", "json", "bytes", "blob", "stream"] as const) {
        expect(await storage.getItem("missing", { type } as any)).toBeNull();
      }
    }
  });

  it("normalizes binary and plain values", async () => {
    const bytes = encoder.encode("hello");
    for (const value of [
      bytes,
      bytes.buffer,
      new DataView(bytes.buffer),
      new Blob([bytes]),
      new Response(bytes),
      new ReadableStream({
        start(c) {
          c.enqueue(bytes);
          c.close();
        },
      }),
      (async function* () {
        yield bytes;
      })(),
      "hello",
      true,
      42,
      { a: 1 },
      [1],
    ]) {
      const storage = createStorage({
        driver: {
          hasItem: () => true,
          getKeys: () => [],
          getItem: () => null,
          getItemRaw: () => value,
        },
      });
      const expected =
        typeof value === "boolean"
          ? "true"
          : typeof value === "number"
            ? "42"
            : Array.isArray(value)
              ? "[1]"
              : value?.constructor === Object
                ? '{"a":1}'
                : "hello";
      expect(decoder.decode((await storage.getItem("x", { type: "bytes" }))!)).toBe(expected);
    }
  });

  it("preserves matching blobs and streams and releases failing readers", async () => {
    const storage = createStorage();
    const blob = new Blob(["hello"]);
    const stream = new ReadableStream();
    await storage.setItemRaw("blob", blob);
    await storage.setItemRaw("stream", stream);
    expect(await storage.getItem("blob", { type: "blob" })).toBe(blob);
    expect(await storage.getItem("stream", { type: "stream" })).toBe(stream);
    const broken = new ReadableStream({
      pull(c) {
        c.error(new Error("broken"));
      },
    });
    await storage.setItemRaw("broken", broken);
    await expect(storage.getItem("broken", { type: "bytes" })).rejects.toThrow("broken");
    expect(broken.locked).toBe(false);
    await storage.setItemRaw("map", new Map());
    await expect(storage.getItem("map", { type: "bytes" })).rejects.toThrow(
      "Cannot convert `Map` to bytes",
    );
  });

  it("mixes batches with raw reads, strips types, and matches positions", async () => {
    const driver: Driver = {
      hasItem: () => true,
      getKeys: () => [],
      getItem: () => "fallback",
      getItemRaw: (key, options) => {
        expect(options).not.toHaveProperty("type");
        return encoder.encode(key);
      },
      getItems: (items, options) => {
        expect(options).not.toHaveProperty("type");
        for (const item of items) expect(item.options).not.toHaveProperty("type");
        return items.map(({ key }) => ({ key: "changed-" + key, value: "42" }));
      },
    };
    const storage = createStorage({ driver });
    storage.mount("mount", { ...driver });
    const results = await storage.getItems(
      [
        "a",
        { key: "raw", options: { type: "bytes" } },
        "mount:b",
        { key: "c", options: { type: "json" } },
      ],
      { type: "text" },
    );
    expect(results.map((item) => item.key)).toEqual([
      "changed-a",
      "raw",
      "mount:changed-b",
      "changed-c",
    ]);
    expect(results.map((item) => item.value)).toEqual(["42", encoder.encode("raw"), "42", 42]);
  });
});
