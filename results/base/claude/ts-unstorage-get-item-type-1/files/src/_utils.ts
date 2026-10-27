import { destr } from "destr";
import type { Driver } from "./types.ts";

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

// --- Typed reads (`getItem(key, { type })`) ---

const GET_ITEM_TYPES = new Set(["text", "json", "bytes", "blob", "stream"]);

export function isRawGetItemType(type: string | undefined): boolean {
  return type === "bytes" || type === "blob" || type === "stream";
}

/**
 * Split the reserved `type` option from the options forwarded to drivers.
 */
export function splitGetItemOptions<T extends Record<string, any> | undefined>(
  options: T,
): { type: string | undefined; options: Record<string, any> } {
  const { type, ...rest } = (options || {}) as Record<string, any>;
  if (type !== undefined && !GET_ITEM_TYPES.has(type)) {
    throw new Error(
      `[unstorage] Unknown \`type\` option: ${String(type)} (expected one of ${[...GET_ITEM_TYPES].join(", ")})`,
    );
  }
  return { type, options: rest };
}

function isAsyncIterable(value: any): value is AsyncIterable<unknown> {
  return typeof value?.[Symbol.asyncIterator] === "function";
}

function isBinaryLike(value: any): boolean {
  return (
    value instanceof ArrayBuffer ||
    (typeof SharedArrayBuffer !== "undefined" && value instanceof SharedArrayBuffer) ||
    ArrayBuffer.isView(value) ||
    (typeof Blob !== "undefined" && value instanceof Blob) ||
    (typeof ReadableStream !== "undefined" && value instanceof ReadableStream) ||
    (typeof Response !== "undefined" && value instanceof Response) ||
    isAsyncIterable(value)
  );
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) {
    return chunks[0]!;
  }
  let length = 0;
  for (const chunk of chunks) {
    length += chunk.byteLength;
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function drainStream(stream: ReadableStream<unknown>): Promise<Uint8Array> {
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
  return concatBytes(chunks);
}

/**
 * Normalize any binary-like (or text-like) value to a `Uint8Array`.
 */
export async function toBytes(value: unknown): Promise<Uint8Array> {
  if (value instanceof Uint8Array) {
    // Normalize `Buffer` to a plain `Uint8Array` view (no copy)
    return value.constructor === Uint8Array
      ? value
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (
    value instanceof ArrayBuffer ||
    (typeof SharedArrayBuffer !== "undefined" && value instanceof SharedArrayBuffer)
  ) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return new Uint8Array(await value.arrayBuffer());
  }
  if (typeof ReadableStream !== "undefined" && value instanceof ReadableStream) {
    return drainStream(value);
  }
  if (typeof Response !== "undefined" && value instanceof Response) {
    return new Uint8Array(await value.arrayBuffer());
  }
  if (isAsyncIterable(value)) {
    const chunks: Uint8Array[] = [];
    for await (const chunk of value) {
      chunks.push(await toBytes(chunk));
    }
    return concatBytes(chunks);
  }
  if (typeof value === "string") {
    return new TextEncoder().encode(value);
  }
  if (isTextLike(value)) {
    return new TextEncoder().encode(stringify(value));
  }
  const name = (value as any)?.constructor?.name || "Object";
  throw new Error(`[unstorage] Cannot convert \`${name}\` to bytes`);
}

function isTextLike(value: unknown): boolean {
  return (
    isPrimitive(value) ||
    Array.isArray(value) ||
    (typeof value === "object" && value !== null && isPureObject(value))
  );
}

async function toText(value: unknown): Promise<string> {
  return new TextDecoder().decode(await toBytes(value));
}

async function toStream(value: unknown): Promise<ReadableStream<Uint8Array>> {
  if (value instanceof ReadableStream) {
    return value as ReadableStream<Uint8Array>;
  }
  if (value instanceof Blob) {
    return value.stream() as ReadableStream<Uint8Array>;
  }
  if (value instanceof Response) {
    return (
      (value.body as ReadableStream<Uint8Array> | null) ??
      new ReadableStream<Uint8Array>({ start: (controller) => controller.close() })
    );
  }
  const bytes = await toBytes(value);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (bytes.byteLength > 0) {
        controller.enqueue(bytes);
      }
      controller.close();
    },
  });
}

async function toBlob(value: unknown): Promise<Blob> {
  if (value instanceof Blob) {
    return value;
  }
  if (value instanceof Response) {
    return value.blob();
  }
  return new Blob([(await toBytes(value)) as BlobPart]);
}

/**
 * Convert a value read with the driver's `getItem` for `text` / `json` / no type.
 */
export async function convertItem(type: string | undefined, value: unknown): Promise<any> {
  if (value === undefined || value === null) {
    return null;
  }
  if (!type) {
    return destr(value);
  }
  if (typeof value === "string" && value.startsWith(BASE64_PREFIX)) {
    value = await toBytes(deserializeRaw(value));
  }
  if (type === "text") {
    if (typeof value === "string") {
      return value;
    }
    return isBinaryLike(value) ? toText(value) : stringify(value);
  }
  // json
  if (typeof value === "string") {
    return destr(value);
  }
  return isBinaryLike(value) ? destr(await toText(value)) : value;
}

/**
 * Convert a raw value (from `getItemRaw`) for `bytes` / `blob` / `stream`.
 */
export async function convertRawItem(type: string | undefined, value: unknown): Promise<any> {
  if (value === undefined || value === null) {
    return null;
  }
  switch (type) {
    case "blob": {
      return toBlob(deserializeRaw(value));
    }
    case "stream": {
      return toStream(deserializeRaw(value));
    }
    default: {
      return toBytes(deserializeRaw(value));
    }
  }
}

/**
 * Read a single item from a driver in the requested format.
 * `options` must not contain the `type` option.
 */
export async function readItem(
  driver: Driver,
  key: string,
  options: Record<string, any>,
  type: string | undefined,
): Promise<any> {
  if (isRawGetItemType(type)) {
    if (driver.getItemRaw) {
      return convertRawItem(type, await asyncCall(driver.getItemRaw, key, options));
    }
    // `convertRawItem` decodes `base64:` strings
    return convertRawItem(type, await asyncCall(driver.getItem, key, options));
  }
  return convertItem(type, await asyncCall(driver.getItem, key, options));
}
