import * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import * as schemas from "./schemas.js";

export type DeepPartial<T extends core.SomeType> = T extends schemas.ZodFunction<infer A, infer B>
  ? schemas.ZodFunction<DeepPartial<A>, DeepPartial<B>>
  : T extends schemas.ZodObject<infer S, infer C>
    ? schemas.ZodObject<{ [K in keyof S]: schemas.ZodOptional<DeepPartial<S[K]>> }, C>
    : T extends schemas.ZodArray<infer A>
      ? schemas.ZodArray<DeepPartial<A>>
      : T extends schemas.ZodOptional<infer A>
        ? schemas.ZodOptional<DeepPartial<A>>
        : T extends schemas.ZodNullable<infer A>
          ? schemas.ZodNullable<DeepPartial<A>>
          : T extends schemas.ZodDefault<infer A>
            ? schemas.ZodDefault<DeepPartial<A>>
            : T extends schemas.ZodPrefault<infer A>
              ? schemas.ZodPrefault<DeepPartial<A>>
              : T extends schemas.ZodNonOptional<infer A>
                ? schemas.ZodNonOptional<DeepPartial<A>>
                : T extends schemas.ZodCatch<infer A>
                  ? schemas.ZodCatch<DeepPartial<A>>
                  : T extends schemas.ZodReadonly<infer A>
                    ? schemas.ZodReadonly<DeepPartial<A>>
                    : T extends schemas.ZodPromise<infer A>
                      ? schemas.ZodPromise<DeepPartial<A>>
                      : T extends schemas.ZodSuccess<infer A>
                        ? schemas.ZodSuccess<DeepPartial<A>>
                        : T extends schemas.ZodLazy<infer A>
                          ? schemas.ZodLazy<DeepPartial<A>>
                          : T extends schemas.ZodSet<infer A>
                            ? schemas.ZodSet<DeepPartial<A>>
                            : T extends schemas.ZodRecord<infer A, infer B>
                              ? schemas.ZodRecord<DeepPartial<A>, DeepPartial<B>>
                              : T extends schemas.ZodMap<infer A, infer B>
                                ? schemas.ZodMap<DeepPartial<A>, DeepPartial<B>>
                                : T extends schemas.ZodIntersection<infer A, infer B>
                                  ? schemas.ZodIntersection<DeepPartial<A>, DeepPartial<B>>
                                  : T extends schemas.ZodCodec<infer A, infer B>
                                    ? schemas.ZodCodec<DeepPartial<A>, DeepPartial<B>>
                                    : T extends schemas.ZodPreprocess<infer B, infer I>
                                      ? schemas.ZodPreprocess<DeepPartial<B>, I>
                                      : T extends schemas.ZodPipe<infer A, infer B>
                                        ? schemas.ZodPipe<DeepPartial<A>, DeepPartial<B>>
                                        : T extends schemas.ZodTuple<infer I, infer R>
                                          ? schemas.ZodTuple<
                                              { [K in keyof I]: DeepPartial<I[K]> },
                                              R extends core.$ZodType ? DeepPartial<R> : R
                                            >
                                          : T extends schemas.ZodUnion<infer O>
                                            ? schemas.ZodUnion<{ [K in keyof O]: DeepPartial<O[K]> }>
                                            : T;

export function deepPartial<T extends core.$ZodType>(schema: T): DeepPartial<T> {
  return visit(schema, {
    object: (node) => {
      const def = node._zod.def;
      const shape = Object.fromEntries(
        Object.entries(def.shape).map(([key, value]) => [key, schemas.optional(value as core.$ZodType)])
      );
      return core.clone(node, { ...def, shape });
    },
    union: (node) => (node._zod.def.discriminator !== undefined ? schemas.union(node._zod.def.options) : node),
  }) as DeepPartial<T>;
}
