import * as core from "../core/index.js";
import { deepPartial as _deepPartial } from "../core/visit.js";
import { ZodMiniObject, ZodMiniOptional, ZodMiniType, ZodMiniUnion } from "./schemas.js";

/**
 * The partial version of an object schema: every entry of `.shape` wrapped in `ZodMiniOptional`.
 * The type is deliberately shallow so recursive schemas stay cheap; nested objects are made
 * partial at runtime.
 */
export type ZodMiniDeepPartial<T extends core.$ZodType> =
  T extends ZodMiniObject<infer Shape, infer Config>
    ? ZodMiniObject<{ -readonly [k in keyof Shape]: ZodMiniOptional<Shape[k]> }, Config>
    : ZodMiniType;

/** Makes every object in the schema tree partial. Returns a new schema; the input is not mutated. */
export function deepPartial<T extends core.$ZodType>(schema: T): ZodMiniDeepPartial<T> {
  return _deepPartial(schema, ZodMiniOptional, ZodMiniUnion) as any;
}
