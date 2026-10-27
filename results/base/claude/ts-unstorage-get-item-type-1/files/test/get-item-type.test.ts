import { describe, it, expect } from "vitest";
import { createStorage } from "../src/index.ts";
import memory from "../src/drivers/memory.ts";
import type { Driver } from "../src/index.ts";

const enc = new TextEncoder();
const stringOnly = (): Driver => {
  const data = new Map<string, string>();
  return {
    hasItem: (k) => data.has(k),
    getItem: (k) => data.get(k) as any,
    setItem: (k, v) => void data.set(k, v),
    getKeys: () => [...data.keys()],
  };
};

async function read(stream: ReadableStream<Uint8Array>) {
  return new TextDecoder().decode(new Uint8Array(await new Response(stream).arrayBuffer()));
}

describe("getItem type option", () => {
  it("missing keys and undefined are null", async () => {
    const storage = createStorage({ driver: { ...memory(), getItem: () => undefined as any } });
    expect(await storage.getItem("x")).toBeNull();
    for (const type of ["text", "json", "bytes", "blob", "stream"] as const) {
      expect(await storage.getItem("x", { type })).toBeNull();
    }
  });

  for (const [name, driver] of [
    ["memory", memory],
    ["string-only", stringOnly],
  ] as const) {
    it(`decodes setItemRaw values (${name})`, async () => {
      const storage = createStorage({ driver: driver() });
      await storage.setItemRaw("a", enc.encode("hello wörld"));
      expect(await storage.getItem("a", { type: "text" })).toBe("hello wörld");
      expect(await storage.getItem("a", { type: "bytes" })).toEqual(enc.encode("hello wörld"));
      expect(await read((await storage.getItem("a", { type: "stream" }))!)).toBe("hello wörld");
      expect(await (await storage.getItem("a", { type: "blob" }))!.text()).toBe("hello wörld");
      await storage.setItemRaw("j", enc.encode('{"a":1}'));
      expect(await storage.getItem("j", { type: "json" })).toEqual({ a: 1 });
      await storage.setItem("s", "plain");
      expect(await storage.getItem("s", { type: "text" })).toBe("plain");
      expect(await storage.getItem("s", { type: "json" })).toBe("plain");
      expect(await storage.getItem("s", { type: "bytes" })).toEqual(enc.encode("plain"));
    });
  }

  it("normalizes binary-like values", async () => {
    const storage = createStorage();
    const bytes = enc.encode("abc");
    const values: unknown[] = [
      bytes,
      Buffer.from("abc"),
      bytes.buffer.slice(0),
      new DataView(bytes.buffer.slice(0)),
      new Blob(["abc"]),
      new Response("abc"),
      new Blob(["abc"]).stream(),
      (async function* () {
        yield enc.encode("a");
        yield "bc";
      })(),
      "abc",
    ];
    for (const value of values) {
      await storage.setItemRaw("k", value);
      const out = await storage.getItem("k", { type: "bytes" });
      expect(out!.constructor).toBe(Uint8Array);
      expect([...out!]).toEqual([...bytes]);
    }
    await storage.setItemRaw("k", true);
    expect(await storage.getItem("k", { type: "bytes" })).toEqual(enc.encode("true"));
    await storage.setItemRaw("k", { a: 1 });
    expect(await storage.getItem("k", { type: "bytes" })).toEqual(enc.encode('{"a":1}'));
    await storage.setItemRaw("k", new Map());
    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow(
      /Cannot convert `Map` to bytes/,
    );
  });

  it("returns blobs and streams as is", async () => {
    const storage = createStorage();
    const blob = new Blob(["x"]);
    const stream = new Blob(["x"]).stream();
    await storage.setItemRaw("b", blob);
    await storage.setItemRaw("s", stream);
    expect(await storage.getItem("b", { type: "blob" })).toBe(blob);
    expect(await storage.getItem("s", { type: "stream" })).toBe(stream);
  });

  it("releases the reader lock when draining fails", async () => {
    const storage = createStorage();
    const stream = new ReadableStream({
      pull(controller) {
        controller.error(new Error("boom"));
      },
    });
    await storage.setItemRaw("k", stream);
    await expect(storage.getItem("k", { type: "bytes" })).rejects.toThrow("boom");
    expect(stream.locked).toBe(false);
  });

  it("does not forward type to the driver", async () => {
    let seen: any;
    const storage = createStorage({
      driver: { ...memory(), getItemRaw: (_k, o) => ((seen = o), null) },
    });
    await storage.getItem("k", { type: "bytes", foo: 1 });
    expect(seen).toEqual({ foo: 1 });
  });

  it("getItems", async () => {
    const storage = createStorage();
    storage.mount("m", memory());
    await storage.setItem("a", '{"n":1}');
    await storage.setItem("m:b", "bee");
    await storage.setItemRaw("m:c", enc.encode("see"));
    const out = await storage.getItems(
      [
        "a",
        { key: "m:b", options: { type: "bytes" } },
        "m:c",
        "missing",
        { key: "a", options: { type: "text" } },
      ],
      { type: "json" },
    );
    expect(out).toEqual([
      { key: "a", value: { n: 1 } },
      { key: "m:b", value: enc.encode("bee") },
      { key: "m:c", value: "see" },
      { key: "missing", value: null },
      { key: "a", value: '{"n":1}' },
    ]);
  });

  it("getItems applies type by position with batch drivers renaming keys", async () => {
    const storage = createStorage({
      driver: {
        ...memory(),
        getItems: (items) => items.map((i) => ({ key: "renamed:" + i.key, value: "v:" + i.key })),
        getItemRaw: (k) => "raw:" + k,
      },
    });
    const out = await storage.getItems([
      { key: "x", options: { type: "text" } },
      { key: "y", options: { type: "bytes" } },
      "z",
    ]);
    expect(out[0]).toEqual({ key: "renamed:x", value: "v:x" });
    expect(out[1]).toEqual({ key: "y", value: enc.encode("raw:y") });
    expect(out[2]).toEqual({ key: "renamed:z", value: "v:z" });
  });
});
