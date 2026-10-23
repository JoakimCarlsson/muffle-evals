# rust-http-headermap-size-hint

Source: https://github.com/hyperium/http/pull/870

## Prompt

> `size_hint` on the iterator from `http::HeaderMap::iter` can report a lower bound of 1 when the iterator actually has 0 elements left. The `Iterator` docs say an implementation should give a correct estimate, otherwise it violates the trait's protocol.
> 
> Version: http 1.5.0, Linux x86_64.
> 
> ```rust
> fn main() {
>     let mut m: http::HeaderMap<http::HeaderValue> = Default::default();
>     m.insert(http::header::HOST, http::HeaderValue::from_static("x"));
>     let mut it = m.iter();
>     let (lo, _) = std::iter::Iterator::size_hint(&it); let a = it.next(); // (1,_), Some
>     let (lo, _) = std::iter::Iterator::size_hint(&it); let b = it.next(); // (1,_), None <- bug
>     assert!(!(lo >= 1 && b.is_none()), "size_hint lower bound {lo} > 0 but next() == None");
>     let _ = a;
> }
> ```
> 
> Expected: `size_hint` is accurate. Actual: it is not.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [src/header/map.rs](../../tasks/rust-http-headermap-size-hint/upstream/src/header/map.rs), [tests/header_map.rs](../../tasks/rust-http-headermap-size-hint/upstream/tests/header_map.rs)

```diff
diff --git a/src/header/map.rs b/src/header/map.rs
index 08a1b8b..e16d631 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,11 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        let mut lower = map.entries.len() - self.entry;
+        if self.cursor.is_none() {
+            // The current entry is exhausted. Saturate for an empty map.
+            lower = lower.saturating_sub(1);
+        }
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2457,11 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        let mut lower = self.entries_len - self.entry;
+        if self.cursor.is_none() {
+            // The current entry is exhausted. Saturate for an empty map.
+            lower = lower.saturating_sub(1);
+        }
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +12/-2 | 24 | 1,528 | $0.079 |
| claude | muffle | pass | +12/-2 | 23 | 1,723 | $0.073 |
| claude | hush | pass | +4/-2 | 17 | 1,947 | $0.094 |
| claude | sloth | pass | +36/-2 | 0 | 1,939 | $0.082 |
| claude | all | pass | +2/-2 | 25 | 1,625 | $0.090 |
| codex | base | pass | +10/-2 | 35 | 1,533 | - |
| codex | muffle | pass | +10/-2 | 34 | 1,276 | - |
| codex | hush | pass | +4/-2 | 32 | 1,106 | - |
| codex | sloth | pass | +4/-2 | 35 | 1,485 | - |
| codex | all | pass | +4/-2 | 36 | 1,188 | - |

### claude, base: pass

Files: [src/header/map.rs](../base/claude/rust-http-headermap-size-hint-1/files/src/header/map.rs), [tests/header_map.rs](../base/claude/rust-http-headermap-size-hint-1/files/tests/header_map.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/header/map.rs b/src/header/map.rs
index 08a1b8b..938fcde 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,12 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        // When the cursor is `None`, the entry at `self.entry` is exhausted.
+        let lower = if self.cursor.is_some() {
+            map.entries.len() - self.entry
+        } else {
+            (map.entries.len() - self.entry).saturating_sub(1)
+        };
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2458,12 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        // When the cursor is `None`, the entry at `self.entry` is exhausted.
+        let lower = if self.cursor.is_some() {
+            self.entries_len - self.entry
+        } else {
+            (self.entries_len - self.entry).saturating_sub(1)
+        };
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
diff --git a/tests/header_map.rs b/tests/header_map.rs
index f621013..2a0f27c 100644
--- a/tests/header_map.rs
+++ b/tests/header_map.rs
@@ -772,3 +772,27 @@ fn into_iter_drop_panic_after_yielding_extra_value_double_drops() {
 
     let _ = catch_unwind(AssertUnwindSafe(|| drop(iter)));
 }
+
+#[test]
+fn iter_size_hint_lower_bound_is_accurate() {
+    let mut m: HeaderMap<HeaderValue> = HeaderMap::new();
+    m.insert(HOST, HeaderValue::from_static("x"));
+    m.append(HOST, HeaderValue::from_static("y"));
+    m.insert(ACCEPT, HeaderValue::from_static("z"));
+    let mut it = m.iter();
+    loop {
+        let (lo, _) = it.size_hint();
+        if it.next().is_none() {
+            assert_eq!(lo, 0);
+            break;
+        }
+    }
+    let mut it = m.iter_mut();
+    loop {
+        let (lo, _) = it.size_hint();
+        if it.next().is_none() {
+            assert_eq!(lo, 0);
+            break;
+        }
+    }
+}
```

</details>

<details><summary>reply</summary>

I fixed `size_hint` so it no longer reports a lower bound of 1 once the iterator is exhausted. The `header_map` test file passes (36 tests), including a new regression test.

**Cause:** the lower bound was `entries.len() - self.entry`. That assumes the entry at `self.entry` is still waiting to be yielded. After the last value of an entry is yielded, the cursor is `None` and that entry is already used up. For a one-entry map the bound therefore stayed at 1 after the only item was returned.

**Fix:** in `src/header/map.rs`, when the cursor is `None` the current entry no longer counts. The subtraction saturates, so an empty map gives 0. I applied the same change to `IterMut::size_hint`, which had the same bug.

**Test:** `iter_size_hint_lower_bound_is_accurate` in `tests/header_map.rs` covers both `iter` and `iter_mut`. It uses a map that includes a multi-value header. It asserts that the lower bound is 0 whenever `next()` returns `None`.

I haven't committed anything.

</details>

### claude, muffle: pass

Files: [src/header/map.rs](../muffle/claude/rust-http-headermap-size-hint-1/files/src/header/map.rs), [tests/header_map.rs](../muffle/claude/rust-http-headermap-size-hint-1/files/tests/header_map.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/header/map.rs b/src/header/map.rs
index 08a1b8b..e1669d9 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,12 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        // With no cursor, the current entry is exhausted (or the map is empty).
+        let lower = if self.cursor.is_some() {
+            map.entries.len() - self.entry
+        } else {
+            (map.entries.len() - self.entry).saturating_sub(1)
+        };
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2458,12 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        // With no cursor, the current entry is exhausted (or the map is empty).
+        let lower = if self.cursor.is_some() {
+            self.entries_len - self.entry
+        } else {
+            (self.entries_len - self.entry).saturating_sub(1)
+        };
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
diff --git a/tests/header_map.rs b/tests/header_map.rs
index f621013..284d7cd 100644
--- a/tests/header_map.rs
+++ b/tests/header_map.rs
@@ -772,3 +772,26 @@ fn into_iter_drop_panic_after_yielding_extra_value_double_drops() {
 
     let _ = catch_unwind(AssertUnwindSafe(|| drop(iter)));
 }
+
+#[test]
+fn iter_size_hint_lower_bound_is_accurate() {
+    let mut m: HeaderMap<HeaderValue> = HeaderMap::new();
+    assert_eq!(m.iter().size_hint().0, 0);
+    m.insert(HOST, HeaderValue::from_static("x"));
+    let mut it = m.iter();
+    assert_eq!(it.size_hint().0, 1);
+    it.next();
+    assert_eq!(it.size_hint().0, 0);
+    assert!(it.next().is_none());
+
+    m.append(HOST, HeaderValue::from_static("y"));
+    m.insert(ACCEPT, HeaderValue::from_static("z"));
+    let mut it = m.iter();
+    let mut left = 3;
+    while left > 0 {
+        assert!(it.size_hint().0 <= left);
+        it.next();
+        left -= 1;
+    }
+    assert_eq!(it.size_hint().0, 0);
+}
```

</details>

<details><summary>reply</summary>

Fixed in `src/header/map.rs`. Both `Iter::size_hint` and `IterMut::size_hint` now report a correct lower bound, and the `header_map` tests pass. I only ran that test target, not the full suite.

**Cause:** `entry` is the index of the entry currently being iterated. When the iterator has no cursor, that entry is already fully consumed. The old code computed `len - entry`, which counted it again. That's why your example reported `(1, _)` just before `next()` returned `None`.

**Fix:** With a cursor, the lower bound stays `len - entry`. Without a cursor, it is `len - entry - 1`, using `saturating_sub` so an empty map gives 0.

I added a regression test in `tests/header_map.rs`, `iter_size_hint_lower_bound_is_accurate`. It covers an empty map, a single entry, and a map with a multi-value header. I didn't confirm that the new test fails on the old code.

I made no commit.

</details>

### claude, hush: pass

Files: [src/header/map.rs](../hush/claude/rust-http-headermap-size-hint-1/files/src/header/map.rs), [tests/header_map.rs](../hush/claude/rust-http-headermap-size-hint-1/files/tests/header_map.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/header/map.rs b/src/header/map.rs
index 08a1b8b..4d100a6 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,8 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        // The current entry is exhausted once the cursor is `None`.
+        let lower = (map.entries.len() - self.entry).saturating_sub(self.cursor.is_none() as usize);
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2454,8 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        // The current entry is exhausted once the cursor is `None`.
+        let lower = (self.entries_len - self.entry).saturating_sub(self.cursor.is_none() as usize);
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
diff --git a/tests/header_map.rs b/tests/header_map.rs
index f621013..188a730 100644
--- a/tests/header_map.rs
+++ b/tests/header_map.rs
@@ -772,3 +772,20 @@ fn into_iter_drop_panic_after_yielding_extra_value_double_drops() {
 
     let _ = catch_unwind(AssertUnwindSafe(|| drop(iter)));
 }
+
+#[test]
+fn iter_size_hint_lower_bound_is_accurate() {
+    let mut m: HeaderMap<HeaderValue> = HeaderMap::new();
+    assert_eq!(m.iter().size_hint().0, 0);
+    assert_eq!(m.iter_mut().size_hint().0, 0);
+    m.insert(HOST, HeaderValue::from_static("x"));
+    let mut it = m.iter();
+    assert_eq!(it.size_hint().0, 1);
+    it.next();
+    assert_eq!(it.size_hint().0, 0);
+    assert!(it.next().is_none());
+    let mut it = m.iter_mut();
+    assert_eq!(it.size_hint().0, 1);
+    it.next();
+    assert_eq!(it.size_hint().0, 0);
+}
```

</details>

<details><summary>reply</summary>

Done. `Iter::size_hint` and `IterMut::size_hint` in `src/header/map.rs` now subtract 1 from the lower bound once the current entry is exhausted. I added a regression test in `tests/header_map.rs`, and the full test suite passes. Nothing is committed.

</details>

### claude, sloth: pass

Files: [src/header/map.rs](../sloth/claude/rust-http-headermap-size-hint-1/files/src/header/map.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/header/map.rs b/src/header/map.rs
index 08a1b8b..5754d28 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,7 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        let lower = (map.entries.len() - self.entry).saturating_sub(self.cursor.is_none() as usize);
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2453,7 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        let lower = (self.entries_len - self.entry).saturating_sub(self.cursor.is_none() as usize);
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -4051,3 +4051,37 @@ fn skip_duplicates_during_key_iteration() {
     map.try_append("a", HeaderValue::from_static("b")).unwrap();
     assert_eq!(map.keys().count(), map.keys_len());
 }
+
+#[test]
+fn iter_size_hint_lower_bound_is_never_too_high() {
+    let mut map = HeaderMap::new();
+    assert_eq!(map.iter().size_hint().0, 0);
+    map.try_insert(super::HOST, HeaderValue::from_static("x"))
+        .unwrap();
+    map.try_append(super::ACCEPT, HeaderValue::from_static("a"))
+        .unwrap();
+    map.try_append(super::ACCEPT, HeaderValue::from_static("b"))
+        .unwrap();
+
+    let mut it = map.iter();
+    let mut remaining = 3;
+    loop {
+        assert!(it.size_hint().0 <= remaining);
+        if it.next().is_none() {
+            break;
+        }
+        remaining -= 1;
+    }
+    assert_eq!(it.size_hint().0, 0);
+
+    let mut it = map.iter_mut();
+    let mut remaining = 3;
+    loop {
+        assert!(it.size_hint().0 <= remaining);
+        if it.next().is_none() {
+            break;
+        }
+        remaining -= 1;
+    }
+    assert_eq!(it.size_hint().0, 0);
+}
```

</details>

<details><summary>reply</summary>

`HeaderMap::iter()` no longer reports a lower bound of 1 when it has 0 elements left. `iter_mut()` had the same bug, so I fixed both. The lib tests pass (143), and I didn't run the doc or integration tests.

`size_hint` counted the entry the iterator was on as still pending, even after that entry's last value had been yielded. In your example, `size_hint` read `(1, _)` just before the final `next()` returned `None`. The fix is in `src/header/map.rs`: the lower bound now drops that entry once it's finished. It uses `saturating_sub` so an empty map gives 0 instead of underflowing.

I added one test, `iter_size_hint_lower_bound_is_never_too_high`. It uses an empty map and a map with a multi-value key, and checks that `iter()` and `iter_mut()` never report a lower bound above what's left. It also checks they report 0 once exhausted.

I made no commit.

</details>

### claude, all: pass

Files: [src/header/map.rs](../all/claude/rust-http-headermap-size-hint-1/files/src/header/map.rs), [tests/header_map.rs](../all/claude/rust-http-headermap-size-hint-1/files/tests/header_map.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/header/map.rs b/src/header/map.rs
index 08a1b8b..8069799 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,7 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        let lower = (map.entries.len() - self.entry).saturating_sub(self.cursor.is_none() as usize);
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2453,7 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        let lower = (self.entries_len - self.entry).saturating_sub(self.cursor.is_none() as usize);
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
diff --git a/tests/header_map.rs b/tests/header_map.rs
index f621013..685be57 100644
--- a/tests/header_map.rs
+++ b/tests/header_map.rs
@@ -772,3 +772,28 @@ fn into_iter_drop_panic_after_yielding_extra_value_double_drops() {
 
     let _ = catch_unwind(AssertUnwindSafe(|| drop(iter)));
 }
+
+#[test]
+fn iter_size_hint_lower_bound_is_exact_remaining() {
+    let mut map = HeaderMap::new();
+    assert_eq!(map.iter().size_hint().0, 0);
+
+    map.insert(HOST, "a".parse().unwrap());
+    map.append(HOST, "b".parse().unwrap());
+    map.insert(ACCEPT, "c".parse().unwrap());
+
+    let mut it = map.iter();
+    let mut remaining = 3;
+    while it.size_hint().0 > 0 {
+        assert!(it.next().is_some());
+        remaining -= 1;
+        assert!(it.size_hint().0 <= remaining);
+    }
+    assert!(it.next().is_none());
+
+    let mut it = map.iter_mut();
+    while it.size_hint().0 > 0 {
+        assert!(it.next().is_some());
+    }
+    assert!(it.next().is_none());
+}
```

</details>

<details><summary>reply</summary>

Done. `Iter` and `IterMut` `size_hint` in `src/header/map.rs` now subtract 1 from the lower bound once the current entry is exhausted (`cursor` is `None`). The subtraction saturates, so an empty map reports 0. I added a test to `tests/header_map.rs`. The `header_map` test suite passes (36 tests); I did not run the rest of the crate's tests.

</details>

### codex, base: pass

Files: [src/header/map.rs](../base/codex/rust-http-headermap-size-hint-1/files/src/header/map.rs), [tests/header_map.rs](../base/codex/rust-http-headermap-size-hint-1/files/tests/header_map.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/header/map.rs b/src/header/map.rs
index 08a1b8b..523f044 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,11 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        let mut lower = map.entries.len() - self.entry;
+        // A missing cursor means the current entry has been exhausted.
+        if self.cursor.is_none() {
+            lower = lower.saturating_sub(1);
+        }
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2457,11 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        let mut lower = self.entries_len - self.entry;
+        // A missing cursor means the current entry has been exhausted.
+        if self.cursor.is_none() {
+            lower = lower.saturating_sub(1);
+        }
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
diff --git a/tests/header_map.rs b/tests/header_map.rs
index f621013..bb8ad18 100644
--- a/tests/header_map.rs
+++ b/tests/header_map.rs
@@ -35,6 +35,41 @@ fn smoke() {
     }
 }
 
+#[test]
+fn iter_size_hint() {
+    fn check(mut iter: impl Iterator, len: usize) {
+        for remaining in (0..=len).rev() {
+            let (lower, upper) = iter.size_hint();
+            assert!(
+                lower <= remaining,
+                "lower bound {lower} exceeds {remaining}"
+            );
+            if let Some(upper) = upper {
+                assert!(upper >= remaining);
+            }
+            assert_eq!(iter.next().is_some(), remaining > 0);
+        }
+        assert_eq!(iter.size_hint().0, 0);
+        assert!(iter.next().is_none());
+    }
+
+    for counts in [&[][..], &[1], &[3], &[1, 1], &[3, 1, 2]] {
+        let mut headers = HeaderMap::<usize>::default();
+        for (name, count) in [HOST, ACCEPT, SERVER].iter().zip(counts) {
+            for value in 0..*count {
+                headers.append(name, value);
+            }
+        }
+        let len = headers.len();
+        assert_eq!(headers.iter().size_hint().0, headers.keys_len());
+        assert_eq!(headers.iter_mut().size_hint().0, headers.keys_len());
+        check(headers.iter(), len);
+        check(headers.iter_mut(), len);
+        check(headers.values(), len);
+        check(headers.values_mut(), len);
+    }
+}
+
 #[test]
 #[should_panic]
 fn reserve_over_capacity() {
```

</details>

<details><summary>reply</summary>

I’ll inspect the iterator’s state tracking, fix the lower bound, and add a regression test.

The iterator still points at the current header after yielding its last value, but `size_hint` keeps counting that header. The same issue affects `iter_mut`, and therefore `values` and `values_mut`. I’ll fix both calculations and test them through exhaustion.

Fixed `size_hint` to exclude the current header once its values are exhausted. This corrects `iter`, `iter_mut`, `values`, and `values_mut`.

Added regression coverage for empty maps, single values, multiple headers, and repeated values, checking bounds through exhaustion.

Validation passed: `cargo test`, `cargo fmt --check`, and `git diff --check`.

</details>

### codex, muffle: pass

Files: [src/header/map.rs](../muffle/codex/rust-http-headermap-size-hint-1/files/src/header/map.rs), [tests/header_map.rs](../muffle/codex/rust-http-headermap-size-hint-1/files/tests/header_map.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/header/map.rs b/src/header/map.rs
index 08a1b8b..523f044 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,11 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        let mut lower = map.entries.len() - self.entry;
+        // A missing cursor means the current entry has been exhausted.
+        if self.cursor.is_none() {
+            lower = lower.saturating_sub(1);
+        }
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2457,11 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        let mut lower = self.entries_len - self.entry;
+        // A missing cursor means the current entry has been exhausted.
+        if self.cursor.is_none() {
+            lower = lower.saturating_sub(1);
+        }
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
diff --git a/tests/header_map.rs b/tests/header_map.rs
index f621013..e0b3ffa 100644
--- a/tests/header_map.rs
+++ b/tests/header_map.rs
@@ -1,6 +1,40 @@
 use http::header::*;
 use http::*;
 
+#[test]
+fn iter_size_hint() {
+    fn check(mut iter: impl Iterator, len: usize) {
+        for remaining in (0..=len).rev() {
+            let (lower, upper) = iter.size_hint();
+            assert!(lower <= remaining);
+            if let Some(upper) = upper {
+                assert!(upper >= remaining);
+            }
+            assert_eq!(iter.next().is_some(), remaining > 0);
+        }
+        assert_eq!(iter.size_hint().0, 0);
+        assert!(iter.next().is_none());
+    }
+
+    let mut headers = HeaderMap::new();
+    for values in [
+        vec![],
+        vec!["host"],
+        vec!["host", "host"],
+        vec!["host", "accept", "accept", "host", "via"],
+    ] {
+        headers.clear();
+        for name in values {
+            headers.append(HeaderName::from_static(name), HeaderValue::from_static("x"));
+        }
+        let len = headers.len();
+        check(headers.iter(), len);
+        check(headers.iter_mut(), len);
+        check(headers.values(), len);
+        check(headers.values_mut(), len);
+    }
+}
+
 #[test]
 fn smoke() {
     let mut headers = HeaderMap::new();
```

</details>

<details><summary>reply</summary>

I’ll check how the iterator tracks remaining entries, fix the size hint, and add a regression test for the exhausted case.

The lower bound still counts the current header after its last value has been yielded. The mutable iterator uses the same calculation, so I’ll fix both. I’ll test empty maps, single values, and multiple values per header, including the `values()` wrappers.

Fixed the lower bound calculation in `HeaderMap::iter()` and `iter_mut()`, which also fixes their `values()` wrappers. Exhausted entries no longer count toward the lower bound.

Added regression coverage for empty maps, single values, multiple headers, and repeated values.

Validation: all 415 tests pass; formatting and diff checks pass.

</details>

### codex, hush: pass

Files: [src/header/map.rs](../hush/codex/rust-http-headermap-size-hint-1/files/src/header/map.rs), [tests/header_map.rs](../hush/codex/rust-http-headermap-size-hint-1/files/tests/header_map.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/header/map.rs b/src/header/map.rs
index 08a1b8b..c61d814 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,8 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        let lower =
+            (map.entries.len() - self.entry).saturating_sub(usize::from(self.cursor.is_none()));
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2454,8 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        let lower =
+            (self.entries_len - self.entry).saturating_sub(usize::from(self.cursor.is_none()));
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
diff --git a/tests/header_map.rs b/tests/header_map.rs
index f621013..677c71e 100644
--- a/tests/header_map.rs
+++ b/tests/header_map.rs
@@ -1,6 +1,38 @@
 use http::header::*;
 use http::*;
 
+#[test]
+fn iterator_size_hint_bounds() {
+    fn check(mut iter: impl Iterator, len: usize) {
+        for remaining in (0..=len).rev() {
+            let (lower, upper) = iter.size_hint();
+            assert!(lower <= remaining);
+            if let Some(upper) = upper {
+                assert!(upper >= remaining);
+            }
+            assert_eq!(iter.next().is_some(), remaining > 0);
+        }
+        assert_eq!(iter.size_hint().0, 0);
+        assert!(iter.next().is_none());
+    }
+
+    for keys in 0..=3 {
+        for values in 1..=4 {
+            let mut map = HeaderMap::new();
+            for name in [HOST, ACCEPT, CONTENT_TYPE].iter().take(keys) {
+                for _ in 0..values {
+                    map.append(name, HeaderValue::from_static("x"));
+                }
+            }
+            let len = map.len();
+            check(map.iter(), len);
+            check(map.iter_mut(), len);
+            check(map.values(), len);
+            check(map.values_mut(), len);
+        }
+    }
+}
+
 #[test]
 fn smoke() {
     let mut headers = HeaderMap::new();
```

</details>

<details><summary>reply</summary>

Header iterator bounds need inspection; fix and regression check follow.


Done.
Fixed `Iter`/`IterMut` bounds, including `values` variants. Added regression coverage. `cargo test`: 415 passed.

</details>

### codex, sloth: pass

Files: [src/header/map.rs](../sloth/codex/rust-http-headermap-size-hint-1/files/src/header/map.rs), [tests/header_map.rs](../sloth/codex/rust-http-headermap-size-hint-1/files/tests/header_map.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/header/map.rs b/src/header/map.rs
index 08a1b8b..c61d814 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,8 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        let lower =
+            (map.entries.len() - self.entry).saturating_sub(usize::from(self.cursor.is_none()));
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2454,8 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        let lower =
+            (self.entries_len - self.entry).saturating_sub(usize::from(self.cursor.is_none()));
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
diff --git a/tests/header_map.rs b/tests/header_map.rs
index f621013..b4d6e48 100644
--- a/tests/header_map.rs
+++ b/tests/header_map.rs
@@ -35,6 +35,41 @@ fn smoke() {
     }
 }
 
+#[test]
+/// Checks iterator bounds before and after every value, including exhaustion.
+fn iter_size_hint() {
+    for values in [
+        vec![],
+        vec![HOST],
+        vec![HOST, HOST],
+        vec![HOST, ACCEPT, ACCEPT],
+    ] {
+        let mut map = HeaderMap::new();
+        for name in values {
+            map.append(name, HeaderValue::from_static("x"));
+        }
+        let len = map.len();
+        let mut mutable_map = map.clone();
+        let mut mutable_values_map = map.clone();
+        let mut iterators: Vec<Box<dyn Iterator<Item = ()> + '_>> = vec![
+            Box::new(map.iter().map(|_| ())),
+            Box::new(map.values().map(|_| ())),
+        ];
+        iterators.push(Box::new(mutable_map.iter_mut().map(|_| ())));
+        iterators.push(Box::new(mutable_values_map.values_mut().map(|_| ())));
+        for mut iter in iterators {
+            for remaining in (0..=len).rev() {
+                let (lower, upper) = iter.size_hint();
+                assert!(lower <= remaining);
+                assert!(upper.map_or(true, |upper| upper >= remaining));
+                assert_eq!(iter.next().is_some(), remaining > 0);
+            }
+            assert_eq!(iter.size_hint().0, 0);
+            assert!(iter.next().is_none());
+        }
+    }
+}
+
 #[test]
 #[should_panic]
 fn reserve_over_capacity() {
```

</details>

<details><summary>reply</summary>

I’ll check the shared iterator logic and existing tests, fix the lower bound, and run the build and test suite.

The lower bound counts the current header even after its last value has been yielded. The same bug affects `iter_mut`, and both value iterators delegate to these implementations. I’ll fix both and add one regression test covering empty maps, multiple headers, duplicate values, and exhaustion. No API, dependency, or configuration changes are needed.

Fixed the lower bound in `iter()` and `iter_mut()`, which also fixes `values()` and `values_mut()`. Exhausted iterators now report a lower bound of zero.

Added regression coverage for empty maps, single headers, multiple headers, duplicate values, and exhaustion.

Validation: all 415 tests passed; build and formatting checks passed.

</details>

### codex, all: pass

Files: [src/header/map.rs](../all/codex/rust-http-headermap-size-hint-1/files/src/header/map.rs), [tests/header_map.rs](../all/codex/rust-http-headermap-size-hint-1/files/tests/header_map.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/header/map.rs b/src/header/map.rs
index 08a1b8b..c61d814 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,8 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        let lower =
+            (map.entries.len() - self.entry).saturating_sub(usize::from(self.cursor.is_none()));
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2454,8 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        let lower =
+            (self.entries_len - self.entry).saturating_sub(usize::from(self.cursor.is_none()));
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
diff --git a/tests/header_map.rs b/tests/header_map.rs
index f621013..b838f78 100644
--- a/tests/header_map.rs
+++ b/tests/header_map.rs
@@ -772,3 +772,39 @@ fn into_iter_drop_panic_after_yielding_extra_value_double_drops() {
 
     let _ = catch_unwind(AssertUnwindSafe(|| drop(iter)));
 }
+
+/// Checks bounds before each item and after repeated exhaustion.
+#[test]
+fn iter_size_hint() {
+    for names in 0..=3 {
+        for values in 1..=3 {
+            let mut headers = HeaderMap::new();
+            for name in [HOST, CONTENT_LENGTH, ACCEPT].iter().take(names) {
+                for _ in 0..values {
+                    headers.append(name, HeaderValue::from_static("x"));
+                }
+            }
+
+            let mut iter = headers.iter();
+            for remaining in (0..=headers.len()).rev() {
+                let (lower, upper) = iter.size_hint();
+                assert!(lower <= remaining);
+                assert!(upper.map_or(true, |upper| upper >= remaining));
+                assert_eq!(iter.next().is_some(), remaining > 0);
+            }
+            assert_eq!(iter.size_hint().0, 0);
+            assert!(iter.next().is_none());
+
+            let len = headers.len();
+            let mut iter = headers.iter_mut();
+            for remaining in (0..=len).rev() {
+                let (lower, upper) = iter.size_hint();
+                assert!(lower <= remaining);
+                assert!(upper.map_or(true, |upper| upper >= remaining));
+                assert_eq!(iter.next().is_some(), remaining > 0);
+            }
+            assert_eq!(iter.size_hint().0, 0);
+            assert!(iter.next().is_none());
+        }
+    }
+}
```

</details>

<details><summary>reply</summary>

Done.
Fixed `iter`/`iter_mut` lower bounds, including `values`/`values_mut`. Added empty, duplicate, exhausted iterator tests. All 415 tests pass; formatting checked.

</details>
