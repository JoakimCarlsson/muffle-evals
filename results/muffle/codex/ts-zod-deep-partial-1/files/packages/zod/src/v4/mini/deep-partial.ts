import * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import * as s from "./schemas.js";

export type DeepPartial<T extends core.SomeType> = T extends s.ZodMiniObject<infer Shape, infer Config>
  ? s.ZodMiniObject<{ [K in keyof Shape]: s.ZodMiniOptional<DeepPartial<Shape[K]>> }, Config>
  : T extends s.ZodMiniDiscriminatedUnion<infer Options, any>
    ? s.ZodMiniUnion<{ [K in keyof Options]: DeepPartial<Options[K]> }>
    : T extends s.ZodMiniTuple<infer Items, infer Rest>
      ? s.ZodMiniTuple<
          { [K in keyof Items]: DeepPartial<Items[K]> },
          Rest extends core.$ZodType ? DeepPartial<Rest> : null
        >
      : T extends s.ZodMiniUnion<infer Options>
        ? s.ZodMiniUnion<{ [K in keyof Options]: DeepPartial<Options[K]> }>
        : T extends s.ZodMiniCodec<infer A, infer B>
          ? s.ZodMiniCodec<DeepPartial<A>, DeepPartial<B>>
          : T extends s.ZodMiniPipe<infer A, infer B>
            ? s.ZodMiniPipe<DeepPartial<A>, DeepPartial<B>>
            : T extends s.ZodMiniIntersection<infer A, infer B>
              ? s.ZodMiniIntersection<DeepPartial<A>, DeepPartial<B>>
              : T extends s.ZodMiniMap<infer A, infer B>
                ? s.ZodMiniMap<DeepPartial<A>, DeepPartial<B>>
                : T extends s.ZodMiniRecord<infer A, infer B>
                  ? s.ZodMiniRecord<DeepPartial<A>, DeepPartial<B>>
                  : T extends s.ZodMiniArray<infer Inner>
                    ? s.ZodMiniArray<DeepPartial<Inner>>
                    : T extends s.ZodMiniSet<infer Inner>
                      ? s.ZodMiniSet<DeepPartial<Inner>>
                      : T extends s.ZodMiniOptional<infer Inner>
                        ? s.ZodMiniOptional<DeepPartial<Inner>>
                        : T extends s.ZodMiniNullable<infer Inner>
                          ? s.ZodMiniNullable<DeepPartial<Inner>>
                          : T extends s.ZodMiniDefault<infer Inner>
                            ? s.ZodMiniDefault<DeepPartial<Inner>>
                            : T extends s.ZodMiniPrefault<infer Inner>
                              ? s.ZodMiniPrefault<DeepPartial<Inner>>
                              : T extends s.ZodMiniNonOptional<infer Inner>
                                ? s.ZodMiniNonOptional<DeepPartial<Inner>>
                                : T extends s.ZodMiniCatch<infer Inner>
                                  ? s.ZodMiniCatch<DeepPartial<Inner>>
                                  : T extends s.ZodMiniReadonly<infer Inner>
                                    ? s.ZodMiniReadonly<DeepPartial<Inner>>
                                    : T extends s.ZodMiniPromise<infer Inner>
                                      ? s.ZodMiniPromise<DeepPartial<Inner>>
                                      : T extends s.ZodMiniSuccess<infer Inner>
                                        ? s.ZodMiniSuccess<DeepPartial<Inner>>
                                        : T extends s.ZodMiniLazy<infer Inner>
                                          ? s.ZodMiniLazy<DeepPartial<Inner>>
                                          : T;

/** Make every object in a schema graph partial. Tuple positions remain required. */
export function deepPartial<T extends core.$ZodType>(schema: T): DeepPartial<T> {
  return visit(schema, {
    object: (schema) => {
      const def = schema._zod.def as core.$ZodObjectDef;
      const shape = Object.fromEntries(Object.entries(def.shape).map(([key, value]) => [key, s.optional(value)]));
      return core.clone(schema, { ...def, shape } as core.$ZodObjectDef);
    },
    union: (schema) => {
      const def = schema._zod.def as core.$ZodUnionDef & { discriminator?: string };
      return def.discriminator === undefined ? schema : s.union(def.options);
    },
  }) as DeepPartial<T>;
}
