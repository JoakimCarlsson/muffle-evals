Prettier was clean before my edit, so I'll format and verify through vitest instead.

`withBase` and `withoutBase` now only treat a path as under the base when it equals the base or continues it at a `/`, `?` or `#`. I changed `src/utils.ts` and didn't commit anything.

I added a small `isUnderBase` helper there and used it in both functions. I checked your cases with a throwaway test, which I deleted afterwards:

- `withoutBase('/admin-dashboard', '/admin/')` now returns `/admin-dashboard`.
- `withBase('/admin-dashboard', '/admin/')` now returns `/admin/admin-dashboard`.
- Paths under the base behave as before: `/admin` gives `/`, `/admin?x` gives `/?x`, and `/admin/dashboard` gives `/dashboard`.
- `withBase('/admin?x', '/admin/')` still returns `/admin?x`.

The existing suite passes. I didn't add a permanent test because you didn't ask for one. I didn't run a Nuxt build, so I haven't confirmed the stray `-dashboard` file is gone from `nuxt generate`.
