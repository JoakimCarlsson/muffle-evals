import * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import {
  type ZodObject,
  type ZodOptional,
  type ZodType,
  ZodOptional as _ZodOptional,
  union,
} from "./schemas.js";

export type ZodDeepPartial<T extends core.$ZodType> = T extends ZodObject
  ? ZodObject<
      { -readonly [k in keyof T["shape"]]: ZodOptional<T["shape"][k]> },
      T["_zod"]["config"]
    >
  : ZodType;

/** Makes every object in the tree partial. Never mutates `schema`. */
export function deepPartial<T extends core.$ZodType>(
  schema: T,
): ZodDeepPartial<T> {
  return visit(schema, {
    object: (s) => core.util.partial(_ZodOptional, s, undefined),
    // an optional discriminator breaks the lookup, so fall back to a plain union
    union: (s) =>
      "discriminator" in s._zod.def ? union(s._zod.def.options) : s,
  }) as any;
}
