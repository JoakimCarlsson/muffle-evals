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
| claude | muffle | pass | +16/-2 | 33 | 2,142 | $0.076 |
| claude | hush | pass | +12/-2 | 20 | 1,743 | $0.082 |
| claude | sloth | pass | +2/-2 | 0 | 1,631 | $0.079 |
| claude | all | pass | +4/-2 | 0 | 1,504 | $0.081 |
| codex | base | pass | +10/-2 | 35 | 1,533 | - |
| codex | muffle | pass | +8/-2 | 34 | 1,343 | - |
| codex | hush | pass | +4/-2 | 33 | 1,154 | - |
| codex | sloth | pass | +4/-2 | 0 | 789 | - |
| codex | all | pass | +4/-2 | 0 | 836 | - |

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
index 08a1b8b..602a535 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,14 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        // The current entry still has an item to yield only if the cursor
+        // is set; otherwise the iterator is positioned at the end of it.
+        let consumed = if self.cursor.is_some() {
+            self.entry
+        } else {
+            self.entry + 1
+        };
+        let lower = map.entries.len().saturating_sub(consumed);
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2460,14 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        // The current entry still has an item to yield only if the cursor
+        // is set; otherwise the iterator is positioned at the end of it.
+        let consumed = if self.cursor.is_some() {
+            self.entry
+        } else {
+            self.entry + 1
+        };
+        let lower = self.entries_len.saturating_sub(consumed);
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
diff --git a/tests/header_map.rs b/tests/header_map.rs
index f621013..c9e46fc 100644
--- a/tests/header_map.rs
+++ b/tests/header_map.rs
@@ -772,3 +772,36 @@ fn into_iter_drop_panic_after_yielding_extra_value_double_drops() {
 
     let _ = catch_unwind(AssertUnwindSafe(|| drop(iter)));
 }
+
+#[test]
+fn iter_size_hint_lower_bound_is_accurate() {
+    let mut map = HeaderMap::new();
+    assert_eq!(map.iter().size_hint().0, 0);
+    assert_eq!(map.iter_mut().size_hint().0, 0);
+
+    map.insert(HOST, "a".parse().unwrap());
+    map.append(HOST, "b".parse().unwrap());
+    map.insert(ACCEPT, "c".parse().unwrap());
+
+    let mut it = map.iter();
+    loop {
+        let (lo, _) = it.size_hint();
+        let next = it.next();
+        assert!(lo == 0 || next.is_some());
+        if next.is_none() {
+            break;
+        }
+    }
+    assert_eq!(it.size_hint().0, 0);
+
+    let mut it = map.iter_mut();
+    loop {
+        let (lo, _) = it.size_hint();
+        let next = it.next();
+        assert!(lo == 0 || next.is_some());
+        if next.is_none() {
+            break;
+        }
+    }
+    assert_eq!(it.size_hint().0, 0);
+}
```

</details>

<details><summary>reply</summary>

Fixed: `size_hint` on `HeaderMap::iter()` and `iter_mut()` no longer reports a lower bound of 1 when the iterator is exhausted. The new regression test and the existing `header_map` and lib tests pass.

**Cause:** the lower bound was `entries.len() - self.entry`. That always counts the current entry, even after the cursor has moved past its last value.

**Fix:** in `src/header/map.rs`, both `Iter` and `IterMut` now count the current entry only while the cursor is still inside it, and use `saturating_sub` so an empty map can't underflow.

**Test:** I added `iter_size_hint_lower_bound_is_accurate` to `tests/header_map.rs`. It checks an empty map and a map with multi-value entries, for both `iter` and `iter_mut`. At every step, a lower bound above 0 must be followed by `Some`.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [src/header/map.rs](../hush/claude/rust-http-headermap-size-hint-1/files/src/header/map.rs), [tests/header_map.rs](../hush/claude/rust-http-headermap-size-hint-1/files/tests/header_map.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/header/map.rs b/src/header/map.rs
index 08a1b8b..395f979 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,12 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        // Current entry still has items only while the cursor is set.
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
+        // Current entry still has items only while the cursor is set.
+        let lower = if self.cursor.is_some() {
+            self.entries_len - self.entry
+        } else {
+            (self.entries_len - self.entry).saturating_sub(1)
+        };
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
diff --git a/tests/header_map.rs b/tests/header_map.rs
index f621013..66d7607 100644
--- a/tests/header_map.rs
+++ b/tests/header_map.rs
@@ -772,3 +772,23 @@ fn into_iter_drop_panic_after_yielding_extra_value_double_drops() {
 
     let _ = catch_unwind(AssertUnwindSafe(|| drop(iter)));
 }
+
+#[test]
+fn iter_size_hint_exact_at_end() {
+    let mut m = HeaderMap::new();
+    assert_eq!(m.iter().size_hint().0, 0);
+    m.insert(HOST, "x".parse().unwrap());
+    m.append(HOST, "y".parse().unwrap());
+    let mut it = m.iter();
+    let mut left = 2;
+    loop {
+        assert_eq!(it.size_hint().0.min(1), if left > 0 { 1 } else { 0 });
+        if it.next().is_none() {
+            break;
+        }
+        left -= 1;
+    }
+    let mut it = m.iter_mut();
+    while it.next().is_some() {}
+    assert_eq!(it.size_hint().0, 0);
+}
```

</details>

<details><summary>reply</summary>

Done. `Iter` and `IterMut` `size_hint` in `src/header/map.rs` now return 0 once the cursor is spent on the last entry. I added a regression test in `tests/header_map.rs`. `cargo test` passes. I didn't run your repro snippet directly, and nothing is committed.

</details>

### claude, sloth: pass

Files: [src/header/map.rs](../sloth/claude/rust-http-headermap-size-hint-1/files/src/header/map.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/header/map.rs b/src/header/map.rs
index 08a1b8b..6a7c3a5 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,7 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        let lower = (map.entries.len() - self.entry).saturating_sub(1) + self.cursor.is_some() as usize;
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2453,7 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        let lower = (self.entries_len - self.entry).saturating_sub(1) + self.cursor.is_some() as usize;
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
```

</details>

<details><summary>reply</summary>

I fixed `size_hint` for `HeaderMap::iter` and `iter_mut`. It now reports a lower bound of 0 once the iterator is exhausted. The existing tests pass, and so did a throwaway regression test I wrote and then removed.

The old lower bound was `entries.len() - entry`. That still counted the entry the iterator was on after its values had all been yielded, so it was 1 too high at the end. The new bound counts the entries after the current one, plus 1 only if the current entry still has a value to yield. Both `Iter` and `IterMut` had the same formula, so I changed both in `src/header/map.rs`. `Keys`, `Values` and `ValuesMut` wrap these two, so they are fixed as well.

The throwaway test used a map with a multi-value header, a second header and an empty map. At every step it checked that a lower bound of 1 or more never came with `next() == None`, and that the lower bound was 0 at the end. You asked only for the fix, so I didn't add a permanent test. I haven't committed anything.

</details>

### claude, all: pass

Files: [src/header/map.rs](../all/claude/rust-http-headermap-size-hint-1/files/src/header/map.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/header/map.rs b/src/header/map.rs
index 08a1b8b..57e1d01 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,8 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        let next_entry = self.entry + self.cursor.is_none() as usize;
+        let lower = map.entries.len().saturating_sub(next_entry);
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2454,8 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        let next_entry = self.entry + self.cursor.is_none() as usize;
+        let lower = self.entries_len.saturating_sub(next_entry);
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
```

</details>

<details><summary>reply</summary>

Done. Fixed `size_hint` lower bound in `Iter` and `IterMut` (`src/header/map.rs`). It now skips the current entry once its cursor is exhausted. Existing tests pass. I didn't run your repro and added no new test.

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
index 08a1b8b..8e9dd27 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,10 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        // A missing cursor means the current entry has been exhausted.
+        // Saturate because an empty map also starts with no cursor.
+        let lower =
+            (map.entries.len() - self.entry).saturating_sub(usize::from(self.cursor.is_none()));
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2456,10 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        // A missing cursor means the current entry has been exhausted.
+        // Saturate because an empty map also starts with no cursor.
+        let lower =
+            (self.entries_len - self.entry).saturating_sub(usize::from(self.cursor.is_none()));
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
diff --git a/tests/header_map.rs b/tests/header_map.rs
index f621013..0a4c6ef 100644
--- a/tests/header_map.rs
+++ b/tests/header_map.rs
@@ -772,3 +772,37 @@ fn into_iter_drop_panic_after_yielding_extra_value_double_drops() {
 
     let _ = catch_unwind(AssertUnwindSafe(|| drop(iter)));
 }
+
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
+                assert!(upper >= remaining, "upper bound {upper} below {remaining}");
+            }
+            assert_eq!(iter.next().is_some(), remaining != 0);
+        }
+        // The estimate must remain valid after next() returns None.
+        assert_eq!(iter.size_hint().0, 0);
+        assert!(iter.next().is_none());
+    }
+
+    for counts in [&[][..], &[1], &[3], &[1, 1, 1], &[3, 1, 2]] {
+        let mut map = HeaderMap::<usize>::default();
+        for (name, &count) in [HOST, ACCEPT, CONTENT_TYPE].iter().zip(counts) {
+            for value in 0..count {
+                map.append(name, value);
+            }
+        }
+        let len = map.len();
+        check(map.iter(), len);
+        check(map.iter_mut(), len);
+        check(map.values(), len);
+        check(map.values_mut(), len);
+    }
+}
```

</details>

<details><summary>reply</summary>

I’ll check how the iterator tracks its position, fix the lower bound, and add a regression test.

The lower bound still counts the current header after its last value has been yielded. The same issue affects `iter_mut`, and therefore `values` and `values_mut`. I’ll fix both underlying iterators and test all four with empty maps, single values, and repeated header values.

Fixed the lower bound to exclude the current header once its values are exhausted. This fixes `iter`, `iter_mut`, `values`, and `values_mut`.

Added regression coverage for empty maps, single values, repeated values, and exhausted iterators.

Validation: all 415 tests passed; formatting and diff checks passed.

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
index f621013..5c279ef 100644
--- a/tests/header_map.rs
+++ b/tests/header_map.rs
@@ -1,6 +1,39 @@
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
+    let mut map = HeaderMap::<usize>::default();
+    for names in 0..=3 {
+        if names > 0 {
+            map.append([HOST, ACCEPT, CONTENT_TYPE][names - 1].clone(), 0);
+        }
+        for extras in 0..=2 {
+            if names > 0 && extras > 0 {
+                map.append(HOST, extras);
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

Iterator lower bound needs checking against remaining entries; regression test will cover exhaustion.


Done.
Fixed `Iter` and `IterMut` lower bounds; added regression coverage for empty, exhausted, and multivalue maps. All 415 tests passed.

</details>

### codex, sloth: pass

Files: [src/header/map.rs](../sloth/codex/rust-http-headermap-size-hint-1/files/src/header/map.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/header/map.rs b/src/header/map.rs
index 08a1b8b..0a277e3 100644
--- a/src/header/map.rs
+++ b/src/header/map.rs
@@ -2368,7 +2368,8 @@ impl<'a, T> Iterator for Iter<'a, T> {
         let map = self.map;
         debug_assert!(map.entries.len() >= self.entry);
 
-        let lower = map.entries.len() - self.entry;
+        let lower = (map.entries.len() - self.entry)
+            .saturating_sub(usize::from(self.cursor.is_none()));
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
@@ -2453,7 +2454,8 @@ impl<'a, T> Iterator for IterMut<'a, T> {
     fn size_hint(&self) -> (usize, Option<usize>) {
         debug_assert!(self.entries_len >= self.entry);
 
-        let lower = self.entries_len - self.entry;
+        let lower = (self.entries_len - self.entry)
+            .saturating_sub(usize::from(self.cursor.is_none()));
         // We could pessimistically guess at the upper bound, saying
         // that its lower + map.extra_values.len(). That could be
         // way over though, such as if we're near the end, and have
```

</details>

<details><summary>reply</summary>

I’ll check the shared iterator code and its callers, fix the lower-bound calculation, then build and run the existing tests.

Both `Iter` and `IterMut` count the current header after its last value has been consumed. Their `Values` and `ValuesMut` wrappers inherit the same bug. I’ll adjust both calculations to exclude that header when the cursor is empty, including for an empty map. No API, fixture, config, or export changes are needed.

Fixed the lower-bound calculation in [src/header/map.rs](/home/jdaddy/.cache/muffle-evals/runs/sloth/codex/rust-http-headermap-size-hint-1/work/src/header/map.rs:2367) for both `Iter` and `IterMut`, also fixing their values wrappers. Exhausted iterators now report a lower bound of zero, including empty maps.

Build succeeded; all 414 existing tests passed.

</details>

### codex, all: pass

Files: [src/header/map.rs](../all/codex/rust-http-headermap-size-hint-1/files/src/header/map.rs)

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
```

</details>

<details><summary>reply</summary>

Done.
Fixed exhausted lower bounds for `iter`, `iter_mut`, `values`, `values_mut`. Build, formatting, 414 existing tests passed.

</details>
