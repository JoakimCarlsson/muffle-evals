I’ll check the dynamic import generator, exports, and build setup, then add the helper using the existing rendering utilities.

The change needs a helper in `src/esm.ts` and a README entry; the existing barrel export will expose it automatically. I’ll reuse `genDynamicImport` for comments, attributes, and quoting, and check identifier syntax for dot access. Existing helpers, fixtures, and config need no changes. No new dependencies or options are needed.

Added and exported `genDynamicTypeImport` with optional names, dot access for valid identifiers, and escaped bracket access otherwise. Comments and attributes use the existing dynamic import renderer. README updated.

Build, lint, formatting, and all 54 existing tests passed using local tools because `pnpm` was unavailable.
