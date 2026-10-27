import * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import { ZodMiniOptional, ZodMiniUnion, type ZodMiniObject } from "./schemas.js";

/**
 * limit: only the top-level shape is typed as partial, nested objects keep their original type
 * to keep recursive schemas shallow; revisit with a depth-bounded type.
 */
export type ZodMiniDeepPartial<T extends core.$ZodType> =
  T extends ZodMiniObject<infer Shape, infer Config>
    ? ZodMiniObject<{ -readonly [k in keyof Shape]: ZodMiniOptional<Shape[k]> }, Config>
    : T;

/** Makes every object in the schema tree partial, recursively. Never mutates `schema`. */
export function deepPartial<T extends core.$ZodType>(schema: T): ZodMiniDeepPartial<T> {
  return visit(schema, {
    object: (s) => core.util.partial(ZodMiniOptional, s, undefined),
    union: (s) => {
      const { discriminator, unionFallback, ...def } = s._zod.def;
      return discriminator === undefined ? s : new ZodMiniUnion(def);
    },
  }) as any;
}
