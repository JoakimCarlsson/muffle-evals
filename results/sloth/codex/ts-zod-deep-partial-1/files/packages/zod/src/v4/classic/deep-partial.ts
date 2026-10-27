import * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import * as schemas from "./schemas.js";

type Mode = "partial" | "input" | "output";
type Shape<S extends core.$ZodShape, M extends Mode> = {
  [K in keyof S]: M extends "partial" ? schemas.ZodOptional<Tree<S[K], M>> : Tree<S[K], M>;
};
type Tree<T extends core.$ZodType, M extends Mode> = T["_zod"]["def"] extends core.$ZodObjectDef<infer S>
  ? schemas.ZodObject<
      Shape<S, M>,
      T["_zod"] extends { config: infer C extends core.$ZodObjectConfig } ? C : core.$strip
    >
  : T["_zod"]["def"] extends {
        type: "pipe";
        in: infer A extends core.$ZodType;
        out: infer B extends core.$ZodType;
        reverseTransform: unknown;
      }
    ? M extends "input"
      ? Tree<A, M>
      : M extends "output"
        ? Tree<B, M>
        : schemas.ZodCodec<Tree<A, M>, Tree<B, M>>
    : T extends schemas.ZodPreprocess<infer B, infer I>
      ? M extends "output"
        ? B extends core.$ZodType
          ? Tree<B, M>
          : T
        : M extends "input"
          ? T["_zod"]["def"]["in"]
          : schemas.ZodPreprocess<B extends core.$ZodType ? Tree<B, M> : B, I>
      : T["_zod"]["def"] extends { type: "pipe"; in: infer A extends core.$ZodType; out: infer B extends core.$ZodType }
        ? M extends "input"
          ? Tree<A, M>
          : M extends "output"
            ? Tree<B, M>
            : schemas.ZodPipe<Tree<A, M>, Tree<B, M>>
        : T["_zod"]["def"] extends { type: "array"; element: infer I extends core.$ZodType }
          ? schemas.ZodArray<Tree<I, M>>
          : T["_zod"]["def"] extends { type: "optional"; innerType: infer I extends core.$ZodType }
            ? schemas.ZodOptional<Tree<I, M>>
            : T["_zod"]["def"] extends { type: "nullable"; innerType: infer I extends core.$ZodType }
              ? schemas.ZodNullable<Tree<I, M>>
              : T["_zod"]["def"] extends { type: "default"; innerType: infer I extends core.$ZodType }
                ? schemas.ZodDefault<Tree<I, M>>
                : T["_zod"]["def"] extends { type: "prefault"; innerType: infer I extends core.$ZodType }
                  ? schemas.ZodPrefault<Tree<I, M>>
                  : T["_zod"]["def"] extends { type: "nonoptional"; innerType: infer I extends core.$ZodType }
                    ? schemas.ZodNonOptional<Tree<I, M>>
                    : T["_zod"]["def"] extends { type: "catch"; innerType: infer I extends core.$ZodType }
                      ? schemas.ZodCatch<Tree<I, M>>
                      : T["_zod"]["def"] extends { type: "readonly"; innerType: infer I extends core.$ZodType }
                        ? schemas.ZodReadonly<Tree<I, M>>
                        : T["_zod"]["def"] extends { type: "promise"; innerType: infer I extends core.$ZodType }
                          ? schemas.ZodPromise<Tree<I, M>>
                          : T["_zod"]["def"] extends { type: "success"; innerType: infer I extends core.$ZodType }
                            ? schemas.ZodSuccess<Tree<I, M>>
                            : T["_zod"]["def"] extends { type: "set"; valueType: infer I extends core.$ZodType }
                              ? schemas.ZodSet<Tree<I, M>>
                              : T["_zod"]["def"] extends { type: "lazy"; getter: () => infer I extends core.$ZodType }
                                ? schemas.ZodLazy<Tree<I, M>>
                                : T["_zod"]["def"] extends {
                                      type: "record";
                                      keyType: infer A extends core.$ZodType;
                                      valueType: infer B extends core.$ZodType;
                                    }
                                  ? schemas.ZodRecord<Extract<Tree<A, M>, core.$ZodRecordKey>, Tree<B, M>>
                                  : T["_zod"]["def"] extends {
                                        type: "map";
                                        keyType: infer A extends core.$ZodType;
                                        valueType: infer B extends core.$ZodType;
                                      }
                                    ? schemas.ZodMap<Tree<A, M>, Tree<B, M>>
                                    : T["_zod"]["def"] extends {
                                          type: "intersection";
                                          left: infer A extends core.$ZodType;
                                          right: infer B extends core.$ZodType;
                                        }
                                      ? schemas.ZodIntersection<Tree<A, M>, Tree<B, M>>
                                      : T["_zod"]["def"] extends core.$ZodTupleDef<infer I, infer R>
                                        ? schemas.ZodTuple<
                                            { [K in keyof I]: I[K] extends core.$ZodType ? Tree<I[K], M> : I[K] },
                                            R extends core.$ZodType ? Tree<R, M> : null
                                          >
                                        : T["_zod"]["def"] extends core.$ZodUnionDef<infer O>
                                          ? schemas.ZodUnion<{
                                              [K in keyof O]: O[K] extends core.$ZodType ? Tree<O[K], M> : O[K];
                                            }>
                                          : T;

/** Make every object in a schema tree partial. */
export function deepPartial<T extends core.$ZodType>(schema: T): Tree<T, "partial"> {
  return visit(schema, {
    object: (node) => {
      const shape: Record<string, core.$ZodType> = {};
      for (const key of Object.keys(node._zod.def.shape)) {
        const field = new schemas.ZodOptional({
          type: "optional",
          get innerType() {
            return node._zod.def.shape[key];
          },
        });
        shape[key] = field;
      }
      return core.clone(node, { ...node._zod.def, shape });
    },
    union: (node) => {
      if (node._zod.def.discriminator === undefined) return node;
      const def = { ...node._zod.def };
      delete def.discriminator;
      delete def.unionFallback;
      return new schemas.ZodUnion(def);
    },
  }) as Tree<T, "partial">;
}

/** Select the input side of every pipe in a schema tree. */
export function input<T extends core.$ZodType>(schema: T): Tree<T, "input"> {
  return visit(schema, { pipe: (node) => node._zod.def.in }) as Tree<T, "input">;
}

/** Select the output side of every pipe in a schema tree. */
export function output<T extends core.$ZodType>(schema: T): Tree<T, "output"> {
  return visit(schema, { pipe: (node) => node._zod.def.out }) as Tree<T, "output">;
}

export type input<T> = core.input<T>;
export type output<T> = core.output<T>;
