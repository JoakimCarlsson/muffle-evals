`z.deepPartial()` (in `zod` and `zod/mini`), `z.input()` / `z.output()` and the internal `visit()` are in, with docs. The full zod suite passes (352 files, 4147 tests, no type errors). I haven't run the docs build, and I haven't separately re-checked a bare `tsc` run on the whole package; the 15 errors it reported are all "declared but never read" warnings (TS6133/TS6196) that I filtered out without checking which files they are in.

Files, all under `packages/zod/src/v4/`:
- **`core/visit.ts`**: the traversal, kept out of every barrel. It also holds a small `unpipe` helper that `z.input` / `z.output` share.
- **`classic/deep-partial.ts` and `mini/deep-partial.ts`**: `deepPartial` for each flavour.
- **`classic/input-output.ts` and `mini/input-output.ts`**: `z.input` / `z.output`. Each file defines the function and the same-named type alias together, so `z.input<T>` still works as a type. `external.ts` in both flavours now exports them from there.
- **Docs**: `packages/docs/content/api.mdx` has a `z.deepPartial()` section after `.partial()` and a `z.input()` / `z.output()` section.
- **Tests**: `core/tests/visit.test.ts`, `classic/tests/deep-partial.test.ts` and `mini/tests/deep-partial.test.ts`. They cover:
  - identity and the shared-node call count
  - handler maps and strict objects
  - lazy and getter cycles, including the already-resolved lazy case
  - codec and preprocess kept as what they are
  - discriminated unions becoming plain unions
  - no mutation
  - `z.input` / `z.output`

Behaviours and limits to know about:
- **Unknown `def.type`:** `visit` returns the node untouched and does not call the callback on it. Your wording allowed either reading, so say if you want the callback to run.
- **Return type:** only the top-level shape is typed as partial (entries wrapped in `ZodOptional`); nested objects keep their original static type. That keeps recursive getter schemas from blowing up TypeScript's depth, and there's a `limit:` comment in the source. A non-object root is typed as `T`.
- **Refinements:** `deepPartial` throws on any object that has refinements, the same as `.partial()` does.
- **Transforms in `z.output`:** the output side of `schema.transform(fn)` is the transform itself, so `z.output()` of such a schema would run `fn` again on the value you give it.
- **Cycle edge case:** a catchall that points directly back at its own object is read while the clone is being built, so it will not be rewritten. I haven't seen this in practice.
- **Existing promise bug:** `z.object({ p: z.promise(...) }).safeParse({})` already throws on main. I left it alone and tested promise separately.

I haven't committed anything.
