import { destr } from "destr";
import { deserializeRaw, stringify } from "./_utils.ts";
import type { GetItemType } from "./types.ts";

export function isRawType(type?: GetItemType): boolean {
  return type === "bytes" || type === "blob" || type === "stream";
}

function isInstance<T>(value: unknown, ctor: { new (...args: any[]): T } | undefined): value is T {
  return !!ctor && value instanceof ctor;
}

export async function toBytes(value: any): Promise<Uint8Array> {
  if (value instanceof Uint8Array)
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (isInstance(value, globalThis.Blob) || isInstance(value, globalThis.Response)) {
    return new Uint8Array(await value.arrayBuffer());
  }
  const chunks: Uint8Array[] = [];
  if (isInstance(value, globalThis.ReadableStream)) {
    const reader = value.getReader();
    try {
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        chunks.push(await toBytes(chunk));
      }
    } finally {
      reader.releaseLock();
    }
  } else if (value && typeof value[Symbol.asyncIterator] === "function") {
    for await (const chunk of value) chunks.push(await toBytes(chunk));
  } else {
    const proto = value && typeof value === "object" ? Object.getPrototypeOf(value) : undefined;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      Array.isArray(value) ||
      proto === null ||
      proto === Object.prototype
    ) {
      return new TextEncoder().encode(stringify(value));
    }
    throw new Error(
      `[unstorage] Cannot convert \`${value?.constructor?.name || "Object"}\` to bytes`,
    );
  }
  const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function convertValue(value: any, type?: GetItemType): Promise<any> {
  if (value === null || value === undefined) return null;
  if (!type) return destr(value);
  value = deserializeRaw(value);
  if (type === "blob" && isInstance(value, globalThis.Blob)) return value;
  if (type === "stream" && isInstance(value, globalThis.ReadableStream)) return value;
  if (type === "json" || type === "text") {
    const proto = typeof value === "object" ? Object.getPrototypeOf(value) : undefined;
    const plain =
      typeof value !== "object" ||
      Array.isArray(value) ||
      proto === null ||
      proto === Object.prototype;
    if (plain) return type === "json" ? destr(value) : stringify(value);
    const text = new TextDecoder().decode(await toBytes(value));
    return type === "json" ? destr(text) : text;
  }
  const bytes = await toBytes(value);
  if (type === "blob") return new Blob([bytes as Uint8Array<ArrayBuffer>]);
  if (type === "stream") {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
  }
  return bytes;
}
