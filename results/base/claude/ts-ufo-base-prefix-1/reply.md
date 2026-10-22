Now add tests.

I fixed both functions in `src/utils.ts`, and the full test suite passes (483 tests), including the new ones I added.

I added a small helper, `_isUnderBase`. It treats an input as under the base only if it starts with the base and the next character is the end of the string, `/`, `?` or `#`. `withBase` and `withoutBase` both use it instead of a plain `startsWith`.

- **`withoutBase('/admin-dashboard', '/admin/')`** now returns `/admin-dashboard`.
- **`withBase('/admin-dashboard', '/admin/')`** now returns `/admin/admin-dashboard`.
- **Paths under the base** such as `/admin`, `/admin/dashboard` and `/admin?x` behave as before.

I added the `/admin-dashboard` and under-base cases to `test/base.test.ts`. I didn't run `nuxt generate` against the fix.

I haven't committed anything.
