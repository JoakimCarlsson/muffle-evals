Fixed and tested. Nothing is committed.

`withBase` and `withoutBase` in `src/utils.ts` now treat a path as under the base only if the base is followed by the end of the string, `/`, `?` or `#`. This comes from a small `isUnderBase` helper that both functions use.

- `withoutBase('/admin-dashboard', '/admin/')` now returns `/admin-dashboard`.
- `withBase('/admin-dashboard', '/admin/')` now returns `/admin/admin-dashboard`.
- `/admin`, `/admin/dashboard` and `/admin?x` behave as before.

I added five cases to `test/base.test.ts`: your two examples plus the three paths that should keep working. The full suite passes (482 tests).

I didn't run `nuxt generate` against the fix, so the stray `-dashboard` stub is untested on your app.
