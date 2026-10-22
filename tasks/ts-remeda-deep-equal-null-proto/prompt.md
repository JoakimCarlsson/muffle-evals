`isDeepEqual` is not the same as v1's `equals`.

I upgraded from v1 to v2 and changed `equals` to `isDeepEqual` (the docs suggest it's just a rename), and our unit tests started failing. Objects with a `null` prototype are never equal to a plain object with the same contents:

```ts
import { parse } from "node:querystring";

isDeepEqual(parse("a=1&b=2"), { a: "1", b: "2" }); // false, expected true
isDeepEqual(Object.assign(Object.create(null), { a: 1 }), { a: 1 }); // false, expected true
```

Node's built-in `querystring.parse` returns exactly such objects ("The object returned by the querystring.parse() method does not prototypically inherit from the JavaScript Object"), so we hit this all the time. The cause seems to be the prototype comparison in `isDeepEqual`, which doesn't exist in `equals`. I understand that instances of different classes shouldn't be considered equal, but a null-prototype object should compare like a plain object, in both argument orders and when nested.

Please fix this.
