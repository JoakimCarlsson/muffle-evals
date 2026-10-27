import * as core from "../core/index.js";
import { deepPartialWith } from "../core/rewrites.js";
import type { util } from "../core/index.js";
import {
  type ZodArray,
  type ZodCatch,
  type ZodCodec,
  type ZodDefault,
  type ZodDiscriminatedUnion,
  type ZodIntersection,
  type ZodLazy,
  type ZodMap,
  type ZodNonOptional,
  type ZodNullable,
  type ZodObject,
  type ZodOptional,
  type ZodPipe,
  type ZodPrefault,
  type ZodPromise,
  type ZodReadonly,
  type ZodRecord,
  type ZodSet,
  type ZodSuccess,
  type ZodTuple,
  type ZodUnion,
  ZodLazy as ZodLazyClass,
  ZodOptional as ZodOptionalClass,
  ZodUnion as ZodUnionClass,
} from "./schemas.js";

/** Recursion guard: schemas nested deeper than this (e.g. getter-recursive ones) are left as they are. */
type MaxDepth = 6;
type Next<D extends unknown[]> = [...D, 0];
type DP<T, D extends unknown[]> = ZodDeepPartial<T, D>;
type DPItems<I extends readonly unknown[], D extends unknown[]> = { [K in keyof I]: DP<I[K], Next<D>> };

/** Type of `z.deepPartial(schema)`. */
export type ZodDeepPartial<T, D extends unknown[] = []> = D["length"] extends MaxDepth
  ? T
  : T extends ZodObject<infer S, infer C>
    ? ZodObject<{ -readonly [K in keyof S]: ZodOptional<DP<S[K], Next<D>>> }, C>
    : T extends ZodArray<infer E>
      ? ZodArray<DP<E, Next<D>>>
      : T extends ZodTuple<infer I extends util.TupleItems, infer R>
        ? ZodTuple<DPItems<I, D> extends infer X extends util.TupleItems ? X : I, R extends core.SomeType ? DP<R, Next<D>> : R>
        : T extends ZodRecord<infer K, infer V>
          ? ZodRecord<K, DP<V, Next<D>>>
          : T extends ZodMap<infer K, infer V>
            ? ZodMap<DP<K, Next<D>>, DP<V, Next<D>>>
            : T extends ZodSet<infer V>
              ? ZodSet<DP<V, Next<D>>>
              : T extends ZodDiscriminatedUnion<infer O extends readonly core.SomeType[], any>
                ? ZodUnion<DPItems<O, D> extends infer X extends readonly core.SomeType[] ? X : O>
                : T extends ZodUnion<infer O extends readonly core.SomeType[]>
                  ? ZodUnion<DPItems<O, D> extends infer X extends readonly core.SomeType[] ? X : O>
                  : T extends ZodIntersection<infer A, infer B>
                    ? ZodIntersection<DP<A, Next<D>>, DP<B, Next<D>>>
                    : T extends ZodOptional<infer I>
                      ? ZodOptional<DP<I, Next<D>>>
                      : T extends ZodNullable<infer I>
                        ? ZodNullable<DP<I, Next<D>>>
                        : T extends ZodDefault<infer I>
                          ? ZodDefault<DP<I, Next<D>>>
                          : T extends ZodPrefault<infer I>
                            ? ZodPrefault<DP<I, Next<D>>>
                            : T extends ZodNonOptional<infer I>
                              ? ZodNonOptional<DP<I, Next<D>>>
                              : T extends ZodCatch<infer I>
                                ? ZodCatch<DP<I, Next<D>>>
                                : T extends ZodReadonly<infer I>
                                  ? ZodReadonly<DP<I, Next<D>>>
                                  : T extends ZodPromise<infer I>
                                    ? ZodPromise<DP<I, Next<D>>>
                                    : T extends ZodSuccess<infer I>
                                      ? ZodSuccess<DP<I, Next<D>>>
                                      : T extends ZodCodec<infer A, infer B>
                                        ? ZodCodec<DP<A, Next<D>>, DP<B, Next<D>>>
                                        : T extends ZodPipe<infer A, infer B>
                                          ? ZodPipe<DP<A, Next<D>>, DP<B, Next<D>>>
                                          : T extends ZodLazy<infer I>
                                            ? ZodLazy<DP<I, Next<D>>>
                                            : T;

/**
 * Make every object in the tree partial. Transforms and primitives are left alone, and a
 * discriminated union becomes a plain union. Never mutates its input.
 */
export function deepPartial<T extends core.SomeType>(schema: T): ZodDeepPartial<T> {
  return deepPartialWith(ZodOptionalClass as any, ZodUnionClass as any, ZodLazyClass as any, schema as any);
}
