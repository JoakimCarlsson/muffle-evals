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

const isBinaryLike = (value: any): boolean =>
  typeof value === "object" &&
  value !== null &&
  (ArrayBuffer.isView(value) ||
    value instanceof ArrayBuffer ||
    value instanceof Blob ||
    value instanceof ReadableStream ||
    (typeof Response !== "undefined" && value instanceof Response) ||
    typeof value[Symbol.asyncIterator] === "function");

const concatBytes = (chunks: Uint8Array[]): Uint8Array => {
  const bytes = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
};

/**
 * Normalizes any binary-like or text-like value to a `Uint8Array`.
 */
export async function toBytes(value: any): Promise<Uint8Array> {
  if (typeof value === "string") {
    return new TextEncoder().encode(value);
  }
  if (value instanceof Uint8Array && value.constructor === Uint8Array) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (value instanceof Blob || (typeof Response !== "undefined" && value instanceof Response)) {
    return new Uint8Array(await value.arrayBuffer());
  }
  if (value instanceof ReadableStream) {
    const reader = value.getReader();
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) {
          break;
        }
        chunks.push(await toBytes(chunk));
      }
    } finally {
      reader.releaseLock();
    }
    return concatBytes(chunks);
  }
  if (value && typeof value[Symbol.asyncIterator] === "function") {
    const chunks: Uint8Array[] = [];
    for await (const chunk of value) {
      chunks.push(await toBytes(chunk));
    }
    return concatBytes(chunks);
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    Array.isArray(value) ||
    (value && typeof value === "object" && isPureObject(value))
  ) {
    return new TextEncoder().encode(stringify(value));
  }
  throw new Error(
    `[unstorage] Cannot convert \`${value?.constructor?.name || "Object"}\` to bytes`,
  );
}

/**
 * Converts a driver's raw value to the requested binary `type`.
 * `Blob` and `ReadableStream` values are returned as is when asked for.
 */
export async function toBinaryType(value: any, type: "bytes" | "blob" | "stream"): Promise<any> {
  if (value === null || value === undefined) {
    return null;
  }
  if (type === "blob" && value instanceof Blob) {
    return value;
  }
  if (type === "stream" && value instanceof ReadableStream) {
    return value;
  }
  const bytes = await toBytes(value);
  if (type === "bytes") {
    return bytes;
  }
  if (type === "blob") {
    return new Blob([bytes as BlobPart]);
  }
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (bytes.length > 0) {
        controller.enqueue(bytes);
      }
      controller.close();
    },
  });
}

/**
 * Converts a value returned by a driver's `getItem` for the `text`/`json` types
 * (or no type), decoding `setItemRaw` values (`base64:` strings, binary).
 */
export async function toTextOrJson(value: any, type?: "text" | "json"): Promise<any> {
  if (value === null || value === undefined) {
    return null;
  }
  if (!type) {
    return destr(value);
  }
  if (typeof value === "string" && value.startsWith(BASE64_PREFIX)) {
    value = base64Decode(value.slice(BASE64_PREFIX.length));
  }
  if (isBinaryLike(value)) {
    value = new TextDecoder().decode(await toBytes(value));
  } else if (type === "text" && typeof value !== "string") {
    value = stringify(value);
  }
  return type === "json" && typeof value === "string" ? destr(value) : value;
}
