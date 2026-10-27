import * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import * as s from "./schemas.js";

export type DeepPartial<T extends core.SomeType> = T extends s.ZodObject<infer Shape, infer Config>
  ? s.ZodObject<{ [K in keyof Shape]: s.ZodOptional<DeepPartial<Shape[K]>> }, Config>
  : T extends s.ZodDiscriminatedUnion<infer Options, any>
    ? s.ZodUnion<{ [K in keyof Options]: DeepPartial<Options[K]> }>
    : T extends s.ZodTuple<infer Items, infer Rest>
      ? s.ZodTuple<{ [K in keyof Items]: DeepPartial<Items[K]> }, Rest extends core.$ZodType ? DeepPartial<Rest> : null>
      : T extends s.ZodUnion<infer Options>
        ? s.ZodUnion<{ [K in keyof Options]: DeepPartial<Options[K]> }>
        : T extends s.ZodPreprocess<infer B, infer I>
          ? s.ZodPreprocess<DeepPartial<B>, I>
          : T extends s.ZodCodec<infer A, infer B>
            ? s.ZodCodec<DeepPartial<A>, DeepPartial<B>>
            : T extends s.ZodPipe<infer A, infer B>
              ? s.ZodPipe<DeepPartial<A>, DeepPartial<B>>
              : T extends s.ZodIntersection<infer A, infer B>
                ? s.ZodIntersection<DeepPartial<A>, DeepPartial<B>>
                : T extends s.ZodMap<infer A, infer B>
                  ? s.ZodMap<DeepPartial<A>, DeepPartial<B>>
                  : T extends s.ZodRecord<infer A, infer B>
                    ? s.ZodRecord<DeepPartial<A>, DeepPartial<B>>
                    : T extends s.ZodArray<infer Inner>
                      ? s.ZodArray<DeepPartial<Inner>>
                      : T extends s.ZodSet<infer Inner>
                        ? s.ZodSet<DeepPartial<Inner>>
                        : T extends s.ZodOptional<infer Inner>
                          ? s.ZodOptional<DeepPartial<Inner>>
                          : T extends s.ZodNullable<infer Inner>
                            ? s.ZodNullable<DeepPartial<Inner>>
                            : T extends s.ZodDefault<infer Inner>
                              ? s.ZodDefault<DeepPartial<Inner>>
                              : T extends s.ZodPrefault<infer Inner>
                                ? s.ZodPrefault<DeepPartial<Inner>>
                                : T extends s.ZodNonOptional<infer Inner>
                                  ? s.ZodNonOptional<DeepPartial<Inner>>
                                  : T extends s.ZodCatch<infer Inner>
                                    ? s.ZodCatch<DeepPartial<Inner>>
                                    : T extends s.ZodReadonly<infer Inner>
                                      ? s.ZodReadonly<DeepPartial<Inner>>
                                      : T extends s.ZodPromise<infer Inner>
                                        ? s.ZodPromise<DeepPartial<Inner>>
                                        : T extends s.ZodSuccess<infer Inner>
                                          ? s.ZodSuccess<DeepPartial<Inner>>
                                          : T extends s.ZodLazy<infer Inner>
                                            ? s.ZodLazy<DeepPartial<Inner>>
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
