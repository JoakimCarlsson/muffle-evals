# rust-feat-bytes-extend-from-within

Source: https://github.com/tokio-rs/bytes/pull/818

## Prompt

> `Vec<u8>` has `extend_from_within`, which copies a range of its own contents onto the end. `BytesMut` doesn't, and I can't do `buf.extend_from_slice(&buf[a..b])` because of the borrow, so I end up copying into a temporary first.
> 
> I'd like:
> 
> ```rust
> impl BytesMut {
>     pub fn extend_from_within(&mut self, range: impl RangeBounds<usize>);
> }
> ```
> 
> It appends a copy of the bytes in `range` to the end, growing the buffer as needed, and panics if the range is out of bounds for the current length, the same way `Vec::extend_from_within` does.
> 
> ```rust
> let mut buf = BytesMut::new();
> buf.extend_from_slice(b"aaabbb_");
> buf.extend_from_within(3..6);
> assert_eq!(&buf[..], b"aaabbb_bbb");
> ```
> 
> Please add this.

## Upstream change (tests left out)

Files: [src/bytes.rs](../../tasks/rust-feat-bytes-extend-from-within/upstream/src/bytes.rs), [src/bytes_mut.rs](../../tasks/rust-feat-bytes-extend-from-within/upstream/src/bytes_mut.rs), [src/lib.rs](../../tasks/rust-feat-bytes-extend-from-within/upstream/src/lib.rs), [tests/test_bytes.rs](../../tasks/rust-feat-bytes-extend-from-within/upstream/tests/test_bytes.rs)

```diff
diff --git a/src/bytes.rs b/src/bytes.rs
index 441ca80..40c902f 100644
--- a/src/bytes.rs
+++ b/src/bytes.rs
@@ -367,34 +367,7 @@ impl Bytes {
     /// Requires that `begin <= end` and `end <= self.len()`, otherwise slicing
     /// will panic.
     pub fn slice(&self, range: impl RangeBounds<usize>) -> Self {
-        use core::ops::Bound;
-
-        let len = self.len();
-
-        let begin = match range.start_bound() {
-            Bound::Included(&n) => n,
-            Bound::Excluded(&n) => n.checked_add(1).expect("out of range"),
-            Bound::Unbounded => 0,
-        };
-
-        let end = match range.end_bound() {
-            Bound::Included(&n) => n.checked_add(1).expect("out of range"),
-            Bound::Excluded(&n) => n,
-            Bound::Unbounded => len,
-        };
-
-        assert!(
-            begin <= end,
-            "range start must not be greater than end: {:?} <= {:?}",
-            begin,
-            end,
-        );
-        assert!(
-            end <= len,
-            "range end out of bounds: {:?} <= {:?}",
-            end,
-            len,
-        );
+        let (begin, end) = crate::range(range, self.len());
 
         if end == begin {
             return Bytes::new_empty_with_ptr(self.ptr.wrapping_add(begin));
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..78c5fd6 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -884,6 +884,41 @@ impl BytesMut {
         }
     }
 
+    /// Clones the elements in the given `range` within this `BytesMut` and
+    /// appends them to the end.
+    ///
+    /// # Panics
+    ///
+    /// Panics if `range` is out of bounds for this `BytesMut`.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// use bytes::BytesMut;
+    ///
+    /// let mut buf = BytesMut::with_capacity(0);
+    /// buf.extend_from_slice(b"aaabbb_");
+    /// buf.extend_from_within(3..6);
+    ///
+    /// assert_eq!(b"aaabbb_bbb", &buf[..]);
+    /// ```
+    pub fn extend_from_within(&mut self, range: impl core::ops::RangeBounds<usize>) {
+        let (begin, end) = crate::range(range, self.len());
+
+        let cnt = end - begin;
+        self.reserve(cnt);
+
+        // SAFETY: range is already checked
+        let src = unsafe { self.as_ptr().add(begin) };
+        let dst = self.spare_capacity_mut();
+
+        // SAFETY: range doesn't overlap with spare capacity
+        unsafe { ptr::copy_nonoverlapping(src, dst.as_mut_ptr().cast(), cnt) }
+
+        // SAFETY: capacity is already reserved and filled with data
+        unsafe { self.advance_mut(cnt) }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
diff --git a/src/lib.rs b/src/lib.rs
index fb5c506..1916b60 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -129,6 +129,43 @@ fn min_u64_usize(a: u64, b: usize) -> usize {
     }
 }
 
+/// Performs bounds checking of a range.
+///
+/// This is a spiritual copy of [core::slice::index::range] because that
+/// function is currently unstable.
+#[inline(always)]
+#[track_caller]
+fn range(range: impl core::ops::RangeBounds<usize>, len: usize) -> (usize, usize) {
+    use core::ops::Bound;
+
+    let begin = match range.start_bound() {
+        Bound::Included(&n) => n,
+        Bound::Excluded(&n) => n.checked_add(1).expect("out of range"),
+        Bound::Unbounded => 0,
+    };
+
+    let end = match range.end_bound() {
+        Bound::Included(&n) => n.checked_add(1).expect("out of range"),
+        Bound::Excluded(&n) => n,
+        Bound::Unbounded => len,
+    };
+
+    assert!(
+        begin <= end,
+        "range start must not be greater than end: {:?} <= {:?}",
+        begin,
+        end,
+    );
+    assert!(
+        end <= len,
+        "range end out of bounds: {:?} <= {:?}",
+        end,
+        len,
+    );
+
+    (begin, end)
+}
+
 /// Error type for the `try_get_` methods of [`Buf`].
 /// Indicates that there were not enough remaining
 /// bytes in the buffer while attempting
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +61/-1 | 34 | 2,415 | $0.086 |
| claude | muffle | pass | +68/-1 | 35 | 2,461 | $0.076 |
| claude | hush | pass | +58/-1 | 30 | 2,213 | $0.076 |
| claude | sloth | pass | +63/-1 | 0 | 2,258 | $0.084 |
| claude | all | pass | +62/-1 | 0 | 1,471 | $0.058 |
| codex | base | pass | +48/-1 | 74 | 2,109 | - |
| codex | muffle | pass | +46/-1 | 62 | 2,089 | - |
| codex | hush | pass | +45/-1 | 53 | 1,535 | - |
| codex | sloth | pass | +57/-1 | 0 | 1,236 | - |
| codex | all | pass | +45/-1 | 0 | 1,019 | - |

### claude, base: pass

Files: [src/bytes_mut.rs](../base/claude/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs), [tests/test_bytes.rs](../base/claude/rust-feat-bytes-extend-from-within-1/files/tests/test_bytes.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..25c8217 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -1,5 +1,5 @@
 use core::mem::{self, ManuallyDrop, MaybeUninit};
-use core::ops::{Deref, DerefMut};
+use core::ops::{Bound, Deref, DerefMut, RangeBounds};
 use core::ptr::{self, NonNull};
 use core::{cmp, fmt, hash, slice};
 
@@ -884,6 +884,66 @@ impl BytesMut {
         }
     }
 
+    /// Appends a copy of the bytes in `range` to the end of this `BytesMut`.
+    ///
+    /// If this `BytesMut` object does not have enough capacity, it is resized
+    /// first.
+    ///
+    /// # Panics
+    ///
+    /// Panics if the starting point is greater than the end point or if the
+    /// end point is greater than the length of this `BytesMut`.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// use bytes::BytesMut;
+    ///
+    /// let mut buf = BytesMut::new();
+    /// buf.extend_from_slice(b"aaabbb_");
+    /// buf.extend_from_within(3..6);
+    ///
+    /// assert_eq!(&buf[..], b"aaabbb_bbb");
+    /// ```
+    pub fn extend_from_within(&mut self, range: impl RangeBounds<usize>) {
+        let len = self.len();
+        let start = match range.start_bound() {
+            Bound::Included(&n) => n,
+            Bound::Excluded(&n) => n.checked_add(1).expect("range start overflow"),
+            Bound::Unbounded => 0,
+        };
+        let end = match range.end_bound() {
+            Bound::Included(&n) => n.checked_add(1).expect("range end overflow"),
+            Bound::Excluded(&n) => n,
+            Bound::Unbounded => len,
+        };
+        assert!(
+            start <= end,
+            "slice index starts at {} but ends at {}",
+            start,
+            end
+        );
+        assert!(
+            end <= len,
+            "range end index {} out of range for slice of length {}",
+            end,
+            len
+        );
+
+        let cnt = end - start;
+        // May reallocate, so pointers are taken afterwards.
+        self.reserve(cnt);
+
+        unsafe {
+            let src = self.as_ptr().add(start);
+            let dst = self.as_mut_ptr().add(len);
+            // `reserve` guarantees room for `cnt` bytes past `len`, and the
+            // source range lies within `..len`, so the regions are disjoint.
+            ptr::copy_nonoverlapping(src, dst, cnt);
+            self.advance_mut(cnt);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
diff --git a/tests/test_bytes.rs b/tests/test_bytes.rs
index b9bd5e1..f07bd64 100644
--- a/tests/test_bytes.rs
+++ b/tests/test_bytes.rs
@@ -1720,3 +1720,37 @@ fn bytes_mut_reserve_overflow() {
     // This call relies on the corrupted cap and may cause UB & HBO
     b.put_u8(b'h');
 }
+
+#[test]
+fn bytes_mut_extend_from_within() {
+    let mut buf = BytesMut::new();
+    buf.extend_from_slice(b"aaabbb_");
+    buf.extend_from_within(3..6);
+    assert_eq!(&buf[..], b"aaabbb_bbb");
+    buf.extend_from_within(..=1);
+    assert_eq!(&buf[..], b"aaabbb_bbbaa");
+    buf.extend_from_within(12..);
+    buf.extend_from_within(5..5);
+    assert_eq!(buf.len(), 12);
+    // Forces reallocation.
+    let mut buf = BytesMut::from(&b"xyz"[..]);
+    for _ in 0..10 {
+        buf.extend_from_within(..);
+    }
+    assert_eq!(buf.len(), 3 * 1024);
+    assert!(buf.chunks(3).all(|c| c == b"xyz"));
+}
+
+#[test]
+#[should_panic]
+fn bytes_mut_extend_from_within_out_of_bounds() {
+    let mut buf = BytesMut::from(&b"abc"[..]);
+    buf.extend_from_within(2..4);
+}
+
+#[test]
+#[should_panic]
+fn bytes_mut_extend_from_within_inverted() {
+    let mut buf = BytesMut::from(&b"abc"[..]);
+    buf.extend_from_within(2..1);
+}
```

</details>

<details><summary>reply</summary>

I added `BytesMut::extend_from_within(range: impl RangeBounds<usize>)` in `src/bytes_mut.rs`, and your example now works. The new tests and the doctest pass. I didn't run the rest of the suite.

- **Behavior:** it appends a copy of `range` to the end and grows the buffer as needed. It panics if the start is greater than the end, or if the end is past the current length.
- **Range forms:** all range forms work, including `..`, `..=n` and `n..`.
- **Tests:** I added three tests to `tests/test_bytes.rs`. One covers the happy path, including empty ranges and a case that forces reallocation. The other two check that an out-of-bounds range and an inverted range panic.
- **Doctest:** your snippet is the doc example.
- **Not done:** I didn't add a `CHANGELOG.md` entry or commit anything.

</details>

### claude, muffle: pass

Files: [src/bytes_mut.rs](../muffle/claude/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs), [tests/test_bytes.rs](../muffle/claude/rust-feat-bytes-extend-from-within-1/files/tests/test_bytes.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..714e308 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -1,5 +1,5 @@
 use core::mem::{self, ManuallyDrop, MaybeUninit};
-use core::ops::{Deref, DerefMut};
+use core::ops::{Bound, Deref, DerefMut, RangeBounds};
 use core::ptr::{self, NonNull};
 use core::{cmp, fmt, hash, slice};
 
@@ -884,6 +884,73 @@ impl BytesMut {
         }
     }
 
+    /// Appends a copy of the bytes in `range` to the end of this `BytesMut`.
+    ///
+    /// If this `BytesMut` object does not have enough capacity, it is resized
+    /// first.
+    ///
+    /// # Panics
+    ///
+    /// Panics if the range is out of bounds for the current length, or if its
+    /// start is greater than its end.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// use bytes::BytesMut;
+    ///
+    /// let mut buf = BytesMut::new();
+    /// buf.extend_from_slice(b"aaabbb_");
+    /// buf.extend_from_within(3..6);
+    ///
+    /// assert_eq!(b"aaabbb_bbb", &buf[..]);
+    /// ```
+    pub fn extend_from_within(&mut self, range: impl RangeBounds<usize>) {
+        let len = self.len();
+
+        let start = match range.start_bound() {
+            Bound::Included(&n) => n,
+            Bound::Excluded(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Unbounded => 0,
+        };
+        let end = match range.end_bound() {
+            Bound::Included(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Excluded(&n) => n,
+            Bound::Unbounded => len,
+        };
+
+        assert!(
+            start <= end,
+            "range start must not be greater than end: {:?} <= {:?}",
+            start,
+            end,
+        );
+        assert!(
+            end <= len,
+            "range end out of bounds: {:?} <= {:?}",
+            end,
+            len,
+        );
+
+        let cnt = end - start;
+        // May reallocate, so the source pointer is taken afterwards.
+        self.reserve(cnt);
+
+        unsafe {
+            let src = self.as_ptr().add(start);
+            let dst = self.spare_capacity_mut();
+            // Reserved above
+            debug_assert!(dst.len() >= cnt);
+
+            // The destination lies past `len`, so it cannot overlap the source.
+            ptr::copy_nonoverlapping(src, dst.as_mut_ptr().cast(), cnt);
+        }
+
+        unsafe {
+            self.advance_mut(cnt);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
diff --git a/tests/test_bytes.rs b/tests/test_bytes.rs
index b9bd5e1..8becd09 100644
--- a/tests/test_bytes.rs
+++ b/tests/test_bytes.rs
@@ -1720,3 +1720,38 @@ fn bytes_mut_reserve_overflow() {
     // This call relies on the corrupted cap and may cause UB & HBO
     b.put_u8(b'h');
 }
+
+#[test]
+fn extend_from_within_mut() {
+    let mut buf = BytesMut::new();
+    buf.extend_from_slice(b"aaabbb_");
+    buf.extend_from_within(3..6);
+    assert_eq!(&buf[..], b"aaabbb_bbb");
+
+    buf.extend_from_within(..=1);
+    assert_eq!(&buf[..], b"aaabbb_bbbaa");
+    buf.extend_from_within(12..);
+    buf.extend_from_within(5..5);
+    assert_eq!(&buf[..], b"aaabbb_bbbaa");
+
+    // Forces reallocation while the source lives in the old buffer.
+    let mut buf = BytesMut::from(&LONG[..]);
+    buf.extend_from_within(..);
+    assert_eq!(&buf[..LONG.len()], LONG);
+    assert_eq!(&buf[LONG.len()..], LONG);
+}
+
+#[test]
+#[should_panic]
+fn extend_from_within_out_of_bounds() {
+    let mut buf = BytesMut::from(&b"abc"[..]);
+    buf.extend_from_within(1..4);
+}
+
+#[test]
+#[should_panic]
+fn extend_from_within_inverted_range() {
+    let mut buf = BytesMut::from(&b"abc"[..]);
+    #[allow(clippy::reversed_empty_ranges)]
+    buf.extend_from_within(2..1);
+}
```

</details>

<details><summary>reply</summary>

I added `BytesMut::extend_from_within(range: impl RangeBounds<usize>)` in `src/bytes_mut.rs`, placed right after `extend_from_slice`. The new unit tests and the doc test pass; I didn't run the rest of the test suite.

- **Behaviour:** it appends a copy of `range` to the end and grows the buffer as needed. Your example gives `b"aaabbb_bbb"`.
- **Bounds:** it panics if the range end is past the current length, or if the start is greater than the end. That matches `Vec::extend_from_within`.
- **Growth:** the source pointer is read only after the buffer has grown. If the buffer reallocates, the copy still reads from the new allocation rather than a stale pointer.
- **Tests:** in `tests/test_bytes.rs`, I added three tests.
  - Your example, plus unbounded, inclusive and empty ranges.
  - A copy that forces reallocation.
  - Two `should_panic` cases, one for an out-of-bounds range and one for an inverted range.
- **Docs:** the method has a doc comment with your example as a doc test.

I didn't add a `CHANGELOG.md` entry, and I haven't committed anything.

</details>

### claude, hush: pass

Files: [src/bytes_mut.rs](../hush/claude/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs), [tests/test_bytes.rs](../hush/claude/rust-feat-bytes-extend-from-within-1/files/tests/test_bytes.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..7bc2785 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -1,5 +1,5 @@
 use core::mem::{self, ManuallyDrop, MaybeUninit};
-use core::ops::{Deref, DerefMut};
+use core::ops::{Bound, Deref, DerefMut, RangeBounds};
 use core::ptr::{self, NonNull};
 use core::{cmp, fmt, hash, slice};
 
@@ -884,6 +884,63 @@ impl BytesMut {
         }
     }
 
+    /// Copies bytes from `range` of this `BytesMut` and appends them to the end.
+    ///
+    /// If this `BytesMut` object does not have enough capacity, it is resized
+    /// first.
+    ///
+    /// # Panics
+    ///
+    /// Panics if the range is out of bounds for the current length, or if
+    /// its start is greater than its end.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// use bytes::BytesMut;
+    ///
+    /// let mut buf = BytesMut::new();
+    /// buf.extend_from_slice(b"aaabbb_");
+    /// buf.extend_from_within(3..6);
+    ///
+    /// assert_eq!(b"aaabbb_bbb", &buf[..]);
+    /// ```
+    pub fn extend_from_within(&mut self, range: impl RangeBounds<usize>) {
+        let len = self.len();
+
+        let begin = match range.start_bound() {
+            Bound::Included(&n) => n,
+            Bound::Excluded(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Unbounded => 0,
+        };
+
+        let end = match range.end_bound() {
+            Bound::Included(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Excluded(&n) => n,
+            Bound::Unbounded => len,
+        };
+
+        assert!(
+            begin <= end,
+            "range start must not be greater than end: {:?} <= {:?}",
+            begin,
+            end,
+        );
+        assert!(end <= len, "range end out of bounds: {:?} <= {:?}", end, len);
+
+        let cnt = end - begin;
+        self.reserve(cnt);
+
+        // `reserve` may reallocate, so take pointers only afterwards. The
+        // destination starts at `len`, so it never overlaps the source.
+        unsafe {
+            let src = self.as_ptr().add(begin);
+            let dst = self.as_mut_ptr().add(len);
+            ptr::copy_nonoverlapping(src, dst, cnt);
+            self.advance_mut(cnt);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
diff --git a/tests/test_bytes.rs b/tests/test_bytes.rs
index b9bd5e1..eb73062 100644
--- a/tests/test_bytes.rs
+++ b/tests/test_bytes.rs
@@ -1720,3 +1720,33 @@ fn bytes_mut_reserve_overflow() {
     // This call relies on the corrupted cap and may cause UB & HBO
     b.put_u8(b'h');
 }
+
+#[test]
+fn bytes_mut_extend_from_within() {
+    let mut buf = BytesMut::new();
+    buf.extend_from_slice(b"aaabbb_");
+    buf.extend_from_within(3..6);
+    assert_eq!(&buf[..], b"aaabbb_bbb");
+
+    buf.extend_from_within(..2);
+    assert_eq!(&buf[..], b"aaabbb_bbbaa");
+    buf.extend_from_within(10..);
+    assert_eq!(&buf[..], b"aaabbb_bbbaaaa");
+    buf.extend_from_within(..=0);
+    assert_eq!(&buf[..], b"aaabbb_bbbaaaaa");
+    buf.extend_from_within(4..4);
+    assert_eq!(buf.len(), 15);
+
+    // forces reallocation
+    let mut buf = BytesMut::with_capacity(4);
+    buf.extend_from_slice(b"abcd");
+    buf.extend_from_within(..);
+    assert_eq!(&buf[..], b"abcdabcd");
+}
+
+#[test]
+#[should_panic]
+fn bytes_mut_extend_from_within_out_of_bounds() {
+    let mut buf = BytesMut::from(&b"abc"[..]);
+    buf.extend_from_within(2..4);
+}
```

</details>

<details><summary>reply</summary>

Done. Added `BytesMut::extend_from_within` in `src/bytes_mut.rs`, with a doc example and tests in `tests/test_bytes.rs`. Tests and doctest pass; clippy and miri not run.

</details>

### claude, sloth: pass

Files: [src/bytes_mut.rs](../sloth/claude/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..19855f1 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -1,5 +1,5 @@
 use core::mem::{self, ManuallyDrop, MaybeUninit};
-use core::ops::{Deref, DerefMut};
+use core::ops::{Bound, Deref, DerefMut, RangeBounds};
 use core::ptr::{self, NonNull};
 use core::{cmp, fmt, hash, slice};
 
@@ -884,6 +884,68 @@ impl BytesMut {
         }
     }
 
+    /// Appends a copy of the bytes in `range` to the end of this `BytesMut`.
+    ///
+    /// If this `BytesMut` does not have enough capacity, it is resized first.
+    ///
+    /// # Panics
+    ///
+    /// Panics if the range is out of bounds for the current length or its
+    /// start is greater than its end.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// use bytes::BytesMut;
+    ///
+    /// let mut buf = BytesMut::new();
+    /// buf.extend_from_slice(b"aaabbb_");
+    /// buf.extend_from_within(3..6);
+    ///
+    /// assert_eq!(&buf[..], b"aaabbb_bbb");
+    /// ```
+    pub fn extend_from_within(&mut self, range: impl RangeBounds<usize>) {
+        let len = self.len();
+
+        let begin = match range.start_bound() {
+            Bound::Included(&n) => n,
+            Bound::Excluded(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Unbounded => 0,
+        };
+
+        let end = match range.end_bound() {
+            Bound::Included(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Excluded(&n) => n,
+            Bound::Unbounded => len,
+        };
+
+        assert!(
+            begin <= end,
+            "range start must not be greater than end: {:?} <= {:?}",
+            begin,
+            end,
+        );
+        assert!(
+            end <= len,
+            "range end out of bounds: {:?} <= {:?}",
+            end,
+            len,
+        );
+
+        let cnt = end - begin;
+        self.reserve(cnt);
+
+        unsafe {
+            // `reserve` may have moved the buffer, so take the source pointer after it.
+            let src = self.as_ptr().add(begin);
+            let dst = self.spare_capacity_mut();
+            debug_assert!(dst.len() >= cnt);
+
+            ptr::copy_nonoverlapping(src, dst.as_mut_ptr().cast(), cnt);
+            self.advance_mut(cnt);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
```

</details>

<details><summary>reply</summary>

I added `BytesMut::extend_from_within` in `src/bytes_mut.rs`. The full test suite passes, including the doc example from your request.

- **Bounds:** it accepts any `RangeBounds<usize>`, resolved the same way `Bytes::slice` does it. It panics if the range ends past the current length or if its start is greater than its end.
- **Growth:** it reserves space first, which may move the buffer, and only then reads the source bytes. That order is what keeps the copy safe.

I didn't add unit tests, since you didn't ask for any. The only coverage is the doc example, and the panic cases aren't tested. I also didn't touch `CHANGELOG.md`.

</details>

### claude, all: pass

Files: [src/bytes_mut.rs](../all/claude/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..a1e6d6f 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -1,5 +1,5 @@
 use core::mem::{self, ManuallyDrop, MaybeUninit};
-use core::ops::{Deref, DerefMut};
+use core::ops::{Bound, Deref, DerefMut, RangeBounds};
 use core::ptr::{self, NonNull};
 use core::{cmp, fmt, hash, slice};
 
@@ -884,6 +884,67 @@ impl BytesMut {
         }
     }
 
+    /// Appends a copy of the bytes in `range` to the end of this `BytesMut`.
+    ///
+    /// If this `BytesMut` object does not have enough capacity, it is resized
+    /// first.
+    ///
+    /// # Panics
+    ///
+    /// Panics if the range start is greater than the range end, or if the
+    /// range end is greater than `self.len()`.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// use bytes::BytesMut;
+    ///
+    /// let mut buf = BytesMut::new();
+    /// buf.extend_from_slice(b"aaabbb_");
+    /// buf.extend_from_within(3..6);
+    ///
+    /// assert_eq!(&buf[..], b"aaabbb_bbb");
+    /// ```
+    pub fn extend_from_within(&mut self, range: impl RangeBounds<usize>) {
+        let len = self.len();
+
+        let begin = match range.start_bound() {
+            Bound::Included(&n) => n,
+            Bound::Excluded(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Unbounded => 0,
+        };
+        let end = match range.end_bound() {
+            Bound::Included(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Excluded(&n) => n,
+            Bound::Unbounded => len,
+        };
+
+        assert!(
+            begin <= end,
+            "range start must not be greater than end: {:?} <= {:?}",
+            begin,
+            end,
+        );
+        assert!(
+            end <= len,
+            "range end out of bounds: {:?} <= {:?}",
+            end,
+            len,
+        );
+
+        let cnt = end - begin;
+        self.reserve(cnt);
+
+        unsafe {
+            let src = self.as_ptr().add(begin);
+            let dst = self.spare_capacity_mut();
+            debug_assert!(dst.len() >= cnt);
+
+            ptr::copy_nonoverlapping(src, dst.as_mut_ptr().cast(), cnt);
+            self.advance_mut(cnt);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
```

</details>

<details><summary>reply</summary>

Done. Added `BytesMut::extend_from_within` in `src/bytes_mut.rs`, with the same range and panic checks as `Bytes::slice`. The doc example passes and the build is clean. I didn't run the full test suite, and I didn't add other tests.

</details>

### codex, base: pass

Files: [src/bytes_mut.rs](../base/codex/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs), [tests/test_bytes.rs](../base/codex/rust-feat-bytes-extend-from-within-1/files/tests/test_bytes.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..e10eee1 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -1,5 +1,5 @@
 use core::mem::{self, ManuallyDrop, MaybeUninit};
-use core::ops::{Deref, DerefMut};
+use core::ops::{Bound, Deref, DerefMut, RangeBounds};
 use core::ptr::{self, NonNull};
 use core::{cmp, fmt, hash, slice};
 
@@ -884,6 +884,53 @@ impl BytesMut {
         }
     }
 
+    /// Appends a copy of the bytes in `range` to this `BytesMut`.
+    ///
+    /// The buffer is grown as needed to make room for the copied bytes.
+    ///
+    /// # Panics
+    ///
+    /// Panics if the start of the range is greater than its end, or if the
+    /// range is out of bounds for the current length.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// use bytes::BytesMut;
+    ///
+    /// let mut buf = BytesMut::from(&b"aaabbb_"[..]);
+    /// buf.extend_from_within(3..6);
+    /// assert_eq!(&buf[..], b"aaabbb_bbb");
+    /// ```
+    #[inline]
+    pub fn extend_from_within(&mut self, range: impl RangeBounds<usize>) {
+        let start = match range.start_bound() {
+            Bound::Included(&n) => n,
+            Bound::Excluded(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Unbounded => 0,
+        };
+        let end = match range.end_bound() {
+            Bound::Included(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Excluded(&n) => n,
+            Bound::Unbounded => self.len,
+        };
+        assert!(start <= end, "range start must not be greater than end");
+        assert!(end <= self.len, "range out of bounds");
+
+        let cnt = end - start;
+        self.reserve(cnt);
+
+        // SAFETY: The source range is initialized and within the original
+        // length. After reserving, the destination has room for `cnt` bytes
+        // and starts at the original length, so the regions do not overlap.
+        // Obtain both pointers after reserve, which may move the allocation.
+        unsafe {
+            let ptr = self.ptr.as_ptr();
+            ptr::copy_nonoverlapping(ptr.add(start), ptr.add(self.len), cnt);
+            self.advance_mut(cnt);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
diff --git a/tests/test_bytes.rs b/tests/test_bytes.rs
index b9bd5e1..0ecf0a5 100644
--- a/tests/test_bytes.rs
+++ b/tests/test_bytes.rs
@@ -597,6 +597,80 @@ fn extend_mut() {
     assert_eq!(*bytes, LONG[..]);
 }
 
+#[test]
+fn extend_from_within_mut() {
+    use std::ops::Bound::*;
+
+    let ranges = [
+        (Included(3), Excluded(6)),
+        (Included(3), Included(5)),
+        (Excluded(2), Excluded(6)),
+        (Unbounded, Excluded(3)),
+        (Included(3), Unbounded),
+        (Unbounded, Unbounded),
+        (Included(7), Excluded(7)),
+        (Included(0), Excluded(0)),
+    ];
+    for capacity in [7, 64] {
+        for range in ranges {
+            let mut buf = BytesMut::with_capacity(capacity);
+            buf.extend_from_slice(b"aaabbb_");
+            let mut expected = buf.to_vec();
+            expected.extend_from_within(range);
+            buf.extend_from_within(range);
+            assert_eq!(&buf[..], &expected[..]);
+        }
+    }
+
+    let mut empty = BytesMut::new();
+    empty.extend_from_within(..);
+    assert!(empty.is_empty());
+}
+
+#[test]
+fn extend_from_within_mut_shared_and_reclaimed() {
+    for shared in [false, true] {
+        let mut buf = BytesMut::with_capacity(16);
+        buf.extend_from_slice(b"0123456789abcdef");
+        let prefix = buf.split_to(10);
+        let snapshot = prefix.to_vec();
+        if !shared {
+            drop(prefix);
+        } else {
+            // Keep another view alive while growth moves this buffer.
+            buf.extend_from_within(..);
+            assert_eq!(&prefix[..], &snapshot[..]);
+            assert_eq!(&buf[..], b"abcdefabcdef");
+            continue;
+        }
+        buf.extend_from_within(..);
+        assert_eq!(&buf[..], b"abcdefabcdef");
+    }
+}
+
+#[test]
+fn extend_from_within_mut_invalid_ranges() {
+    use std::ops::Bound::*;
+
+    for range in [
+        (Included(4), Excluded(3)),
+        (Included(0), Excluded(8)),
+        (Included(8), Unbounded),
+        (Included(8), Excluded(8)),
+        (Excluded(usize::MAX), Unbounded),
+        (Unbounded, Included(usize::MAX)),
+    ] {
+        let mut buf = BytesMut::from(&b"aaabbb_"[..]);
+        let capacity = buf.capacity();
+        assert!(panic::catch_unwind(AssertUnwindSafe(|| {
+            buf.extend_from_within(range);
+        }))
+        .is_err());
+        assert_eq!(&buf[..], b"aaabbb_");
+        assert_eq!(buf.capacity(), capacity);
+    }
+}
+
 #[test]
 fn extend_from_slice_mut() {
     for &i in &[3, 34] {
```

</details>

<details><summary>reply</summary>

I’ll check how `BytesMut` handles growth and ranges, then add the method and tests for bounds and allocation behavior.

The method is implemented. It validates the range before reserving space, then copies using pointers obtained after any buffer movement. The tests cover range forms, invalid bounds, growth, and buffers with split storage; the full suite is running.

Added `BytesMut::extend_from_within` with range validation, automatic growth, and documentation.

Tests cover range forms, empty ranges, invalid bounds, and shared or reclaimed storage.

Passed `cargo fmt --check`, tests with all features and without default features, and `git diff --check`.

</details>

### codex, muffle: pass

Files: [src/bytes_mut.rs](../muffle/codex/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs), [tests/test_bytes.rs](../muffle/codex/rust-feat-bytes-extend-from-within-1/files/tests/test_bytes.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..7b5076e 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -1,5 +1,5 @@
 use core::mem::{self, ManuallyDrop, MaybeUninit};
-use core::ops::{Deref, DerefMut};
+use core::ops::{Bound, Deref, DerefMut, RangeBounds};
 use core::ptr::{self, NonNull};
 use core::{cmp, fmt, hash, slice};
 
@@ -884,6 +884,51 @@ impl BytesMut {
         }
     }
 
+    /// Appends a copy of the bytes in `range` to this `BytesMut`.
+    ///
+    /// The buffer grows as needed to accommodate the additional bytes.
+    ///
+    /// # Panics
+    ///
+    /// Panics if the range's start is greater than its end, or if either bound
+    /// is out of bounds for the current length.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// use bytes::BytesMut;
+    ///
+    /// let mut buf = BytesMut::from(&b"aaabbb_"[..]);
+    /// buf.extend_from_within(3..6);
+    /// assert_eq!(&buf[..], b"aaabbb_bbb");
+    /// ```
+    pub fn extend_from_within(&mut self, range: impl RangeBounds<usize>) {
+        let start = match range.start_bound() {
+            Bound::Included(&n) => n,
+            Bound::Excluded(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Unbounded => 0,
+        };
+        let end = match range.end_bound() {
+            Bound::Included(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Excluded(&n) => n,
+            Bound::Unbounded => self.len(),
+        };
+        assert!(start <= end, "range start must not be greater than end");
+        assert!(end <= self.len(), "range end out of bounds");
+
+        let count = end - start;
+        self.reserve(count);
+
+        unsafe {
+            // Reserve may move the allocation, so obtain the pointer afterwards.
+            // The source is initialized and ends at or before the destination;
+            // reserve ensures there is room for the entire copy.
+            let ptr = self.ptr.as_ptr();
+            ptr::copy_nonoverlapping(ptr.add(start), ptr.add(self.len()), count);
+            self.advance_mut(count);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
diff --git a/tests/test_bytes.rs b/tests/test_bytes.rs
index b9bd5e1..4d74852 100644
--- a/tests/test_bytes.rs
+++ b/tests/test_bytes.rs
@@ -607,6 +607,68 @@ fn extend_from_slice_mut() {
     }
 }
 
+#[test]
+fn extend_from_within_mut() {
+    use std::ops::Bound::{Excluded, Included, Unbounded};
+
+    let ranges = [
+        (Included(3), Excluded(6)),
+        (Unbounded, Unbounded),
+        (Unbounded, Included(2)),
+        (Excluded(2), Unbounded),
+        (Included(7), Excluded(7)),
+        (Included(0), Excluded(0)),
+    ];
+    for range in ranges {
+        for capacity in [7, 64] {
+            let mut bytes = BytesMut::with_capacity(capacity);
+            bytes.extend_from_slice(b"aaabbb_");
+            let mut expected = bytes.to_vec();
+            expected.extend_from_within(range);
+            bytes.extend_from_within(range);
+            assert_eq!(&bytes[..], &expected[..]);
+        }
+    }
+
+    let mut empty = BytesMut::new();
+    empty.extend_from_within(..);
+    assert!(empty.is_empty());
+
+    // Exercise relocation when reclaiming consumed capacity.
+    let mut bytes = BytesMut::with_capacity(16);
+    bytes.extend_from_slice(b"0123456789abcdef");
+    bytes.advance(10);
+    bytes.extend_from_within(1..5);
+    assert_eq!(&bytes[..], b"abcdefbcde");
+
+    // Growing a split buffer must preserve the other view.
+    let mut bytes = BytesMut::from(&b"aaabbb_"[..]);
+    let other = bytes.split_off(3);
+    bytes.extend_from_within(..);
+    assert_eq!(&bytes[..], b"aaaaaa");
+    assert_eq!(&other[..], b"bbb_");
+}
+
+#[test]
+fn extend_from_within_mut_invalid_ranges() {
+    use std::ops::Bound::{Excluded, Included, Unbounded};
+
+    for range in [
+        (Included(4), Excluded(2)),
+        (Included(0), Excluded(8)),
+        (Included(8), Excluded(8)),
+        (Excluded(usize::MAX), Unbounded),
+        (Unbounded, Included(usize::MAX)),
+    ] {
+        let mut bytes = BytesMut::from(&b"aaabbb_"[..]);
+        assert!(panic::catch_unwind(AssertUnwindSafe(|| {
+            bytes.extend_from_within(range);
+        }))
+        .is_err());
+        assert_eq!(&bytes[..], b"aaabbb_");
+    }
+}
+
 #[test]
 fn extend_mut_from_bytes() {
     let mut bytes = BytesMut::with_capacity(0);
```

</details>

<details><summary>reply</summary>

I’ll check how `BytesMut` handles growth and ranges, add the method, and test the copy and panic behavior.

The method validates the range before growing the buffer, then gets the source pointer after growth so it remains valid if the allocation moves. The new tests pass for range bounds, growth, reclaimed capacity, split buffers, and invalid ranges. Documentation tests and the `no_std` check also pass.

Added `BytesMut::extend_from_within` with documentation and tests. It supports all range bounds, grows the buffer as needed, and panics on invalid ranges before mutation.

Validation passed: all 1,302 tests, formatting, documentation tests, and the `no_std` check.

</details>

### codex, hush: pass

Files: [src/bytes_mut.rs](../hush/codex/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs), [tests/test_bytes.rs](../hush/codex/rust-feat-bytes-extend-from-within-1/files/tests/test_bytes.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..6114a6e 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -1,5 +1,5 @@
 use core::mem::{self, ManuallyDrop, MaybeUninit};
-use core::ops::{Deref, DerefMut};
+use core::ops::{Bound, Deref, DerefMut, RangeBounds};
 use core::ptr::{self, NonNull};
 use core::{cmp, fmt, hash, slice};
 
@@ -884,6 +884,50 @@ impl BytesMut {
         }
     }
 
+    /// Appends a copy of the bytes in `range` to this `BytesMut`.
+    ///
+    /// The buffer grows as needed to hold the appended bytes.
+    ///
+    /// # Panics
+    ///
+    /// Panics if the range starts after its end or ends beyond the current length.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// use bytes::BytesMut;
+    ///
+    /// let mut buf = BytesMut::from(&b"aaabbb_"[..]);
+    /// buf.extend_from_within(3..6);
+    /// assert_eq!(&buf[..], b"aaabbb_bbb");
+    /// ```
+    pub fn extend_from_within(&mut self, range: impl RangeBounds<usize>) {
+        let len = self.len();
+        let start = match range.start_bound() {
+            Bound::Included(&n) => n,
+            Bound::Excluded(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Unbounded => 0,
+        };
+        let end = match range.end_bound() {
+            Bound::Included(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Excluded(&n) => n,
+            Bound::Unbounded => len,
+        };
+        assert!(start <= end, "range start must not be greater than end");
+        assert!(end <= len, "range end out of bounds");
+
+        let count = end - start;
+        self.reserve(count);
+        unsafe {
+            // Reserve may move the buffer, so obtain its pointer afterwards.
+            // The source is initialized and ends before the destination, whose
+            // capacity was reserved above.
+            let ptr = self.as_mut_ptr();
+            ptr::copy_nonoverlapping(ptr.add(start), ptr.add(len), count);
+            self.advance_mut(count);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
diff --git a/tests/test_bytes.rs b/tests/test_bytes.rs
index b9bd5e1..2a70275 100644
--- a/tests/test_bytes.rs
+++ b/tests/test_bytes.rs
@@ -1720,3 +1720,56 @@ fn bytes_mut_reserve_overflow() {
     // This call relies on the corrupted cap and may cause UB & HBO
     b.put_u8(b'h');
 }
+
+#[test]
+fn extend_from_within_mut() {
+    use std::ops::Bound::*;
+
+    let ranges = [
+        (Included(3), Excluded(6)),
+        (Unbounded, Unbounded),
+        (Unbounded, Included(2)),
+        (Excluded(2), Unbounded),
+        (Included(7), Excluded(7)),
+        (Included(0), Excluded(0)),
+    ];
+    for capacity in [7, 64] {
+        for range in ranges {
+            let mut bytes = BytesMut::with_capacity(capacity);
+            bytes.extend_from_slice(b"aaabbb_");
+            let mut expected = bytes.to_vec();
+            expected.extend_from_within(range);
+            bytes.extend_from_within(range);
+            assert_eq!(&bytes[..], &expected[..]);
+        }
+    }
+    let mut empty = BytesMut::new();
+    empty.extend_from_within(..);
+    assert!(empty.is_empty());
+
+    let mut bytes = BytesMut::from(&b"prefixaaabbb_"[..]);
+    let prefix = bytes.split_to(6);
+    bytes.extend_from_within(3..6);
+    assert_eq!(&bytes[..], b"aaabbb_bbb");
+    assert_eq!(&prefix[..], b"prefix");
+}
+
+#[test]
+fn extend_from_within_mut_invalid_ranges() {
+    use std::ops::Bound::*;
+
+    for range in [
+        (Included(4), Excluded(3)),
+        (Included(0), Excluded(8)),
+        (Included(8), Unbounded),
+        (Excluded(usize::MAX), Unbounded),
+        (Unbounded, Included(usize::MAX)),
+    ] {
+        let mut bytes = BytesMut::from(&b"aaabbb_"[..]);
+        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
+            bytes.extend_from_within(range);
+        }));
+        assert!(result.is_err());
+        assert_eq!(&bytes[..], b"aaabbb_");
+    }
+}
```

</details>

<details><summary>reply</summary>

BytesMut method, range checks, and tests coming; checking repository guidance first.


Done.
Added `BytesMut::extend_from_within`, range checks, docs, tests. Formatting, all-feature tests, no-default-features check passed.

</details>

### codex, sloth: pass

Files: [src/bytes_mut.rs](../sloth/codex/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..4b3b4a5 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -1,5 +1,5 @@
 use core::mem::{self, ManuallyDrop, MaybeUninit};
-use core::ops::{Deref, DerefMut};
+use core::ops::{Deref, DerefMut, RangeBounds};
 use core::ptr::{self, NonNull};
 use core::{cmp, fmt, hash, slice};
 
@@ -884,6 +884,62 @@ impl BytesMut {
         }
     }
 
+    /// Appends a copy of the bytes in `range` to this `BytesMut`.
+    ///
+    /// The buffer is grown as needed.
+    ///
+    /// # Panics
+    ///
+    /// Panics if the range start is greater than its end or the range end is
+    /// greater than the current length.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// use bytes::BytesMut;
+    ///
+    /// let mut buf = BytesMut::new();
+    /// buf.extend_from_slice(b"aaabbb_");
+    /// buf.extend_from_within(3..6);
+    /// assert_eq!(&buf[..], b"aaabbb_bbb");
+    /// ```
+    pub fn extend_from_within(&mut self, range: impl RangeBounds<usize>) {
+        use core::ops::Bound;
+
+        let len = self.len();
+        let begin = match range.start_bound() {
+            Bound::Included(&n) => n,
+            Bound::Excluded(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Unbounded => 0,
+        };
+        let end = match range.end_bound() {
+            Bound::Included(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Excluded(&n) => n,
+            Bound::Unbounded => len,
+        };
+
+        assert!(
+            begin <= end,
+            "range start must not be greater than end: {:?} <= {:?}",
+            begin,
+            end,
+        );
+        assert!(
+            end <= len,
+            "range end out of bounds: {:?} <= {:?}",
+            end,
+            len,
+        );
+
+        let cnt = end - begin;
+        self.reserve(cnt);
+        unsafe {
+            let ptr = self.ptr.as_ptr();
+            ptr::copy_nonoverlapping(ptr.add(begin), ptr.add(len), cnt);
+            self.advance_mut(cnt);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
```

</details>

<details><summary>reply</summary>

I’ll check the existing range handling and growth code, add the method in the same style, then build and run the existing tests.

This only needs a change in `src/bytes_mut.rs`; no callers, exports, fixtures, or configuration need updating. I’ll use the existing range-checking conventions and reserve capacity before taking copy pointers, since growing the buffer can move its contents. No extra API or dependencies are needed.

Added `BytesMut::extend_from_within` with range validation, automatic growth, and a documented example. It copies directly within the buffer without a temporary allocation.

Build, existing tests with all features and without default features, and formatting checks all passed.

</details>

### codex, all: pass

Files: [src/bytes_mut.rs](../all/codex/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..b9461be 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -1,5 +1,5 @@
 use core::mem::{self, ManuallyDrop, MaybeUninit};
-use core::ops::{Deref, DerefMut};
+use core::ops::{Bound, Deref, DerefMut, RangeBounds};
 use core::ptr::{self, NonNull};
 use core::{cmp, fmt, hash, slice};
 
@@ -884,6 +884,50 @@ impl BytesMut {
         }
     }
 
+    /// Appends a copy of the bytes in `range` to this `BytesMut`.
+    ///
+    /// The buffer grows as needed to hold the additional bytes.
+    ///
+    /// # Panics
+    ///
+    /// Panics if the range starts after it ends or is out of bounds for the
+    /// current length.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// use bytes::BytesMut;
+    ///
+    /// let mut buf = BytesMut::from(&b"aaabbb_"[..]);
+    /// buf.extend_from_within(3..6);
+    /// assert_eq!(&buf[..], b"aaabbb_bbb");
+    /// ```
+    pub fn extend_from_within(&mut self, range: impl RangeBounds<usize>) {
+        let len = self.len();
+        let start = match range.start_bound() {
+            Bound::Included(&n) => n,
+            Bound::Excluded(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Unbounded => 0,
+        };
+        let end = match range.end_bound() {
+            Bound::Included(&n) => n.checked_add(1).expect("out of range"),
+            Bound::Excluded(&n) => n,
+            Bound::Unbounded => len,
+        };
+
+        assert!(start <= end, "range start must not be greater than end");
+        assert!(end <= len, "range end out of bounds");
+
+        let count = end - start;
+        self.reserve(count);
+
+        unsafe {
+            let ptr = self.ptr.as_ptr();
+            ptr::copy_nonoverlapping(ptr.add(start), ptr.add(len), count);
+            self.advance_mut(count);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
```

</details>

<details><summary>reply</summary>

BytesMut method needs range validation before reserve; checking existing range helpers and allocation paths.


Done. Added `BytesMut::extend_from_within`; bounds checked before growth.
All 1,302 tests passed; no-default-features build and formatting passed.

</details>
