import * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import { ZodOptional, ZodUnion, type ZodObject } from "./schemas.js";

/**
 * limit: only the top-level shape is typed as partial, nested objects keep their original type
 * to keep recursive schemas shallow; revisit with a depth-bounded type.
 */
export type ZodDeepPartial<T extends core.$ZodType> =
  T extends ZodObject<infer Shape, infer Config>
    ? ZodObject<{ -readonly [k in keyof Shape]: ZodOptional<Shape[k]> }, Config>
    : T;

/** Makes every object in the schema tree partial, recursively. Never mutates `schema`. */
export function deepPartial<T extends core.$ZodType>(schema: T): ZodDeepPartial<T> {
  return visit(schema, {
    object: (s) => core.util.partial(ZodOptional, s, undefined),
    union: (s) => {
      const { discriminator, unionFallback, ...def } = s._zod.def;
      return discriminator === undefined ? s : new ZodUnion(def);
    },
  }) as any;
}
