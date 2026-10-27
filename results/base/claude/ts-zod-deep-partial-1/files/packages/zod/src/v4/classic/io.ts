import type * as core from "../core/index.js";
import { replacePipes } from "../core/visit.js";
import { type ZodType, unknown } from "./schemas.js";

export type input<T> = core.input<T>;
/** Runtime version of `z.input<T>`: replaces every pipe in the schema with its input side. */
export function input<T extends core.$ZodType>(schema: T): ZodType<core.input<T>, core.input<T>> {
  return replacePipes(schema, "in", unknown) as any;
}

export type output<T> = core.output<T>;
/** Runtime version of `z.output<T>`: replaces every pipe in the schema with its output side. */
export function output<T extends core.$ZodType>(schema: T): ZodType<core.output<T>, core.output<T>> {
  return replacePipes(schema, "out", unknown) as any;
}
