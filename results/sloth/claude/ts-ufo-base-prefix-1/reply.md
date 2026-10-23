`withBase` and `withoutBase` now only treat a path as under the base when it equals the base or continues it at a `/`, `?` or `#`. The existing tests and the new cases pass, but `tsc` printed no type errors and I didn't confirm it ran cleanly.

- **Your examples:** `withoutBase('/admin-dashboard', '/admin/')` now returns `/admin-dashboard`. `withBase('/admin-dashboard', '/admin/')` now returns `/admin/admin-dashboard`.
- **Paths under the base:** `/admin`, `/admin/dashboard` and `/admin?x` behave as before.
- **Where the fix is:** a small private helper, `isUnderBase`, in `src/utils.ts`. Both functions call it in place of the plain `startsWith` check.
- **Tests:** I added cases to `test/base.test.ts` for the prefix-only path, a path under the base, and the `?` and `#` boundaries.

I didn't commit anything.
