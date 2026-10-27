I’ll inspect the read paths and type definitions, add the conversions and type inference, then run the relevant tests.

The conversion and batch-read paths are in place. I’m adding tests for raw UTF-8 decoding, mixed batch types, stream lock release, and return-type inference. The type check also found existing package-resolution errors in this checkout; I’ll distinguish those from any errors introduced here.

Implemented `type` for `getItem()`, `get()`, and `getItems()`, with binary normalization, raw decoding, ordered mixed batches, inferred return types, root type exports, and documentation.

Validation: 100 tests passed; changed-file lint passed. Full type checking remains blocked by existing package-resolution and driver typing errors.
