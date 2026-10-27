import type * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import type { ZodMiniType } from "./schemas.js";

export type input<T> = core.input<T>;
export type output<T> = core.output<T>;

/** Runtime `z.input<T>`: replaces every pipe (codecs included) in the tree with its input side. */
export function input<T extends core.$ZodType>(
  schema: T,
): ZodMiniType<core.input<T>, core.input<T>> {
  return visit(schema, { pipe: (s) => s._zod.def.in }) as any;
}

/** Runtime `z.output<T>`: replaces every pipe (codecs included) in the tree with its output side. */
export function output<T extends core.$ZodType>(
  schema: T,
): ZodMiniType<core.output<T>, core.output<T>> {
  return visit(schema, { pipe: (s) => s._zod.def.out }) as any;
}
