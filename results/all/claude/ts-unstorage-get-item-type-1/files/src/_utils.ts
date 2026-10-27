import { destr } from "destr";
import type { GetItemType } from "./types.ts";

type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;
type Promisified<T> = Promise<Awaited<T>>;

export function wrapToPromise<T>(value: T): Promisified<T> {
  if (!value || typeof (value as any).then !== "function") {
    return Promise.resolve(value) as Promisified<T>;
  }
  return value as unknown as Promisified<T>;
}

export function asyncCall<T extends (...arguments_: any) => any>(
  function_: T,
  ...arguments_: any[]
): Promisified<ReturnType<T>> {
  try {
    return wrapToPromise(function_(...arguments_));
  } catch (error) {
    return Promise.reject(error);
  }
}

function isPrimitive(value: any) {
  const type = typeof value;
  return value === null || (type !== "object" && type !== "function");
}

function isPureObject(value: any) {
  const proto = Object.getPrototypeOf(value);
  // eslint-disable-next-line no-prototype-builtins
  return !proto || proto.isPrototypeOf(Object);
}

export function stringify(value: any): string {
  if (isPrimitive(value)) {
    return String(value);
  }

  if (isPureObject(value) || Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (typeof value.toJSON === "function") {
    return stringify(value.toJSON());
  }

  throw new Error("[unstorage] Cannot stringify value!");
}

export const BASE64_PREFIX = "base64:";

export function serializeRaw(value: any): string {
  if (typeof value === "string") {
    return value;
  }
  return BASE64_PREFIX + base64Encode(value);
}

export function deserializeRaw(value: any): any {
  if (typeof value !== "string") {
    // Return non-strings as-is
    return value;
  }
  if (!value.startsWith(BASE64_PREFIX)) {
    // Return unknown strings as-is
    return value;
  }
  return base64Decode(value.slice(BASE64_PREFIX.length));
}

function base64Decode(input: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "base64");
  }
  return Uint8Array.from(globalThis.atob(input), (c) => c.codePointAt(0) as number);
}

function base64Encode(input: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input).toString("base64");
  }
  return globalThis.btoa(String.fromCodePoint(...input));
}

const GET_ITEM_TYPES = ["text", "json", "bytes", "blob", "stream"];
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Whether `type` reads the driver's raw value. */
export function isBinaryType(type?: GetItemType): boolean {
  return type === "bytes" || type === "blob" || type === "stream";
}

export function assertGetItemType(type: unknown): void {
  if (type !== undefined && !GET_ITEM_TYPES.includes(type as string)) {
    throw new Error(`[unstorage] Unsupported type \`${String(type)}\``);
  }
}

function isTextLike(value: unknown): boolean {
  return (
    typeof value === "number" ||
    typeof value === "boolean" ||
    (typeof value === "object" && value !== null && (Array.isArray(value) || isPureObject(value)))
  );
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

async function toBytes(value: any): Promise<Uint8Array> {
  if (typeof value === "string") {
    return encoder.encode(value);
  }
  if (value instanceof Uint8Array && value.constructor === Uint8Array) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (
    value instanceof ArrayBuffer ||
    (typeof SharedArrayBuffer !== "undefined" && value instanceof SharedArrayBuffer)
  ) {
    return new Uint8Array(value);
  }
  if (value instanceof Blob || value instanceof Response) {
    return new Uint8Array(await value.arrayBuffer());
  }
  if (value instanceof ReadableStream) {
    const reader = value.getReader();
    const parts: Uint8Array[] = [];
    try {
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) {
          break;
        }
        parts.push(await toBytes(chunk));
      }
    } finally {
      reader.releaseLock();
    }
    return concatBytes(parts);
  }
  if (value && typeof value[Symbol.asyncIterator] === "function") {
    const parts: Uint8Array[] = [];
    for await (const chunk of value) {
      parts.push(await toBytes(chunk));
    }
    return concatBytes(parts);
  }
  if (isTextLike(value)) {
    return encoder.encode(stringify(value));
  }
  throw new Error(
    `[unstorage] Cannot convert \`${value?.constructor?.name || "Object"}\` to bytes`,
  );
}

async function toText(value: any): Promise<string> {
  if (typeof value === "string") {
    return value.startsWith(BASE64_PREFIX) ? decoder.decode(deserializeRaw(value)) : value;
  }
  if (isTextLike(value)) {
    return stringify(value);
  }
  return decoder.decode(await toBytes(value));
}

/**
 * Converts a value read from a driver to the requested `type`.
 * `null` and `undefined` give `null`; without `type` the value is only parsed leniently.
 */
export async function convertItem(value: unknown, type?: GetItemType): Promise<unknown> {
  if (value === undefined || value === null) {
    return null;
  }
  switch (type) {
    case "text":
      return toText(value);
    case "json":
      return typeof value === "string" || !isTextLike(value) ? destr(await toText(value)) : value;
    case "bytes":
      return toBytes(value);
    case "blob":
      return value instanceof Blob ? value : new Blob([(await toBytes(value)) as BlobPart]);
    case "stream":
      if (value instanceof ReadableStream) {
        return value;
      }
      if (value instanceof Blob) {
        return value.stream();
      }
      const bytes = await toBytes(value);
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
    default:
      return destr(value);
  }
}
