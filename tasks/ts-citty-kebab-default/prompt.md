Kebab-case CLI input does not override the default for camelCase-defined args.

When an argument is defined in camelCase (e.g. `fooBar`) with a default value, passing the kebab-case variant on the command line (`--foo-bar one`) does not override the default. The parsed `fooBar` stays the default instead of the value I passed.

```js
args: {
  fooBar: { type: "enum", options: ["one", "two"], default: "two" },
}
```

Running with `--foo-bar one` gives `fooBar: "two"`; I expected `fooBar: "one"` (and `"foo-bar": "one"`).

citty 0.2.1, Node v24.

Please fix this.
