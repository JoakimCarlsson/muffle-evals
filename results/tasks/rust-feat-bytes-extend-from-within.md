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
| claude | muffle | pass | +59/-1 | 36 | 2,396 | $0.072 |
| claude | hush | pass | +49/-1 | 25 | 3,203 | $0.078 |
| claude | sloth | pass | +46/-1 | 32 | 3,336 | $0.099 |
| claude | all | pass | +59/-1 | 34 | 2,296 | $0.083 |
| codex | base | pass | +48/-1 | 74 | 2,109 | - |
| codex | muffle | pass | +51/-1 | 72 | 2,238 | - |
| codex | hush | pass | +46/-1 | 63 | 1,865 | - |
| codex | sloth | pass | +45/-1 | 58 | 2,095 | - |
| codex | all | pass | +45/-1 | 65 | 1,932 | - |

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
index 68c5f73..7d70a24 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -1,5 +1,5 @@
 use core::mem::{self, ManuallyDrop, MaybeUninit};
-use core::ops::{Deref, DerefMut};
+use core::ops::{Bound, Deref, DerefMut, RangeBounds};
 use core::ptr::{self, NonNull};
 use core::{cmp, fmt, hash, slice};
 
@@ -884,6 +884,64 @@ impl BytesMut {
         }
     }
 
+    /// Appends a copy of the bytes in `range` to the end of the buffer,
+    /// reserving additional capacity as needed.
+    ///
+    /// # Panics
+    ///
+    /// Panics if the starting point is greater than the end point or if
+    /// the end point is greater than the length of the buffer.
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
+    pub fn extend_from_within<R>(&mut self, range: R)
+    where
+        R: RangeBounds<usize>,
+    {
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
+            "range start must not be greater than end: {start} <= {end}"
+        );
+        assert!(end <= len, "range end out of bounds: {end} <= {len}");
+
+        let cnt = end - start;
+        self.reserve(cnt);
+
+        // `reserve` may have reallocated, so take the source pointer afterwards.
+        unsafe {
+            let src = self.as_ptr().add(start);
+            let dst = self.spare_capacity_mut();
+            // Reserved above
+            debug_assert!(dst.len() >= cnt);
+
+            // The source lies within the initialized bytes and the destination
+            // within the spare capacity, so they cannot overlap.
+            ptr::copy_nonoverlapping(src, dst.as_mut_ptr().cast(), cnt);
+
+            self.advance_mut(cnt);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
diff --git a/tests/test_bytes.rs b/tests/test_bytes.rs
index b9bd5e1..43eb333 100644
--- a/tests/test_bytes.rs
+++ b/tests/test_bytes.rs
@@ -1720,3 +1720,39 @@ fn bytes_mut_reserve_overflow() {
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
+    buf.extend_from_within(..=1);
+    assert_eq!(&buf[..], b"aaabbb_bbbaa");
+    buf.extend_from_within(10..);
+    assert_eq!(&buf[..], b"aaabbb_bbbaaaa");
+    buf.extend_from_within(5..5);
+    assert_eq!(buf.len(), 14);
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
+    buf.extend_from_within(1..4);
+}
+
+#[test]
+#[should_panic]
+fn bytes_mut_extend_from_within_inverted() {
+    let mut buf = BytesMut::from(&b"abc"[..]);
+    #[allow(clippy::reversed_empty_ranges)]
+    buf.extend_from_within(2..1);
+}
```

</details>

<details><summary>reply</summary>

I added `BytesMut::extend_from_within` in `src/bytes_mut.rs`. The 3 new tests in `tests/test_bytes.rs` and the new doctest pass. I didn't run the rest of the test suite, and `cargo fmt` ran over the repo.

- **Behavior:** it appends a copy of `range` to the end and reserves capacity as needed. It accepts any `RangeBounds<usize>`, including `..`, `..=n` and `n..`.
- **Panics:** it panics if the range start is greater than its end, or if the end is past the current length. That matches `Vec::extend_from_within`.
- **Implementation:** the capacity reservation can reallocate, so the source pointer is taken after it. The copy then goes from the initialized bytes into the spare capacity, so there is no temporary buffer.
- **Tests:**
  - Your example.
  - Open-ended and empty ranges.
  - A case that forces reallocation.
  - Two `should_panic` cases, one out of bounds and one with an inverted range.
- **Not done:** I didn't touch `CHANGELOG.md` or commit anything.

</details>

### claude, hush: pass

Files: [src/bytes_mut.rs](../hush/claude/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs), [tests/test_bytes.rs](../hush/claude/rust-feat-bytes-extend-from-within-1/files/tests/test_bytes.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..06864bc 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -1,5 +1,5 @@
 use core::mem::{self, ManuallyDrop, MaybeUninit};
-use core::ops::{Deref, DerefMut};
+use core::ops::{Bound, Deref, DerefMut, RangeBounds};
 use core::ptr::{self, NonNull};
 use core::{cmp, fmt, hash, slice};
 
@@ -884,6 +884,54 @@ impl BytesMut {
         }
     }
 
+    /// Copies the bytes in `range` and appends them to the end of this `BytesMut`.
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
+        assert!(start <= end, "range start must not be greater than end: {start} <= {end}");
+        assert!(end <= len, "range end out of bounds: {end} <= {len}");
+
+        let cnt = end - start;
+        // May reallocate, so source pointer is taken afterwards.
+        self.reserve(cnt);
+
+        unsafe {
+            let base = self.ptr.as_ptr();
+            // Source lies within `len`, destination starts at `len`: no overlap.
+            ptr::copy_nonoverlapping(base.add(start), base.add(len), cnt);
+            self.advance_mut(cnt);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
diff --git a/tests/test_bytes.rs b/tests/test_bytes.rs
index b9bd5e1..3a158d4 100644
--- a/tests/test_bytes.rs
+++ b/tests/test_bytes.rs
@@ -1720,3 +1720,28 @@ fn bytes_mut_reserve_overflow() {
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
+    buf.extend_from_within(..0);
+    assert_eq!(buf.len(), 12);
+    // forces reallocation
+    let mut b = BytesMut::with_capacity(4);
+    b.extend_from_slice(b"abcd");
+    b.extend_from_within(..);
+    assert_eq!(&b[..], b"abcdabcd");
+}
+
+#[test]
+#[should_panic]
+fn bytes_mut_extend_from_within_oob() {
+    let mut buf = BytesMut::from(&b"abc"[..]);
+    buf.extend_from_within(2..5);
+}
```

</details>

<details><summary>reply</summary>

Done. Added `BytesMut::extend_from_within` in `src/bytes_mut.rs`, with a doc example and two tests in `tests/test_bytes.rs`. It panics on a bad range, and the new tests and doctest pass. I ran only those, not the full suite.

</details>

### claude, sloth: pass

Files: [src/bytes_mut.rs](../sloth/claude/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs), [tests/test_bytes.rs](../sloth/claude/rust-feat-bytes-extend-from-within-1/files/tests/test_bytes.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..e550750 100644
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
 
+    /// Appends a copy of the bytes in `range` to the end of the buffer,
+    /// growing it as needed.
+    ///
+    /// # Panics
+    ///
+    /// Panics if the range is decreasing or extends past the current length.
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
+        assert!(start <= end, "range start {} is greater than end {}", start, end);
+        assert!(end <= len, "range end {} is out of bounds for length {}", end, len);
+
+        let cnt = end - start;
+        self.reserve(cnt);
+
+        unsafe {
+            let src = self.as_ptr().add(start);
+            let dst = self.spare_capacity_mut().as_mut_ptr().cast::<u8>();
+            // `dst` is past `len`, `src..src + cnt` is within `len`: disjoint.
+            ptr::copy_nonoverlapping(src, dst, cnt);
+            self.advance_mut(cnt);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
diff --git a/tests/test_bytes.rs b/tests/test_bytes.rs
index b9bd5e1..da00087 100644
--- a/tests/test_bytes.rs
+++ b/tests/test_bytes.rs
@@ -607,6 +607,38 @@ fn extend_from_slice_mut() {
     }
 }
 
+#[test]
+fn extend_from_within_mut() {
+    let mut bytes = BytesMut::new();
+    bytes.extend_from_slice(b"aaabbb_");
+    bytes.extend_from_within(3..6);
+    assert_eq!(&bytes[..], b"aaabbb_bbb");
+    bytes.extend_from_within(..=1);
+    assert_eq!(&bytes[..], b"aaabbb_bbbaa");
+    bytes.extend_from_within(12..);
+    bytes.extend_from_within(4..4);
+    assert_eq!(&bytes[..], b"aaabbb_bbbaa");
+
+    let mut bytes = BytesMut::from(&LONG[..]);
+    bytes.extend_from_within(..);
+    assert_eq!(bytes.len(), LONG.len() * 2);
+    assert_eq!(bytes[LONG.len()..], LONG[..]);
+}
+
+#[test]
+#[should_panic]
+fn extend_from_within_mut_out_of_bounds() {
+    let mut bytes = BytesMut::from(&b"abc"[..]);
+    bytes.extend_from_within(1..4);
+}
+
+#[test]
+#[should_panic]
+fn extend_from_within_mut_decreasing() {
+    let mut bytes = BytesMut::from(&b"abc"[..]);
+    bytes.extend_from_within(2..1);
+}
+
 #[test]
 fn extend_mut_from_bytes() {
     let mut bytes = BytesMut::with_capacity(0);
```

</details>

<details><summary>reply</summary>

I've added `BytesMut::extend_from_within`, and the new tests and doc test pass. I'm now running the rest of the test suite to check nothing else broke.

I added `BytesMut::extend_from_within(range: impl RangeBounds<usize>)` in `src/bytes_mut.rs`, and the full `cargo test` run passes, including the new tests and a doc test that uses your example.

It appends a copy of the bytes in `range` to the end and grows the buffer as needed. It panics if the range is decreasing or runs past the current length, as `Vec::extend_from_within` does. It accepts every range form, so `..`, `3..`, `..=1` and `3..6` all work.

I put three tests next to the other `extend_*` tests in `tests/test_bytes.rs`. They cover:
- your example;
- `..=1`, `12..` (the end of the buffer), an empty range, and `..` on a buffer long enough to force a reallocation;
- a panic for an out-of-bounds range;
- a panic for a decreasing range.

I haven't committed anything.

</details>

### claude, all: pass

Files: [src/bytes_mut.rs](../all/claude/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs), [tests/test_bytes.rs](../all/claude/rust-feat-bytes-extend-from-within-1/files/tests/test_bytes.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..56f1136 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -1,5 +1,5 @@
 use core::mem::{self, ManuallyDrop, MaybeUninit};
-use core::ops::{Deref, DerefMut};
+use core::ops::{Bound, Deref, DerefMut, RangeBounds};
 use core::ptr::{self, NonNull};
 use core::{cmp, fmt, hash, slice};
 
@@ -884,6 +884,64 @@ impl BytesMut {
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
+            "range start must not be greater than end: {:?} <= {:?}",
+            start,
+            end
+        );
+        assert!(
+            end <= len,
+            "range end out of bounds: {:?} <= {:?}",
+            end,
+            len
+        );
+
+        let cnt = end - start;
+        self.reserve(cnt);
+
+        unsafe {
+            let src = self.as_ptr().add(start);
+            let dst = self.as_mut_ptr().add(len);
+            // Reserved above; source lies below `len`, destination at or past it.
+            ptr::copy_nonoverlapping(src, dst, cnt);
+            self.set_len(len + cnt);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
diff --git a/tests/test_bytes.rs b/tests/test_bytes.rs
index b9bd5e1..91e93e1 100644
--- a/tests/test_bytes.rs
+++ b/tests/test_bytes.rs
@@ -1720,3 +1720,37 @@ fn bytes_mut_reserve_overflow() {
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
+    buf.extend_from_within(10..);
+    assert_eq!(&buf[..], b"aaabbb_bbbaaaa");
+    buf.extend_from_within(4..4);
+    assert_eq!(buf.len(), 14);
+
+    let mut buf = BytesMut::from(&LONG[..]);
+    buf.extend_from_within(..);
+    assert_eq!(buf.len(), LONG.len() * 2);
+    assert_eq!(&buf[LONG.len()..], LONG);
+}
+
+#[test]
+#[should_panic]
+fn extend_from_within_mut_end_out_of_bounds() {
+    let mut buf = BytesMut::from(&b"abc"[..]);
+    buf.extend_from_within(1..4);
+}
+
+#[test]
+#[should_panic]
+fn extend_from_within_mut_start_after_end() {
+    let mut buf = BytesMut::from(&b"abc"[..]);
+    buf.extend_from_within(2..1);
+}
```

</details>

<details><summary>reply</summary>

Done. Added `BytesMut::extend_from_within` in `src/bytes_mut.rs`, with 3 tests in `tests/test_bytes.rs` and a doc test. They pass. I ran only the new tests, not the full suite. Nothing is committed.

It panics if the range end is past `len` or the start is after the end. `cargo fmt` also ran on the repo.

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
index 68c5f73..4f11418 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -1,5 +1,5 @@
 use core::mem::{self, ManuallyDrop, MaybeUninit};
-use core::ops::{Deref, DerefMut};
+use core::ops::{Deref, DerefMut, RangeBounds};
 use core::ptr::{self, NonNull};
 use core::{cmp, fmt, hash, slice};
 
@@ -884,6 +884,56 @@ impl BytesMut {
         }
     }
 
+    /// Appends a copy of the bytes in `range` to this `BytesMut`.
+    ///
+    /// The buffer grows as needed to accommodate the copied bytes.
+    ///
+    /// # Panics
+    ///
+    /// Panics if the range starts after its end or extends beyond the current
+    /// length of the buffer.
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
+        use core::ops::Bound;
+
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
+        // SAFETY: Obtain the pointer after reserving, which may move the buffer.
+        // The validated source range is initialized and ends at or before `len`,
+        // so it cannot overlap the destination. Reservation ensures space for
+        // the copy, and the length is updated only after initializing the bytes.
+        unsafe {
+            let ptr = self.ptr.as_ptr();
+            ptr::copy_nonoverlapping(ptr.add(start), ptr.add(len), count);
+            self.set_len(len + count);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
diff --git a/tests/test_bytes.rs b/tests/test_bytes.rs
index b9bd5e1..94f51e6 100644
--- a/tests/test_bytes.rs
+++ b/tests/test_bytes.rs
@@ -607,6 +607,78 @@ fn extend_from_slice_mut() {
     }
 }
 
+#[test]
+fn extend_from_within_mut() {
+    use std::ops::Bound::{Excluded, Included, Unbounded};
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
+    for capacity in [0, 64] {
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
+fn extend_from_within_shared_mut() {
+    for capacity in [16, 128] {
+        let mut buf = BytesMut::with_capacity(capacity);
+        buf.extend_from_slice(b"prefix:aaabbb_");
+        let prefix = buf.split_to(7);
+        buf.extend_from_within(..);
+        assert_eq!(&buf[..], b"aaabbb_aaabbb_");
+        assert_eq!(&prefix[..], b"prefix:");
+    }
+
+    // Reserving can reclaim the space before the current view.
+    let mut buf = BytesMut::with_capacity(64);
+    buf.extend_from_slice(&[b'x'; 64]);
+    buf.advance(56);
+    buf.extend_from_within(..);
+    assert_eq!(&buf[..], &[b'x'; 16]);
+}
+
+#[test]
+fn extend_from_within_invalid_range_mut() {
+    use std::ops::Bound::{Excluded, Included, Unbounded};
+
+    for range in [
+        (Included(4), Excluded(3)),
+        (Included(0), Excluded(8)),
+        (Included(8), Unbounded),
+        (Included(8), Excluded(8)),
+        (Unbounded, Included(usize::MAX)),
+        (Excluded(usize::MAX), Unbounded),
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
 fn extend_mut_from_bytes() {
     let mut bytes = BytesMut::with_capacity(0);
```

</details>

<details><summary>reply</summary>

I’ll check how `BytesMut` handles ranges and buffer growth, add the method, and test it.

The method validates the range before reserving space and gets the source pointer after reservation, since growth can move the buffer. The tests cover range bounds, empty ranges, buffer growth, shared storage, and invalid ranges.

Added `BytesMut::extend_from_within` with documentation and tests. It supports all range bounds, grows as needed, and panics on invalid ranges before modifying the buffer.

Validation passed: all 1,303 tests, no-default-features check, formatting, and diff checks.

</details>

### codex, hush: pass

Files: [src/bytes_mut.rs](../hush/codex/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs), [tests/test_bytes.rs](../hush/codex/rust-feat-bytes-extend-from-within-1/files/tests/test_bytes.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..88f27a8 100644
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
+    /// Panics if the range start is greater than its end or if the range is
+    /// out of bounds for the current length.
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
+            Bound::Unbounded => self.len,
+        };
+        assert!(start <= end, "range start must not be greater than end");
+        assert!(end <= self.len, "range end out of bounds");
+
+        let count = end - start;
+        self.reserve(count);
+
+        // SAFETY: The source is within the initialized bytes, and reserve
+        // ensures enough space after them. The regions do not overlap.
+        // Obtain pointers after reserve, which may move the allocation.
+        unsafe {
+            let ptr = self.ptr.as_ptr();
+            ptr::copy_nonoverlapping(ptr.add(start), ptr.add(self.len), count);
+            self.len += count;
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
diff --git a/tests/test_bytes.rs b/tests/test_bytes.rs
index b9bd5e1..186ba83 100644
--- a/tests/test_bytes.rs
+++ b/tests/test_bytes.rs
@@ -607,6 +607,69 @@ fn extend_from_slice_mut() {
     }
 }
 
+#[test]
+fn extend_from_within_mut() {
+    use std::ops::Bound::*;
+
+    let ranges = [
+        (Unbounded, Unbounded),
+        (Included(3), Excluded(6)),
+        (Excluded(2), Included(5)),
+        (Unbounded, Included(2)),
+        (Included(3), Unbounded),
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
+    // Exercise growth of an offset view while another view stays alive.
+    let mut bytes = BytesMut::from(&b"prefixaaabbb_"[..]);
+    let prefix = bytes.split_to(6);
+    bytes.extend_from_within(..);
+    assert_eq!(&bytes[..], b"aaabbb_aaabbb_");
+    assert_eq!(&prefix[..], b"prefix");
+
+    // Exercise reclaiming space before the current view.
+    let mut bytes = BytesMut::with_capacity(64);
+    bytes.extend_from_slice(&[b'x'; 64]);
+    bytes.advance(56);
+    bytes.extend_from_within(..);
+    assert_eq!(&bytes[..], &[b'x'; 16]);
+}
+
+#[test]
+fn extend_from_within_mut_invalid_ranges() {
+    use std::ops::Bound::*;
+
+    for range in [
+        (Included(4), Excluded(2)),
+        (Included(0), Excluded(8)),
+        (Included(8), Excluded(8)),
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
+
 #[test]
 fn extend_mut_from_bytes() {
     let mut bytes = BytesMut::with_capacity(0);
```

</details>

<details><summary>reply</summary>

BytesMut needs range checks before reserve, then copying within allocated storage.


Done.
Added `BytesMut::extend_from_within` with bounds checks, growth, docs, tests. All-feature tests, no-default-features check, formatting passed.

</details>

### codex, sloth: pass

Files: [src/bytes_mut.rs](../sloth/codex/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs), [tests/test_bytes.rs](../sloth/codex/rust-feat-bytes-extend-from-within-1/files/tests/test_bytes.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..aed9505 100644
--- a/src/bytes_mut.rs
+++ b/src/bytes_mut.rs
@@ -1,5 +1,5 @@
 use core::mem::{self, ManuallyDrop, MaybeUninit};
-use core::ops::{Deref, DerefMut};
+use core::ops::{Deref, DerefMut, RangeBounds};
 use core::ptr::{self, NonNull};
 use core::{cmp, fmt, hash, slice};
 
@@ -884,6 +884,50 @@ impl BytesMut {
         }
     }
 
+    /// Appends a copy of the bytes in `range` to this `BytesMut`, growing the
+    /// buffer as needed.
+    ///
+    /// # Panics
+    ///
+    /// Panics if the range's start is greater than its end or if the range
+    /// is out of bounds for the current length.
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
+    #[inline]
+    pub fn extend_from_within(&mut self, range: impl RangeBounds<usize>) {
+        use core::ops::Bound;
+
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
+        assert!(end <= self.len, "range end out of bounds");
+
+        let count = end - start;
+        self.reserve(count);
+        unsafe {
+            let ptr = self.ptr.as_ptr();
+            ptr::copy_nonoverlapping(ptr.add(start), ptr.add(self.len), count);
+            self.set_len(self.len + count);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
diff --git a/tests/test_bytes.rs b/tests/test_bytes.rs
index b9bd5e1..0127ff7 100644
--- a/tests/test_bytes.rs
+++ b/tests/test_bytes.rs
@@ -607,6 +607,64 @@ fn extend_from_slice_mut() {
     }
 }
 
+#[test]
+/// Checks self copies across storage modes and range boundaries.
+fn extend_from_within_mut() {
+    use std::ops::Bound::{Excluded, Included, Unbounded};
+
+    let mut bytes = BytesMut::new();
+    bytes.extend_from_slice(b"aaabbb_");
+    bytes.extend_from_within(3..6);
+    assert_eq!(&bytes[..], b"aaabbb_bbb");
+
+    let bounds = [
+        Unbounded,
+        Included(0),
+        Included(3),
+        Included(7),
+        Included(8),
+        Included(usize::MAX),
+        Excluded(0),
+        Excluded(3),
+        Excluded(7),
+        Excluded(8),
+        Excluded(usize::MAX),
+    ];
+    for capacity in [7, 64] {
+        for shared in [false, true] {
+            for start in bounds {
+                for end in bounds {
+                    let mut bytes = BytesMut::with_capacity(capacity);
+                    bytes.extend_from_slice(b"aaabbb_");
+                    let prefix = if shared {
+                        Some(bytes.split_to(1))
+                    } else {
+                        None
+                    };
+                    let mut expected = bytes.to_vec();
+                    let range = (start, end);
+                    let expected_result = panic::catch_unwind(AssertUnwindSafe(|| {
+                        expected.extend_from_within(range);
+                    }));
+                    let result = panic::catch_unwind(AssertUnwindSafe(|| {
+                        bytes.extend_from_within(range);
+                    }));
+                    assert_eq!(result.is_ok(), expected_result.is_ok());
+                    assert_eq!(&bytes[..], &expected[..]);
+                    if let Some(prefix) = prefix {
+                        assert_eq!(&prefix[..], b"a");
+                    }
+                }
+            }
+        }
+    }
+
+    let mut empty = BytesMut::new();
+    empty.extend_from_within(..);
+    empty.extend_from_within(0..0);
+    assert!(empty.is_empty());
+}
+
 #[test]
 fn extend_mut_from_bytes() {
     let mut bytes = BytesMut::with_capacity(0);
```

</details>

<details><summary>reply</summary>

I’ll check the existing buffer growth and range handling code, add the method and focused tests, then run the build and test suite.

This needs changes in `src/bytes_mut.rs` and the existing `tests/test_bytes.rs`; there are no callers or exports to update. I’ll follow the range handling used by `Bytes::slice` and reserve capacity before taking the copy pointers, since growth can move the buffer. No dependency or configuration changes are needed.

The method and regression test are in place. All 1,303 all-feature tests pass, including range checks against `Vec::extend_from_within` and copies from shared buffers. The build and tests without default features are still running.

Added `BytesMut::extend_from_within` with range validation, automatic growth, and a documentation example.

Tests cover empty ranges, invalid bounds, overflow, growth, and shared buffers.

Validation passed: build, formatting, 1,303 all-feature tests, and 1,176 tests without default features.

</details>

### codex, all: pass

Files: [src/bytes_mut.rs](../all/codex/rust-feat-bytes-extend-from-within-1/files/src/bytes_mut.rs), [tests/test_bytes.rs](../all/codex/rust-feat-bytes-extend-from-within-1/files/tests/test_bytes.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/bytes_mut.rs b/src/bytes_mut.rs
index 68c5f73..b204ec2 100644
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
+    /// Panics if the range starts after its end or ends beyond the current length.
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
+        assert!(end <= self.len, "range end out of bounds");
+
+        let count = end - start;
+        self.reserve(count);
+        unsafe {
+            ptr::copy_nonoverlapping(
+                self.ptr.as_ptr().add(start),
+                self.ptr.as_ptr().add(self.len),
+                count,
+            );
+            self.advance_mut(count);
+        }
+    }
+
     /// Absorbs a `BytesMut` that was previously split off if they are
     /// contiguous, otherwise appends its bytes to this `BytesMut`.
     ///
diff --git a/tests/test_bytes.rs b/tests/test_bytes.rs
index b9bd5e1..df5b798 100644
--- a/tests/test_bytes.rs
+++ b/tests/test_bytes.rs
@@ -607,6 +607,71 @@ fn extend_from_slice_mut() {
     }
 }
 
+#[test]
+/// Checks self-copying across range bounds, storage layouts, and invalid ranges.
+fn extend_from_within_mut() {
+    use std::ops::Bound::{Excluded, Included, Unbounded};
+
+    for range in [
+        (Included(3), Excluded(6)),
+        (Excluded(2), Included(5)),
+        (Unbounded, Excluded(3)),
+        (Included(3), Unbounded),
+        (Unbounded, Unbounded),
+        (Included(7), Excluded(7)),
+        (Unbounded, Excluded(0)),
+    ] {
+        for capacity in [7, 64] {
+            for shared in [false, true] {
+                let mut buf = BytesMut::with_capacity(capacity);
+                buf.extend_from_slice(b"aaabbb_");
+                let prefix = if shared {
+                    buf.split_to(1)
+                } else {
+                    BytesMut::new()
+                };
+                let mut expected = buf.to_vec();
+                let result = panic::catch_unwind(AssertUnwindSafe(|| {
+                    expected.extend_from_within(range);
+                }));
+                if result.is_ok() {
+                    buf.extend_from_within(range);
+                    assert_eq!(&buf[..], &expected[..]);
+                } else {
+                    let original = buf.to_vec();
+                    assert!(panic::catch_unwind(AssertUnwindSafe(|| {
+                        buf.extend_from_within(range);
+                    }))
+                    .is_err());
+                    assert_eq!(&buf[..], &original[..]);
+                }
+                if shared {
+                    assert_eq!(&prefix[..], b"a");
+                }
+            }
+        }
+    }
+
+    let mut empty = BytesMut::new();
+    empty.extend_from_within(..);
+    assert!(empty.is_empty());
+
+    for range in [
+        (Included(5), Excluded(3)),
+        (Included(0), Included(7)),
+        (Included(8), Unbounded),
+        (Excluded(usize::MAX), Unbounded),
+        (Unbounded, Included(usize::MAX)),
+    ] {
+        let mut buf = BytesMut::from(&b"aaabbb_"[..]);
+        assert!(panic::catch_unwind(AssertUnwindSafe(|| {
+            buf.extend_from_within(range);
+        }))
+        .is_err());
+        assert_eq!(&buf[..], b"aaabbb_");
+    }
+}
+
 #[test]
 fn extend_mut_from_bytes() {
     let mut bytes = BytesMut::with_capacity(0);
```

</details>

<details><summary>reply</summary>

Done.
Added `BytesMut::extend_from_within` with growth, bounds checks, docs, edge-case tests. All 1,303 tests passed; no-default-features build passed.

</details>
