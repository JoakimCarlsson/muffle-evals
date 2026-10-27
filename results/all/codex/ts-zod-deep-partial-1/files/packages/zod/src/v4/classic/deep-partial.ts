import type * as core from "../core/index.js";
import { clone } from "../core/util.js";
import { visit } from "../core/visit.js";
import * as schemas from "./schemas.js";

type Mode = "partial" | "input" | "output";
export type Rewritten<T extends core.SomeType, M extends Mode> = T extends schemas.ZodObject<infer S, infer C>
  ? schemas.ZodObject<
      {
        [K in keyof S]: M extends "partial"
          ? schemas.ZodOptional<Rewritten<S[K], M>>
          : Extract<Rewritten<S[K], M>, core.$ZodType>;
      },
      C
    >
  : T extends schemas.ZodPreprocess<infer B, infer I>
    ? M extends "partial"
      ? schemas.ZodPreprocess<Rewritten<B, M>, I>
      : M extends "output"
        ? Rewritten<B, M>
        : T["in"]
    : T extends schemas.ZodCodec<infer A, infer B>
      ? M extends "partial"
        ? schemas.ZodCodec<Rewritten<A, M>, Rewritten<B, M>>
        : Rewritten<M extends "input" ? A : B, M>
      : T extends schemas.ZodPipe<infer A, infer B>
        ? M extends "partial"
          ? schemas.ZodPipe<Rewritten<A, M>, Rewritten<B, M>>
          : Rewritten<M extends "input" ? A : B, M>
        : T extends schemas.ZodArray<infer A>
          ? schemas.ZodArray<Rewritten<A, M>>
          : T extends schemas.ZodOptional<infer A>
            ? schemas.ZodOptional<Rewritten<A, M>>
            : T extends schemas.ZodNullable<infer A>
              ? schemas.ZodNullable<Rewritten<A, M>>
              : T extends schemas.ZodDefault<infer A>
                ? schemas.ZodDefault<Rewritten<A, M>>
                : T extends schemas.ZodPrefault<infer A>
                  ? schemas.ZodPrefault<Rewritten<A, M>>
                  : T extends schemas.ZodNonOptional<infer A>
                    ? schemas.ZodNonOptional<Rewritten<A, M>>
                    : T extends schemas.ZodCatch<infer A>
                      ? schemas.ZodCatch<Rewritten<A, M>>
                      : T extends schemas.ZodReadonly<infer A>
                        ? schemas.ZodReadonly<Rewritten<A, M>>
                        : T extends schemas.ZodPromise<infer A>
                          ? schemas.ZodPromise<Rewritten<A, M>>
                          : T extends schemas.ZodSuccess<infer A>
                            ? schemas.ZodSuccess<Rewritten<A, M>>
                            : T extends schemas.ZodSet<infer A>
                              ? schemas.ZodSet<Rewritten<A, M>>
                              : T extends schemas.ZodLazy<infer A>
                                ? schemas.ZodLazy<Rewritten<A, M>>
                                : T extends schemas.ZodRecord<infer A, infer B>
                                  ? schemas.ZodRecord<Rewritten<A, M>, Rewritten<B, M>>
                                  : T extends schemas.ZodMap<infer A, infer B>
                                    ? schemas.ZodMap<Rewritten<A, M>, Rewritten<B, M>>
                                    : T extends schemas.ZodIntersection<infer A, infer B>
                                      ? schemas.ZodIntersection<Rewritten<A, M>, Rewritten<B, M>>
                                      : T extends schemas.ZodFunction<infer A, infer B>
                                        ? schemas.ZodFunction<Rewritten<A, M>, Extract<Rewritten<B, M>, core.$ZodType>>
                                        : T extends schemas.ZodTuple<infer A, infer B>
                                          ? schemas.ZodTuple<
                                              {
                                                [K in keyof A]: A[K] extends core.SomeType ? Rewritten<A[K], M> : A[K];
                                              },
                                              B extends core.SomeType ? Rewritten<B, M> : null
                                            >
                                          : T extends schemas.ZodUnion<infer A>
                                            ? schemas.ZodUnion<{ [K in keyof A]: Rewritten<A[K], M> }>
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
      return new schemas.ZodUnion(def);
    },
  }) as Rewritten<T, "partial">;
}
