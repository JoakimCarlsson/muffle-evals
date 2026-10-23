I’ll check the existing generators, exports, and tests, then add the helper using the same options and rendering conventions.

The change needs a TypeScript generator, tests, and an API documentation entry; the existing barrel export will expose it automatically. I’ll reuse `genDynamicImport` for comments and attributes and leave `genInlineTypeImport` unchanged.

The object-key helper accepts numeric keys, which aren’t valid after a dot, so this helper needs an identifier check of its own. No new dependencies or configuration are needed.

Added and exported `genDynamicTypeImport` with optional names, dot or bracket access, and shared comment/attributes rendering. Updated API docs and added edge-case tests.

Validation passed: all 70 tests, lint, formatting, typecheck, and build. Used installed binaries because `pnpm` was unavailable.
