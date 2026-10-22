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
| claude | muffle | pass | +7/-1 | 34 | 3,388 | $0.109 |
| claude | hush | pass | +7/-1 | 39 | 2,307 | $0.093 |
| claude | sloth | pass | +10/-2 | 0 | 4,698 | $0.192 |
| claude | all | pass | +8/-1 | 0 | 1,757 | $0.080 |
| codex | base | pass | +10/-10 | 61 | 2,666 | - |
| codex | muffle | pass | +10/-10 | 63 | 2,354 | - |
| codex | hush | pass | +6/-2 | 47 | 1,826 | - |
| codex | sloth | pass | +5/-9 | 0 | 1,550 | - |
| codex | all | pass | +6/-10 | 0 | 1,301 | - |

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
index 8c50b5e..bed17ab 100644
--- a/packages/remeda/src/isDeepEqual.test.ts
+++ b/packages/remeda/src/isDeepEqual.test.ts
@@ -399,8 +399,42 @@ describe("sample objects", () => {
       ),
     ).toBe(true);
   });
+
+  describe("null prototype objects", () => {
+    test("equals a plain object in both orders", () => {
+      expect(isDeepEqual(nullProto({ a: 1 }), { a: 1 })).toBe(true);
+      expect(isDeepEqual({ a: 1 }, nullProto({ a: 1 }))).toBe(true);
+      expect(isDeepEqual(nullProto({ a: 1 }), nullProto({ a: 1 }))).toBe(true);
+    });
+
+    test("equals a plain object when nested", () => {
+      expect(
+        isDeepEqual([{ x: nullProto({ a: 1 }) }], [{ x: { a: 1 } }]),
+      ).toBe(true);
+    });
+
+    test("detects differing contents", () => {
+      expect(isDeepEqual(nullProto({ a: 1 }), { a: 2 })).toBe(false);
+      expect(isDeepEqual({ a: 1 }, nullProto({ a: 1, b: 2 }))).toBe(false);
+    });
+
+    test("doesn't equal class instances, arrays, or maps", () => {
+      class Foo {
+        public a = 1;
+      }
+
+      expect(isDeepEqual(nullProto({ a: 1 }), new Foo())).toBe(false);
+      expect(isDeepEqual(new Foo(), nullProto({ a: 1 }))).toBe(false);
+      expect(isDeepEqual(nullProto({}), [])).toBe(false);
+      expect(isDeepEqual(new Map(), nullProto({}))).toBe(false);
+    });
+  });
 });
 
+function nullProto(obj: object): object {
+  return Object.assign(Object.create(null) as object, obj);
+}
+
 /* v8 ignore next 3 -- We only need the function pointer, we never call it! */
 function func1(): void {
   throw new Error("This function should never be called!");
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..6b63679 100644
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
@@ -159,6 +159,12 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
   return true;
 }
 
+// Objects with a `null` prototype (e.g. the result of `querystring.parse`, or
+// `Object.create(null)`) are semantically plain objects, so we compare them as
+// if they had `Object.prototype`.
+const getPrototype = (value: object): object =>
+  (Object.getPrototypeOf(value) as object | null) ?? Object.prototype;
+
 function isDeepEqualArrays(
   data: readonly unknown[],
   other: readonly unknown[],
```

</details>

<details><summary>reply</summary>

The first call failed on the tool name, so I'll rerun the edit.

Switch to `test`, fix lint issues.

Move the helper to the outer scope.

`isDeepEqual` now treats a null-prototype object like a plain object, so both of your examples return `true`. The `isDeepEqual` tests, `tsc` and `eslint` all pass.

**Cause:** the prototype check compared `Object.getPrototypeOf` results directly. `null` never equals `Object.prototype`, so the comparison returned `false` straight away.

**Fix:** in `packages/remeda/src/isDeepEqual.ts`, a small `getPrototype` helper maps a `null` prototype to `Object.prototype` before the comparison.

- **Argument order and nesting:** it works in either argument order and when the objects are nested, because the comparison is recursive.
- **Class instances:** instances of different classes are still unequal, as are a null-prototype object and an array or `Map`.

**Tests:** I added tests in `isDeepEqual.test.ts` covering both orders, nesting, differing contents, and the class, array and `Map` cases.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [packages/remeda/src/isDeepEqual.test.ts](../hush/claude/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.test.ts), [packages/remeda/src/isDeepEqual.ts](../hush/claude/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.test.ts b/packages/remeda/src/isDeepEqual.test.ts
index 8c50b5e..257c085 100644
--- a/packages/remeda/src/isDeepEqual.test.ts
+++ b/packages/remeda/src/isDeepEqual.test.ts
@@ -151,6 +151,45 @@ describe("objects", () => {
   test("undefined and empty object are not equal", () => {
     expect(isDeepEqual(undefined as unknown, {})).toBe(false);
   });
+
+  describe("null-prototype objects", () => {
+    const nullProto = (obj: object): unknown =>
+      Object.assign(Object.create(null), obj);
+
+    test("equal to plain object", () => {
+      expect(isDeepEqual(nullProto({ a: 1 }), { a: 1 })).toBe(true);
+    });
+
+    test("equal to plain object, reversed", () => {
+      expect(isDeepEqual({ a: 1 } as unknown, nullProto({ a: 1 }))).toBe(true);
+    });
+
+    test("equal to each other", () => {
+      expect(isDeepEqual(nullProto({ a: 1 }), nullProto({ a: 1 }))).toBe(true);
+    });
+
+    test("nested", () => {
+      expect(
+        isDeepEqual({ x: [nullProto({ a: 1 })] } as unknown, {
+          x: [{ a: 1 }],
+        }),
+      ).toBe(true);
+    });
+
+    test("different contents are not equal", () => {
+      expect(isDeepEqual(nullProto({ a: 1 }), { a: 2 })).toBe(false);
+    });
+
+    test("not equal to class instances", () => {
+      class Foo {
+        public a = 1;
+      }
+      expect(isDeepEqual(nullProto({ a: 1 }), new Foo())).toBe(false);
+      expect(isDeepEqual(new Foo() as unknown, nullProto({ a: 1 }))).toBe(
+        false,
+      );
+    });
+  });
 });
 
 describe("sets", () => {
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..bead25f 100644
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
@@ -159,6 +159,12 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
   return true;
 }
 
+// Objects with a `null` prototype (e.g. from `querystring.parse`) are plain
+// objects for all practical purposes, so they are compared as such.
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

Done. `isDeepEqual` now treats null-prototype objects as plain objects, in both argument orders and when nested. Class instances still don't equal them. The fix is in `src/isDeepEqual.ts`, and I added tests for it. The `isDeepEqual` tests and the type check pass. I didn't run lint or the full suite.

</details>

### claude, sloth: pass

Files: [packages/remeda/src/isDeepEqual.ts](../sloth/claude/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..6a62d86 100644
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
@@ -141,7 +141,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
   }
 
   for (const [key, value] of Object.entries(data)) {
-    if (!(key in other)) {
+    if (!Object.hasOwn(other, key)) {
       return false;
     }
 
@@ -159,6 +159,14 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
   return true;
 }
 
+/**
+ * Objects with a `null` prototype (e.g. the result of `querystring.parse`) are
+ * structurally plain objects, so they are treated as having `Object.prototype`.
+ */
+function getPrototype(value: object): object {
+  return (Object.getPrototypeOf(value) as object | null) ?? Object.prototype;
+}
+
 function isDeepEqualArrays(
   data: readonly unknown[],
   other: readonly unknown[],
```

</details>

<details><summary>reply</summary>

`isDeepEqual` now treats a `null`-prototype object like a plain object, so your two examples return `true`. The existing `isDeepEqual` tests pass, along with a throwaway test I wrote and then deleted. It covered both argument orders, a nested case, and a `null`-prototype object against a class instance (still `false`). The `tsc` and `eslint` runs printed only `npx` notices, no errors, but I didn't confirm their exit codes.

The change is in `packages/remeda/src/isDeepEqual.ts`. The prototype check now maps a `null` prototype to `Object.prototype` before comparing. Objects of different classes still compare as unequal.

I also changed the key check from `key in other` to `Object.hasOwn(other, key)`. Without that, a `null`-prototype object with an own key like `toString` could wrongly match a plain object that only inherits `toString`. Plain-versus-plain comparisons are affected the same way: an inherited key no longer counts as a match for an own key.

I didn't add a permanent test, since you didn't ask for one. Nothing is committed.

The background command from my first attempt was stopped after it hit its time limit. It ran the file edit, then `vitest`, `tsc` and `eslint` in one chain. The edit had already been applied, and I'd reran the tests separately, so nothing needs restarting.

- **Tests:** the separate `vitest` run passed (67 tests, no type errors).
- **`tsc` and `eslint`:** in my later re-run these printed only `npx` notices and no errors. That output doesn't prove they passed, since I didn't confirm exit codes. If you want certainty, run `npx tsc --noEmit` and `npx eslint src/isDeepEqual.ts` in `packages/remeda`.

The fix in `packages/remeda/src/isDeepEqual.ts` is unchanged, and nothing is committed.

</details>

### claude, all: pass

Files: [packages/remeda/src/isDeepEqual.ts](../all/claude/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..22331a5 100644
--- a/packages/remeda/src/isDeepEqual.ts
+++ b/packages/remeda/src/isDeepEqual.ts
@@ -80,6 +80,13 @@ export function isDeepEqual(...args: readonly unknown[]): unknown {
   return purry(isDeepEqualImplementation, args);
 }
 
+/**
+ * Prototype of an object, where a `null` prototype is treated as
+ * `Object.prototype` so that null-prototype objects compare like plain objects.
+ */
+const prototypeOf = (object: object): unknown =>
+  Object.getPrototypeOf(object) ?? Object.prototype;
+
 function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
   if (data === other) {
     return true;
@@ -99,7 +106,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return false;
   }
 
-  if (Object.getPrototypeOf(data) !== Object.getPrototypeOf(other)) {
+  if (prototypeOf(data) !== prototypeOf(other)) {
     // If the objects don't share a prototype it's unlikely that they are
     // semantically equal. It is technically possible to build 2 prototypes that
     // act the same but are not equal (at the reference level, checked via
```

</details>

<details><summary>reply</summary>

Done. `isDeepEqual` in `packages/remeda/src/isDeepEqual.ts` now treats a `null` prototype as `Object.prototype`, so it works in both argument orders and when nested. Existing tests and `tsc` pass. I checked your cases with a throwaway test, then deleted it. I added no permanent test.

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
index 8c50b5e..3f637ca 100644
--- a/packages/remeda/src/isDeepEqual.test.ts
+++ b/packages/remeda/src/isDeepEqual.test.ts
@@ -1,3 +1,4 @@
+import { parse } from "node:querystring";
 import { describe, expect, test } from "vitest";
 import { isDeepEqual } from "./isDeepEqual";
 
@@ -80,6 +81,68 @@ describe("objects", () => {
     expect(isDeepEqual({}, {})).toBe(true);
   });
 
+  describe("null prototypes", () => {
+    test("compares querystring.parse results with plain objects", () => {
+      const data = parse("a=1&b=2");
+      const other = { a: "1", b: "2" };
+
+      expect(isDeepEqual(data, other)).toBe(true);
+      expect(isDeepEqual(other, data)).toBe(true);
+    });
+
+    test.each([
+      [{}, {}, true],
+      [{ a: 1 }, { a: 1 }, true],
+      [{ a: 1 }, { a: 2 }, false],
+      [{ a: 1 }, { b: 1 }, false],
+      [{ a: 1 }, {}, false],
+      [{ constructor: Object }, { toString: Object }, false],
+    ])("compares %j with %j as %s", (data, other, expected) => {
+      const nullPrototype: unknown = Object.assign(Object.create(null), data);
+
+      expect(isDeepEqual(nullPrototype, other)).toBe(expected);
+      expect(isDeepEqual(other, nullPrototype)).toBe(expected);
+      expect(isDeepEqual(other)(nullPrototype)).toBe(expected);
+      expect(isDeepEqual(nullPrototype)(other)).toBe(expected);
+    });
+
+    test("compares nested objects", () => {
+      const data = { a: [Object.assign(Object.create(null), { b: 1 })] };
+      const other = { a: [{ b: 1 }] };
+
+      expect(isDeepEqual(data, other)).toBe(true);
+      expect(isDeepEqual(other, data)).toBe(true);
+    });
+
+    test.each([
+      [],
+      new Map(),
+      new Set(),
+      new Date(),
+      /a/u,
+      new (class {
+        public a = 1;
+      })(),
+    ])("does not equate null prototypes with instances (%j)", (instance) => {
+      const nullPrototype: unknown = Object.create(null);
+
+      expect(isDeepEqual(nullPrototype, instance)).toBe(false);
+      expect(isDeepEqual(instance, nullPrototype)).toBe(false);
+    });
+
+    test("preserves comparisons between different classes", () => {
+      class First {
+        public a = 1;
+      }
+      class Second {
+        public a = 1;
+      }
+
+      expect(isDeepEqual(new First(), new Second())).toBe(false);
+      expect(isDeepEqual(new First(), { a: 1 })).toBe(false);
+    });
+  });
+
   test('equal objects (same properties "order")', () => {
     expect(isDeepEqual({ a: 1, b: "2" }, { a: 1, b: "2" })).toBe(true);
   });
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..c7110a7 100644
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
+    // Plain objects and null-prototype objects are compared by their contents.
+    // All other objects must share a prototype so that classes and built-ins
+    // remain distinct and the type-specific comparisons below are safe.
     return false;
   }
 
@@ -130,7 +130,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return data.toString() === (other as unknown as RegExp).toString();
   }
 
-  // At this point we only know that the 2 objects share a prototype and are not
+  // At this point the objects have compatible prototypes and are not
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

I’ll check the prototype comparison, update it to handle null-prototype objects, and add regression tests for both argument orders and nested values.

The regression tests reproduced the failure. The fix allows null and plain-object prototypes to compare by contents while preserving prototype checks for classes and built-ins. I also found an inherited-property edge case that could make results differ by argument order, so the comparison now checks for own properties.

Fixed `isDeepEqual` to compare null-prototype objects with plain objects by contents, in both argument orders and when nested. Different class and built-in prototypes remain distinct.

Added regression coverage for `querystring.parse`, curried calls, unequal contents, and inherited-property edge cases.

Validation: all 81 tests in `isDeepEqual.test.ts` pass; ESLint and TypeScript checks pass.

</details>

### codex, hush: pass

Files: [packages/remeda/src/isDeepEqual.test.ts](../hush/codex/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.test.ts), [packages/remeda/src/isDeepEqual.ts](../hush/codex/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.test.ts b/packages/remeda/src/isDeepEqual.test.ts
index 8c50b5e..e56a419 100644
--- a/packages/remeda/src/isDeepEqual.test.ts
+++ b/packages/remeda/src/isDeepEqual.test.ts
@@ -1,3 +1,4 @@
+import { parse } from "node:querystring";
 import { describe, expect, test } from "vitest";
 import { isDeepEqual } from "./isDeepEqual";
 
@@ -153,6 +154,52 @@ describe("objects", () => {
   });
 });
 
+describe("null-prototype objects", () => {
+  const nullPrototype = (
+    props: Readonly<Record<string, unknown>>,
+  ): Record<string, unknown> =>
+    Object.assign(Object.create(null) as Record<string, unknown>, props);
+
+  class Example {
+    public a = 1;
+  }
+
+  test.each([
+    ["empty objects", nullPrototype({}), {}, true],
+    ["matching properties", nullPrototype({ a: 1 }), { a: 1 }, true],
+    ["query strings", parse("a=1&b=2"), { a: "1", b: "2" }, true],
+    [
+      "two null prototypes",
+      nullPrototype({ a: 1 }),
+      nullPrototype({ a: 1 }),
+      true,
+    ],
+    ["different values", nullPrototype({ a: 1 }), { a: 2 }, false],
+    ["different keys", nullPrototype({ a: 1 }), { b: 1 }, false],
+    ["extra keys", nullPrototype({ a: 1 }), { a: 1, b: 2 }, false],
+    [
+      "nested objects",
+      { nested: nullPrototype({ a: 1 }) },
+      { nested: { a: 1 } },
+      true,
+    ],
+    ["nested arrays", [nullPrototype({ a: 1 })], [{ a: 1 }], true],
+    ["class instances", nullPrototype({ a: 1 }), new Example(), false],
+    ["plain objects and classes", { a: 1 }, new Example(), false],
+    ["custom prototypes", nullPrototype({}), Object.create({}), false],
+    ["arrays", nullPrototype({}), [], false],
+    ["maps", nullPrototype({}), new Map(), false],
+    ["sets", nullPrototype({}), new Set(), false],
+    ["dates", nullPrototype({}), new Date(0), false],
+    ["regular expressions", nullPrototype({}), /a/u, false],
+  ])("%s", (_name, data, other, expected) => {
+    expect(isDeepEqual(data, other)).toBe(expected);
+    expect(isDeepEqual(other, data)).toBe(expected);
+    expect(isDeepEqual(other)(data)).toBe(expected);
+    expect(isDeepEqual(data)(other)).toBe(expected);
+  });
+});
+
 describe("sets", () => {
   test("two empty sets should be equal", () => {
     expect(isDeepEqual(new Set(), new Set())).toBe(true);
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..e356e6e 100644
--- a/packages/remeda/src/isDeepEqual.ts
+++ b/packages/remeda/src/isDeepEqual.ts
@@ -99,7 +99,10 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return false;
   }
 
-  if (Object.getPrototypeOf(data) !== Object.getPrototypeOf(other)) {
+  if (
+    (Object.getPrototypeOf(data) ?? Object.prototype) !==
+    (Object.getPrototypeOf(other) ?? Object.prototype)
+  ) {
     // If the objects don't share a prototype it's unlikely that they are
     // semantically equal. It is technically possible to build 2 prototypes that
     // act the same but are not equal (at the reference level, checked via
@@ -130,7 +133,8 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return data.toString() === (other as unknown as RegExp).toString();
   }
 
-  // At this point we only know that the 2 objects share a prototype and are not
+  // At this point the objects share a prototype (treating null prototypes as
+  // Object.prototype) and are not
   // any of the previous types. They could be plain objects (Object.prototype),
   // they could be classes, they could be other built-ins, or they could be
   // something weird. We assume that comparing values by keys is enough to judge
```

</details>

<details><summary>reply</summary>

Done.
`isDeepEqual` matches null-prototype/plain objects both ways, including nested values; preserves class checks. 83 tests, lint, type check passed.

</details>

### codex, sloth: pass

Files: [packages/remeda/src/isDeepEqual.ts](../sloth/codex/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..c9dc533 100644
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
 
@@ -130,7 +126,7 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return data.toString() === (other as unknown as RegExp).toString();
   }
 
-  // At this point we only know that the 2 objects share a prototype and are not
+  // At this point we only know that the 2 objects have compatible prototypes and are not
   // any of the previous types. They could be plain objects (Object.prototype),
   // they could be classes, they could be other built-ins, or they could be
   // something weird. We assume that comparing values by keys is enough to judge
```

</details>

<details><summary>reply</summary>

I’ll check the prototype comparison and its callers, then make the smallest fix that preserves class-instance distinctions.

The fix belongs in the shared recursive implementation, so it will cover both argument orders, nested values, curried calls, and `hasSubObject`. I’ll treat `null` and `Object.prototype` as equivalent during the prototype check; other prototypes will still have to match. No exports, fixtures, config, or caller changes are needed. I’ll keep this to the fix and run the existing tests without adding new ones.

Fixed `isDeepEqual` to treat null-prototype objects like plain objects, including both argument orders, curried calls, and nested values. Different class prototypes still compare unequal.

Validation passed: build, TypeScript check, all 305 existing test files, and manual checks using `querystring.parse`.

</details>

### codex, all: pass

Files: [packages/remeda/src/isDeepEqual.ts](../all/codex/ts-remeda-deep-equal-null-proto-1/files/packages/remeda/src/isDeepEqual.ts)

<details><summary>diff</summary>

```diff
diff --git a/packages/remeda/src/isDeepEqual.ts b/packages/remeda/src/isDeepEqual.ts
index 4e7a239..a24715d 100644
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
 
@@ -130,8 +126,8 @@ function isDeepEqualImplementation<T>(data: unknown, other: T): data is T {
     return data.toString() === (other as unknown as RegExp).toString();
   }
 
-  // At this point we only know that the 2 objects share a prototype and are not
-  // any of the previous types. They could be plain objects (Object.prototype),
+  // At this point the objects have compatible prototypes and are not any of
+  // the previous types. They could be plain objects (Object.prototype or null),
   // they could be classes, they could be other built-ins, or they could be
   // something weird. We assume that comparing values by keys is enough to judge
   // their equality.
```

</details>

<details><summary>reply</summary>

Done.
`isDeepEqual` handles null/plain prototypes both ways, nested; class distinctions kept. Build, typecheck, 2,167 tests, regression checks passed.

</details>
