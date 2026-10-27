I'll start by looking at the repo layout and any AGENTS.md files.

Still reading the zod internals (def shapes, `util.partial`, how codecs and preprocess are built) before I write `visit.ts`.

Writing `visit.ts` now.

Now the classic and mini `deep-partial.ts` files, plus the `input`/`output` functions.

The sed also renamed `core.$ZodType` in the mini copy. I'll fix that, then write a test file.

The source type-checks. The only new errors are in my test file, which I'll fix. Vitest has to run from the repo root.

That failure is a bad line in my test: the line itself throws, which shows the original stays strict. I'll remove it and add a stronger check, then run the whole suite.

Two files fail. The treeshake one needs a build. I'll check what the other one is, then write the docs.

Both failures are the same on a clean checkout, so they were already there. I'll write the docs next.

I added `visit`, `deepPartial`, `z.input()` / `z.output()` and the docs. The new tests pass, and the rest of the suite passes except two treeshake tests that fail the same way on a clean checkout. I haven't checked the cycle-handling edge cases or the type-depth requirement beyond the tests below.

**What exists now**
- **`visit`:** `core/visit.ts` implements `visit(schema, rewrite)` and isn't exported from any barrel. It covers all the built-in defs. Cycles are rewritten as a unit, so `lazy` recursion and getter-recursive objects terminate, and the rewrite reaches the recursive reference. The callback doesn't run at parse time.
- **`deepPartial`:** `classic/deep-partial.ts` and `mini/deep-partial.ts`, exported from `zod` and `zod/mini`. A discriminated union becomes a plain union, and codecs and preprocess keep their kind.
- **`z.input()` / `z.output()`:** in `classic/io.ts` and `mini/io.ts`, exported from both entry points. They replace every pipe with its input or output side. I moved the `input` / `output` type exports into these files so each name is now both a type and a function.
- **Docs:** `z.deepPartial()` and `z.input()` / `z.output()` sections in `api.mdx`, placed just before `.required()`.
- **Tests:** `classic/tests/deep-partial.test.ts` and `mini/tests/deep-partial.test.ts`.

**Checks**
- The new tests cover shared nodes visited once, identity preserved, custom schemas left alone, `lazy` and getter recursion, and tuples keeping required positions. They also check that `z.string().min(1)` still fails, that codecs and preprocess survive `deepPartial`, and `z.output(...).parse({ b: 1n })`.
- `tsc` reports no new errors in the source. The unused-declaration errors it reports are all in other test files.
- The two failing treeshake tests (`default-locale` and `locale-treeshake`) need a `pnpm build` first.
- The type-depth requirement for recursive getter schemas isn't covered by a dedicated type test.

I haven't committed anything.
