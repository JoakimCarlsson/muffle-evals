import { destr } from "destr";
import type { GetItemType } from "./types.ts";
import { BASE64_PREFIX, deserializeRaw } from "./_utils.ts";

const GET_ITEM_TYPES = new Set<string>(["text", "json", "bytes", "blob", "stream"]);

export function assertGetItemType(type: unknown): asserts type is GetItemType | undefined {
  if (type !== undefined && !GET_ITEM_TYPES.has(type as string)) {
    throw new Error(`[unstorage] Unknown \`type\` option: ${String(type)}`);
  }
}

/** `bytes`, `blob` and `stream` read the driver's raw value. */
export function isRawType(type: GetItemType | undefined): type is "bytes" | "blob" | "stream" {
  return type === "bytes" || type === "blob" || type === "stream";
}

/** Remove the reserved `type` option before options are handed to a driver. */
export function omitType<T extends Record<string, any> | undefined>(options: T): T {
  if (!options || !("type" in options)) {
    return options;
  }
  const { type: _type, ...rest } = options;
  return rest as T;
}

function isPlainObject(value: any): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/** Text form of numbers, booleans, plain objects and arrays (`undefined` for anything else). */
function plainText(value: unknown): string | undefined {
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
    case "bigint": {
      return String(value);
    }
    case "object": {
      if (value !== null && (Array.isArray(value) || isPlainObject(value))) {
        return JSON.stringify(value);
      }
    }
  }
}

const isInstance = (name: string, value: unknown) => {
  const ctor = (globalThis as any)[name];
  return typeof ctor === "function" && value instanceof ctor;
};

function concat(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) {
    return chunks[0]!;
  }
  const result = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function drainStream(stream: ReadableStream): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(await toBytes(value));
    }
  } finally {
    reader.releaseLock();
  }
  return concat(chunks);
}

/** Normalize any binary-like value to a `Uint8Array`. */
export async function toBytes(value: unknown): Promise<Uint8Array> {
  const text = plainText(value);
  if (text !== undefined) {
    return new TextEncoder().encode(text);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer || isInstance("SharedArrayBuffer", value)) {
    return new Uint8Array(value as ArrayBuffer);
  }
  if (isInstance("Blob", value)) {
    return new Uint8Array(await (value as Blob).arrayBuffer());
  }
  if (isInstance("ReadableStream", value)) {
    return drainStream(value as ReadableStream);
  }
  if (isInstance("Response", value)) {
    return new Uint8Array(await (value as Response).arrayBuffer());
  }
  if (value && typeof (value as any)[Symbol.asyncIterator] === "function") {
    const chunks: Uint8Array[] = [];
    for await (const chunk of value as AsyncIterable<unknown>) {
      chunks.push(await toBytes(chunk));
    }
    return concat(chunks);
  }
  const name = (value as any)?.constructor?.name || "Object";
  throw new Error(`[unstorage] Cannot convert \`${name}\` to bytes`);
}

async function toText(value: unknown): Promise<string> {
  if (typeof value === "string" && !value.startsWith(BASE64_PREFIX)) {
    return value;
  }
  const text = plainText(value);
  if (text !== undefined && typeof value !== "string") {
    return text;
  }
  return new TextDecoder().decode(await toBytes(deserializeRaw(value)));
}

function bytesToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** Convert a value read with the driver's `getItem` (`text`, `json` or no type). */
export async function convertValue(type: GetItemType | undefined, value: unknown): Promise<any> {
  assertGetItemType(type);
  if (value === undefined || value === null) {
    return null;
  }
  if (type === "text") {
    return toText(value);
  }
  if (type === "json") {
    if (typeof value === "string" || plainText(value) === undefined) {
      return destr(await toText(value));
    }
    return value;
  }
  return destr(value);
}

/** Convert a value read with the driver's raw reader (`bytes`, `blob` or `stream`). */
export async function convertRaw(type: "bytes" | "blob" | "stream", value: unknown): Promise<any> {
  if (value === undefined || value === null) {
    return null;
  }
  if (type === "blob") {
    if (isInstance("Blob", value)) {
      return value;
    }
    if (isInstance("Response", value)) {
      return (value as Response).blob();
    }
    return new Blob([(await toBytes(value)) as BlobPart]);
  }
  if (type === "stream") {
    if (isInstance("ReadableStream", value)) {
      return value;
    }
    if (isInstance("Blob", value)) {
      return (value as Blob).stream();
    }
    if (isInstance("Response", value)) {
      return (value as Response).body ?? bytesToStream(new Uint8Array());
    }
    return bytesToStream(await toBytes(value));
  }
  return toBytes(value);
}
