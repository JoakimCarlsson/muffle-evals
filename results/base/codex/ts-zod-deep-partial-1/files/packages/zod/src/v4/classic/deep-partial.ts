import type * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import * as s from "./schemas.js";

export type DeepPartial<T extends core.SomeType> = Rewrite<T, "partial">;
export type Rewrite<T extends core.SomeType, Mode extends "partial" | "input" | "output"> = T extends s.ZodObject<
  infer Shape,
  infer Config
>
  ? s.ZodObject<
      { [K in keyof Shape]: Mode extends "partial" ? s.ZodOptional<Rewrite<Shape[K], Mode>> : Rewrite<Shape[K], Mode> },
      Config
    >
  : T extends s.ZodFunction<infer Args, infer Returns>
    ? s.ZodFunction<Rewrite<Args, Mode> extends infer A extends core.$ZodFunctionIn ? A : Args, Rewrite<Returns, Mode>>
    : T extends s.ZodCodec<infer A, infer B>
      ? Mode extends "partial"
        ? s.ZodCodec<Rewrite<A, Mode>, Rewrite<B, Mode>>
        : Rewrite<Mode extends "input" ? A : B, Mode>
      : T extends s.ZodPreprocess<infer B, infer I>
        ? Mode extends "partial"
          ? s.ZodPreprocess<Rewrite<B, Mode>, I>
          : Mode extends "output"
            ? Rewrite<B, Mode>
            : core.$ZodTransform<unknown, I>
        : T extends s.ZodPipe<infer A, infer B>
          ? Mode extends "partial"
            ? s.ZodPipe<Rewrite<A, Mode>, Rewrite<B, Mode>>
            : Rewrite<Mode extends "input" ? A : B, Mode>
          : T extends s.ZodDiscriminatedUnion<infer Options>
            ? s.ZodUnion<{ [K in keyof Options]: Rewrite<Options[K], Mode> }>
            : T extends s.ZodUnion<infer Options>
              ? s.ZodUnion<{ [K in keyof Options]: Rewrite<Options[K], Mode> }>
              : T extends s.ZodIntersection<infer A, infer B>
                ? s.ZodIntersection<Rewrite<A, Mode>, Rewrite<B, Mode>>
                : T extends s.ZodTuple<infer Items, infer Rest>
                  ? s.ZodTuple<
                      { [K in keyof Items]: Rewrite<Items[K], Mode> },
                      Rest extends core.SomeType ? Rewrite<Rest, Mode> : null
                    >
                  : T extends s.ZodRecord<infer K, infer V>
                    ? s.ZodRecord<
                        Rewrite<K, Mode> extends infer Key extends core.$ZodRecordKey ? Key : K,
                        Rewrite<V, Mode>
                      >
                    : T extends s.ZodMap<infer K, infer V>
                      ? s.ZodMap<Rewrite<K, Mode>, Rewrite<V, Mode>>
                      : T extends s.ZodArray<infer Inner>
                        ? s.ZodArray<Rewrite<Inner, Mode>>
                        : T extends s.ZodSet<infer Inner>
                          ? s.ZodSet<Rewrite<Inner, Mode>>
                          : T extends s.ZodOptional<infer Inner>
                            ? s.ZodOptional<Rewrite<Inner, Mode>>
                            : T extends s.ZodNullable<infer Inner>
                              ? s.ZodNullable<Rewrite<Inner, Mode>>
                              : T extends s.ZodDefault<infer Inner>
                                ? s.ZodDefault<Rewrite<Inner, Mode>>
                                : T extends s.ZodPrefault<infer Inner>
                                  ? s.ZodPrefault<Rewrite<Inner, Mode>>
                                  : T extends s.ZodNonOptional<infer Inner>
                                    ? s.ZodNonOptional<Rewrite<Inner, Mode>>
                                    : T extends s.ZodCatch<infer Inner>
                                      ? s.ZodCatch<Rewrite<Inner, Mode>>
                                      : T extends s.ZodReadonly<infer Inner>
                                        ? s.ZodReadonly<Rewrite<Inner, Mode>>
                                        : T extends s.ZodPromise<infer Inner>
                                          ? s.ZodPromise<Rewrite<Inner, Mode>>
                                          : T extends s.ZodSuccess<infer Inner>
                                            ? s.ZodSuccess<Rewrite<Inner, Mode>>
                                            : T extends s.ZodLazy<infer Inner>
                                              ? s.ZodLazy<Rewrite<Inner, Mode>>
                                              : T extends core.$ZodType
                                                ? T
                                                : core.$ZodType;

/** Make object properties optional throughout a schema graph. */
export function deepPartial<T extends core.$ZodType>(schema: T): DeepPartial<T> {
  return visit(schema, {
    object: (node) => {
      const def = node._zod.def as core.$ZodObjectDef;
      return new s.ZodObject({
        ...def,
        shape: Object.fromEntries(Object.entries(def.shape).map(([key, value]) => [key, s.optional(value)])),
      });
    },
    union: (node) => {
      const def = node._zod.def as core.$ZodDiscriminatedUnionDef;
      if (!("discriminator" in def)) return node;
      const { discriminator: _, ...rest } = def;
      return new s.ZodUnion(rest);
    },
  }) as DeepPartial<T>;
}
