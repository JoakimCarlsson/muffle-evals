Let me read the key defs.

I've read the core defs and settled the design, so I'm writing `visit.ts` now. Next come the classic and mini `deepPartial`, `input`/`output`, then tests and docs.

Use `core.$ZodType` as the constraint instead.

I added `visit`, `deepPartial` and `z.input()` / `z.output()` in both `zod` and `zod/mini`, plus the docs. The new tests and the rest of the vitest suite pass, apart from two test files that need a built zod (`zod is not built`). I haven't committed anything.

`tsc` shows 15 errors, all unused-variable errors in existing test files; none are in the new code.

**What was added**
- **`visit`:** `core/visit.ts` follows your spec and isn't exported from any barrel. A cycle that nothing changes (an identity rewrite of a recursive schema) comes back as the original object.
- **`deepPartial`:** `classic/deep-partial.ts` and `mini/deep-partial.ts`, exported as `z.deepPartial`. A discriminated union becomes a plain `union`.
- **`input` / `output`:** `classic/io.ts` and `mini/io.ts`. I removed the type-only `input` / `output` export from both `external.ts` files so the new functions and the types can share those names.
- **Docs:** `z.deepPartial()` is in `api.mdx` under Objects, and `z.input()` / `z.output()` under Pipes.
- **Tests:** `core/tests/visit.test.ts`, `classic/tests/deep-partial.test.ts` and `mini/tests/deep-partial.test.ts`.

**Behaviours you might not expect**
- **Shallow return type:** `deepPartial` is typed as you specified, so nested objects become partial at runtime but not in `z.infer`. Any non-object schema is typed as a plain `ZodType`. The docs say this.
- **Refinements throw:** `deepPartial` throws on an object with refinements, the same as `.partial()`.
- **Transform sides become `unknown`:** if the chosen side of a pipe is a transform, `z.input()` / `z.output()` use `unknown` there. The transform has no schema of its own, so using it would re-run the function. Preprocess is the `z.input()` case.
- **Recursive references show up as lazy nodes:** in a recursive schema, the rewritten tree refers back to itself through an internal lazy node. It resolves to the final result at parse time, and the callback never runs again.
- **Metadata is inherited:** re-cloned nodes keep their parent's metadata, except `id`.

One thing I noticed but didn't touch: parsing `{}` with a particular combined object schema threw a `TypeError` in zod's JIT. I didn't track down which member triggers it. It happens on the original schema, not only on the `deepPartial` result, so I changed my test to avoid it.
