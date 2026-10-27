import * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import {
  type ZodMiniObject,
  type ZodMiniOptional,
  type ZodMiniType,
  ZodMiniOptional as _ZodMiniOptional,
  union,
} from "./schemas.js";

export type ZodMiniDeepPartial<T extends core.$ZodType> =
  T extends ZodMiniObject
    ? ZodMiniObject<
        { -readonly [k in keyof T["shape"]]: ZodMiniOptional<T["shape"][k]> },
        T["_zod"]["config"]
      >
    : ZodMiniType;

/** Makes every object in the tree partial. Never mutates `schema`. */
export function deepPartial<T extends core.$ZodType>(
  schema: T,
): ZodMiniDeepPartial<T> {
  return visit(schema, {
    object: (s) => core.util.partial(_ZodMiniOptional, s, undefined),
    // an optional discriminator breaks the lookup, so fall back to a plain union
    union: (s) =>
      "discriminator" in s._zod.def ? union(s._zod.def.options) : s,
  }) as any;
}
