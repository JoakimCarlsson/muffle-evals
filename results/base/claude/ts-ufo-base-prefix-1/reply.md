Now add regression tests.

I fixed both functions in `src/utils.ts`. `withoutBase('/admin-dashboard', '/admin/')` now returns `/admin-dashboard`, and `withBase('/admin-dashboard', '/admin/')` returns `/admin/admin-dashboard`.

Both functions now use a small shared helper, `isUnderBase`. It treats a path as under the base only when it equals the base or the next character is `/`, `?` or `#`. Paths like `/admin`, `/admin/dashboard` and `/admin?x` still behave as before.

I added regression tests for these cases to `test/base.test.ts`. The full suite passes (482 tests) and eslint reports no errors. I haven't tested this inside a Nuxt `nuxt generate` build, so I haven't confirmed the `-dashboard` stub file is gone there.

I didn't commit anything.
