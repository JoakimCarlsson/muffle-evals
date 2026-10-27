import { destr } from "destr";

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

const textEncoder = /* @__PURE__ */ new TextEncoder();
const textDecoder = /* @__PURE__ */ new TextDecoder();

function isPlainValue(value: any): boolean {
  const type = typeof value;
  return (
    type === "number" ||
    type === "boolean" ||
    (type === "object" && value !== null && (Array.isArray(value) || isPureObject(value)))
  );
}

function asUint8Array(value: Uint8Array): Uint8Array {
  // Normalize subclasses such as `Buffer` without copying
  return value.constructor === Uint8Array
    ? value
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
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
      chunks.push((await toBytes(value))!);
    }
  } finally {
    reader.releaseLock();
  }
  return concatBytes(chunks);
}

async function drainIterable(iterable: AsyncIterable<unknown>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of iterable) {
    chunks.push((await toBytes(chunk))!);
  }
  return concatBytes(chunks);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) {
    return chunks[0]!;
  }
  const result = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

/** Normalizes any binary-like value to a `Uint8Array`. */
export async function toBytes(value: any): Promise<Uint8Array | null> {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return textEncoder.encode(value);
  }
  if (value instanceof Uint8Array) {
    return asUint8Array(value);
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return new Uint8Array(await value.arrayBuffer());
  }
  if (typeof Response !== "undefined" && value instanceof Response) {
    return new Uint8Array(await value.arrayBuffer());
  }
  if (typeof ReadableStream !== "undefined" && value instanceof ReadableStream) {
    return drainStream(value);
  }
  if (typeof value[Symbol.asyncIterator] === "function") {
    return drainIterable(value);
  }
  if (isPlainValue(value)) {
    return textEncoder.encode(stringify(value));
  }
  const name = (typeof value === "object" && value.constructor?.name) || "Object";
  throw new Error(`[unstorage] Cannot convert \`${name}\` to bytes`);
}

async function toText(value: any): Promise<string> {
  if (typeof value === "string") {
    return value.startsWith(BASE64_PREFIX)
      ? textDecoder.decode(base64Decode(value.slice(BASE64_PREFIX.length)))
      : value;
  }
  if (isPlainValue(value)) {
    return stringify(value);
  }
  return textDecoder.decode((await toBytes(value))!);
}

/** Converts a value read through the driver's `getItem` to a `text`, `json` or untyped item. */
export async function convertText(value: any, type: "text" | "json" | undefined): Promise<any> {
  if (value === null || value === undefined) {
    return null;
  }
  if (type === "text") {
    return toText(value);
  }
  if (type === "json") {
    return typeof value === "string" || !isPlainValue(value) ? destr(await toText(value)) : value;
  }
  return destr(value);
}

/** Converts a raw driver value to a `bytes`, `blob` or `stream` item. */
export async function convertBinary(value: any, type: "bytes" | "blob" | "stream"): Promise<any> {
  if (value === null || value === undefined) {
    return null;
  }
  if (type === "blob") {
    if (typeof Blob !== "undefined" && value instanceof Blob) {
      return value;
    }
    return new Blob([(await toBytes(value))! as BlobPart]);
  }
  if (type === "stream") {
    if (typeof ReadableStream !== "undefined" && value instanceof ReadableStream) {
      return value;
    }
    if (typeof Blob !== "undefined" && value instanceof Blob) {
      return value.stream();
    }
    const bytes = (await toBytes(value))!;
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
  }
  return toBytes(value);
}
