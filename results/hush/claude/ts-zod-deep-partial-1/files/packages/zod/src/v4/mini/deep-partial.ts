import * as core from "../core/index.js";
import { deepPartialWith } from "../core/rewrites.js";
import type { util } from "../core/index.js";
import {
  type ZodMiniArray,
  type ZodMiniCatch,
  type ZodMiniCodec,
  type ZodMiniDefault,
  type ZodMiniDiscriminatedUnion,
  type ZodMiniIntersection,
  type ZodMiniLazy,
  type ZodMiniMap,
  type ZodMiniNonOptional,
  type ZodMiniNullable,
  type ZodMiniObject,
  type ZodMiniOptional,
  type ZodMiniPipe,
  type ZodMiniPrefault,
  type ZodMiniPromise,
  type ZodMiniReadonly,
  type ZodMiniRecord,
  type ZodMiniSet,
  type ZodMiniSuccess,
  type ZodMiniTuple,
  type ZodMiniUnion,
  ZodMiniLazy as ZodMiniLazyClass,
  ZodMiniOptional as ZodMiniOptionalClass,
  ZodMiniUnion as ZodMiniUnionClass,
} from "./schemas.js";

/** Recursion guard: schemas nested deeper than this (e.g. getter-recursive ones) are left as they are. */
type MaxDepth = 6;
type Next<D extends unknown[]> = [...D, 0];
type DP<T, D extends unknown[]> = ZodMiniDeepPartial<T, D>;
type DPItems<I extends readonly unknown[], D extends unknown[]> = { [K in keyof I]: DP<I[K], Next<D>> };

/** Type of `z.deepPartial(schema)`. */
export type ZodMiniDeepPartial<T, D extends unknown[] = []> = D["length"] extends MaxDepth
  ? T
  : T extends ZodMiniObject<infer S, infer C>
    ? ZodMiniObject<{ -readonly [K in keyof S]: ZodMiniOptional<DP<S[K], Next<D>>> }, C>
    : T extends ZodMiniArray<infer E>
      ? ZodMiniArray<DP<E, Next<D>>>
      : T extends ZodMiniTuple<infer I extends util.TupleItems, infer R>
        ? ZodMiniTuple<DPItems<I, D> extends infer X extends util.TupleItems ? X : I, R extends core.SomeType ? DP<R, Next<D>> : R>
        : T extends ZodMiniRecord<infer K, infer V>
          ? ZodMiniRecord<K, DP<V, Next<D>>>
          : T extends ZodMiniMap<infer K, infer V>
            ? ZodMiniMap<DP<K, Next<D>>, DP<V, Next<D>>>
            : T extends ZodMiniSet<infer V>
              ? ZodMiniSet<DP<V, Next<D>>>
              : T extends ZodMiniDiscriminatedUnion<infer O extends readonly core.SomeType[], any>
                ? ZodMiniUnion<DPItems<O, D> extends infer X extends readonly core.SomeType[] ? X : O>
                : T extends ZodMiniUnion<infer O extends readonly core.SomeType[]>
                  ? ZodMiniUnion<DPItems<O, D> extends infer X extends readonly core.SomeType[] ? X : O>
                  : T extends ZodMiniIntersection<infer A, infer B>
                    ? ZodMiniIntersection<DP<A, Next<D>>, DP<B, Next<D>>>
                    : T extends ZodMiniOptional<infer I>
                      ? ZodMiniOptional<DP<I, Next<D>>>
                      : T extends ZodMiniNullable<infer I>
                        ? ZodMiniNullable<DP<I, Next<D>>>
                        : T extends ZodMiniDefault<infer I>
                          ? ZodMiniDefault<DP<I, Next<D>>>
                          : T extends ZodMiniPrefault<infer I>
                            ? ZodMiniPrefault<DP<I, Next<D>>>
                            : T extends ZodMiniNonOptional<infer I>
                              ? ZodMiniNonOptional<DP<I, Next<D>>>
                              : T extends ZodMiniCatch<infer I>
                                ? ZodMiniCatch<DP<I, Next<D>>>
                                : T extends ZodMiniReadonly<infer I>
                                  ? ZodMiniReadonly<DP<I, Next<D>>>
                                  : T extends ZodMiniPromise<infer I>
                                    ? ZodMiniPromise<DP<I, Next<D>>>
                                    : T extends ZodMiniSuccess<infer I>
                                      ? ZodMiniSuccess<DP<I, Next<D>>>
                                      : T extends ZodMiniCodec<infer A, infer B>
                                        ? ZodMiniCodec<DP<A, Next<D>>, DP<B, Next<D>>>
                                        : T extends ZodMiniPipe<infer A, infer B>
                                          ? ZodMiniPipe<DP<A, Next<D>>, DP<B, Next<D>>>
                                          : T extends ZodMiniLazy<infer I>
                                            ? ZodMiniLazy<DP<I, Next<D>>>
                                            : T;

/**
 * Make every object in the tree partial. Transforms and primitives are left alone, and a
 * discriminated union becomes a plain union. Never mutates its input.
 */
export function deepPartial<T extends core.SomeType>(schema: T): ZodMiniDeepPartial<T> {
  return deepPartialWith(ZodMiniOptionalClass as any, ZodMiniUnionClass as any, ZodMiniLazyClass as any, schema as any);
}
