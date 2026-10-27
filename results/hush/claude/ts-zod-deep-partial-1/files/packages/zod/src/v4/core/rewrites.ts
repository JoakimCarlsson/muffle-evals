import type { $ZodType } from "./schemas.js";
import * as util from "./util.js";
import { visit } from "./visit.js";

type Ctor = new (def: any) => $ZodType;

/** Shared runtime of `deepPartial`; classes are injected so each flavour builds its own. @internal */
export function deepPartialWith(Optional: Ctor, Union: Ctor, Lazy: Ctor, schema: $ZodType): any {
  return visit(
    schema,
    {
      object: (s) => util.partial(Optional as any, s as any, undefined),
      union: (s) => {
        const def = s._zod.def as any;
        if (!("discriminator" in def)) return s;
        const plain = util.mergeDefs(def);
        delete plain.discriminator;
        delete plain.unionFallback;
        return new Union(plain);
      },
    },
    Lazy
  );
}

/** Shared runtime of `input()` / `output()`: replace every pipe with one side. @internal */
export function pipeSideWith(side: "in" | "out", Lazy: Ctor, schema: $ZodType): any {
  return visit(schema, { pipe: (s) => (s._zod.def as any)[side] }, Lazy);
}

