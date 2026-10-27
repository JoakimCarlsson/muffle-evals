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

/** Normalize supported raw values to bytes. */
export async function toBytes(value: any): Promise<Uint8Array> {
  if (value instanceof Uint8Array)
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof Blob || value instanceof Response)
    return new Uint8Array(await value.arrayBuffer());
  if (value instanceof ReadableStream) {
    const reader = value.getReader();
    try {
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        chunks.push(await toBytes(chunk));
      }
      return concatBytes(chunks);
    } finally {
      reader.releaseLock();
    }
  }
  if (value && typeof value[Symbol.asyncIterator] === "function") {
    const chunks: Uint8Array[] = [];
    for await (const chunk of value) chunks.push(await toBytes(chunk));
    return concatBytes(chunks);
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    (value &&
      (Array.isArray(value) ||
        Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null))
  ) {
    return new TextEncoder().encode(stringify(value));
  }
  throw new Error(`Cannot convert \`${value?.constructor?.name || "Object"}\` to bytes`);
}

/** Join byte chunks in their original order. */
function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

/** Convert a driver value to the requested read format. */
export async function convertValue(
  value: any,
  type?: import("./types.ts").GetItemType,
): Promise<any> {
  if (value === null || value === undefined) return null;
  if (!type) return destr(value);
  value = deserializeRaw(value);
  if (type === "json") {
    if (typeof value === "string") return destr(value);
    if (
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null
    )
      return value;
    return destr(new TextDecoder().decode(await toBytes(value)));
  }
  if (type === "text") return new TextDecoder().decode(await toBytes(value));
  if (type === "blob" && value instanceof Blob) return value;
  if (type === "stream" && value instanceof ReadableStream) return value;
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
