`pathe/utils` has `resolveAlias(path, aliases)` to turn an aliased path into a real one, but I need the opposite: given a real path, which aliased paths could I write instead? I'm writing lint rules that suggest alias imports.

Could you add `reverseResolveAlias(path, aliases): string[]` to `pathe/utils` (in `src/utils.ts`, next to `resolveAlias`)?

- It takes the same alias map as `resolveAlias` and should treat it the same way (normalized with `normalizeAliases`, Windows paths normalized, alias targets only match on a path separator boundary or the whole path, aliases that end in `/` work like they do in `resolveAlias`).
- It returns every aliased form of the path, sorted longest first. No match returns `[]`.

Examples:

```ts
reverseResolveAlias("/root/some/assets/smth.jpg", { "~": "/root", "~assets": "/root/some/assets" });
// => ["~/some/assets/smth.jpg", "~assets/smth.jpg"]

reverseResolveAlias("/root/index.js", { "@": "/root", "~": "/root/index.js" });
// => ["@/index.js", "~"]

reverseResolveAlias("/src/foo/bar", { "~/": "/src" });
// => ["~/foo/bar"]

reverseResolveAlias("/src", { "~/": "/src" });
// => ["~/"]

reverseResolveAlias("./bar.js", { "@": "/root" });
// => []
```

Please add this.
