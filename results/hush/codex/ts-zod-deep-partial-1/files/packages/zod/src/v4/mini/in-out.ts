import type * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import type * as schemas from "./schemas.js";

export type input<T extends core.$ZodType> = core.input<T>;
export type output<T extends core.$ZodType> = core.output<T>;

export function input<T extends core.$ZodType>(schema: T): schemas.ZodMiniType<core.input<T>, core.input<T>> {
  return visit(schema, { pipe: (node) => node._zod.def.in }) as schemas.ZodMiniType<core.input<T>, core.input<T>>;
}

export function output<T extends core.$ZodType>(schema: T): schemas.ZodMiniType<core.output<T>, core.output<T>> {
  return visit(schema, { pipe: (node) => node._zod.def.out }) as schemas.ZodMiniType<core.output<T>, core.output<T>>;
}
