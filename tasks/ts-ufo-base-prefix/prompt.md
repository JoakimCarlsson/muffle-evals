`withBase` and `withoutBase` treat a path as being under the base when it only shares a prefix with it.

I have a Nuxt app with `app: { baseURL: '/admin/' }` and a page at `/admin-dashboard`. `nuxt generate` writes a stray stub file called `-dashboard` into `.output/public`, and I tracked it down to ufo:

```js
withoutBase('/admin-dashboard', '/admin/') // => '/-dashboard', expected '/admin-dashboard'
withBase('/admin-dashboard', '/admin/')    // => '/admin-dashboard', expected '/admin/admin-dashboard'
```

`/admin-dashboard` is not inside `/admin/`, so `withoutBase` should leave it alone and `withBase` should prefix it. Paths that really are under the base (`/admin`, `/admin/dashboard`, `/admin?x`) should keep working as before.

Please fix this.
