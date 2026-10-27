import type * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import type { Rewritten } from "./deep-partial.js";

/** Extract every nested pipe input. */
export function input<T extends core.$ZodType>(schema: T): Rewritten<T, "input"> {
  return visit(schema, { pipe: (node) => node._zod.def.in }) as Rewritten<T, "input">;
}

/** Extract every nested pipe output. */
export function output<T extends core.$ZodType>(schema: T): Rewritten<T, "output"> {
  return visit(schema, { pipe: (node) => node._zod.def.out }) as Rewritten<T, "output">;
}

export type input<T> = core.input<T>;
export type output<T> = core.output<T>;
