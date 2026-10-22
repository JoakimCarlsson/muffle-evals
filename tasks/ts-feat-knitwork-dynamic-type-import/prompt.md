I generate type declarations for auto-imports with knitwork and keep needing `typeof import("pkg").foo`. Right now I build it by hand on top of `genDynamicImport`, and end up with `typeof import("pkg")["foo"]` even when `.foo` would be valid, which is noisy.

Could knitwork export a `genDynamicTypeImport(specifier, name, options)` helper next to `genDynamicImport`?

- `specifier` is the module, `name` is an optional export name (`string | undefined`).
- With no name: `genDynamicTypeImport("pkg", undefined)` returns `typeof import("pkg")`.
- With a name that is a valid identifier: `genDynamicTypeImport("pkg", "foo")` returns `typeof import("pkg").foo`.
- With a name that is not a valid identifier: `genDynamicTypeImport("pkg", "foo-bar")` returns `typeof import("pkg")["foo-bar"]`.
- `options` should take the same `comment` and `attributes` options as `genDynamicImport` and render them the same way inside the parentheses, e.g.
  - `{ comment: 'webpackChunkName: "chunks/dynamic"' }` with name `foo` gives `typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo`
  - `{ attributes: { type: "json" } }` with name `foo` gives `typeof import("pkg", { with: { type: "json" } }).foo`

Please add this.
