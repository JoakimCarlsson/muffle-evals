Now add tests.

I fixed `withBase` and `withoutBase` in `src/utils.ts`. The full test suite and eslint both pass.

A path now counts as under the base only if the character right after the base is `/`, `?` or `#`, or if the path ends exactly at the base. Both functions use one shared helper, `_isUnderBase`, for this check. So:

- `withoutBase('/admin-dashboard', '/admin/')` returns `/admin-dashboard`.
- `withBase('/admin-dashboard', '/admin/')` returns `/admin/admin-dashboard`.
- `/admin`, `/admin/dashboard` and `/admin?x` behave as before.

I added cases for all of these to `test/base.test.ts`. I didn't run `nuxt generate`, so the stray `-dashboard` file in `.output/public` isn't confirmed gone. It should be, since that file came from `withoutBase` returning `/-dashboard`.

I haven't committed anything.
