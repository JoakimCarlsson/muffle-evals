I fixed `withBase` and `withoutBase` in `src/utils.ts`. A path now counts as under the base only if it equals the base or the base is followed by `/`, `?` or `#`. The full test suite passes.

- `withoutBase('/admin-dashboard', '/admin/')` now returns `/admin-dashboard`.
- `withBase('/admin-dashboard', '/admin/')` now returns `/admin/admin-dashboard`.
- `/admin`, `/admin/dashboard` and `/admin?x` behave as before.

I added test cases for the prefix-only path and the `?x` case to `test/base.test.ts`. I haven't tried it in your Nuxt app, so `nuxt generate` still needs to be run against the fixed ufo to confirm the stray `-dashboard` file is gone.

I haven't committed anything.
