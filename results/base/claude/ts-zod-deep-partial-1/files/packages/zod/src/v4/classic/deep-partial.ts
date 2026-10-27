import * as core from "../core/index.js";
import { deepPartial as _deepPartial } from "../core/visit.js";
import { ZodObject, ZodOptional, ZodType, ZodUnion } from "./schemas.js";

/**
 * The partial version of an object schema: every entry of `.shape` wrapped in `ZodOptional`.
 * The type is deliberately shallow so recursive schemas stay cheap; nested objects are made
 * partial at runtime.
 */
export type ZodDeepPartial<T extends core.$ZodType> =
  T extends ZodObject<infer Shape, infer Config>
    ? ZodObject<{ -readonly [k in keyof Shape]: ZodOptional<Shape[k]> }, Config>
    : ZodType;

/** Makes every object in the schema tree partial. Returns a new schema; the input is not mutated. */
export function deepPartial<T extends core.$ZodType>(schema: T): ZodDeepPartial<T> {
  return _deepPartial(schema, ZodOptional, ZodUnion) as any;
}

