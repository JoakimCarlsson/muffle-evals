I’ll inspect the schema definitions and exports, add the shared traversal and helpers, then test identity preservation, recursion, and inferred types.

The traversal now handles shared nodes and cycles as a graph, so recursive references can point to the rewritten schemas without running callbacks during parsing. I’m adding the classic and mini helpers next, with structural return types that preserve object APIs.

The initial tests pass for recursive getters, previously parsed lazy schemas, nested codecs, and identity preservation. I’ve added collection and wrapper coverage and docs. I’m now checking TypeScript and running the nearby regression tests.

The regression run passed all 452 tests with no type errors. The package TypeScript check also passed with unused-variable checks disabled; the default check reports existing unused variables in unrelated tests. I’m finishing one last test for custom schema kinds and untouched sibling identity.

Implemented the internal traversal, `z.deepPartial()`, and runtime `z.input()` / `z.output()` in classic and mini, plus API docs and regression tests.

Validation: 452 regression tests passed; final traversal tests passed. TypeScript passed with unused-variable checks disabled because unrelated existing tests trigger those checks.
