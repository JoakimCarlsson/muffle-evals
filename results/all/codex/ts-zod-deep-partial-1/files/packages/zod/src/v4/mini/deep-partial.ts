import type * as core from "../core/index.js";
import { clone } from "../core/util.js";
import { visit } from "../core/visit.js";
import * as schemas from "./schemas.js";

type Mode = "partial" | "input" | "output";
export type Rewritten<T extends core.SomeType, M extends Mode> = T extends schemas.ZodMiniObject<infer S, infer C>
  ? schemas.ZodMiniObject<
      {
        [K in keyof S]: M extends "partial"
          ? schemas.ZodMiniOptional<Rewritten<S[K], M>>
          : Extract<Rewritten<S[K], M>, core.$ZodType>;
      },
      C
    >
  : T extends schemas.ZodMiniCodec<infer A, infer B>
    ? M extends "partial"
      ? schemas.ZodMiniCodec<Rewritten<A, M>, Rewritten<B, M>>
      : Rewritten<M extends "input" ? A : B, M>
    : T extends schemas.ZodMiniPipe<infer A, infer B>
      ? M extends "partial"
        ? schemas.ZodMiniPipe<Rewritten<A, M>, Rewritten<B, M>>
        : Rewritten<M extends "input" ? A : B, M>
      : T extends schemas.ZodMiniArray<infer A>
        ? schemas.ZodMiniArray<Rewritten<A, M>>
        : T extends schemas.ZodMiniOptional<infer A>
          ? schemas.ZodMiniOptional<Rewritten<A, M>>
          : T extends schemas.ZodMiniNullable<infer A>
            ? schemas.ZodMiniNullable<Rewritten<A, M>>
            : T extends schemas.ZodMiniDefault<infer A>
              ? schemas.ZodMiniDefault<Rewritten<A, M>>
              : T extends schemas.ZodMiniPrefault<infer A>
                ? schemas.ZodMiniPrefault<Rewritten<A, M>>
                : T extends schemas.ZodMiniNonOptional<infer A>
                  ? schemas.ZodMiniNonOptional<Rewritten<A, M>>
                  : T extends schemas.ZodMiniCatch<infer A>
                    ? schemas.ZodMiniCatch<Rewritten<A, M>>
                    : T extends schemas.ZodMiniReadonly<infer A>
                      ? schemas.ZodMiniReadonly<Rewritten<A, M>>
                      : T extends schemas.ZodMiniPromise<infer A>
                        ? schemas.ZodMiniPromise<Rewritten<A, M>>
                        : T extends schemas.ZodMiniSuccess<infer A>
                          ? schemas.ZodMiniSuccess<Rewritten<A, M>>
                          : T extends schemas.ZodMiniSet<infer A>
                            ? schemas.ZodMiniSet<Rewritten<A, M>>
                            : T extends schemas.ZodMiniLazy<infer A>
                              ? schemas.ZodMiniLazy<Rewritten<A, M>>
                              : T extends schemas.ZodMiniRecord<infer A, infer B>
                                ? schemas.ZodMiniRecord<Rewritten<A, M>, Rewritten<B, M>>
                                : T extends schemas.ZodMiniMap<infer A, infer B>
                                  ? schemas.ZodMiniMap<Rewritten<A, M>, Rewritten<B, M>>
                                  : T extends schemas.ZodMiniIntersection<infer A, infer B>
                                    ? schemas.ZodMiniIntersection<Rewritten<A, M>, Rewritten<B, M>>
                                    : T extends schemas.ZodMiniFunction<infer A, infer B>
                                      ? schemas.ZodMiniFunction<
                                          Rewritten<A, M>,
                                          Extract<Rewritten<B, M>, core.$ZodType>
                                        >
                                      : T extends schemas.ZodMiniTuple<infer A, infer B>
                                        ? schemas.ZodMiniTuple<
                                            { [K in keyof A]: A[K] extends core.SomeType ? Rewritten<A[K], M> : A[K] },
                                            B extends core.SomeType ? Rewritten<B, M> : null
                                          >
                                        : T extends schemas.ZodMiniUnion<infer A>
                                          ? schemas.ZodMiniUnion<{ [K in keyof A]: Rewritten<A[K], M> }>
                                          : T;

/** Make every nested object partial without changing the input schema. */
export function deepPartial<T extends core.$ZodType>(schema: T): Rewritten<T, "partial"> {
  return visit(schema, {
    object: (node) => {
      const def = node._zod.def;
      return clone(node, {
        ...def,
        shape: Object.fromEntries(
          Object.entries(def.shape).map(([key, value]) => [key, schemas.optional(value as core.$ZodType)])
        ),
      });
    },
    union: (node) => {
      if (node._zod.def.discriminator === undefined) return node;
      const def = { ...node._zod.def };
      delete def.discriminator;
      return new schemas.ZodMiniUnion(def);
    },
  }) as Rewritten<T, "partial">;
}
