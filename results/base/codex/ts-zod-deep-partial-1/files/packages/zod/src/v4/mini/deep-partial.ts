import type * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import * as s from "./schemas.js";

export type DeepPartial<T extends core.SomeType> = Rewrite<T, "partial">;
export type Rewrite<T extends core.SomeType, Mode extends "partial" | "input" | "output"> = T extends s.ZodMiniObject<
  infer Shape,
  infer Config
>
  ? s.ZodMiniObject<
      {
        [K in keyof Shape]: Mode extends "partial"
          ? s.ZodMiniOptional<Rewrite<Shape[K], Mode>>
          : Rewrite<Shape[K], Mode>;
      },
      Config
    >
  : T extends s.ZodMiniFunction<infer Args, infer Returns>
    ? s.ZodMiniFunction<
        Rewrite<Args, Mode> extends infer A extends core.$ZodFunctionIn ? A : Args,
        Rewrite<Returns, Mode>
      >
    : T extends s.ZodMiniCodec<infer A, infer B>
      ? Mode extends "partial"
        ? s.ZodMiniCodec<Rewrite<A, Mode>, Rewrite<B, Mode>>
        : Rewrite<Mode extends "input" ? A : B, Mode>
      : T extends s.ZodMiniPipe<infer A, infer B>
        ? Mode extends "partial"
          ? s.ZodMiniPipe<Rewrite<A, Mode>, Rewrite<B, Mode>>
          : Rewrite<Mode extends "input" ? A : B, Mode>
        : T extends s.ZodMiniDiscriminatedUnion<infer Options>
          ? s.ZodMiniUnion<{ [K in keyof Options]: Rewrite<Options[K], Mode> }>
          : T extends s.ZodMiniUnion<infer Options>
            ? s.ZodMiniUnion<{ [K in keyof Options]: Rewrite<Options[K], Mode> }>
            : T extends s.ZodMiniIntersection<infer A, infer B>
              ? s.ZodMiniIntersection<Rewrite<A, Mode>, Rewrite<B, Mode>>
              : T extends s.ZodMiniTuple<infer Items, infer Rest>
                ? s.ZodMiniTuple<
                    { [K in keyof Items]: Rewrite<Items[K], Mode> },
                    Rest extends core.SomeType ? Rewrite<Rest, Mode> : null
                  >
                : T extends s.ZodMiniRecord<infer K, infer V>
                  ? s.ZodMiniRecord<
                      Rewrite<K, Mode> extends infer Key extends core.$ZodRecordKey ? Key : K,
                      Rewrite<V, Mode>
                    >
                  : T extends s.ZodMiniMap<infer K, infer V>
                    ? s.ZodMiniMap<Rewrite<K, Mode>, Rewrite<V, Mode>>
                    : T extends s.ZodMiniArray<infer Inner>
                      ? s.ZodMiniArray<Rewrite<Inner, Mode>>
                      : T extends s.ZodMiniSet<infer Inner>
                        ? s.ZodMiniSet<Rewrite<Inner, Mode>>
                        : T extends s.ZodMiniOptional<infer Inner>
                          ? s.ZodMiniOptional<Rewrite<Inner, Mode>>
                          : T extends s.ZodMiniNullable<infer Inner>
                            ? s.ZodMiniNullable<Rewrite<Inner, Mode>>
                            : T extends s.ZodMiniDefault<infer Inner>
                              ? s.ZodMiniDefault<Rewrite<Inner, Mode>>
                              : T extends s.ZodMiniPrefault<infer Inner>
                                ? s.ZodMiniPrefault<Rewrite<Inner, Mode>>
                                : T extends s.ZodMiniNonOptional<infer Inner>
                                  ? s.ZodMiniNonOptional<Rewrite<Inner, Mode>>
                                  : T extends s.ZodMiniCatch<infer Inner>
                                    ? s.ZodMiniCatch<Rewrite<Inner, Mode>>
                                    : T extends s.ZodMiniReadonly<infer Inner>
                                      ? s.ZodMiniReadonly<Rewrite<Inner, Mode>>
                                      : T extends s.ZodMiniPromise<infer Inner>
                                        ? s.ZodMiniPromise<Rewrite<Inner, Mode>>
                                        : T extends s.ZodMiniSuccess<infer Inner>
                                          ? s.ZodMiniSuccess<Rewrite<Inner, Mode>>
                                          : T extends s.ZodMiniLazy<infer Inner>
                                            ? s.ZodMiniLazy<Rewrite<Inner, Mode>>
                                            : T extends core.$ZodType
                                              ? T
                                              : core.$ZodType;

/** Make object properties optional throughout a schema graph. */
export function deepPartial<T extends core.$ZodType>(schema: T): DeepPartial<T> {
  return visit(schema, {
    object: (node) => {
      const def = node._zod.def as core.$ZodObjectDef;
      return new s.ZodMiniObject({
        ...def,
        shape: Object.fromEntries(Object.entries(def.shape).map(([key, value]) => [key, s.optional(value)])),
      });
    },
    union: (node) => {
      const def = node._zod.def as core.$ZodDiscriminatedUnionDef;
      if (!("discriminator" in def)) return node;
      const { discriminator: _, ...rest } = def;
      return new s.ZodMiniUnion(rest);
    },
  }) as DeepPartial<T>;
}
