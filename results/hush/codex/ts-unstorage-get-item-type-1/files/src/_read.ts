import { destr } from "destr";
import { deserializeRaw, stringify } from "./_utils.ts";
import type { GetItemType } from "./types.ts";

export function isBinaryType(type?: GetItemType) {
  return type === "bytes" || type === "blob" || type === "stream";
}

export async function toBytes(value: any): Promise<Uint8Array> {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof Blob || value instanceof Response) {
    return new Uint8Array(await value.arrayBuffer());
  }
  if (value instanceof ReadableStream) {
    const reader = value.getReader();
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        chunks.push(await toBytes(chunk));
      }
    } finally {
      reader.releaseLock();
    }
    return concat(chunks);
  }
  if (value?.[Symbol.asyncIterator]) {
    const chunks: Uint8Array[] = [];
    for await (const chunk of value) chunks.push(await toBytes(chunk));
    return concat(chunks);
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    Array.isArray(value) ||
    (typeof value === "object" &&
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null))
  ) {
    return new TextEncoder().encode(stringify(value));
  }
  throw new TypeError(`Cannot convert \`${value?.constructor?.name || "Object"}\` to bytes`);
}

function concat(chunks: Uint8Array[]) {
  const result = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function readValue(value: any, type?: GetItemType): Promise<any> {
  if (value == null) return null;
  if (!type) return destr(value);
  value = deserializeRaw(value);
  if (type === "blob" && value instanceof Blob) return value;
  if (type === "stream" && value instanceof ReadableStream) return value;
  if (isBinaryType(type)) {
    const bytes = await toBytes(value);
    if (type === "blob") return new Blob([bytes as Uint8Array<ArrayBuffer>]);
    if (type === "stream")
      return new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
    return bytes;
  }
  const binary =
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    value instanceof Blob ||
    value instanceof ReadableStream ||
    value instanceof Response ||
    value?.[Symbol.asyncIterator];
  if (binary) value = new TextDecoder().decode(await toBytes(value));
  return type === "text" ? (typeof value === "string" ? value : stringify(value)) : destr(value);
}
