import { describe, it, expect, vi, expectTypeOf } from "vitest";
import { createStorage, type JSONValue, type StorageValue } from "../src/index.ts";
import memory from "../src/drivers/memory.ts";

describe("read formats", () => {
  it("decodes raw UTF-8 and JSON with raw and string-only drivers", async () => {
    for (const raw of [true, false]) {
      const driver = memory();
      if (!raw) {
        delete driver.getItemRaw;
        delete driver.setItemRaw;
      }
      const storage = createStorage({ driver });
      await storage.setItemRaw("text", new TextEncoder().encode("hello wörld"));
      await storage.setItemRaw("json", new TextEncoder().encode('{"a":1}'));
      expect(await storage.get("text", { type: "text" })).toBe("hello wörld");
      expect(await storage.getItem("json", { type: "json" })).toEqual({ a: 1 });
      for (const type of ["text", "json", "bytes", "blob", "stream"] as const) {
        expect(await storage.getItem("missing", { type })).toBeNull();
      }
    }
  });

  it("normalizes binary and plain values", async () => {
    const driver = memory();
    const storage = createStorage({ driver });
    for (const value of [true, 123, { a: 1 }, [1, 2], "hello"]) {
      driver.getItem = () => value;
      driver.getItemRaw = () => value;
      const text = await storage.getItem("k", { type: "text" });
      expect(await storage.getItem("k", { type: "bytes" })).toEqual(
        new TextEncoder().encode(text!),
      );
    }
    for (const value of [
      new Uint8Array([1, 2]),
      new Uint8Array([1, 2]).buffer,
      new DataView(new Uint8Array([1, 2]).buffer),
      new Blob([new Uint8Array([1, 2])]),
      new Response(new Uint8Array([1, 2])),
      (async function* () {
        yield new Uint8Array([1]);
        yield new Uint8Array([2]);
      })(),
    ]) {
      driver.getItemRaw = () => value;
      expect(await storage.getItem("k", { type: "bytes" })).toEqual(new Uint8Array([1, 2]));
    }
    driver.getItemRaw = () => new Map();
    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow(
      "Cannot convert `Map` to bytes",
    );
    driver.getItem = () => undefined as any;
    expect(await storage.getItem("k")).toBeNull();
  });

  it("preserves blobs and streams and releases failed readers", async () => {
    const driver = memory();
    const storage = createStorage({ driver });
    const blob = new Blob(["hello"]);
    driver.getItemRaw = () => blob;
    expect(await storage.getItem("k", { type: "blob" })).toBe(blob);
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        c.error(new Error("failed"));
      },
    });
    driver.getItemRaw = () => stream;
    expect(await storage.getItem("k", { type: "stream" })).toBe(stream);
    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow("failed");
    expect(stream.locked).toBe(false);
  });

  it("batches by position, strips type, and keeps mixed mount order", async () => {
    const driver = memory();
    driver.getItems = vi.fn(async (items, common) => {
      expect(common).toEqual({ flag: true });
      expect(items.map((i) => i.options)).toEqual([{ flag: true }, { flag: true }]);
      return items.map(() => ({ key: "changed", value: "123" }));
    });
    driver.getItemRaw = vi.fn(() => "raw");
    const storage = createStorage({ driver }).mount("other", memory());
    const result = await storage.getItems(
      [
        "a",
        { key: "other:missing", options: { type: "bytes" } },
        { key: "b", options: { type: "json" } },
        { key: "c", options: { type: "bytes" } },
      ],
      { type: "text", flag: true },
    );
    expect(result.map((i) => i.value)).toEqual(["123", null, 123, new TextEncoder().encode("raw")]);
    expect(driver.getItemRaw).toHaveBeenCalledWith("c", { flag: true });
  });

  it("infers requested formats", async () => {
    const storage = createStorage();
    expectTypeOf(storage.getItem("k", { type: "bytes" })).toEqualTypeOf<
      Promise<Uint8Array | null>
    >();
    expectTypeOf(storage.get("k", { type: "json" })).toEqualTypeOf<Promise<JSONValue | null>>();
    expectTypeOf(storage.getItems(["a"], { type: "text" })).toEqualTypeOf<
      Promise<{ key: string; value: string | null }[]>
    >();
    expectTypeOf(
      storage.getItems([
        { key: "a", options: { type: "bytes" } },
        { key: "b", options: { type: "json" } },
      ]),
    ).toEqualTypeOf<Promise<{ key: string; value: JSONValue | Uint8Array | null }[]>>();
    expectTypeOf(storage.getItems(["a"])).toEqualTypeOf<
      Promise<{ key: string; value: StorageValue }[]>
    >();
    // @ts-expect-error unknown format
    storage.getItem("k", { type: "buffer" });
    // @ts-expect-error unknown per-item format
    storage.getItems([{ key: "k", options: { type: "buffer" } }]);
  });
});
