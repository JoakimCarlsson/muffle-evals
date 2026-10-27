import type * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import type { Rewrite } from "./deep-partial.js";

export type input<T> = core.input<T>;
export type output<T> = core.output<T>;

/** Extract the input schemas of every pipe, including nested codecs. */
export function input<T extends core.$ZodType>(schema: T): Rewrite<T, "input"> {
  return visit(schema, { pipe: (node) => (node._zod.def as core.$ZodPipeDef).in }) as Rewrite<T, "input">;
}

/** Extract the output schemas of every pipe, including nested codecs. */
export function output<T extends core.$ZodType>(schema: T): Rewrite<T, "output"> {
  return visit(schema, { pipe: (node) => (node._zod.def as core.$ZodPipeDef).out }) as Rewrite<T, "output">;
}
