I’ll check the read paths, types, and existing tests, then add the option in shared code and verify the requested conversions and type inference.

The shared storage layer handles both single and batch reads. I’ll put conversion there, strip `type` before driver calls, and track batch positions so results keep input order across mounts and driver key rewrites.

The conversion tests pass; one batch test has an incorrect expected key after prefix removal, which I’m fixing. The type check also needs generated package declarations and reports two errors in untouched driver files. I’ll build next, then rerun the focused checks.

All 102 focused runtime and type tests pass, including concurrent batch/raw reads, stream lock release, and Netlify Blobs compatibility. The build passes too. Repository-wide type checking still reports one error in the untouched `src/drivers/utils/node-fs.ts`; I’ll leave that outside this change.

Added `type` support to `getItem()`, `get()`, and `getItems()`, with conversions, inferred return types, root exports, and documentation.

Build, focused lint/format checks, and 102 tests passed. Full type checking reports an existing error in `src/drivers/utils/node-fs.ts`; focused tests passed with source errors ignored.

No dependencies or unrelated features added. Full test suite not run.
