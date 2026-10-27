I’ll check the read paths and types, add the conversions and option handling, then verify them with runtime and type tests.

The conversion paths and batch handling are in place. Binary reads use the driver’s raw method, and batch results are matched by position to preserve order and per-item types. I’ll now test raw decoding, stream failures, and TypeScript inference.

The runtime tests pass, including raw UTF-8 decoding, Blob and stream identity, reader-lock release on failure, and positional batch conversion. The new type assertions also pass. The full type check reports an existing `node-fs.ts` error involving an optional encoding argument; I’ll leave that unrelated code unchanged and finish verification.

Added `type` support to `getItem()`, `get()`, and `getItems()`, including conversions, inferred return types, exported types, and documentation.

Validation: build succeeded and 164 runtime tests passed. New type assertions passed; the full type check remains blocked by an existing optional-encoding error in `src/drivers/utils/node-fs.ts`.
