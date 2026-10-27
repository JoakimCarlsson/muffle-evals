I put the helper between withBase's doc comment and the function. I'll move it above the doc comment.

`withBase` and `withoutBase` now only treat a path as under the base when it equals the base or continues past it at a `/`, `?` or `#`. The full vitest suite passes, 483 tests. I didn't run lint or the type check.

- **Fix:** a new `isUnderBase` helper in `src/utils.ts` replaces the plain `startsWith` check in both functions.
- **Your examples:**
  - `withoutBase('/admin-dashboard', '/admin/')` now returns `/admin-dashboard`.
  - `withBase('/admin-dashboard', '/admin/')` now returns `/admin/admin-dashboard`.
  - `/admin`, `/admin/dashboard` and `/admin?x` behave as before.
- **Tests:** I added cases for all of these to `test/base.test.ts`.
