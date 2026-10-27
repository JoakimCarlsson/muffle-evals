Directory persisted; use relative paths.

Writing `visit.ts` first (traversal, cycle stubs), then the rewrites and public APIs.

Wiring done; type-checking now, then I'll write tests.

Only pre-existing unused-variable errors remain. Adding docs before `.required()`.

Done. Added `core/visit.ts`, `z.deepPartial`, `z.input`/`z.output` in zod and zod/mini, plus tests and `api.mdx` docs. Full suite passes. Not checked: visit's every-def coverage and the type-depth limit on recursive getters beyond the basic tests. Nothing committed.
