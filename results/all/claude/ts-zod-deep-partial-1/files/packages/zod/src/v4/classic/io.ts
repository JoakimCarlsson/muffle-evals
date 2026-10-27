import type * as core from "../core/index.js";
import { visit } from "../core/visit.js";
import { unknown } from "./schemas.js";
import type { ZodType } from "./schemas.js";

export type input<T> = core.input<T>;
export type output<T> = core.output<T>;

const side = (key: "in" | "out") => (s: core.$ZodPipe) => {
  const inner = s._zod.def[key];
  return inner._zod.def.type === "transform" ? unknown() : inner;
};

/**
 * Runtime version of `z.input<T>`: replaces every pipe (codecs included) with its input side.
 *
 * @param schema - The schema to rewrite.
 * @returns A schema with no pipes, or `schema` itself when it has none.
 */
export function input<T extends core.$ZodType>(schema: T): ZodType<core.input<T>, core.input<T>> {
  return visit(schema, { pipe: side("in") }) as any;
}

/**
 * Runtime version of `z.output<T>`: replaces every pipe (codecs included) with its output side.
 *
 * @param schema - The schema to rewrite.
 * @returns A schema with no pipes, or `schema` itself when it has none.
 */
export function output<T extends core.$ZodType>(schema: T): ZodType<core.output<T>, core.output<T>> {
  return visit(schema, { pipe: side("out") }) as any;
}
