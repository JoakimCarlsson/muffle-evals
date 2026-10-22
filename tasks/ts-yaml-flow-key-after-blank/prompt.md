Parsing this YAML throws an `IMPOSSIBLE` error:

```yaml
? - Detroit Tigers
  - Chicago cubs
: - 2001-07-23

[New York Yankees, Atlanta Braves]: [2001-07-02, 2001-08-12, 2001-08-14]
```

```js
require('yaml').parse(fs.readFileSync('./test.yaml', 'utf8'))
```

```
Uncaught YAMLParseError: Map comment with trailing content at line 5, column 1:

[New York Yankees, Atlanta Braves]: [2001-07-02, 2001-08-12, 2001-08-14]
^
  code: 'IMPOSSIBLE',
```

This is "Example 2.11 Mapping between Sequences" from the YAML 1.2.2 spec, as Prettier reformats it. A smaller case like `1: 2\n\n[3]: 4` fails the same way: it seems to happen whenever a flow collection is used as a block map key and there is a blank line (or a comment line) before it. Without the blank line it parses fine. The docs say `IMPOSSIBLE` should never happen.

Please fix this.
