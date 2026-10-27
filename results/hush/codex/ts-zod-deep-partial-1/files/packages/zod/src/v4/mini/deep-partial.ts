import * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import * as schemas from "./schemas.js";

export type DeepPartial<T extends core.SomeType> = T extends schemas.ZodMiniFunction<infer A, infer B>
  ? schemas.ZodMiniFunction<DeepPartial<A>, DeepPartial<B>>
  : T extends schemas.ZodMiniObject<infer S, infer C>
    ? schemas.ZodMiniObject<{ [K in keyof S]: schemas.ZodMiniOptional<DeepPartial<S[K]>> }, C>
    : T extends schemas.ZodMiniArray<infer A>
      ? schemas.ZodMiniArray<DeepPartial<A>>
      : T extends schemas.ZodMiniOptional<infer A>
        ? schemas.ZodMiniOptional<DeepPartial<A>>
        : T extends schemas.ZodMiniNullable<infer A>
          ? schemas.ZodMiniNullable<DeepPartial<A>>
          : T extends schemas.ZodMiniDefault<infer A>
            ? schemas.ZodMiniDefault<DeepPartial<A>>
            : T extends schemas.ZodMiniPrefault<infer A>
              ? schemas.ZodMiniPrefault<DeepPartial<A>>
              : T extends schemas.ZodMiniNonOptional<infer A>
                ? schemas.ZodMiniNonOptional<DeepPartial<A>>
                : T extends schemas.ZodMiniCatch<infer A>
                  ? schemas.ZodMiniCatch<DeepPartial<A>>
                  : T extends schemas.ZodMiniReadonly<infer A>
                    ? schemas.ZodMiniReadonly<DeepPartial<A>>
                    : T extends schemas.ZodMiniPromise<infer A>
                      ? schemas.ZodMiniPromise<DeepPartial<A>>
                      : T extends schemas.ZodMiniSuccess<infer A>
                        ? schemas.ZodMiniSuccess<DeepPartial<A>>
                        : T extends schemas.ZodMiniLazy<infer A>
                          ? schemas.ZodMiniLazy<DeepPartial<A>>
                          : T extends schemas.ZodMiniSet<infer A>
                            ? schemas.ZodMiniSet<DeepPartial<A>>
                            : T extends schemas.ZodMiniRecord<infer A, infer B>
                              ? schemas.ZodMiniRecord<DeepPartial<A>, DeepPartial<B>>
                              : T extends schemas.ZodMiniMap<infer A, infer B>
                                ? schemas.ZodMiniMap<DeepPartial<A>, DeepPartial<B>>
                                : T extends schemas.ZodMiniIntersection<infer A, infer B>
                                  ? schemas.ZodMiniIntersection<DeepPartial<A>, DeepPartial<B>>
                                  : T extends schemas.ZodMiniCodec<infer A, infer B>
                                    ? schemas.ZodMiniCodec<DeepPartial<A>, DeepPartial<B>>
                                    : T extends schemas.ZodMiniPipe<infer A, infer B>
                                      ? schemas.ZodMiniPipe<DeepPartial<A>, DeepPartial<B>>
                                      : T extends schemas.ZodMiniTuple<infer I, infer R>
                                        ? schemas.ZodMiniTuple<
                                            { [K in keyof I]: DeepPartial<I[K]> },
                                            R extends core.$ZodType ? DeepPartial<R> : R
                                          >
                                        : T extends schemas.ZodMiniUnion<infer O>
                                          ? schemas.ZodMiniUnion<{ [K in keyof O]: DeepPartial<O[K]> }>
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
