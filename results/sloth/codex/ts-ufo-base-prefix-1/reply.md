I’ll check both helpers and their callers, fix the shared boundary check, then run the build and existing tests.

Both helpers use the same prefix-only check in `src/utils.ts`. I’ll replace it with a shared check that requires the base to end at `/`, `?`, `#`, or the end of the input. Existing exports, callers, tests, fixtures, and config need no changes; no new options or dependencies are needed.

Fixed both helpers with a shared path-boundary check. `/admin-dashboard` now stays unchanged with `withoutBase` and becomes `/admin/admin-dashboard` with `withBase`. Exact matches, nested paths, queries, and fragments retain their behavior.

Build, lint, type checks, and all 479 existing tests passed. Also verified your examples against the built output. Used local tools because `pnpm` was unavailable.
