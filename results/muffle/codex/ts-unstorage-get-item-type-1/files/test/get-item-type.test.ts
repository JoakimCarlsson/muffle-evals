import { describe, it, expect, vi } from "vitest";
import { createStorage, prefixStorage } from "../src/index.ts";
import memory from "../src/drivers/memory.ts";

const encode = (value: string) => new TextEncoder().encode(value);

describe("read types", () => {
  it("decodes raw values and preserves default reads", async () => {
    for (const raw of [true, false]) {
      const driver = memory();
      if (!raw) {
        delete driver.getItemRaw;
        delete driver.setItemRaw;
      }
      const storage = createStorage({ driver });
      await storage.setItemRaw("greeting", encode("hello wörld"));
      expect(await storage.get("greeting", { type: "text" })).toBe("hello wörld");
      await storage.setItemRaw("json", encode('{"a":1}'));
      expect(await storage.getItem("json", { type: "json" })).toEqual({ a: 1 });
      for (const type of ["text", "json", "bytes", "blob", "stream"] as const) {
        expect(await storage.getItem("missing", { type })).toBeNull();
      }
      expect(await storage.getItem("missing")).toBeNull();
    }
    const driver = memory();
    driver.getItem = () => undefined as any;
    expect(await createStorage({ driver }).getItem("missing")).toBeNull();
  });

  it("normalizes binary and plain values", async () => {
    const bytes = encode("hello wörld");
    const values = [
      bytes,
      Buffer.from(bytes),
      bytes.buffer,
      new DataView(bytes.buffer),
      new Blob([bytes]),
      new Response(bytes),
      new Blob([bytes]).stream(),
      (async function* () {
        yield bytes.subarray(0, 2);
        yield bytes.subarray(2);
      })(),
    ];
    for (const value of values) {
      const driver = memory();
      driver.getItemRaw = () => value;
      expect(await createStorage({ driver }).getItem("key", { type: "bytes" })).toEqual(bytes);
    }
    for (const value of [true, 42, { a: 1 }, [1, 2], "hello wörld"]) {
      const driver = memory();
      driver.getItemRaw = () => value;
      driver.getItem = () => value;
      const storage = createStorage({ driver });
      expect(await storage.getItem("key", { type: "bytes" })).toEqual(
        encode((await storage.getItem("key", { type: "text" }))!),
      );
    }
    const driver = memory();
    driver.getItemRaw = () => new Map();
    await expect(createStorage({ driver }).getItem("key", { type: "bytes" })).rejects.toThrow(
      "Cannot convert `Map` to bytes",
    );
  });

  it("preserves blobs and streams and releases failed stream readers", async () => {
    const storage = createStorage();
    const blob = new Blob(["hello"]);
    const stream = blob.stream();
    await storage.setItemRaw("blob", blob);
    await storage.setItemRaw("stream", stream);
    expect(await storage.getItem("blob", { type: "blob" })).toBe(blob);
    expect(await storage.getItem("stream", { type: "stream" })).toBe(stream);
    const failing = new ReadableStream({
      pull(controller) {
        controller.error(new Error("broken"));
      },
    });
    await storage.setItemRaw("bad", failing);
    await expect(storage.getItem("bad", { type: "bytes" })).rejects.toThrow("broken");
    expect(failing.locked).toBe(false);
    await storage.setItem("value", "hello");
    expect(await (await storage.getItem("value", { type: "blob" }))!.text()).toBe("hello");
    expect(await new Response((await storage.getItem("value", { type: "stream" }))!).text()).toBe(
      "hello",
    );
  });

  it("starts raw reads alongside the driver batch", async () => {
    const driver = memory();
    let release!: () => void;
    const rawStarted = new Promise<void>((resolve) => {
      release = resolve;
    });
    driver.getItems = async () => {
      await rawStarted;
      return [{ key: "text", value: "hello" }];
    };
    driver.getItemRaw = () => {
      release();
      return encode("raw");
    };
    const storage = createStorage({ driver });
    expect(await storage.getItems(["text", { key: "raw", options: { type: "bytes" } }])).toEqual([
      { key: "text", value: "hello" },
      { key: "raw", value: encode("raw") },
    ]);
  });

  it("uses positional batch types, strips type, and keeps order across mounts", async () => {
    const driver = memory();
    driver.getItems = vi.fn(async (items, common) => {
      expect(common).toEqual({ consistency: "strong" });
      expect(items).toEqual([
        { key: "a", options: { consistency: "strong" } },
        { key: "a", options: { consistency: "strong" } },
      ]);
      return items.map(() => ({ key: "rewritten", value: '{"a":1}' }));
    });
    driver.getItemRaw = vi.fn((_key, options) => {
      expect(options).toEqual({ consistency: "strong" });
      return encode("raw");
    });
    const storage = createStorage({ driver });
    storage.mount("other", memory());
    await storage.setItem("other:b", 42);
    const result = await storage.getItems(
      [
        "a",
        "other:b",
        { key: "binary", options: { type: "bytes" } },
        { key: "a", options: { type: "json" } },
      ],
      { type: "text", consistency: "strong" },
    );
    expect(result).toEqual([
      { key: "rewritten", value: '{"a":1}' },
      { key: "other:b", value: "42" },
      { key: "binary", value: encode("raw") },
      { key: "rewritten", value: { a: 1 } },
    ]);
    expect(driver.getItemRaw).toHaveBeenCalledOnce();
    const prefixed = prefixStorage(storage, "other");
    expect(await prefixed.getItems(["b"], { type: "text" })).toEqual([{ key: "b", value: "42" }]);
  });
});
