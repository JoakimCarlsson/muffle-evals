import { describe, it, expect } from "vitest";
import { createStorage } from "../src/index.ts";
import memory from "../src/drivers/memory.ts";
import type { Driver } from "../src/index.ts";

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

describe("getItem type", () => {
  it("missing key and undefined give null", async () => {
    const storage = createStorage();
    for (const type of ["text", "json", "bytes", "blob", "stream"] as const) {
      expect(await storage.getItem("nope", { type })).toBeNull();
    }
    const undef = createStorage({
      driver: {
        getItem: () => undefined as any,
        hasItem: () => false,
        getKeys: () => [],
      } as Driver,
    });
    expect(await undef.getItem("x")).toBeNull();
  });

  it("text and json", async () => {
    const storage = createStorage();
    await storage.setItem("user", { a: 1 });
    await storage.setItem("n", 12);
    expect(await storage.getItem("user", { type: "text" })).toBe('{"a":1}');
    expect(await storage.getItem("user", { type: "json" })).toEqual({ a: 1 });
    expect(await storage.getItem("n", { type: "text" })).toBe("12");
    await storage.setItem("s", "plain");
    expect(await storage.getItem("s", { type: "json" })).toBe("plain");
    expect(await storage.get("s", { type: "text" })).toBe("plain");
  });

  it("decodes setItemRaw values", async () => {
    const storage = createStorage();
    await storage.setItemRaw("a", enc("hello wörld"));
    await storage.setItemRaw("j", enc('{"x":[1]}'));
    expect(await storage.getItem("a", { type: "text" })).toBe("hello wörld");
    expect(await storage.getItem("j", { type: "json" })).toEqual({ x: [1] });

    const strings = new Map<string, string>();
    const str = createStorage({
      driver: {
        hasItem: (k) => strings.has(k),
        getItem: (k) => strings.get(k) ?? null,
        setItem: (k, v) => void strings.set(k, v),
        getKeys: () => [],
      },
    });
    await str.setItemRaw("a", enc("hello wörld"));
    expect(strings.get("a")).toMatch(/^base64:/);
    expect(await str.getItem("a", { type: "text" })).toBe("hello wörld");
    expect(dec((await str.getItem("a", { type: "bytes" }))!)).toBe("hello wörld");
  });

  it("bytes, blob, stream normalization", async () => {
    const storage = createStorage();
    const bytes = new Uint8Array([1, 2, 3]);
    await storage.setItemRaw("b", Buffer.from(bytes));
    const out = (await storage.getItem("b", { type: "bytes" }))!;
    expect(out.constructor).toBe(Uint8Array);
    expect([...out]).toEqual([1, 2, 3]);
    const blob = (await storage.getItem("b", { type: "blob" }))!;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(3);
    const stream = (await storage.getItem("b", { type: "stream" }))!;
    expect(stream).toBeInstanceOf(ReadableStream);
    expect([...new Uint8Array(await new Response(stream).arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it("accepts many binary-like inputs", async () => {
    const storage = createStorage();
    const source = enc("abc");
    const inputs: any[] = [
      source.buffer.slice(0),
      new DataView(source.buffer.slice(0)),
      new Blob(["abc"]),
      new Response("abc"),
      new ReadableStream({
        start(c) {
          c.enqueue(enc("a"));
          c.enqueue("bc");
          c.close();
        },
      }),
      (async function* () {
        yield enc("ab");
        yield enc("c");
      })(),
      "abc",
    ];
    for (const input of inputs) {
      await storage.setItemRaw("k", input);
      expect(dec((await storage.getItem("k", { type: "bytes" }))!)).toBe("abc");
    }
    await storage.setItemRaw("k", true);
    expect(dec((await storage.getItem("k", { type: "bytes" }))!)).toBe("true");
    await storage.setItemRaw("k", { a: 1 });
    expect(dec((await storage.getItem("k", { type: "bytes" }))!)).toBe('{"a":1}');
    await storage.setItemRaw("k", new Map());
    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow(
      "Cannot convert `Map` to bytes",
    );
  });

  it("returns blob and stream as is", async () => {
    const storage = createStorage();
    const blob = new Blob(["x"]);
    const stream = new ReadableStream();
    await storage.setItemRaw("blob", blob);
    await storage.setItemRaw("stream", stream);
    expect(await storage.getItem("blob", { type: "blob" })).toBe(blob);
    expect(await storage.getItem("stream", { type: "stream" })).toBe(stream);
    expect(stream.locked).toBe(false);
  });

  it("releases the reader lock when a stream fails", async () => {
    const storage = createStorage();
    const stream = new ReadableStream({
      pull(c) {
        c.error(new Error("boom"));
      },
    });
    await storage.setItemRaw("s", stream);
    await expect(storage.getItem("s", { type: "bytes" })).rejects.toThrow("boom");
    expect(stream.locked).toBe(false);
  });

  it("does not forward type to the driver", async () => {
    const seen: any[] = [];
    const storage = createStorage({
      driver: {
        hasItem: () => false,
        getItem: (_k, o) => (seen.push(o), "v"),
        getKeys: () => [],
      },
    });
    await storage.getItem("a", { type: "text", foo: 1 });
    expect(seen).toEqual([{ foo: 1 }]);
  });
});

describe("getItems type", () => {
  it("keeps order and per-item types", async () => {
    const storage = createStorage();
    storage.mount("m", memory());
    await storage.setItem("a", { n: 1 });
    await storage.setItem("m:b", { n: 2 });
    await storage.setItem("c", { n: 3 });
    const res = await storage.getItems(["a", { key: "m:b", options: { type: "bytes" } }, "c"], {
      type: "text",
    });
    expect(res.map((r) => r.key)).toEqual(["a", "m:b", "c"]);
    expect(res[0]!.value).toBe('{"n":1}');
    expect(dec(res[1]!.value as Uint8Array)).toBe('{"n":2}');
    expect(res[2]!.value).toBe('{"n":3}');
    expect((await storage.getItems(["nope"], { type: "blob" }))[0]!.value).toBeNull();
  });

  it("applies type by position when driver keys differ", async () => {
    const storage = createStorage({
      driver: {
        hasItem: () => false,
        getItem: () => null,
        getItems: (items) => items.map((i) => ({ key: i.key + "!", value: enc("hi") })),
        getKeys: () => [],
      },
    });
    const res = await storage.getItems(["a", "b"], { type: "text" });
    expect(res).toEqual([
      { key: "a!", value: "hi" },
      { key: "b!", value: "hi" },
    ]);
  });
});
