import { describe, it, expect } from "vitest";
import { createStorage, type Driver } from "../src/index.ts";
import memory from "../src/drivers/memory.ts";

const bytesOf = (s: string) => new TextEncoder().encode(s);

describe("getItem type option", () => {
  it("reads in the requested format", async () => {
    const storage = createStorage();
    await storage.setItem("user", { a: 1 });
    await storage.setItemRaw("bin", bytesOf("hello wörld"));
    expect(await storage.getItem("user", { type: "text" })).toBe('{"a":1}');
    expect(await storage.getItem("user", { type: "json" })).toEqual({ a: 1 });
    expect(await storage.getItem("bin", { type: "text" })).toBe("hello wörld");
    expect(await storage.getItem("nope", { type: "json" })).toBeNull();
    expect(await storage.getItem("nope", { type: "stream" })).toBeNull();
    expect(await storage.getItem("nope")).toBeNull();
    const bytes = await storage.getItem("bin", { type: "bytes" });
    expect(bytes).toEqual(bytesOf("hello wörld"));
    const blob = await storage.getItem("bin", { type: "blob" });
    expect(await blob!.text()).toBe("hello wörld");
    const stream = await storage.getItem("bin", { type: "stream" });
    expect(await new Response(stream!).text()).toBe("hello wörld");
  });

  it("decodes base64 strings from string-only drivers", async () => {
    const data = new Map<string, string>();
    const driver: Driver = {
      hasItem: (k) => data.has(k),
      getItem: (k) => data.get(k) as any,
      setItem: (k, v) => void data.set(k, v),
      getKeys: () => [...data.keys()],
    };
    const storage = createStorage({ driver });
    await storage.setItemRaw("a", bytesOf('{"x":1}'));
    expect(data.get("a")).toMatch(/^base64:/);
    expect(await storage.getItem("a", { type: "json" })).toEqual({ x: 1 });
    expect(await storage.getItem("a", { type: "bytes" })).toEqual(bytesOf('{"x":1}'));
    expect(await storage.getItem("missing", { type: "bytes" })).toBeNull();
  });

  it("normalizes binary-like values and rejects others", async () => {
    const storage = createStorage();
    const expected = bytesOf("abc");
    const values: any[] = [
      expected,
      Buffer.from("abc"),
      expected.buffer,
      new DataView(expected.buffer),
      new Blob(["abc"]),
      new Response("abc"),
      new Response("abc").body,
      (async function* () {
        yield bytesOf("a");
        yield "bc";
      })(),
      "abc",
    ];
    for (const value of values) {
      await storage.setItemRaw("k", value);
      expect(await storage.getItem("k", { type: "bytes" })).toEqual(expected);
    }
    await storage.setItemRaw("k", true);
    expect(await storage.getItem("k", { type: "bytes" })).toEqual(bytesOf("true"));
    await storage.setItemRaw("k", { a: 1 });
    expect(await storage.getItem("k", { type: "bytes" })).toEqual(bytesOf('{"a":1}'));
    await storage.setItemRaw("k", new Map());
    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow(
      /Cannot convert `Map` to bytes/,
    );
    await storage.setItemRaw("k", Object.create(null, { x: { value: 1 } }));
    await storage.setItemRaw("k", new (class {})());
    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow(/`/);
  });

  it("returns blobs and streams as is and releases the lock on failure", async () => {
    const storage = createStorage();
    const blob = new Blob(["x"]);
    const stream = new ReadableStream();
    await storage.setItemRaw("b", blob);
    await storage.setItemRaw("s", stream);
    expect(await storage.getItem("b", { type: "blob" })).toBe(blob);
    expect(await storage.getItem("s", { type: "stream" })).toBe(stream);

    const failing = new ReadableStream({
      pull(c) {
        c.error(new Error("boom"));
      },
    });
    await storage.setItemRaw("f", failing);
    await expect(storage.getItem("f", { type: "bytes" })).rejects.toThrow("boom");
    expect(failing.locked).toBe(false);
  });

  it("does not forward type to the driver and maps undefined to null", async () => {
    let seen: any;
    const driver: Driver = {
      hasItem: () => false,
      getItem: (_k, opts) => ((seen = opts), undefined as any),
      getKeys: () => [],
    };
    const storage = createStorage({ driver });
    expect(await storage.getItem("a", { type: "text", foo: 1 })).toBeNull();
    expect(seen).toEqual({ foo: 1 });
    expect(await storage.getItem("a")).toBeNull();
  });

  it("supports type in getItems in input order across mounts", async () => {
    const storage = createStorage();
    storage.mount("m", memory());
    await storage.setItem("a", "1");
    await storage.setItem("m:b", { x: 1 });
    await storage.setItemRaw("c", bytesOf("hi"));
    await storage.setItemRaw("m:d", bytesOf("yo"));
    const res = await storage.getItems(
      [
        "a",
        { key: "m:b", options: { type: "text" } },
        "c",
        { key: "m:d", options: { type: "bytes" } },
      ],
      { type: "json" },
    );
    expect(res).toEqual([
      { key: "a", value: 1 },
      { key: "m:b", value: '{"x":1}' },
      { key: "c", value: "hi" },
      { key: "m:d", value: bytesOf("yo") },
    ]);
  });

  it("applies type by position when the driver renames keys", async () => {
    const driver: Driver = {
      hasItem: () => false,
      getItem: () => null,
      getKeys: () => [],
      getItems: (items) => items.map((i) => ({ key: `x/${i.key}`, value: '{"a":1}' })),
    };
    const storage = createStorage({ driver });
    const res = await storage.getItems(["a", { key: "b", options: { type: "text" } }]);
    expect(res.map((r) => r.value)).toEqual([{ a: 1 }, '{"a":1}']);
  });
});
