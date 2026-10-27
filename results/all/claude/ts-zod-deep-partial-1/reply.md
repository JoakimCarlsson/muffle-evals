Reading schema defs, then writing `visit.ts`.

Running the new tests; the vitest config needs the repo root.

Now docs.

Done. Added `core/visit.ts`, `z.deepPartial`, `z.input`/`z.output` for `zod` and `zod/mini`, tests for both, and docs in `api.mdx`. The new tests and the full zod suite pass (4135 tests). `tsc` reports no errors in the new files; its 15 existing unused-variable errors are in other files.

- **Types:** The `deepPartial` return type only types the top level. `.shape` entries are the original schemas wrapped in `ZodOptional`, so nested objects keep their original static types but are partial at runtime. Recursive getter schemas stay shallow, so there is no depth blow-up.
- **Transforms in `z.input`/`z.output`:** A transform on the side being kept, or a `preprocess` input, becomes `z.unknown()`. Keeping the transform would re-run it on already-transformed data.
- **Unknown node types:** The callback is not called on them. They come back untouched.
- **Refined objects:** `deepPartial` reuses `util.partial`, so it throws on any nested object that has refinements, as `.partial()` does.
- **Metadata:** Rebuilt nodes lose registry metadata such as descriptions.

I didn't run the build.
