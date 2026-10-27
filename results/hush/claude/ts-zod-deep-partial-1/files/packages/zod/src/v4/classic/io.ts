import type * as core from "../core/index.js";
import { pipeSideWith } from "../core/rewrites.js";
import { ZodLazy, type ZodType } from "./schemas.js";

export type input<T> = core.input<T>;
export type output<T> = core.output<T>;

/** Runtime `z.input<T>`: replaces every pipe (codecs included) with its input side. */
export function input<T extends core.SomeType>(schema: T): ZodType<core.input<T>, core.input<T>> {
  return pipeSideWith("in", ZodLazy as any, schema as any);
}

/** Runtime `z.output<T>`: replaces every pipe (codecs included) with its output side. */
export function output<T extends core.SomeType>(schema: T): ZodType<core.output<T>, core.output<T>> {
  return pipeSideWith("out", ZodLazy as any, schema as any);
}
