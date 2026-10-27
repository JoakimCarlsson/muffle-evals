import * as core from "../core/index.js";
import { unpipe } from "../core/visit.js";
import type { ZodType } from "./schemas.js";

export type input<T> = core.input<T>;
export type output<T> = core.output<T>;

/** Runtime `z.input<T>`: replaces every pipe in the tree with its input side. */
export function input<T extends core.$ZodType>(schema: T): ZodType<core.input<T>, core.input<T>> {
  return unpipe(schema, "in") as any;
}

/** Runtime `z.output<T>`: replaces every pipe in the tree with its output side. */
export function output<T extends core.$ZodType>(schema: T): ZodType<core.output<T>, core.output<T>> {
  return unpipe(schema, "out") as any;
}
