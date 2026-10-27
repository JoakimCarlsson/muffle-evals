import type * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import type { ZodType } from "./schemas.js";

export type input<T extends core.$ZodType> = core.input<T>;
export type output<T extends core.$ZodType> = core.output<T>;

/** Project every pipe, including codecs, to its input schema. */
export function input<T extends core.$ZodType>(schema: T): ZodType<core.input<T>, core.input<T>> {
  return visit(schema, { pipe: (s) => (s._zod.def as core.$ZodPipeDef).in }) as any;
}

/** Project every pipe, including codecs, to its output schema. */
export function output<T extends core.$ZodType>(schema: T): ZodType<core.output<T>, core.output<T>> {
  return visit(schema, { pipe: (s) => (s._zod.def as core.$ZodPipeDef).out }) as any;
}
