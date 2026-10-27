I’ll check the schema definitions and existing tests, then add the shared traversal and the classic and mini helpers.

Codec and preprocess schemas both use `def.type: "pipe"`, but have distinct constructors that the traversal needs to preserve. Lazy schemas also cache their inner type on the definition; I’ll account for that so already-parsed lazy schemas and recursive references are rewritten without callbacks running during parsing.

The initial runtime checks pass for nested codecs, containers, and both recursion styles. Type checking found differences between the classic and mini signatures; I’m adjusting the structural return types and tests to match each API.

The focused runtime and type checks now pass for both APIs. They cover recursive getters, previously resolved lazies, shared nodes, nested projections, codec encoding, preprocess preservation, and dynamic defaults. I’ll run the package build and the broader v4 tests next.

Added the internal traversal, `z.deepPartial()`, and runtime `z.input()` / `z.output()` for classic and mini, plus API docs and regression tests.

Build passed. All 3,080 v4 tests passed with no type errors.

No dependencies added. Tests outside v4 were not run.
