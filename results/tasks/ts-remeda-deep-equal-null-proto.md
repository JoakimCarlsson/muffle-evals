# ts-remeda-deep-equal-null-proto

Source: https://github.com/remeda/remeda/pull/1313

## Prompt

> `isDeepEqual` is not the same as v1's `equals`.
> 
> I upgraded from v1 to v2 and changed `equals` to `isDeepEqual` (the docs suggest it's just a rename), and our unit tests started failing. Objects with a `null` prototype are never equal to a plain object with the same contents:
> 
> ```ts
> import { parse } from "node:querystring";
> 
> isDeepEqual(parse("a=1&b=2"), { a: "1", b: "2" }); // false, expected true
> isDeepEqual(Object.assign(Object.create(null), { a: 1 }), { a: 1 }); // false, expected true
> ```
> 
> Node's built-in `querystring.parse` returns exactly such objects ("The object returned by the querystring.parse() method does not prototypically inherit from the JavaScript Object"), so we hit this all the time. The cause seems to be the prototype comparison in `isDeepEqual`, which doesn't exist in `equals`. I understand that instances of different classes shouldn't be considered equal, but a null-prototype object should compare like a plain object, in both argument orders and when nested.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [packages/remeda/src/isDeepEqual.test.ts](../../tasks/ts-remeda-deep-equal-null-proto/upstream/packages/remeda/src/isDeepEqual.test.ts), [packages/remeda/src/isDeepEqual.ts](../../tasks/ts-remeda-deep-equal-null-proto/upstream/packages/remeda/src/isDeepEqual.ts)

```diff
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..ea4f1da 100644
--- a/packages/remeda/src/isDeepEqual.ts
+++ b/packages/remeda/src/isDeepEqual.ts
@@ -7,7 +7,8 @@ import { purry } from "./purry";
  * for objects all props will be compared recursively.
  *
  * The built-in Date and RegExp are special-cased and will be compared by their
- * values.
+ * values. Objects with a `null` prototype are comparable to plain objects by
+ * their enumerable properties.
  *
  * !IMPORTANT: TypedArrays and symbol properties of objects are not supported
  * right now and might result in unexpected behavior. Please open an issue in
@@ -46,7 +47,8 @@ export function isDeepEqual<T>(data: T, other: T): boolean;
  * for objects all props will be compared recursively.
  *
  * The built-in Date and RegExp are special-cased and will be compared by their
- * values.
+ * values. Objects with a `null` prototype are comparable to plain objects by
+ * their enumerable properties.
  *
  * !IMPORTANT: TypedArrays and symbol properties of objects are not supported
  * right now and might result in unexpected behavior. Please open an issue in
@@ -99,7 +101,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return false;
   }
 
-  if (Object.getPrototypeOf(data) !== Object.getPrototypeOf(other)) {
+  if (!isComparablePrototype(data, other)) {
     // If the objects don't share a prototype it's unlikely that they are
     // semantically equal. It is technically possible to build 2 prototypes that
     // act the same but are not equal (at the reference level, checked via
@@ -130,7 +132,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return data.toString() === (other as unknown as RegExp).toString();
   }
 
-  // At this point we only know that the 2 objects share a prototype and are not
+  // At this point we only know that the 2 objects have a comparable prototype and are not
   // any of the previous types. They could be plain objects (Object.prototype),
   // they could be classes, they could be other built-ins, or they could be
   // something weird. We assume that comparing values by keys is enough to judge
@@ -159,6 +161,23 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
   return true;
 }
 
+function isComparablePrototype(data: object, other: object): boolean {
+  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- This is a low-level check, we can't avoid it being typed as `any`.
+  const dataPrototype = Object.getPrototypeOf(data);
+  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- This is a low-level check, we can't avoid it being typed as `any`.
+  const otherPrototype = Object.getPrototypeOf(other);
+
+  if (dataPrototype === otherPrototype) {
+    return true;
+  }
+
+  if (dataPrototype === null) {
+    return otherPrototype === Object.prototype;
+  }
+
+  return dataPrototype === Object.prototype && otherPrototype === null;
+}
+
 function isDeepEqualArrays(
   data: readonly unknown[],
   other: readonly unknown[],
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +8/-1 | 34 | 3,381 | $0.123 |
| claude | muffle | pass | +8/-1 | 38 | 3,032 | $0.106 |
| claude | hush | pass | +8/-1 | 33 | 2,016 | $0.086 |
| claude | sloth | pass | +9/-1 | 12 | 1,965 | $0.071 |
| claude | all | pass | +9/-1 | 32 | 2,352 | $0.094 |
| codex | base | pass | +10/-10 | 61 | 2,666 | - |
| codex | muffle | pass | +11/-11 | 57 | 3,117 | - |
| codex | hush | pass | +9/-10 | 58 | 1,754 | - |
| codex | sloth | pass | +7/-10 | 54 | 2,439 | - |
| codex | all | pass | +10/-12 | 37 | 1,914 | - |

### claude, base: pass

Files: [packages/remeda/src/isDeepEqual.test.ts](../base/claude/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.test.ts), [packages/remeda/src/isDeepEqual.ts](../base/claude/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.test.ts b/packages/remeda/src/isDeepEqual.test.ts
index 8c50b5e..6e7186d 100644
--- a/packages/remeda/src/isDeepEqual.test.ts
+++ b/packages/remeda/src/isDeepEqual.test.ts
@@ -151,6 +151,36 @@ describe("objects", () => {
   test("undefined and empty object are not equal", () => {
     expect(isDeepEqual(undefined as unknown, {})).toBe(false);
   });
+
+  describe("null prototype", () => {
+    test("equals a plain object, in both orders", () => {
+      expect(isDeepEqual(nullProto({ a: 1 }), { a: 1 })).toBe(true);
+      expect(isDeepEqual({ a: 1 }, nullProto({ a: 1 }))).toBe(true);
+      expect(isDeepEqual(nullProto({ a: 1 }), nullProto({ a: 1 }))).toBe(true);
+    });
+
+    test("equals a plain object when nested", () => {
+      expect(isDeepEqual({ x: [nullProto({ a: 1 })] }, { x: [{ a: 1 }] })).toBe(
+        true,
+      );
+    });
+
+    test("different contents are not equal", () => {
+      expect(isDeepEqual(nullProto({ a: 1 }), { a: 2 })).toBe(false);
+      expect(isDeepEqual({ a: 1 }, nullProto({ b: 1 }))).toBe(false);
+    });
+
+    test("is not equal to class instances, arrays or maps", () => {
+      class Foo {
+        public readonly a = 1;
+      }
+
+      expect(isDeepEqual(nullProto({ a: 1 }), new Foo())).toBe(false);
+      expect(isDeepEqual(new Foo(), nullProto({ a: 1 }))).toBe(false);
+      expect(isDeepEqual(nullProto({}), [])).toBe(false);
+      expect(isDeepEqual(nullProto({}), new Map())).toBe(false);
+    });
+  });
 });
 
 describe("sets", () => {
@@ -410,3 +440,7 @@ function func1(): void {
 function func2(): void {
   throw new Error("This function should never be called!");
 }
+
+function nullProto(obj: object): object {
+  return Object.assign(Object.create(null) as object, obj);
+}
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..9e501fc 100644
--- a/packages/remeda/src/isDeepEqual.ts
+++ b/packages/remeda/src/isDeepEqual.ts
@@ -99,7 +99,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return false;
   }
 
-  if (Object.getPrototypeOf(data) !== Object.getPrototypeOf(other)) {
+  if (getComparablePrototype(data) !== getComparablePrototype(other)) {
     // If the objects don't share a prototype it's unlikely that they are
     // semantically equal. It is technically possible to build 2 prototypes that
     // act the same but are not equal (at the reference level, checked via
@@ -159,6 +159,13 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
   return true;
 }
 
+// Objects with a `null` prototype (e.g. the result of `querystring.parse`, or
+// `Object.create(null)`) are plain objects for all intents and purposes, so we
+// compare them as if they inherited from `Object.prototype`.
+function getComparablePrototype(value: object): object {
+  return (Object.getPrototypeOf(value) as object | null) ?? Object.prototype;
+}
+
 function isDeepEqualArrays(
   data: readonly unknown[],
   other: readonly unknown[],
```

</details>

<details><summary>reply</summary>

Tests pass. I'm now fixing the lint errors in my changes.

Two lint items remain in the test; fixing them.

`isDeepEqual` now treats a null-prototype object as a plain object, so both examples from your report return `true`. The `isDeepEqual` tests pass, along with the type tests and eslint. I did not run the rest of the suite.

The prototype check in `packages/remeda/src/isDeepEqual.ts` compared prototypes by reference, so `null` never matched `Object.prototype`. It now uses a small helper, `getComparablePrototype`, that maps a `null` prototype to `Object.prototype` before comparing. That covers both argument orders and nested values, and the comparison after the check is unchanged.

Class instances of different classes still compare unequal. A null-prototype object also still doesn't equal an array, a `Map` or a class instance.

I added tests in `isDeepEqual.test.ts` for these cases:
- Comparison against a plain object in both orders, and null-prototype against null-prototype.
- A null-prototype object nested inside an array inside an object.
- Different contents compare unequal.
- Class instances, arrays and `Map`s compare unequal.

I didn't commit anything.

</details>

### claude, muffle: pass

Files: [packages/remeda/src/isDeepEqual.test.ts](../muffle/claude/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.test.ts), [packages/remeda/src/isDeepEqual.ts](../muffle/claude/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.test.ts b/packages/remeda/src/isDeepEqual.test.ts
index 8c50b5e..8f8b87d 100644
--- a/packages/remeda/src/isDeepEqual.test.ts
+++ b/packages/remeda/src/isDeepEqual.test.ts
@@ -151,6 +151,44 @@ describe("objects", () => {
   test("undefined and empty object are not equal", () => {
     expect(isDeepEqual(undefined as unknown, {})).toBe(false);
   });
+
+  test("null-prototype object equals a plain object", () => {
+    const nullProto = Object.assign(Object.create(null), { a: 1 }) as object;
+
+    expect(isDeepEqual(nullProto, { a: 1 })).toBe(true);
+    expect(isDeepEqual({ a: 1 }, nullProto)).toBe(true);
+  });
+
+  test("null-prototype objects equal each other", () => {
+    const first = Object.assign(Object.create(null), { a: 1 }) as object;
+    const second = Object.assign(Object.create(null), { a: 1 }) as object;
+
+    expect(isDeepEqual(first, second)).toBe(true);
+  });
+
+  test("nested null-prototype objects equal plain objects", () => {
+    const nullProto = Object.assign(Object.create(null), { a: 1 }) as object;
+
+    expect(isDeepEqual({ x: [nullProto] }, { x: [{ a: 1 }] })).toBe(true);
+    expect(isDeepEqual({ x: [{ a: 1 }] }, { x: [nullProto] })).toBe(true);
+  });
+
+  test("null-prototype objects with different contents are not equal", () => {
+    const nullProto = Object.assign(Object.create(null), { a: 1 }) as object;
+
+    expect(isDeepEqual(nullProto, { a: 2 })).toBe(false);
+    expect(isDeepEqual(nullProto, {})).toBe(false);
+  });
+
+  test("null-prototype object is not equal to a class instance", () => {
+    class Foo {
+      a = 1;
+    }
+    const nullProto = Object.assign(Object.create(null), { a: 1 }) as object;
+
+    expect(isDeepEqual(nullProto, new Foo())).toBe(false);
+    expect(isDeepEqual(new Foo(), nullProto)).toBe(false);
+  });
 });
 
 describe("sets", () => {
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..68a8a0b 100644
--- a/packages/remeda/src/isDeepEqual.ts
+++ b/packages/remeda/src/isDeepEqual.ts
@@ -99,7 +99,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return false;
   }
 
-  if (Object.getPrototypeOf(data) !== Object.getPrototypeOf(other)) {
+  if (getComparablePrototype(data) !== getComparablePrototype(other)) {
     // If the objects don't share a prototype it's unlikely that they are
     // semantically equal. It is technically possible to build 2 prototypes that
     // act the same but are not equal (at the reference level, checked via
@@ -159,6 +159,13 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
   return true;
 }
 
+// Objects with a `null` prototype (e.g. the result of `querystring.parse` or
+// `Object.create(null)`) are plain objects for all practical purposes, so we
+// compare them as if they inherited from `Object.prototype`.
+function getComparablePrototype(value: object): object {
+  return (Object.getPrototypeOf(value) as object | null) ?? Object.prototype;
+}
+
 function isDeepEqualArrays(
   data: readonly unknown[],
   other: readonly unknown[],
```

</details>

<details><summary>reply</summary>

Tests pass; I'm tidying lint warnings in my new tests.

`isDeepEqual` now treats a null-prototype object like a plain object, so both of your examples return `true`. This holds in either argument order and when the objects are nested. The `isDeepEqual` tests, the type check and eslint all pass, apart from one remaining eslint warning in my new test (below). I didn't run the rest of the suite.

The prototype check in `packages/remeda/src/isDeepEqual.ts` now treats a `null` prototype as `Object.prototype`. Instances of different classes still compare as unequal, and so does a null-prototype object against a class instance, an array or a `Map`.

I added tests in `isDeepEqual.test.ts` for:
- null-prototype against plain, in both orders
- null-prototype against null-prototype
- nested cases
- differing contents
- null-prototype against a class instance

One eslint warning remains in the new tests. The `Foo` class in the class-instance test has a property with no accessibility modifier, and I left it as is. I haven't committed anything.

</details>

### claude, hush: pass

Files: [packages/remeda/src/isDeepEqual.test.ts](../hush/claude/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.test.ts), [packages/remeda/src/isDeepEqual.ts](../hush/claude/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.test.ts b/packages/remeda/src/isDeepEqual.test.ts
index 8c50b5e..6f60c8f 100644
--- a/packages/remeda/src/isDeepEqual.test.ts
+++ b/packages/remeda/src/isDeepEqual.test.ts
@@ -151,6 +151,39 @@ describe("objects", () => {
   test("undefined and empty object are not equal", () => {
     expect(isDeepEqual(undefined as unknown, {})).toBe(false);
   });
+
+  describe("null prototype", () => {
+    const nullProto = (obj: object) => Object.assign(Object.create(null), obj);
+
+    test("equals a plain object", () => {
+      expect(isDeepEqual(nullProto({ a: 1 }), { a: 1 })).toBe(true);
+    });
+
+    test("equals a plain object (reversed)", () => {
+      expect(isDeepEqual({ a: 1 }, nullProto({ a: 1 }))).toBe(true);
+    });
+
+    test("equals a null prototype object", () => {
+      expect(isDeepEqual(nullProto({ a: 1 }), nullProto({ a: 1 }))).toBe(true);
+    });
+
+    test("nested", () => {
+      expect(
+        isDeepEqual({ x: [nullProto({ a: 1 })] }, { x: [{ a: 1 }] }),
+      ).toBe(true);
+    });
+
+    test("different contents are not equal", () => {
+      expect(isDeepEqual(nullProto({ a: 1 }), { a: 2 })).toBe(false);
+    });
+
+    test("class instances are still not equal", () => {
+      class A {
+        a = 1;
+      }
+      expect(isDeepEqual(nullProto({ a: 1 }), new A())).toBe(false);
+    });
+  });
 });
 
 describe("sets", () => {
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..a09a74c 100644
--- a/packages/remeda/src/isDeepEqual.ts
+++ b/packages/remeda/src/isDeepEqual.ts
@@ -99,7 +99,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return false;
   }
 
-  if (Object.getPrototypeOf(data) !== Object.getPrototypeOf(other)) {
+  if (getPrototype(data) !== getPrototype(other)) {
     // If the objects don't share a prototype it's unlikely that they are
     // semantically equal. It is technically possible to build 2 prototypes that
     // act the same but are not equal (at the reference level, checked via
@@ -159,6 +159,13 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
   return true;
 }
 
+// Objects with a `null` prototype (e.g. the result of `querystring.parse` or
+// `Object.create(null)`) are plain objects for all practical purposes, so we
+// compare them as if they inherit from `Object.prototype`.
+function getPrototype(value: object): object | null {
+  return Object.getPrototypeOf(value) ?? Object.prototype;
+}
+
 function isDeepEqualArrays(
   data: readonly unknown[],
   other: readonly unknown[],
```

</details>

<details><summary>reply</summary>

Done. `isDeepEqual` now treats null-prototype objects as plain objects, in both argument orders and nested. Tests pass, including new ones for those cases; lint not run.

The fix is in `packages/remeda/src/isDeepEqual.ts`: the prototype check now maps a `null` prototype to `Object.prototype`. Class instances still don't equal null-prototype objects.

</details>

### claude, sloth: pass

Files: [packages/remeda/src/isDeepEqual.test.ts](../sloth/claude/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.test.ts), [packages/remeda/src/isDeepEqual.ts](../sloth/claude/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.test.ts b/packages/remeda/src/isDeepEqual.test.ts
index 8c50b5e..488a83d 100644
--- a/packages/remeda/src/isDeepEqual.test.ts
+++ b/packages/remeda/src/isDeepEqual.test.ts
@@ -88,6 +88,18 @@ describe("objects", () => {
     expect(isDeepEqual({ a: 1, b: "2" }, { b: "2", a: 1 })).toBe(true);
   });
 
+  test("null-prototype objects equal plain objects", () => {
+    const nullProto = Object.assign(Object.create(null), { a: 1 }) as unknown;
+    expect(isDeepEqual(nullProto, { a: 1 })).toBe(true);
+    expect(isDeepEqual({ a: 1 }, nullProto)).toBe(true);
+    expect(isDeepEqual(nullProto, Object.assign(Object.create(null), { a: 1 })))
+      .toBe(true);
+    expect(isDeepEqual({ n: nullProto }, { n: { a: 1 } })).toBe(true);
+    expect(isDeepEqual(nullProto, { a: 2 })).toBe(false);
+    expect(isDeepEqual(nullProto, [])).toBe(false);
+    expect(isDeepEqual(nullProto, new (class A {})())).toBe(false);
+  });
+
   test("not equal objects (extra property)", () => {
     expect(isDeepEqual({ a: 1, b: "2" }, { a: 1, b: "2", c: [] })).toBe(false);
   });
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..24af6dc 100644
--- a/packages/remeda/src/isDeepEqual.ts
+++ b/packages/remeda/src/isDeepEqual.ts
@@ -99,7 +99,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return false;
   }
 
-  if (Object.getPrototypeOf(data) !== Object.getPrototypeOf(other)) {
+  if (getComparablePrototype(data) !== getComparablePrototype(other)) {
     // If the objects don't share a prototype it's unlikely that they are
     // semantically equal. It is technically possible to build 2 prototypes that
     // act the same but are not equal (at the reference level, checked via
@@ -159,6 +159,14 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
   return true;
 }
 
+/**
+ * Objects with a `null` prototype (e.g. the result of `querystring.parse`) are
+ * compared as if they were plain objects.
+ */
+function getComparablePrototype(value: object): object {
+  return Object.getPrototypeOf(value) ?? Object.prototype;
+}
+
 function isDeepEqualArrays(
   data: readonly unknown[],
   other: readonly unknown[],
```

</details>

<details><summary>reply</summary>

`isDeepEqual` now treats a null-prototype object like a plain object. The existing tests and the new one pass, and vitest's type check reports no errors. Prettier skipped the test file ("No files matching the pattern"), so I couldn't confirm it matches the repo's formatting. The standalone `tsc` run also failed because there's no tsconfig at that path.

The fix is in `packages/remeda/src/isDeepEqual.ts`. The prototype check now maps a `null` prototype to `Object.prototype` before comparing. Your `querystring.parse` and `Object.create(null)` examples both return `true`, in either argument order and when nested. Two null-prototype objects compare equal to each other as well.

Instances of different classes still compare as unequal. A null-prototype object also still doesn't equal an array or a class instance.

I added a test, "null-prototype objects equal plain objects", to `isDeepEqual.test.ts`. It covers both argument orders, nesting, a differing value, an array, and a class instance.

</details>

### claude, all: pass

Files: [packages/remeda/src/isDeepEqual.test.ts](../all/claude/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.test.ts), [packages/remeda/src/isDeepEqual.ts](../all/claude/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.test.ts b/packages/remeda/src/isDeepEqual.test.ts
index 8c50b5e..8c2d2ee 100644
--- a/packages/remeda/src/isDeepEqual.test.ts
+++ b/packages/remeda/src/isDeepEqual.test.ts
@@ -401,6 +401,38 @@ describe("sample objects", () => {
   });
 });
 
+const nullProto = (obj: object): object =>
+  Object.assign(Object.create(null) as object, obj);
+
+describe("null prototype", () => {
+  test("equals a plain object in both orders", () => {
+    expect(isDeepEqual(nullProto({ a: 1 }), { a: 1 })).toBe(true);
+    expect(isDeepEqual({ a: 1 }, nullProto({ a: 1 }))).toBe(true);
+  });
+
+  test("equals a plain object when nested", () => {
+    expect(isDeepEqual({ x: [nullProto({ a: 1 })] }, { x: [{ a: 1 }] })).toBe(
+      true,
+    );
+  });
+
+  test("different contents are not equal", () => {
+    expect(isDeepEqual(nullProto({ a: 1 }), { a: 2 })).toBe(false);
+  });
+
+  test("does not equal class instances or arrays", () => {
+    class Foo {
+      public a = 1;
+    }
+
+    expect(isDeepEqual(nullProto({ a: 1 }), new Foo())).toBe(false);
+
+    expect(isDeepEqual(new Foo(), nullProto({ a: 1 }))).toBe(false);
+
+    expect(isDeepEqual(nullProto({}), [])).toBe(false);
+  });
+});
+
 /* v8 ignore next 3 -- We only need the function pointer, we never call it! */
 function func1(): void {
   throw new Error("This function should never be called!");
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..84da249 100644
--- a/packages/remeda/src/isDeepEqual.ts
+++ b/packages/remeda/src/isDeepEqual.ts
@@ -99,7 +99,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return false;
   }
 
-  if (Object.getPrototypeOf(data) !== Object.getPrototypeOf(other)) {
+  if (getComparablePrototype(data) !== getComparablePrototype(other)) {
     // If the objects don't share a prototype it's unlikely that they are
     // semantically equal. It is technically possible to build 2 prototypes that
     // act the same but are not equal (at the reference level, checked via
@@ -159,6 +159,14 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
   return true;
 }
 
+/**
+ * Objects with a `null` prototype (e.g. the result of `querystring.parse`) are
+ * plain objects for all intents and purposes, so they are compared as such.
+ */
+function getComparablePrototype(value: object): unknown {
+  return Object.getPrototypeOf(value) ?? Object.prototype;
+}
+
 function isDeepEqualArrays(
   data: readonly unknown[],
   other: readonly unknown[],
```

</details>

<details><summary>reply</summary>

Fix lint.

Done. `isDeepEqual` now treats a null-prototype object as `Object.prototype`, so it equals plain objects in both orders and when nested. Class instances and arrays still don't match it. The fix is in `src/isDeepEqual.ts`, with new null-prototype tests in `src/isDeepEqual.test.ts`. The tests, `tsc` and eslint all pass.

</details>

### codex, base: pass

Files: [packages/remeda/src/isDeepEqual.test.ts](../base/codex/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.test.ts), [packages/remeda/src/isDeepEqual.ts](../base/codex/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.test.ts b/packages/remeda/src/isDeepEqual.test.ts
index 8c50b5e..360307e 100644
--- a/packages/remeda/src/isDeepEqual.test.ts
+++ b/packages/remeda/src/isDeepEqual.test.ts
@@ -1,3 +1,4 @@
+import { parse } from "node:querystring";
 import { describe, expect, test } from "vitest";
 import { isDeepEqual } from "./isDeepEqual";
 
@@ -153,6 +154,62 @@ describe("objects", () => {
   });
 });
 
+describe("null-prototype objects", () => {
+  test.each([
+    [nullPrototype({}), {}, true],
+    [nullPrototype({ a: 1 }), { a: 1 }, true],
+    [parse("a=1&b=2"), { a: "1", b: "2" }, true],
+    [nullPrototype({ a: 1 }), nullPrototype({ a: 1 }), true],
+    [nullPrototype({ a: 1 }), { a: 2 }, false],
+    [nullPrototype({ a: 1 }), { a: 1, b: 2 }, false],
+    [nullPrototype({ a: undefined }), { b: undefined }, false],
+    [nullPrototype({ toString: undefined }), { a: undefined }, false],
+    [nullPrototype({}), [], false],
+    [nullPrototype({}), new Map(), false],
+    [nullPrototype({}), new Set(), false],
+    [nullPrototype({}), new Date(), false],
+    [nullPrototype({}), /foo/u, false],
+  ])("compares %j and %j as %s in both orders", (data, other, expected) => {
+    expect(isDeepEqual(data, other)).toBe(expected);
+    expect(isDeepEqual(other, data)).toBe(expected);
+    expect(isDeepEqual(other)(data)).toBe(expected);
+    expect(isDeepEqual(data)(other)).toBe(expected);
+  });
+
+  test.each([
+    (value: unknown) => ({ nested: value }),
+    (value: unknown) => [value],
+    (value: unknown) => new Map([["nested", value]]),
+    (value: unknown) => new Set([value]),
+  ])("compares nested objects", (wrap) => {
+    const data = wrap(nullPrototype({ a: 1 }));
+    const other = wrap({ a: 1 });
+
+    expect(isDeepEqual(data, other)).toBe(true);
+    expect(isDeepEqual(other, data)).toBe(true);
+    expect(isDeepEqual(data, wrap({ a: 2 }))).toBe(false);
+    expect(isDeepEqual(wrap({ a: 2 }), data)).toBe(false);
+  });
+
+  test("preserves class prototype comparisons", () => {
+    class First {
+      public a = 1;
+    }
+    class Second {
+      public a = 1;
+    }
+
+    expect(isDeepEqual(new First(), new First())).toBe(true);
+    expect(isDeepEqual(new First(), new Second())).toBe(false);
+    expect(isDeepEqual(new Second(), new First())).toBe(false);
+
+    for (const other of [nullPrototype({ a: 1 }), { a: 1 }]) {
+      expect(isDeepEqual(new First(), other)).toBe(false);
+      expect(isDeepEqual(other, new First())).toBe(false);
+    }
+  });
+});
+
 describe("sets", () => {
   test("two empty sets should be equal", () => {
     expect(isDeepEqual(new Set(), new Set())).toBe(true);
@@ -410,3 +467,7 @@ function func1(): void {
 function func2(): void {
   throw new Error("This function should never be called!");
 }
+
+function nullPrototype(properties: Readonly<Record<string, unknown>>): unknown {
+  return Object.assign(Object.create(null), properties);
+}
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..e04d2a3 100644
--- a/packages/remeda/src/isDeepEqual.ts
+++ b/packages/remeda/src/isDeepEqual.ts
@@ -99,14 +99,14 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return false;
   }
 
-  if (Object.getPrototypeOf(data) !== Object.getPrototypeOf(other)) {
-    // If the objects don't share a prototype it's unlikely that they are
-    // semantically equal. It is technically possible to build 2 prototypes that
-    // act the same but are not equal (at the reference level, checked via
-    // `===`) and then create 2 objects that are equal although we would fail on
-    // them. Because this is so unlikely, the optimization we gain here for the
-    // rest of the function by assuming that `other` is of the same type as
-    // `data` is more than worth it.
+  const dataPrototype: unknown =
+    Object.getPrototypeOf(data) ?? Object.prototype;
+  const otherPrototype: unknown =
+    Object.getPrototypeOf(other) ?? Object.prototype;
+  if (dataPrototype !== otherPrototype) {
+    // Plain objects may have either a null prototype or Object.prototype.
+    // All other objects must share a prototype so that the type-specific
+    // comparisons below can assume that `other` has the same type as `data`.
     return false;
   }
 
@@ -130,7 +130,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return data.toString() === (other as unknown as RegExp).toString();
   }
 
-  // At this point we only know that the 2 objects share a prototype and are not
+  // At this point the objects are plain objects or share a prototype and are not
   // any of the previous types. They could be plain objects (Object.prototype),
   // they could be classes, they could be other built-ins, or they could be
   // something weird. We assume that comparing values by keys is enough to judge
@@ -141,7 +141,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
   }
 
   for (const [key, value] of Object.entries(data)) {
-    if (!(key in other)) {
+    if (!Object.hasOwn(other, key)) {
       return false;
     }
```

</details>

<details><summary>reply</summary>

I’ll check the prototype comparison and existing tests, then update `isDeepEqual` to treat null-prototype objects like plain objects while preserving class-instance checks.

The fix passes the regression tests in both argument orders, including nested objects and `querystring.parse` results. I also changed the key check to require own properties: inherited names such as `toString` could otherwise cause asymmetric results. Class instances still require matching prototypes.

Fixed `isDeepEqual` to compare null-prototype and plain objects by contents, in both argument orders and when nested. Different class prototypes remain unequal.

Added regression coverage for `querystring.parse`, curried calls, nested collections, and inherited property names.

Validation passed: full runtime suite, 84 focused tests, TypeScript check, ESLint, and formatting.

</details>

### codex, muffle: pass

Files: [packages/remeda/src/isDeepEqual.test.ts](../muffle/codex/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.test.ts), [packages/remeda/src/isDeepEqual.ts](../muffle/codex/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.test.ts b/packages/remeda/src/isDeepEqual.test.ts
index 8c50b5e..533e4ce 100644
--- a/packages/remeda/src/isDeepEqual.test.ts
+++ b/packages/remeda/src/isDeepEqual.test.ts
@@ -1,3 +1,4 @@
+import { parse } from "node:querystring";
 import { describe, expect, test } from "vitest";
 import { isDeepEqual } from "./isDeepEqual";
 
@@ -80,6 +81,62 @@ describe("objects", () => {
     expect(isDeepEqual({}, {})).toBe(true);
   });
 
+  describe("null-prototype objects", () => {
+    test.each([
+      [{}, {}, true],
+      [{ a: 1 }, { a: 1 }, true],
+      [{ a: 1 }, { a: 2 }, false],
+      [{ a: 1 }, {}, false],
+      [{ a: undefined }, { b: undefined }, false],
+      [{ toString: undefined }, { b: undefined }, false],
+    ])(
+      "compares contents in both orders: %j and %j",
+      (data, other, expected) => {
+        const nullPrototype: unknown = Object.assign(Object.create(null), data);
+
+        expect(isDeepEqual(nullPrototype, other)).toBe(expected);
+        expect(isDeepEqual(other, nullPrototype)).toBe(expected);
+        expect(isDeepEqual(other)(nullPrototype)).toBe(expected);
+        expect(isDeepEqual(nullPrototype)(other)).toBe(expected);
+      },
+    );
+
+    test("compares querystring results, including nested values", () => {
+      const data = parse("a=1&b=2");
+      const other = { a: "1", b: "2" };
+
+      expect(isDeepEqual(data, other)).toBe(true);
+      expect(isDeepEqual(other, data)).toBe(true);
+      expect(isDeepEqual({ items: [data] }, { items: [other] })).toBe(true);
+      expect(isDeepEqual({ items: [other] }, { items: [data] })).toBe(true);
+    });
+
+    test("does not equate null-prototype objects with other prototypes", () => {
+      class Example {
+        public value = 1;
+      }
+      class OtherExample {
+        public value = 1;
+      }
+      const data: unknown = Object.create(null);
+
+      for (const other of [
+        [],
+        new Map(),
+        new Set(),
+        new Date(),
+        /test/u,
+        new Example(),
+        Object.create({}),
+      ]) {
+        expect(isDeepEqual(data, other)).toBe(false);
+        expect(isDeepEqual(other, data)).toBe(false);
+      }
+
+      expect(isDeepEqual(new Example(), new OtherExample())).toBe(false);
+    });
+  });
+
   test('equal objects (same properties "order")', () => {
     expect(isDeepEqual({ a: 1, b: "2" }, { a: 1, b: "2" })).toBe(true);
   });
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..33f1d74 100644
--- a/packages/remeda/src/isDeepEqual.ts
+++ b/packages/remeda/src/isDeepEqual.ts
@@ -99,14 +99,14 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return false;
   }
 
-  if (Object.getPrototypeOf(data) !== Object.getPrototypeOf(other)) {
-    // If the objects don't share a prototype it's unlikely that they are
-    // semantically equal. It is technically possible to build 2 prototypes that
-    // act the same but are not equal (at the reference level, checked via
-    // `===`) and then create 2 objects that are equal although we would fail on
-    // them. Because this is so unlikely, the optimization we gain here for the
-    // rest of the function by assuming that `other` is of the same type as
-    // `data` is more than worth it.
+  const dataPrototype: unknown =
+    Object.getPrototypeOf(data) ?? Object.prototype;
+  const otherPrototype: unknown =
+    Object.getPrototypeOf(other) ?? Object.prototype;
+  if (dataPrototype !== otherPrototype) {
+    // Null-prototype objects and plain objects compare by their contents.
+    // Otherwise, require the same prototype so different classes and built-ins
+    // remain distinct and the type-specific comparisons below are safe.
     return false;
   }
 
@@ -130,8 +130,8 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return data.toString() === (other as unknown as RegExp).toString();
   }
 
-  // At this point we only know that the 2 objects share a prototype and are not
-  // any of the previous types. They could be plain objects (Object.prototype),
+  // At this point the objects share a prototype (or have null/Object
+  // prototypes) and are not any of the previous types. They could be plain objects (Object.prototype),
   // they could be classes, they could be other built-ins, or they could be
   // something weird. We assume that comparing values by keys is enough to judge
   // their equality.
@@ -141,7 +141,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
   }
 
   for (const [key, value] of Object.entries(data)) {
-    if (!(key in other)) {
+    if (!Object.hasOwn(other, key)) {
       return false;
     }
```

</details>

<details><summary>reply</summary>

I’ll check `isDeepEqual` and its tests, then update the prototype comparison to support null-prototype objects while preserving class-instance checks.

The regression tests pass for both argument orders, nested values, and curried calls. The prototype exception is limited to `null` and `Object.prototype`. I also changed the key check to require own properties, so inherited names such as `toString` cannot produce a false match. I’m finishing lint and type checks.

Fixed `isDeepEqual` to compare null-prototype objects and plain objects by contents, in both argument orders and when nested. Different class prototypes remain distinct.

Added regression tests for querystring results, curried calls, unequal contents, and inherited property names.

Validation passed: 80 runtime/type tests, TypeScript check, lint, and formatting.

</details>

### codex, hush: pass

Files: [packages/remeda/src/isDeepEqual.test.ts](../hush/codex/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.test.ts), [packages/remeda/src/isDeepEqual.ts](../hush/codex/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.test.ts b/packages/remeda/src/isDeepEqual.test.ts
index 8c50b5e..96319ee 100644
--- a/packages/remeda/src/isDeepEqual.test.ts
+++ b/packages/remeda/src/isDeepEqual.test.ts
@@ -1,3 +1,4 @@
+import { parse } from "node:querystring";
 import { describe, expect, test } from "vitest";
 import { isDeepEqual } from "./isDeepEqual";
 
@@ -76,6 +77,63 @@ describe("scalars", () => {
 });
 
 describe("objects", () => {
+  test.each([
+    [{}, {}],
+    [{ a: 1 }, { a: 1 }],
+    [{ a: 1 }, { a: 2 }],
+    [{ a: 1 }, {}],
+    [{ a: undefined }, { b: undefined }],
+    [{ toString: undefined }, { b: undefined }],
+  ])(
+    "null-prototype records compare by own contents: %o, %o",
+    (data, other) => {
+      const record: unknown = Object.assign(Object.create(null), data);
+      const expected = isDeepEqual(data, other);
+
+      expect(isDeepEqual(record, other)).toBe(expected);
+      expect(isDeepEqual(other, record)).toBe(expected);
+      expect(isDeepEqual({ nested: [record] }, { nested: [other] })).toBe(
+        expected,
+      );
+      expect(isDeepEqual({ nested: [other] }, { nested: [record] })).toBe(
+        expected,
+      );
+      expect(isDeepEqual(other)(record)).toBe(expected);
+    },
+  );
+
+  test("querystring records equal plain objects", () => {
+    const record = parse("a=1&b=2");
+    const plain = { a: "1", b: "2" };
+
+    expect(isDeepEqual(record, plain)).toBe(true);
+    expect(isDeepEqual(plain, record)).toBe(true);
+  });
+
+  test("null-prototype records remain distinct from other prototypes", () => {
+    class First {
+      public value = 1;
+    }
+    class Second {
+      public value = 1;
+    }
+    const record: unknown = Object.create(null);
+
+    for (const other of [
+      new First(),
+      [],
+      new Map(),
+      new Set(),
+      new Date(),
+      /a/u,
+    ]) {
+      expect(isDeepEqual(record, other)).toBe(false);
+      expect(isDeepEqual(other, record)).toBe(false);
+    }
+
+    expect(isDeepEqual(new First(), new Second())).toBe(false);
+  });
+
   test("empty objects are equal", () => {
     expect(isDeepEqual({}, {})).toBe(true);
   });
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..c453712 100644
--- a/packages/remeda/src/isDeepEqual.ts
+++ b/packages/remeda/src/isDeepEqual.ts
@@ -99,14 +99,13 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return false;
   }
 
-  if (Object.getPrototypeOf(data) !== Object.getPrototypeOf(other)) {
-    // If the objects don't share a prototype it's unlikely that they are
-    // semantically equal. It is technically possible to build 2 prototypes that
-    // act the same but are not equal (at the reference level, checked via
-    // `===`) and then create 2 objects that are equal although we would fail on
-    // them. Because this is so unlikely, the optimization we gain here for the
-    // rest of the function by assuming that `other` is of the same type as
-    // `data` is more than worth it.
+  // Null-prototype records have the same semantics as plain objects. Normalize
+  // only those prototypes so class instances and built-ins remain distinct.
+  const dataPrototype: unknown =
+    Object.getPrototypeOf(data) ?? Object.prototype;
+  const otherPrototype: unknown =
+    Object.getPrototypeOf(other) ?? Object.prototype;
+  if (dataPrototype !== otherPrototype) {
     return false;
   }
 
@@ -130,7 +129,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return data.toString() === (other as unknown as RegExp).toString();
   }
 
-  // At this point we only know that the 2 objects share a prototype and are not
+  // At this point we only know that the 2 objects share a normalized prototype and are not
   // any of the previous types. They could be plain objects (Object.prototype),
   // they could be classes, they could be other built-ins, or they could be
   // something weird. We assume that comparing values by keys is enough to judge
@@ -141,7 +140,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
   }
 
   for (const [key, value] of Object.entries(data)) {
-    if (!(key in other)) {
+    if (!Object.hasOwn(other, key)) {
       return false;
     }
```

</details>

<details><summary>reply</summary>

Done.
`isDeepEqual` handles null-prototype objects symmetrically and recursively; class distinctions preserved. 74 tests, typecheck, lint passed. Full suite not run.

</details>

### codex, sloth: pass

Files: [packages/remeda/src/isDeepEqual.test.ts](../sloth/codex/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.test.ts), [packages/remeda/src/isDeepEqual.ts](../sloth/codex/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.test.ts b/packages/remeda/src/isDeepEqual.test.ts
index 8c50b5e..0555c94 100644
--- a/packages/remeda/src/isDeepEqual.test.ts
+++ b/packages/remeda/src/isDeepEqual.test.ts
@@ -1,3 +1,4 @@
+import { parse } from "node:querystring";
 import { describe, expect, test } from "vitest";
 import { isDeepEqual } from "./isDeepEqual";
 
@@ -76,6 +77,59 @@ describe("scalars", () => {
 });
 
 describe("objects", () => {
+  test("null-prototype objects compare like plain objects", () => {
+    const empty = Object.create(null) as object;
+    const record = Object.assign(Object.create(null) as object, { a: 1 });
+    const cases: [unknown, unknown, boolean][] = [
+      [parse("a=1&b=2"), { a: "1", b: "2" }, true],
+      [record, { a: 1 }, true],
+      [empty, {}, true],
+      [record, Object.assign(Object.create(null) as object, { a: 1 }), true],
+      [{ nested: [record] }, { nested: [{ a: 1 }] }, true],
+      [new Map([["a", record]]), new Map([["a", { a: 1 }]]), true],
+      [new Set([record]), new Set([{ a: 1 }]), true],
+      [record, { a: 2 }, false],
+      [record, {}, false],
+      [record, { b: 1 }, false],
+      [record, { a: 1, b: 2 }, false],
+      [empty, [], false],
+      [empty, new Date(0), false],
+      [empty, /a/u, false],
+      [empty, new Map(), false],
+      [empty, new Set(), false],
+      [
+        empty,
+        new (class {
+          public a = 1;
+        })(),
+        false,
+      ],
+      [
+        {},
+        new (class {
+          public a = 1;
+        })(),
+        false,
+      ],
+      [
+        new (class {
+          public a = 1;
+        })(),
+        new (class {
+          public a = 1;
+        })(),
+        false,
+      ],
+    ];
+
+    for (const [data, other, expected] of cases) {
+      expect(isDeepEqual(data, other)).toBe(expected);
+      expect(isDeepEqual(other, data)).toBe(expected);
+      expect(isDeepEqual(other)(data)).toBe(expected);
+      expect(isDeepEqual(data)(other)).toBe(expected);
+    }
+  });
+
   test("empty objects are equal", () => {
     expect(isDeepEqual({}, {})).toBe(true);
   });
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..8f2c8cd 100644
--- a/packages/remeda/src/isDeepEqual.ts
+++ b/packages/remeda/src/isDeepEqual.ts
@@ -99,14 +99,10 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return false;
   }
 
-  if (Object.getPrototypeOf(data) !== Object.getPrototypeOf(other)) {
-    // If the objects don't share a prototype it's unlikely that they are
-    // semantically equal. It is technically possible to build 2 prototypes that
-    // act the same but are not equal (at the reference level, checked via
-    // `===`) and then create 2 objects that are equal although we would fail on
-    // them. Because this is so unlikely, the optimization we gain here for the
-    // rest of the function by assuming that `other` is of the same type as
-    // `data` is more than worth it.
+  if (
+    (Object.getPrototypeOf(data) ?? Object.prototype) !==
+    (Object.getPrototypeOf(other) ?? Object.prototype)
+  ) {
     return false;
   }
 
@@ -130,8 +126,9 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return data.toString() === (other as unknown as RegExp).toString();
   }
 
-  // At this point we only know that the 2 objects share a prototype and are not
-  // any of the previous types. They could be plain objects (Object.prototype),
+  // At this point we only know that the 2 objects share a prototype (treating
+  // null as Object.prototype) and are not any of the previous types. They could
+  // be plain objects (Object.prototype),
   // they could be classes, they could be other built-ins, or they could be
   // something weird. We assume that comparing values by keys is enough to judge
   // their equality.
```

</details>

<details><summary>reply</summary>

I’ll check the prototype comparison and existing tests, then make a focused fix that preserves class-instance comparisons.

The change belongs in the shared comparator, with regression coverage in its existing test file. Callers, exports, signatures, fixtures, and config need no changes. I’ll treat `null` and `Object.prototype` as equivalent in the prototype check, while keeping other prototype differences unequal. Tests will cover both argument orders, nesting, curried calls, unequal contents, and class and built-in boundaries.

The fix passes the full test suite, including type tests, and the build succeeds. Lint caught style issues in the new regression test; I’ve corrected them and am rerunning lint, the source type check, and the focused test.

Fixed `isDeepEqual` to treat null-prototype objects like plain objects, in both argument orders, nested comparisons, and curried calls. Different class prototypes remain unequal.

Added regression coverage for both examples and edge cases.

Validation passed: all 305 test files, type checks, build, and lint.

</details>

### codex, all: pass

Files: [packages/remeda/src/isDeepEqual.test.ts](../all/codex/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.test.ts), [packages/remeda/src/isDeepEqual.ts](../all/codex/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.test.ts b/packages/remeda/src/isDeepEqual.test.ts
index 8c50b5e..f05d64d 100644
--- a/packages/remeda/src/isDeepEqual.test.ts
+++ b/packages/remeda/src/isDeepEqual.test.ts
@@ -1,3 +1,4 @@
+import { parse } from "node:querystring";
 import { describe, expect, test } from "vitest";
 import { isDeepEqual } from "./isDeepEqual";
 
@@ -76,6 +77,42 @@ describe("scalars", () => {
 });
 
 describe("objects", () => {
+  test("null-prototype objects compare by contents in both argument orders", () => {
+    class Example {
+      public a = 1;
+    }
+
+    for (const [data, other, expected] of [
+      [parse("a=1&b=2"), { a: "1", b: "2" }, true],
+      [Object.assign(Object.create(null), { a: 1 }), { a: 1 }, true],
+      [Object.create(null), {}, true],
+      [parse("a=1"), parse("a=1"), true],
+      [{ nested: [parse("a=1")] }, { nested: [{ a: "1" }] }, true],
+      [parse("a=1"), { a: "2" }, false],
+      [parse("a=1"), { b: "1" }, false],
+      [parse("a=1"), { a: "1", b: "2" }, false],
+      [Object.create(null), [], false],
+      [Object.create(null), new Date(0), false],
+      [Object.create(null), new Map(), false],
+      [Object.create(null), new Set(), false],
+      [Object.create(null), /a/u, false],
+      [Object.assign(Object.create(null), { a: 1 }), new Example(), false],
+      [{ a: 1 }, new Example(), false],
+      [
+        Object.assign(Object.create(null), {
+          constructor: Object,
+        }),
+        { a: 1 },
+        false,
+      ],
+    ] as const) {
+      expect(isDeepEqual(data, other)).toBe(expected);
+      expect(isDeepEqual(other, data)).toBe(expected);
+      expect(isDeepEqual(other)(data)).toBe(expected);
+      expect(isDeepEqual(data)(other)).toBe(expected);
+    }
+  });
+
   test("empty objects are equal", () => {
     expect(isDeepEqual({}, {})).toBe(true);
   });
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..8714cd5 100644
--- a/packages/remeda/src/isDeepEqual.ts
+++ b/packages/remeda/src/isDeepEqual.ts
@@ -4,7 +4,8 @@ import { purry } from "./purry";
  * Performs a *deep structural* comparison between two values to determine if
  * they are equivalent. For primitive values this is equivalent to `===`, for
  * arrays the check would be performed on every item recursively, in order, and
- * for objects all props will be compared recursively.
+ * for objects all props will be compared recursively. Plain objects and objects
+ * with a null prototype are compared by their contents.
  *
  * The built-in Date and RegExp are special-cased and will be compared by their
  * values.
@@ -43,7 +44,8 @@ export function isDeepEqual<T>(data: T, other: T): boolean;
  * Performs a *deep structural* comparison between two values to determine if
  * they are equivalent. For primitive values this is equivalent to `===`, for
  * arrays the check would be performed on every item recursively, in order, and
- * for objects all props will be compared recursively.
+ * for objects all props will be compared recursively. Plain objects and objects
+ * with a null prototype are compared by their contents.
  *
  * The built-in Date and RegExp are special-cased and will be compared by their
  * values.
@@ -99,14 +101,10 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return false;
   }
 
-  if (Object.getPrototypeOf(data) !== Object.getPrototypeOf(other)) {
-    // If the objects don't share a prototype it's unlikely that they are
-    // semantically equal. It is technically possible to build 2 prototypes that
-    // act the same but are not equal (at the reference level, checked via
-    // `===`) and then create 2 objects that are equal although we would fail on
-    // them. Because this is so unlikely, the optimization we gain here for the
-    // rest of the function by assuming that `other` is of the same type as
-    // `data` is more than worth it.
+  if (
+    (Object.getPrototypeOf(data) ?? Object.prototype) !==
+    (Object.getPrototypeOf(other) ?? Object.prototype)
+  ) {
     return false;
   }
 
@@ -130,7 +128,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return data.toString() === (other as unknown as RegExp).toString();
   }
 
-  // At this point we only know that the 2 objects share a prototype and are not
+  // At this point we only know that the 2 objects have compatible prototypes and are not
   // any of the previous types. They could be plain objects (Object.prototype),
   // they could be classes, they could be other built-ins, or they could be
   // something weird. We assume that comparing values by keys is enough to judge
@@ -141,7 +139,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
   }
 
   for (const [key, value] of Object.entries(data)) {
-    if (!(key in other)) {
+    if (!Object.hasOwn(other, key)) {
       return false;
     }
```

</details>

<details><summary>reply</summary>

Null-prototype equality needs shared comparison fix and regression tests.


Done.
`isDeepEqual` handles null prototypes in both orders and nested values; class checks preserved. Regression tests added. Runtime tests, type tests, build, lint passed.

</details>
