When a request has the same cookie name more than once, `parse()` from cookie-es only keeps the first value and silently drops the rest. Some of our upstream proxies set duplicate cookies and I need to see all of them.

Could `parse()` take an `allowMultiple` option in its options object? With `allowMultiple: true`, a name that appears more than once should map to an array of all its values in order, while names that appear once stay plain strings:

```ts
parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true });
// => { foo: ["a", "b", "c"], bar: "bar" }

parse("foo=;bar=bar;foo=boo", { allowMultiple: true });
// => { foo: ["", "boo"], bar: "bar" }
```

Values should still be decoded the same way as today (e.g. `foo=%1;foo=boo` gives `["%1", "boo"]`). Without the option, behaviour stays as it is: first value wins. It would be nice if the return type reflected that values can be arrays when the option is on.

Please add this.
