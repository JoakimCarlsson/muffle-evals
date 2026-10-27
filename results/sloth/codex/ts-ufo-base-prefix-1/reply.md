I’ll check the base-matching logic and its tests, fix the boundary check, and run the build and relevant tests.

Both helpers now require the base prefix to end at `/`, `?`, `#`, or the end of the input. The tests cover your examples with and without the base’s trailing slash, plus empty input and fragments.

`pnpm` isn’t installed here, so I’ll run the build, lint, and tests using npm and the installed tools.

Fixed both helpers to match the base only at a path boundary. Your `/admin-dashboard` examples now return the expected values, while `/admin`, `/admin/dashboard`, and `/admin?x` retain their behavior.

Build, lint, all 503 tests, and type checks passed. Added regression coverage for both base spellings.

No new options or dependencies. Nuxt generation wasn’t run.
