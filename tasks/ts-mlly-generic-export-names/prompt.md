`findExports` reports generic type arguments as export names.

```ts
findExports("export const APP_MODE_MAP = new Map<string, IAppMode>()")
// names: ["APP_MODE_MAP", "IAppMode"]   expected: ["APP_MODE_MAP"]
```

The comma inside `<string, IAppMode>` seems to be taken as a separator between declarations. The same happens with generic calls like `export const result = foo<Bar, Baz>(arg1, arg2)` and with several declarators, e.g. `export const a = new Set<string>(), b = new Map<string, number>()` should give `["a", "b"]`.

This breaks things downstream: in Nuxt, unimport's `scanDirExports` picks up `IAppMode` as a value export and type checking fails once more than one `imports.dirs` entry is configured.

Real comparisons such as `export const a = 1<2, b = 3` must still give `["a", "b"]`, and type annotations containing arrow function types, like `export const a: Map<string, (x: string) => void> = new Map(), b = 1`, should give `["a", "b"]` too.

Please fix this.
