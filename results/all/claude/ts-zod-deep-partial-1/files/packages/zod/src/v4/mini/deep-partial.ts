import * as core from "../core/index.js";
import { util } from "../core/index.js";
import { visit } from "../core/visit.js";
import { ZodMiniOptional, union } from "./schemas.js";
import type { ZodMiniObject } from "./schemas.js";

/**
 * Type of `deepPartial(schema)`. Only the top-level shape is typed: entries are the original schemas wrapped in
 * `ZodMiniOptional`. limit: nested objects keep their original static types, revisit if a depth-safe recursive type is found.
 */
export type ZodMiniDeepPartial<T extends core.$ZodType> =
  T extends ZodMiniObject<infer Shape, infer Config>
    ? ZodMiniObject<{ -readonly [K in keyof Shape]: ZodMiniOptional<Shape[K]> }, Config>
    : T;

/**
 * Makes every object in the schema tree partial. Discriminated unions become plain unions. Never mutates its input.
 *
 * @param schema - The schema to make deeply partial.
 * @returns A new schema, or `schema` itself when it contains no objects.
 */
export function deepPartial<T extends core.$ZodType>(schema: T): ZodMiniDeepPartial<T> {
  return visit(schema, {
    object: (s) => util.partial(ZodMiniOptional, s, undefined),
    union: (s: core.$ZodUnion) =>
      "discriminator" in s._zod.def ? union(s._zod.def.options as core.$ZodType[]) : s,
  }) as any;
}
