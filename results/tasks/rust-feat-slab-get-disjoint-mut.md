# rust-feat-slab-get-disjoint-mut

Source: https://github.com/tokio-rs/slab/pull/149

## Prompt

> I'd like `Slab` to have a `get_disjoint_mut`, like the one on slices, `HashMap` and `IndexMap`, so I can get mutable references to several entries at once (for example to swap two values) without unsafe code or juggling `remove`/`insert`.
> 
> Signature I'm after:
> 
> ```rust
> pub fn get_disjoint_mut<const N: usize>(&mut self, keys: [usize; N]) -> Result<[&mut T; N], GetDisjointMutError>
> ```
> 
> The result is in the same order as `keys`. `GetDisjointMutError` would be a new public enum, exported from the crate root, deriving `Debug`, `Clone`, `PartialEq` and `Eq`, with these variants:
> 
> - `OverlappingIndices`: the same key appears twice. This is checked for all keys before anything else, so `[42, 2, 1, 2]` gives this error even though 42 is out of bounds and 1 is vacant.
> - `IndexOutOfBounds`: a key is past the end of the slab.
> - `IndexVacant`: a key is in bounds but has no value.
> 
> Otherwise the keys are checked in order and the first bad one decides the error: with a 5-slot slab where key 1 is vacant, `[1, 5]` is `IndexVacant` and `[5, 1]` is `IndexOutOfBounds`. An empty key array returns `Ok([])`.
> 
> ```rust
> let mut slab = Slab::new();
> let a = slab.insert(1);
> let b = slab.insert(2);
> let [x, y] = slab.get_disjoint_mut([a, b]).unwrap();
> std::mem::swap(x, y);
> assert_eq!((slab[a], slab[b]), (2, 1));
> ```
> 
> Please add this.

## Upstream change (tests left out)

Files: [Cargo.toml](../../tasks/rust-feat-slab-get-disjoint-mut/upstream/Cargo.toml), [src/lib.rs](../../tasks/rust-feat-slab-get-disjoint-mut/upstream/src/lib.rs), [tests/slab.rs](../../tasks/rust-feat-slab-get-disjoint-mut/upstream/tests/slab.rs)

```diff
diff --git a/Cargo.toml b/Cargo.toml
index 9e0c186..e237215 100644
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -9,7 +9,7 @@ name = "slab"
 version = "0.4.9"
 authors = ["Carl Lerche <me@carllerche.com>"]
 edition = "2018"
-rust-version = "1.46"
+rust-version = "1.51"
 license = "MIT"
 description = "Pre-allocated storage for a uniform data type"
 repository = "https://github.com/tokio-rs/slab"
diff --git a/src/lib.rs b/src/lib.rs
index cd5fe0e..bd00e08 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -125,6 +125,7 @@ mod builder;
 
 use alloc::vec::{self, Vec};
 use core::iter::{self, FromIterator, FusedIterator};
+use core::mem::MaybeUninit;
 use core::{fmt, mem, ops, slice};
 
 /// Pre-allocated storage for a uniform data type
@@ -169,6 +170,33 @@ impl<T> Default for Slab<T> {
     }
 }
 
+#[derive(Debug, Clone, PartialEq, Eq)]
+/// The error type returned by [`Slab::get_disjoint_mut`].
+pub enum GetDisjointMutError {
+    /// An index provided was not associated with a value.
+    IndexVacant,
+
+    /// An index provided was out-of-bounds for the slab.
+    IndexOutOfBounds,
+
+    /// Two indices provided were overlapping.
+    OverlappingIndices,
+}
+
+impl fmt::Display for GetDisjointMutError {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        let msg = match self {
+            GetDisjointMutError::IndexVacant => "an index is vacant",
+            GetDisjointMutError::IndexOutOfBounds => "an index is out of bounds",
+            GetDisjointMutError::OverlappingIndices => "there were overlapping indices",
+        };
+        fmt::Display::fmt(msg, f)
+    }
+}
+
+#[cfg(feature = "std")]
+impl std::error::Error for GetDisjointMutError {}
+
 /// A handle to a vacant entry in a `Slab`.
 ///
 /// `VacantEntry` allows constructing values with the key that they will be
@@ -776,6 +804,49 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Returns mutable references to many indices at once.
+    ///
+    /// Returns [`GetDisjointMutError`] if the indices are out of bounds,
+    /// overlapping, or vacant.
+    pub fn get_disjoint_mut<const N: usize>(
+        &mut self,
+        keys: [usize; N],
+    ) -> Result<[&mut T; N], GetDisjointMutError> {
+        // NB: The optimizer should inline the loops into a sequence
+        // of instructions without additional branching.
+        for (i, &key) in keys.iter().enumerate() {
+            for &prev_key in &keys[..i] {
+                if key == prev_key {
+                    return Err(GetDisjointMutError::OverlappingIndices);
+                }
+            }
+        }
+
+        let entries_ptr = self.entries.as_mut_ptr();
+        let entries_cap = self.entries.capacity();
+
+        let mut res = MaybeUninit::<[&mut T; N]>::uninit();
+        let res_ptr = res.as_mut_ptr() as *mut &mut T;
+
+        for (i, &key) in keys.iter().enumerate() {
+            if key >= entries_cap {
+                return Err(GetDisjointMutError::IndexOutOfBounds);
+            }
+            // SAFETY: we made sure above that this key is in bounds.
+            match unsafe { &mut *entries_ptr.add(key) } {
+                Entry::Vacant(_) => return Err(GetDisjointMutError::IndexVacant),
+                Entry::Occupied(entry) => {
+                    // SAFETY: `res` and `keys` both have N elements so `i` must be in bounds.
+                    // We checked above that all selected `entry`s are distinct.
+                    unsafe { res_ptr.add(i).write(entry) };
+                }
+            }
+        }
+        // SAFETY: the loop above only terminates successfully if it initialized
+        // all elements of this array.
+        Ok(unsafe { res.assume_init() })
+    }
+
     /// Return a reference to the value associated with the given key without
     /// performing bounds checking.
     ///
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +86/-1 | 19 | 3,712 | $0.095 |
| claude | muffle | pass | +79/-0 | 27 | 3,655 | $0.089 |
| claude | hush | pass | +92/-1 | 27 | 3,453 | $0.102 |
| claude | sloth | pass | +59/-1 | 27 | 3,883 | $0.117 |
| claude | all | pass | +67/-1 | 19 | 2,850 | $0.089 |
| codex | base | pass | +73/-1 | 58 | 2,753 | - |
| codex | muffle | pass | +74/-1 | 68 | 2,461 | - |
| codex | hush | pass | +68/-1 | 51 | 2,160 | - |
| codex | sloth | pass | +63/-1 | 43 | 2,896 | - |
| codex | all | pass | +61/-1 | 41 | 2,105 | - |

### claude, base: pass

Files: [CHANGELOG.md](../base/claude/rust-feat-slab-get-disjoint-mut-1/files/CHANGELOG.md), [Cargo.toml](../base/claude/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../base/claude/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs), [tests/slab.rs](../base/claude/rust-feat-slab-get-disjoint-mut-1/files/tests/slab.rs)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index f46a797..361bd81 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,3 +1,8 @@
+# Unreleased
+
+* Add `Slab::get_disjoint_mut` and `GetDisjointMutError`
+* Raise MSRV to 1.51 (const generics)
+
 # 0.4.9 (August 22, 2023)
 
 * Avoid reallocations in `Slab::clone_from` (#137)
diff --git a/Cargo.toml b/Cargo.toml
index 9e0c186..e237215 100644
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -9,7 +9,7 @@ name = "slab"
 version = "0.4.9"
 authors = ["Carl Lerche <me@carllerche.com>"]
 edition = "2018"
-rust-version = "1.46"
+rust-version = "1.51"
 license = "MIT"
 description = "Pre-allocated storage for a uniform data type"
 repository = "https://github.com/tokio-rs/slab"
diff --git a/src/lib.rs b/src/lib.rs
index cd5fe0e..f7deb65 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -125,6 +125,7 @@ mod builder;
 
 use alloc::vec::{self, Vec};
 use core::iter::{self, FromIterator, FusedIterator};
+use core::mem::MaybeUninit;
 use core::{fmt, mem, ops, slice};
 
 /// Pre-allocated storage for a uniform data type
@@ -230,6 +231,30 @@ pub struct Drain<'a, T> {
     len: usize,
 }
 
+/// The error type returned by [`Slab::get_disjoint_mut`].
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum GetDisjointMutError {
+    /// The same key was given more than once.
+    OverlappingIndices,
+    /// A key is past the end of the slab.
+    IndexOutOfBounds,
+    /// A key is in bounds but has no value.
+    IndexVacant,
+}
+
+impl fmt::Display for GetDisjointMutError {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        f.write_str(match self {
+            GetDisjointMutError::OverlappingIndices => "an index is repeated",
+            GetDisjointMutError::IndexOutOfBounds => "an index is out of bounds",
+            GetDisjointMutError::IndexVacant => "an index is vacant",
+        })
+    }
+}
+
+#[cfg(feature = "std")]
+impl std::error::Error for GetDisjointMutError {}
+
 #[derive(Clone)]
 enum Entry<T> {
     Vacant(usize),
@@ -776,6 +801,61 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with several keys
+    /// at once. The result is in the same order as `keys`.
+    ///
+    /// All keys are first checked for duplicates, which yields
+    /// [`GetDisjointMutError::OverlappingIndices`]. Otherwise the keys are
+    /// checked in order and the first invalid one decides the error:
+    /// [`IndexOutOfBounds`](GetDisjointMutError::IndexOutOfBounds) if it is
+    /// past the end of the slab, or
+    /// [`IndexVacant`](GetDisjointMutError::IndexVacant) if it has no value.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// # use slab::*;
+    /// let mut slab = Slab::new();
+    /// let a = slab.insert(1);
+    /// let b = slab.insert(2);
+    /// let [x, y] = slab.get_disjoint_mut([a, b]).unwrap();
+    /// std::mem::swap(x, y);
+    /// assert_eq!((slab[a], slab[b]), (2, 1));
+    /// ```
+    pub fn get_disjoint_mut<const N: usize>(
+        &mut self,
+        keys: [usize; N],
+    ) -> Result<[&mut T; N], GetDisjointMutError> {
+        for i in 1..N {
+            if keys[..i].contains(&keys[i]) {
+                return Err(GetDisjointMutError::OverlappingIndices);
+            }
+        }
+        for &key in keys.iter() {
+            match self.entries.get(key) {
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                Some(Entry::Occupied(_)) => {}
+            }
+        }
+
+        let base = self.entries.as_mut_ptr();
+        let mut out = MaybeUninit::<[&mut T; N]>::uninit();
+        let out_ptr = out.as_mut_ptr() as *mut &mut T;
+        for (i, &key) in keys.iter().enumerate() {
+            // SAFETY: every key is in bounds and occupied (checked above) and
+            // all keys are distinct, so the references do not alias.
+            unsafe {
+                match &mut *base.add(key) {
+                    Entry::Occupied(val) => out_ptr.add(i).write(val),
+                    Entry::Vacant(_) => core::hint::unreachable_unchecked(),
+                }
+            }
+        }
+        // SAFETY: all N elements were initialized above.
+        Ok(unsafe { out.assume_init() })
+    }
+
     /// Return a reference to the value associated with the given key without
     /// performing bounds checking.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..f48b54c 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,22 @@ fn clone_from() {
     assert_eq!(iter2.next(), None);
     assert!(slab2.capacity() >= 10);
 }
+
+#[test]
+fn get_disjoint_mut() {
+    use slab::GetDisjointMutError::*;
+    let mut slab = Slab::new();
+    for i in 0..5 {
+        slab.insert(i);
+    }
+    slab.remove(1);
+
+    let [a, b] = slab.get_disjoint_mut([3, 0]).unwrap();
+    std::mem::swap(a, b);
+    assert_eq!((slab[3], slab[0]), (0, 3));
+
+    assert_eq!(slab.get_disjoint_mut([]).unwrap().len(), 0);
+    assert_eq!(slab.get_disjoint_mut([42, 2, 1, 2]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(IndexOutOfBounds));
+}
```

</details>

<details><summary>reply</summary>

I added `Slab::get_disjoint_mut` with the signature you gave. The full test suite passes with default features, and the lib and integration tests also pass with `--no-default-features`.

- **Checking order:** it first looks for duplicate keys across the whole array. After that it checks keys in order, so the first bad key decides whether you get `IndexOutOfBounds` or `IndexVacant`. An empty key array returns `Ok([])`.
- **New error type:** `GetDisjointMutError` is a public enum with `OverlappingIndices`, `IndexOutOfBounds` and `IndexVacant`. It derives `Debug`, `Clone`, `PartialEq` and `Eq`. It is exported from the crate root, because it is a public item in `lib.rs`.
- **Extra trait impls:** I also gave it `Display`, plus `std::error::Error` when the `std` feature is on. You didn't ask for these.
- **Unsafe code:** the method has a small `unsafe` block inside. It only runs after every key has been checked as distinct, in bounds and occupied, so callers never see any `unsafe`.
- **Tests and docs:** I added a test in `tests/slab.rs` covering swapping, an empty array, and your three error examples (`[42, 2, 1, 2]`, `[1, 5]` and `[5, 1]`). The method also has a doc example, which is your swap snippet, and a CHANGELOG entry.

**MSRV bump:** `const N: usize` needs Rust 1.51, and the crate declared `rust-version = "1.46"`. I raised it to 1.51 in `Cargo.toml` and noted it in the CHANGELOG. If you need to keep 1.46, this signature can't be supported.

I haven't committed anything.

</details>

### claude, muffle: pass

Files: [src/lib.rs](../muffle/claude/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs), [tests/slab.rs](../muffle/claude/rust-feat-slab-get-disjoint-mut-1/files/tests/slab.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/lib.rs b/src/lib.rs
index cd5fe0e..b0de164 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -230,6 +230,31 @@ pub struct Drain<'a, T> {
     len: usize,
 }
 
+/// The error type returned by [`Slab::get_disjoint_mut`].
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum GetDisjointMutError {
+    /// The same key was given more than once.
+    OverlappingIndices,
+    /// A key is past the end of the slab.
+    IndexOutOfBounds,
+    /// A key is in bounds but has no value associated with it.
+    IndexVacant,
+}
+
+impl fmt::Display for GetDisjointMutError {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        let msg = match self {
+            GetDisjointMutError::OverlappingIndices => "an index is provided more than once",
+            GetDisjointMutError::IndexOutOfBounds => "an index is out of bounds",
+            GetDisjointMutError::IndexVacant => "an index is vacant",
+        };
+        f.write_str(msg)
+    }
+}
+
+#[cfg(feature = "std")]
+impl std::error::Error for GetDisjointMutError {}
+
 #[derive(Clone)]
 enum Entry<T> {
     Vacant(usize),
@@ -776,6 +801,60 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with `N` keys
+    /// simultaneously. The result is in the same order as `keys`.
+    ///
+    /// Duplicate keys are rejected first, before any other check. The
+    /// remaining keys are then checked in order and the first bad one
+    /// determines the error.
+    ///
+    /// # Errors
+    ///
+    /// * [`GetDisjointMutError::OverlappingIndices`] if a key appears twice.
+    /// * [`GetDisjointMutError::IndexOutOfBounds`] if a key is past the end of
+    ///   the slab.
+    /// * [`GetDisjointMutError::IndexVacant`] if a key has no value.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// # use slab::*;
+    /// let mut slab = Slab::new();
+    /// let a = slab.insert(1);
+    /// let b = slab.insert(2);
+    /// let [x, y] = slab.get_disjoint_mut([a, b]).unwrap();
+    /// std::mem::swap(x, y);
+    /// assert_eq!((slab[a], slab[b]), (2, 1));
+    /// ```
+    pub fn get_disjoint_mut<const N: usize>(
+        &mut self,
+        keys: [usize; N],
+    ) -> Result<[&mut T; N], GetDisjointMutError> {
+        for i in 1..N {
+            if keys[..i].contains(&keys[i]) {
+                return Err(GetDisjointMutError::OverlappingIndices);
+            }
+        }
+
+        for &key in keys.iter() {
+            match self.entries.get(key) {
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                Some(Entry::Occupied(_)) => {}
+            }
+        }
+
+        let base = self.entries.as_mut_ptr();
+        Ok(keys.map(|key| {
+            // SAFETY: every key is in bounds and distinct, so each pointer is
+            // valid and the resulting references do not alias.
+            match unsafe { &mut *base.add(key) } {
+                Entry::Occupied(val) => val,
+                Entry::Vacant(_) => unreachable!(),
+            }
+        }))
+    }
+
     /// Return a reference to the value associated with the given key without
     /// performing bounds checking.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..2cf8dbd 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,30 @@ fn clone_from() {
     assert_eq!(iter2.next(), None);
     assert!(slab2.capacity() >= 10);
 }
+
+#[test]
+fn get_disjoint_mut() {
+    let mut slab = Slab::new();
+    for i in 0..5 {
+        slab.insert(i);
+    }
+    slab.remove(1);
+
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+    let [a, b] = slab.get_disjoint_mut([3, 0]).unwrap();
+    std::mem::swap(a, b);
+    assert_eq!((slab[3], slab[0]), (0, 3));
+
+    assert_eq!(
+        slab.get_disjoint_mut([42, 2, 1, 2]),
+        Err(GetDisjointMutError::OverlappingIndices)
+    );
+    assert_eq!(
+        slab.get_disjoint_mut([1, 5]),
+        Err(GetDisjointMutError::IndexVacant)
+    );
+    assert_eq!(
+        slab.get_disjoint_mut([5, 1]),
+        Err(GetDisjointMutError::IndexOutOfBounds)
+    );
+}
```

</details>

<details><summary>reply</summary>

Now a test for the specified error cases.

I added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum to `src/lib.rs`, and `cargo test` passes with a new test in `tests/slab.rs`. The enum is defined in the crate root, so `slab::GetDisjointMutError` works. It derives `Debug`, `Clone`, `PartialEq` and `Eq`.

- **Behaviour:** the method follows the signature and ordering rules you gave. Duplicate keys are rejected first. The remaining keys are then checked in order, and the first bad one decides `IndexOutOfBounds` or `IndexVacant`. An empty array returns `Ok([])`.
- **Unsafe:** callers need no unsafe code, but the method itself uses one small `unsafe` block. It runs only after every key has been checked as distinct, in bounds and occupied.
- **Test:** it covers your swap example and `[]`. It also checks `[42, 2, 1, 2]`, `[1, 5]` and `[5, 1]` on a 5-slot slab with key 1 vacant.
- **Beyond the spec:** I added a `Display` impl for the error, and a `std::error::Error` impl behind the `std` feature.
- **MSRV:** `Cargo.toml` declares `rust-version = "1.46"`, but const generics need Rust 1.51 and `[T; N]::map` needs 1.55. The MSRV needs raising to 1.55, or the method needs a different implementation. I left `Cargo.toml` alone.
- **Changelog:** I didn't add an entry to `CHANGELOG.md`.

I made no commit.

</details>

### claude, hush: pass

Files: [Cargo.toml](../hush/claude/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../hush/claude/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs), [tests/slab.rs](../hush/claude/rust-feat-slab-get-disjoint-mut-1/files/tests/slab.rs)

<details><summary>diff</summary>

```diff
diff --git a/Cargo.toml b/Cargo.toml
index 9e0c186..e237215 100644
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -9,7 +9,7 @@ name = "slab"
 version = "0.4.9"
 authors = ["Carl Lerche <me@carllerche.com>"]
 edition = "2018"
-rust-version = "1.46"
+rust-version = "1.51"
 license = "MIT"
 description = "Pre-allocated storage for a uniform data type"
 repository = "https://github.com/tokio-rs/slab"
diff --git a/src/lib.rs b/src/lib.rs
index cd5fe0e..affb101 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -125,6 +125,7 @@ mod builder;
 
 use alloc::vec::{self, Vec};
 use core::iter::{self, FromIterator, FusedIterator};
+use core::mem::MaybeUninit;
 use core::{fmt, mem, ops, slice};
 
 /// Pre-allocated storage for a uniform data type
@@ -230,6 +231,31 @@ pub struct Drain<'a, T> {
     len: usize,
 }
 
+/// The error type returned by [`Slab::get_disjoint_mut`].
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum GetDisjointMutError {
+    /// The same key was given more than once.
+    OverlappingIndices,
+    /// A key is past the end of the slab.
+    IndexOutOfBounds,
+    /// A key is in bounds but has no value.
+    IndexVacant,
+}
+
+impl fmt::Display for GetDisjointMutError {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        let msg = match self {
+            GetDisjointMutError::OverlappingIndices => "an index is provided more than once",
+            GetDisjointMutError::IndexOutOfBounds => "an index is out of bounds",
+            GetDisjointMutError::IndexVacant => "an index is vacant",
+        };
+        f.write_str(msg)
+    }
+}
+
+#[cfg(feature = "std")]
+impl std::error::Error for GetDisjointMutError {}
+
 #[derive(Clone)]
 enum Entry<T> {
     Vacant(usize),
@@ -725,6 +751,71 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with the given keys
+    /// simultaneously.
+    ///
+    /// The references are returned in the same order as `keys`.
+    ///
+    /// # Errors
+    ///
+    /// All keys are first checked for duplicates, returning
+    /// [`GetDisjointMutError::OverlappingIndices`] if any key appears twice.
+    /// Then the keys are checked in order, and the first bad key decides the
+    /// error: [`GetDisjointMutError::IndexOutOfBounds`] if it is past the end
+    /// of the slab, [`GetDisjointMutError::IndexVacant`] if it has no value.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// # use slab::*;
+    /// let mut slab = Slab::new();
+    /// let a = slab.insert(1);
+    /// let b = slab.insert(2);
+    /// let [x, y] = slab.get_disjoint_mut([a, b]).unwrap();
+    /// std::mem::swap(x, y);
+    /// assert_eq!((slab[a], slab[b]), (2, 1));
+    ///
+    /// assert_eq!(
+    ///     slab.get_disjoint_mut([a, a]),
+    ///     Err(GetDisjointMutError::OverlappingIndices)
+    /// );
+    /// assert_eq!(
+    ///     slab.get_disjoint_mut([a, 5]),
+    ///     Err(GetDisjointMutError::IndexOutOfBounds)
+    /// );
+    /// ```
+    pub fn get_disjoint_mut<const N: usize>(
+        &mut self,
+        keys: [usize; N],
+    ) -> Result<[&mut T; N], GetDisjointMutError> {
+        for i in 1..N {
+            if keys[..i].contains(&keys[i]) {
+                return Err(GetDisjointMutError::OverlappingIndices);
+            }
+        }
+
+        let len = self.entries.len();
+        let base = self.entries.as_mut_ptr();
+        let mut out: MaybeUninit<[&mut T; N]> = MaybeUninit::uninit();
+        let out_ptr = out.as_mut_ptr() as *mut &mut T;
+
+        for (i, &key) in keys.iter().enumerate() {
+            if key >= len {
+                return Err(GetDisjointMutError::IndexOutOfBounds);
+            }
+            // SAFETY: `key` is in bounds and all keys are distinct, so each
+            // reference points to a different entry. `&mut` references need
+            // no drop, so returning early leaves nothing to clean up.
+            match unsafe { &mut *base.add(key) } {
+                Entry::Occupied(val) => unsafe { out_ptr.add(i).write(val) },
+                Entry::Vacant(_) => return Err(GetDisjointMutError::IndexVacant),
+            }
+        }
+
+        // SAFETY: all `N` elements were written above.
+        Ok(unsafe { out.assume_init() })
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..010bed9 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,30 @@ fn clone_from() {
     assert_eq!(iter2.next(), None);
     assert!(slab2.capacity() >= 10);
 }
+
+#[test]
+fn get_disjoint_mut() {
+    let mut slab = Slab::new();
+    for i in 0..5 {
+        slab.insert(i);
+    }
+    slab.remove(1);
+
+    let [a, b] = slab.get_disjoint_mut([3, 0]).unwrap();
+    std::mem::swap(a, b);
+    assert_eq!((slab[3], slab[0]), (0, 3));
+
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+    assert_eq!(
+        slab.get_disjoint_mut([42, 2, 1, 2]),
+        Err(GetDisjointMutError::OverlappingIndices)
+    );
+    assert_eq!(
+        slab.get_disjoint_mut([1, 5]),
+        Err(GetDisjointMutError::IndexVacant)
+    );
+    assert_eq!(
+        slab.get_disjoint_mut([5, 1]),
+        Err(GetDisjointMutError::IndexOutOfBounds)
+    );
+}
```

</details>

<details><summary>reply</summary>

Done. Added `get_disjoint_mut` and `GetDisjointMutError` (crate-root export, also `Display`/`Error` with `std`) in `src/lib.rs`, plus a test; all tests pass.

I bumped `rust-version` from 1.46 to 1.51 in `Cargo.toml` because const generics need it. Revert it if you want to keep the old MSRV. I didn't add a CHANGELOG entry.

</details>

### claude, sloth: pass

Files: [Cargo.toml](../sloth/claude/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../sloth/claude/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs), [tests/slab.rs](../sloth/claude/rust-feat-slab-get-disjoint-mut-1/files/tests/slab.rs)

<details><summary>diff</summary>

```diff
diff --git a/Cargo.toml b/Cargo.toml
index 9e0c186..4b35df5 100644
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -9,7 +9,7 @@ name = "slab"
 version = "0.4.9"
 authors = ["Carl Lerche <me@carllerche.com>"]
 edition = "2018"
-rust-version = "1.46"
+rust-version = "1.55"
 license = "MIT"
 description = "Pre-allocated storage for a uniform data type"
 repository = "https://github.com/tokio-rs/slab"
diff --git a/src/lib.rs b/src/lib.rs
index cd5fe0e..ede6652 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -230,6 +230,17 @@ pub struct Drain<'a, T> {
     len: usize,
 }
 
+/// The error returned by [`Slab::get_disjoint_mut`].
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum GetDisjointMutError {
+    /// The same key was given more than once.
+    OverlappingIndices,
+    /// A key is past the end of the slab.
+    IndexOutOfBounds,
+    /// A key is in bounds but has no value.
+    IndexVacant,
+}
+
 #[derive(Clone)]
 enum Entry<T> {
     Vacant(usize),
@@ -776,6 +787,53 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with the given keys
+    /// simultaneously, in the same order as `keys`.
+    ///
+    /// Overlapping keys are checked first, then the keys are checked in order
+    /// and the first one that is out of bounds or vacant decides the error.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// # use slab::*;
+    /// let mut slab = Slab::new();
+    /// let a = slab.insert(1);
+    /// let b = slab.insert(2);
+    /// let [x, y] = slab.get_disjoint_mut([a, b]).unwrap();
+    /// std::mem::swap(x, y);
+    /// assert_eq!((slab[a], slab[b]), (2, 1));
+    ///
+    /// assert_eq!(
+    ///     slab.get_disjoint_mut([a, a]),
+    ///     Err(GetDisjointMutError::OverlappingIndices)
+    /// );
+    /// ```
+    pub fn get_disjoint_mut<const N: usize>(
+        &mut self,
+        keys: [usize; N],
+    ) -> Result<[&mut T; N], GetDisjointMutError> {
+        for i in 1..N {
+            if keys[..i].contains(&keys[i]) {
+                return Err(GetDisjointMutError::OverlappingIndices);
+            }
+        }
+        for &key in &keys {
+            match self.entries.get(key) {
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                Some(Entry::Occupied(_)) => {}
+            }
+        }
+        let base = self.entries.as_mut_ptr();
+        // SAFETY: every key is in bounds and distinct, so each pointer refers
+        // to a different element of `self.entries`, which `&mut self` borrows.
+        Ok(keys.map(|key| match unsafe { &mut *base.add(key) } {
+            Entry::Occupied(val) => val,
+            Entry::Vacant(_) => unreachable!(),
+        }))
+    }
+
     /// Return a reference to the value associated with the given key without
     /// performing bounds checking.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..cacca8c 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,30 @@ fn clone_from() {
     assert_eq!(iter2.next(), None);
     assert!(slab2.capacity() >= 10);
 }
+
+#[test]
+fn get_disjoint_mut() {
+    let mut slab = Slab::new();
+    for i in 0..5 {
+        slab.insert(i);
+    }
+    slab.remove(1);
+
+    let [a, b] = slab.get_disjoint_mut([3, 0]).unwrap();
+    std::mem::swap(a, b);
+    assert_eq!((slab[0], slab[3]), (3, 0));
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+
+    assert_eq!(
+        slab.get_disjoint_mut([42, 2, 1, 2]),
+        Err(GetDisjointMutError::OverlappingIndices)
+    );
+    assert_eq!(
+        slab.get_disjoint_mut([1, 5]),
+        Err(GetDisjointMutError::IndexVacant)
+    );
+    assert_eq!(
+        slab.get_disjoint_mut([5, 1]),
+        Err(GetDisjointMutError::IndexOutOfBounds)
+    );
+}
```

</details>

<details><summary>reply</summary>

`Slab::get_disjoint_mut` is added, and all 46 integration tests and 39 doctests pass, including the new ones.

- **API:** `GetDisjointMutError` is a public enum in `src/lib.rs` with the three variants and the derives you listed. It's exported from the crate root.
- **Error order:** duplicates are checked first. The keys are then checked in order, so `[42, 2, 1, 2]` gives `OverlappingIndices`, `[1, 5]` gives `IndexVacant` and `[5, 1]` gives `IndexOutOfBounds`. An empty array returns `Ok([])`.
- **Unsafe:** the unsafe code is one small block inside the crate. After validation it builds the references from raw pointers to distinct, in-bounds slots. Callers need no unsafe.
- **MSRV bump:** I raised `rust-version` in `Cargo.toml` from 1.46 to 1.55. Const generics need 1.51 and `[T; N]::map` needs 1.55, so the old value no longer holds. If you want to keep 1.46, say so and I'll look at an alternative, though it can't use this signature.
- **Tests:** a new `get_disjoint_mut` test in `tests/slab.rs` covers the swap, the empty array and your three error examples. The doc example covers the swap and `OverlappingIndices`.
- **Not added:** I didn't add a `Display` or `Error` impl for `GetDisjointMutError`, since you didn't ask for one. I also didn't add a CHANGELOG entry.

Nothing is committed.

</details>

### claude, all: pass

Files: [CHANGELOG.md](../all/claude/rust-feat-slab-get-disjoint-mut-1/files/CHANGELOG.md), [Cargo.toml](../all/claude/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../all/claude/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs), [tests/slab.rs](../all/claude/rust-feat-slab-get-disjoint-mut-1/files/tests/slab.rs)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index f46a797..5b53db7 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,3 +1,8 @@
+# Unreleased
+
+* Add `Slab::get_disjoint_mut` and `GetDisjointMutError`
+* Raise MSRV to 1.55
+
 # 0.4.9 (August 22, 2023)
 
 * Avoid reallocations in `Slab::clone_from` (#137)
diff --git a/Cargo.toml b/Cargo.toml
index 9e0c186..4b35df5 100644
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -9,7 +9,7 @@ name = "slab"
 version = "0.4.9"
 authors = ["Carl Lerche <me@carllerche.com>"]
 edition = "2018"
-rust-version = "1.46"
+rust-version = "1.55"
 license = "MIT"
 description = "Pre-allocated storage for a uniform data type"
 repository = "https://github.com/tokio-rs/slab"
diff --git a/src/lib.rs b/src/lib.rs
index cd5fe0e..b2bf984 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -127,6 +127,17 @@ use alloc::vec::{self, Vec};
 use core::iter::{self, FromIterator, FusedIterator};
 use core::{fmt, mem, ops, slice};
 
+/// The error type returned by [`Slab::get_disjoint_mut`].
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum GetDisjointMutError {
+    /// The same key was given more than once.
+    OverlappingIndices,
+    /// A key is past the end of the slab.
+    IndexOutOfBounds,
+    /// A key is in bounds but has no value.
+    IndexVacant,
+}
+
 /// Pre-allocated storage for a uniform data type
 ///
 /// See the [module documentation] for more details.
@@ -725,6 +736,56 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with the given keys
+    /// simultaneously, in the same order as `keys`.
+    ///
+    /// Overlapping keys are rejected first, then the keys are checked in order
+    /// and the first out-of-bounds or vacant key decides the error.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// # use slab::*;
+    /// let mut slab = Slab::new();
+    /// let a = slab.insert(1);
+    /// let b = slab.insert(2);
+    ///
+    /// let [x, y] = slab.get_disjoint_mut([a, b]).unwrap();
+    /// std::mem::swap(x, y);
+    ///
+    /// assert_eq!((slab[a], slab[b]), (2, 1));
+    /// assert_eq!(
+    ///     slab.get_disjoint_mut([a, a]),
+    ///     Err(GetDisjointMutError::OverlappingIndices)
+    /// );
+    /// ```
+    pub fn get_disjoint_mut<const N: usize>(
+        &mut self,
+        keys: [usize; N],
+    ) -> Result<[&mut T; N], GetDisjointMutError> {
+        for (i, key) in keys.iter().enumerate() {
+            if keys[..i].contains(key) {
+                return Err(GetDisjointMutError::OverlappingIndices);
+            }
+        }
+        for &key in keys.iter() {
+            match self.entries.get(key) {
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                Some(Entry::Occupied(_)) => {}
+            }
+        }
+        let base = self.entries.as_mut_ptr();
+        // SAFETY: keys are in bounds, occupied and pairwise distinct, so each
+        // reference points at a different live entry.
+        Ok(keys.map(|key| unsafe {
+            match &mut *base.add(key) {
+                Entry::Occupied(val) => val,
+                Entry::Vacant(_) => core::hint::unreachable_unchecked(),
+            }
+        }))
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..12875cf 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,22 @@ fn clone_from() {
     assert_eq!(iter2.next(), None);
     assert!(slab2.capacity() >= 10);
 }
+
+#[test]
+fn get_disjoint_mut() {
+    let mut slab = Slab::new();
+    for i in 0..5 {
+        slab.insert(i);
+    }
+    slab.remove(1);
+
+    let [a, b] = slab.get_disjoint_mut([3, 0]).unwrap();
+    std::mem::swap(a, b);
+    assert_eq!((slab[3], slab[0]), (0, 3));
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+
+    use GetDisjointMutError::*;
+    assert_eq!(slab.get_disjoint_mut([42, 2, 1, 2]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(IndexOutOfBounds));
+}
```

</details>

<details><summary>reply</summary>

Done. Added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum, plus a test, a doc example and a CHANGELOG entry. All tests pass.

- **MSRV:** I raised `rust-version` in `Cargo.toml` from 1.46 to 1.55, because const generics and `array::map` need it. I didn't build on 1.55 itself, only on the installed 1.99.
- **Unsafe:** the method uses a small `unsafe` block internally. Your calling code stays safe, and the keys are checked first.

</details>

### codex, base: pass

Files: [Cargo.toml](../base/codex/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../base/codex/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs), [tests/slab.rs](../base/codex/rust-feat-slab-get-disjoint-mut-1/files/tests/slab.rs)

<details><summary>diff</summary>

```diff
diff --git a/Cargo.toml b/Cargo.toml
index 9e0c186..e237215 100644
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -9,7 +9,7 @@ name = "slab"
 version = "0.4.9"
 authors = ["Carl Lerche <me@carllerche.com>"]
 edition = "2018"
-rust-version = "1.46"
+rust-version = "1.51"
 license = "MIT"
 description = "Pre-allocated storage for a uniform data type"
 repository = "https://github.com/tokio-rs/slab"
diff --git a/src/lib.rs b/src/lib.rs
index cd5fe0e..1ad2405 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -144,6 +144,17 @@ pub struct Slab<T> {
     next: usize,
 }
 
+/// An error returned by [`Slab::get_disjoint_mut`].
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum GetDisjointMutError {
+    /// The same key appears more than once.
+    OverlappingIndices,
+    /// A key is past the end of the slab's slots.
+    IndexOutOfBounds,
+    /// A key refers to a vacant slot.
+    IndexVacant,
+}
+
 impl<T> Clone for Slab<T>
 where
     T: Clone,
@@ -725,6 +736,67 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to several values in the same order as `keys`.
+    ///
+    /// An empty array of keys returns an empty array of references.
+    /// Checking for duplicate keys takes O(N²) time.
+    ///
+    /// # Errors
+    ///
+    /// Returns [`GetDisjointMutError::OverlappingIndices`] if any key appears
+    /// more than once, even if another key is out of bounds or vacant.
+    /// Otherwise, keys are checked in order, returning
+    /// [`GetDisjointMutError::IndexOutOfBounds`] for a key past the end of the
+    /// slab's slots or [`GetDisjointMutError::IndexVacant`] for a vacant slot.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// use slab::Slab;
+    ///
+    /// let mut slab = Slab::new();
+    /// let a = slab.insert(1);
+    /// let b = slab.insert(2);
+    /// let [x, y] = slab.get_disjoint_mut([a, b]).unwrap();
+    /// std::mem::swap(x, y);
+    /// assert_eq!((slab[a], slab[b]), (2, 1));
+    /// ```
+    pub fn get_disjoint_mut<const N: usize>(
+        &mut self,
+        keys: [usize; N],
+    ) -> Result<[&mut T; N], GetDisjointMutError> {
+        for (i, key) in keys.iter().enumerate() {
+            if keys[..i].contains(key) {
+                return Err(GetDisjointMutError::OverlappingIndices);
+            }
+        }
+
+        for &key in &keys {
+            match self.entries.get(key) {
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                Some(Entry::Occupied(_)) => {}
+            }
+        }
+
+        let entries = self.entries.as_mut_ptr();
+        let mut result = mem::MaybeUninit::<[&mut T; N]>::uninit();
+        let result_ptr = result.as_mut_ptr() as *mut &mut T;
+        for (i, &key) in keys.iter().enumerate() {
+            // SAFETY: All keys are in bounds and occupied, and duplicate keys
+            // were rejected. Each reference therefore points to a distinct
+            // entry, and the entries are not otherwise accessed while borrowed.
+            unsafe {
+                if let Entry::Occupied(value) = &mut *entries.add(key) {
+                    result_ptr.add(i).write(value);
+                }
+            }
+        }
+        // SAFETY: Every element was initialized above, including vacuously for
+        // N == 0. The references borrow distinct entries for the lifetime of self.
+        Ok(unsafe { result.assume_init() })
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..0a2c9d6 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -4,6 +4,64 @@ use slab::*;
 
 use std::panic::{catch_unwind, resume_unwind, AssertUnwindSafe};
 
+#[test]
+fn get_disjoint_mut_preserves_order() {
+    let mut slab: Slab<_> = (0..5).enumerate().collect();
+    let [last, first, middle] = slab.get_disjoint_mut([4, 0, 2]).unwrap();
+    assert_eq!((*last, *first, *middle), (4, 0, 2));
+    std::mem::swap(last, first);
+    *middle = 20;
+    assert_eq!((slab[0], slab[2], slab[4]), (4, 20, 0));
+    let [single] = slab.get_disjoint_mut([2]).unwrap();
+    *single += 1;
+    assert_eq!(slab[2], 21);
+}
+
+#[test]
+fn get_disjoint_mut_errors() {
+    use GetDisjointMutError::*;
+
+    let mut slab: Slab<_> = (0..5).enumerate().collect();
+    slab.remove(1);
+    assert_eq!(
+        slab.get_disjoint_mut([42, 2, 1, 2]),
+        Err(OverlappingIndices)
+    );
+    assert_eq!(slab.get_disjoint_mut([1, 1]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([5, 5]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([0, 0]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(IndexOutOfBounds));
+    assert_eq!(
+        slab.get_disjoint_mut([0, usize::MAX]),
+        Err(IndexOutOfBounds)
+    );
+    assert_eq!(slab.get_disjoint_mut([0, 1]), Err(IndexVacant));
+    assert_eq!(
+        slab.iter().map(|(_, &v)| v).collect::<Vec<_>>(),
+        vec![0, 2, 3, 4]
+    );
+}
+
+#[test]
+fn get_disjoint_mut_empty() {
+    let mut slab = Slab::<i32>::new();
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+    assert_eq!(
+        slab.get_disjoint_mut([0]),
+        Err(GetDisjointMutError::IndexOutOfBounds)
+    );
+    slab.insert(1);
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+}
+
+#[test]
+fn get_disjoint_mut_zero_sized_values() {
+    let mut slab: Slab<_> = (0..4).map(|key| (key, ())).collect();
+    let values = slab.get_disjoint_mut([3, 1, 0, 2]).unwrap();
+    assert_eq!(values.len(), 4);
+}
+
 #[test]
 fn insert_get_remove_one() {
     let mut slab = Slab::new();
```

</details>

<details><summary>reply</summary>

I’ll check the crate’s implementation and compatibility requirements, then add the API and tests for ordering and error precedence.

The requested signature needs const generics, so I’ll raise the minimum Rust version from 1.46 to 1.51. I’ll check duplicates first, then validate keys in order before creating the mutable references.

Added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum with the requested derives and variants.

It preserves key order, checks duplicates first, reports other errors in key order, and supports empty arrays. Tests cover mutation, error precedence, and zero-sized values.

All-feature and no-default-feature tests, doctests, Clippy, and formatting checks pass. Minimum Rust version raised to 1.51 for const generics.

</details>

### codex, muffle: pass

Files: [Cargo.toml](../muffle/codex/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../muffle/codex/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs), [tests/slab.rs](../muffle/codex/rust-feat-slab-get-disjoint-mut-1/files/tests/slab.rs)

<details><summary>diff</summary>

```diff
diff --git a/Cargo.toml b/Cargo.toml
index 9e0c186..e237215 100644
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -9,7 +9,7 @@ name = "slab"
 version = "0.4.9"
 authors = ["Carl Lerche <me@carllerche.com>"]
 edition = "2018"
-rust-version = "1.46"
+rust-version = "1.51"
 license = "MIT"
 description = "Pre-allocated storage for a uniform data type"
 repository = "https://github.com/tokio-rs/slab"
diff --git a/src/lib.rs b/src/lib.rs
index cd5fe0e..d4d71bf 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -144,6 +144,17 @@ pub struct Slab<T> {
     next: usize,
 }
 
+/// An error returned by [`Slab::get_disjoint_mut`].
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum GetDisjointMutError {
+    /// The same key appears more than once.
+    OverlappingIndices,
+    /// A key is past the end of the slab's slots.
+    IndexOutOfBounds,
+    /// A key refers to a vacant slot.
+    IndexVacant,
+}
+
 impl<T> Clone for Slab<T>
 where
     T: Clone,
@@ -725,6 +736,68 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with the given keys,
+    /// in the same order as `keys`.
+    ///
+    /// # Errors
+    ///
+    /// Returns [`GetDisjointMutError::OverlappingIndices`] if any key appears
+    /// more than once, before checking bounds or occupancy. Otherwise, keys are
+    /// checked in order: the first invalid key returns
+    /// [`GetDisjointMutError::IndexOutOfBounds`] if it is past the end of the
+    /// slab's slots, or [`GetDisjointMutError::IndexVacant`] if its slot is vacant.
+    /// An empty array returns `Ok([])`.
+    ///
+    /// Checking for overlapping keys takes O(N²) time.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// use slab::Slab;
+    ///
+    /// let mut slab = Slab::new();
+    /// let a = slab.insert(1);
+    /// let b = slab.insert(2);
+    /// let [x, y] = slab.get_disjoint_mut([a, b]).unwrap();
+    /// std::mem::swap(x, y);
+    /// assert_eq!((slab[a], slab[b]), (2, 1));
+    /// ```
+    pub fn get_disjoint_mut<const N: usize>(
+        &mut self,
+        keys: [usize; N],
+    ) -> Result<[&mut T; N], GetDisjointMutError> {
+        for (i, key) in keys.iter().enumerate() {
+            if keys[..i].contains(key) {
+                return Err(GetDisjointMutError::OverlappingIndices);
+            }
+        }
+
+        for &key in &keys {
+            match self.entries.get(key) {
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                Some(Entry::Occupied(_)) => {}
+            }
+        }
+
+        let mut result = mem::MaybeUninit::<[&mut T; N]>::uninit();
+        let output = result.as_mut_ptr() as *mut &mut T;
+        let entries = self.entries.as_mut_ptr();
+        // SAFETY: Every key is in bounds and occupied, and all keys are distinct.
+        // Thus each reference points to a different value and no entries move
+        // while the references are constructed. Each output element is written
+        // exactly once before assuming initialization, including when N is zero.
+        unsafe {
+            for (i, &key) in keys.iter().enumerate() {
+                match &mut *entries.add(key) {
+                    Entry::Occupied(value) => output.add(i).write(value),
+                    Entry::Vacant(_) => unreachable!(),
+                }
+            }
+            Ok(result.assume_init())
+        }
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..d3f8bad 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,71 @@ fn clone_from() {
     assert_eq!(iter2.next(), None);
     assert!(slab2.capacity() >= 10);
 }
+
+#[test]
+fn get_disjoint_mut_preserves_order() {
+    let mut slab: Slab<_> = (0..5).map(|i| (i, i)).collect();
+    slab.remove(1);
+    let [last, first, middle] = slab.get_disjoint_mut([4, 0, 2]).unwrap();
+    std::mem::swap(last, first);
+    *middle = 20;
+    assert_eq!((slab[0], slab[2], slab[4]), (4, 20, 0));
+    assert_eq!(slab.len(), 4);
+    assert_eq!(slab.insert(10), 1);
+}
+
+#[test]
+fn get_disjoint_mut_errors() {
+    use GetDisjointMutError::*;
+
+    let mut slab: Slab<_> = (0..5).map(|i| (i, i)).collect();
+    slab.remove(1);
+    assert_eq!(
+        slab.get_disjoint_mut([42, 2, 1, 2]),
+        Err(OverlappingIndices)
+    );
+    assert_eq!(slab.get_disjoint_mut([1, 1]), Err(OverlappingIndices));
+    assert_eq!(
+        slab.get_disjoint_mut([usize::MAX, usize::MAX]),
+        Err(OverlappingIndices)
+    );
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(IndexOutOfBounds));
+    assert_eq!(
+        slab.get_disjoint_mut([0, usize::MAX]),
+        Err(IndexOutOfBounds)
+    );
+    assert_eq!(slab.get_disjoint_mut([0, 1]), Err(IndexVacant));
+    assert_eq!(
+        slab.iter().map(|(k, v)| (k, *v)).collect::<Vec<_>>(),
+        vec![(0, 0), (2, 2), (3, 3), (4, 4)]
+    );
+}
+
+#[test]
+fn get_disjoint_mut_empty_and_single() {
+    let mut slab = Slab::with_capacity(8);
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+    assert_eq!(
+        slab.get_disjoint_mut([0]),
+        Err(GetDisjointMutError::IndexOutOfBounds)
+    );
+    let key = slab.insert(String::from("hello"));
+    let [value] = slab.get_disjoint_mut([key]).unwrap();
+    value.push_str(" world");
+    assert_eq!(slab[key], "hello world");
+    slab.remove(key);
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+    assert_eq!(
+        slab.get_disjoint_mut([key]),
+        Err(GetDisjointMutError::IndexVacant)
+    );
+}
+
+#[test]
+fn get_disjoint_mut_zero_sized_values() {
+    let mut slab: Slab<_> = (0..3).map(|i| (i, ())).collect();
+    let [a, b, c] = slab.get_disjoint_mut([2, 0, 1]).unwrap();
+    std::mem::swap(a, b);
+    *c = ();
+}
```

</details>

<details><summary>reply</summary>

I’ll check the crate’s implementation and compatibility requirements, then add the method, error type, and focused tests.

The requested signature needs const generics, so I’ll raise the declared minimum Rust version from 1.46 to 1.51. The method will check all keys for duplicates first, then check bounds and occupancy in input order before creating references.

Added `Slab::get_disjoint_mut` and public `GetDisjointMutError` with the requested derives, ordering, error precedence, and empty-array behavior.

Added documentation and tests covering swaps, errors, empty inputs, and zero-sized values. Tests pass with all features and with default features disabled.

Raised the minimum Rust version from 1.46 to 1.51 for const generics.

</details>

### codex, hush: pass

Files: [Cargo.toml](../hush/codex/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../hush/codex/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs), [tests/slab.rs](../hush/codex/rust-feat-slab-get-disjoint-mut-1/files/tests/slab.rs)

<details><summary>diff</summary>

```diff
diff --git a/Cargo.toml b/Cargo.toml
index 9e0c186..e237215 100644
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -9,7 +9,7 @@ name = "slab"
 version = "0.4.9"
 authors = ["Carl Lerche <me@carllerche.com>"]
 edition = "2018"
-rust-version = "1.46"
+rust-version = "1.51"
 license = "MIT"
 description = "Pre-allocated storage for a uniform data type"
 repository = "https://github.com/tokio-rs/slab"
diff --git a/src/lib.rs b/src/lib.rs
index cd5fe0e..092adf6 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -127,6 +127,17 @@ use alloc::vec::{self, Vec};
 use core::iter::{self, FromIterator, FusedIterator};
 use core::{fmt, mem, ops, slice};
 
+/// An error returned by [`Slab::get_disjoint_mut`].
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum GetDisjointMutError {
+    /// A key occurs more than once.
+    OverlappingIndices,
+    /// A key is past the end of the slab's slots.
+    IndexOutOfBounds,
+    /// A key refers to a vacant slot.
+    IndexVacant,
+}
+
 /// Pre-allocated storage for a uniform data type
 ///
 /// See the [module documentation] for more details.
@@ -725,6 +736,62 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to several values, in the order of `keys`.
+    ///
+    /// Duplicate keys return [`GetDisjointMutError::OverlappingIndices`]
+    /// before any slots are checked. Otherwise, keys are checked in order:
+    /// a key past the end of the slots returns
+    /// [`GetDisjointMutError::IndexOutOfBounds`], and a vacant slot returns
+    /// [`GetDisjointMutError::IndexVacant`]. An empty array returns `Ok([])`.
+    /// Duplicate checking takes O(N²) time. This method does not allocate.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// use slab::Slab;
+    ///
+    /// let mut slab = Slab::new();
+    /// let a = slab.insert(1);
+    /// let b = slab.insert(2);
+    /// let [x, y] = slab.get_disjoint_mut([a, b]).unwrap();
+    /// std::mem::swap(x, y);
+    /// assert_eq!((slab[a], slab[b]), (2, 1));
+    /// ```
+    pub fn get_disjoint_mut<const N: usize>(
+        &mut self,
+        keys: [usize; N],
+    ) -> Result<[&mut T; N], GetDisjointMutError> {
+        for (i, key) in keys.iter().enumerate() {
+            if keys[..i].contains(key) {
+                return Err(GetDisjointMutError::OverlappingIndices);
+            }
+        }
+        for &key in &keys {
+            match self.entries.get(key) {
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                Some(Entry::Occupied(_)) => {}
+            }
+        }
+
+        let mut result = mem::MaybeUninit::<[&mut T; N]>::uninit();
+        let output = result.as_mut_ptr() as *mut &mut T;
+        let entries = self.entries.as_mut_ptr();
+        for (i, &key) in keys.iter().enumerate() {
+            // SAFETY: Every key is in bounds and occupied, and all keys are
+            // distinct. Each reference therefore points to a separate entry.
+            // The slab is exclusively borrowed for the returned lifetime.
+            unsafe {
+                match &mut *entries.add(key) {
+                    Entry::Occupied(value) => output.add(i).write(value),
+                    Entry::Vacant(_) => unreachable!(),
+                }
+            }
+        }
+        // SAFETY: All N elements have been initialized, including when N is zero.
+        Ok(unsafe { result.assume_init() })
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..b8d066c 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,54 @@ fn clone_from() {
     assert_eq!(iter2.next(), None);
     assert!(slab2.capacity() >= 10);
 }
+
+#[test]
+fn get_disjoint_mut_order_and_swap() {
+    let mut slab: Slab<_> = (0..5).enumerate().collect();
+    let [last, first, middle] = slab.get_disjoint_mut([4, 0, 2]).unwrap();
+    std::mem::swap(last, first);
+    *middle = 20;
+    assert_eq!((slab[0], slab[2], slab[4]), (4, 20, 0));
+    let [only] = slab.get_disjoint_mut([3]).unwrap();
+    *only = 30;
+    assert_eq!(slab[3], 30);
+}
+
+#[test]
+fn get_disjoint_mut_errors() {
+    use GetDisjointMutError::*;
+    let mut slab = Slab::with_capacity(20);
+    for value in 0..5 {
+        slab.insert(value);
+    }
+    slab.remove(1);
+    assert_eq!(
+        slab.get_disjoint_mut([42, 2, 1, 2]),
+        Err(OverlappingIndices)
+    );
+    assert_eq!(slab.get_disjoint_mut([1, 1]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([42, 42]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(IndexOutOfBounds));
+    assert_eq!(
+        slab.get_disjoint_mut([0, usize::MAX]),
+        Err(IndexOutOfBounds)
+    );
+    assert_eq!(slab.get_disjoint_mut([0, 1]), Err(IndexVacant));
+    assert_eq!(slab.len(), 4);
+    assert_eq!(slab[0], 0);
+}
+
+#[test]
+fn get_disjoint_mut_empty_and_zero_sized() {
+    let mut slab = Slab::<()>::new();
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+    assert_eq!(
+        slab.get_disjoint_mut([0]),
+        Err(GetDisjointMutError::IndexOutOfBounds)
+    );
+    for _ in 0..4 {
+        slab.insert(());
+    }
+    assert_eq!(slab.get_disjoint_mut([3, 1, 0, 2]).unwrap().len(), 4);
+}
```

</details>

<details><summary>reply</summary>

Done.
Added `get_disjoint_mut`, public error enum, docs, tests. Tests and Clippy pass. Minimum Rust raised to 1.51 for const generics.

</details>

### codex, sloth: pass

Files: [Cargo.toml](../sloth/codex/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../sloth/codex/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs), [tests/slab.rs](../sloth/codex/rust-feat-slab-get-disjoint-mut-1/files/tests/slab.rs)

<details><summary>diff</summary>

```diff
diff --git a/Cargo.toml b/Cargo.toml
index 9e0c186..e237215 100644
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -9,7 +9,7 @@ name = "slab"
 version = "0.4.9"
 authors = ["Carl Lerche <me@carllerche.com>"]
 edition = "2018"
-rust-version = "1.46"
+rust-version = "1.51"
 license = "MIT"
 description = "Pre-allocated storage for a uniform data type"
 repository = "https://github.com/tokio-rs/slab"
diff --git a/src/lib.rs b/src/lib.rs
index cd5fe0e..c89fccf 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -169,6 +169,17 @@ impl<T> Default for Slab<T> {
     }
 }
 
+/// An error returned by [`Slab::get_disjoint_mut`].
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum GetDisjointMutError {
+    /// The same key appears more than once.
+    OverlappingIndices,
+    /// A key is past the end of the slab's slots.
+    IndexOutOfBounds,
+    /// A key refers to a vacant slot.
+    IndexVacant,
+}
+
 /// A handle to a vacant entry in a `Slab`.
 ///
 /// `VacantEntry` allows constructing values with the key that they will be
@@ -725,6 +736,57 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with the given keys,
+    /// in the same order as `keys`. An empty array returns `Ok([])`.
+    ///
+    /// # Errors
+    ///
+    /// Duplicate keys return [`GetDisjointMutError::OverlappingIndices`] before
+    /// any slots are checked. Otherwise, keys are checked in order, returning
+    /// [`GetDisjointMutError::IndexOutOfBounds`] for a key past the end of the
+    /// slots or [`GetDisjointMutError::IndexVacant`] for a vacant slot.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// # use slab::Slab;
+    /// let mut slab = Slab::new();
+    /// let a = slab.insert(1);
+    /// let b = slab.insert(2);
+    /// let [x, y] = slab.get_disjoint_mut([a, b]).unwrap();
+    /// std::mem::swap(x, y);
+    /// assert_eq!((slab[a], slab[b]), (2, 1));
+    /// ```
+    pub fn get_disjoint_mut<const N: usize>(
+        &mut self,
+        keys: [usize; N],
+    ) -> Result<[&mut T; N], GetDisjointMutError> {
+        for (i, key) in keys.iter().enumerate() {
+            if keys[..i].contains(key) {
+                return Err(GetDisjointMutError::OverlappingIndices);
+            }
+        }
+        for &key in &keys {
+            match self.entries.get(key) {
+                Some(Entry::Occupied(_)) => {}
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+            }
+        }
+
+        let mut values = mem::MaybeUninit::<[&mut T; N]>::uninit();
+        let output = values.as_mut_ptr() as *mut &mut T;
+        let entries = self.entries.as_mut_ptr();
+        for (i, &key) in keys.iter().enumerate() {
+            unsafe {
+                if let Entry::Occupied(value) = &mut *entries.add(key) {
+                    output.add(i).write(value);
+                }
+            }
+        }
+        Ok(unsafe { values.assume_init() })
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..aeef6cd 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -125,6 +125,49 @@ fn slab_get_mut() {
     assert_eq!(slab[key], 3);
 }
 
+/// Check disjoint mutation, key order, and error precedence.
+#[test]
+fn slab_get_disjoint_mut() {
+    use GetDisjointMutError::*;
+
+    let mut slab = Slab::<i32>::with_capacity(10);
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+    assert_eq!(slab.get_disjoint_mut([0]), Err(IndexOutOfBounds));
+    for value in 0..5 {
+        slab.insert(value);
+    }
+    slab.remove(1);
+
+    let [x, y] = slab.get_disjoint_mut([0, 2]).unwrap();
+    std::mem::swap(x, y);
+    assert_eq!((slab[0], slab[2]), (2, 0));
+    let [x, y, z] = slab.get_disjoint_mut([4, 0, 3]).unwrap();
+    *x = 40;
+    *y = 20;
+    *z = 30;
+    assert_eq!((slab[4], slab[0], slab[3]), (40, 20, 30));
+    assert_eq!(slab.get_disjoint_mut([2]).map(|[x]| *x), Ok(0));
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+    assert_eq!(
+        slab.get_disjoint_mut([42, 2, 1, 2]),
+        Err(OverlappingIndices)
+    );
+    assert_eq!(slab.get_disjoint_mut([1, 1]), Err(OverlappingIndices));
+    assert_eq!(
+        slab.get_disjoint_mut([usize::MAX, usize::MAX]),
+        Err(OverlappingIndices)
+    );
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(IndexOutOfBounds));
+    assert_eq!(slab.get_disjoint_mut([usize::MAX]), Err(IndexOutOfBounds));
+    assert_eq!((slab.len(), slab[0], slab[4]), (4, 20, 40));
+
+    let mut slab = Slab::new();
+    slab.insert(());
+    slab.insert(());
+    assert!(slab.get_disjoint_mut([1, 0]).is_ok());
+}
+
 #[test]
 fn key_of_tagged() {
     let mut slab = Slab::new();
```

</details>

<details><summary>reply</summary>

I’ll check the slab storage and test layout, add the API and error type, then run the build and tests.

The change needs the public error enum and method in `src/lib.rs`, plus tests in `tests/slab.rs`. Existing APIs can stay unchanged. The requested const-generic signature also requires raising the minimum Rust version from 1.46 to 1.51; I’ll keep the implementation compatible with 1.51 and `no_std`.

The API passes the requested ordering and error cases, including empty input, vacant slots, and duplicate invalid keys. All 87 tests and doctests pass, along with the `no_std` build, Clippy, and formatting checks. I’m checking compilation with Rust 1.51 as well.

Added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum with the requested derives, variants, ordering, and error precedence.

Raised minimum Rust to 1.51 for const generics.

Verified: all 87 tests and doctests, `no_std` build, Clippy, formatting, and Rust 1.51 compilation.

</details>

### codex, all: pass

Files: [Cargo.toml](../all/codex/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../all/codex/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs), [tests/slab.rs](../all/codex/rust-feat-slab-get-disjoint-mut-1/files/tests/slab.rs)

<details><summary>diff</summary>

```diff
diff --git a/Cargo.toml b/Cargo.toml
index 9e0c186..e237215 100644
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -9,7 +9,7 @@ name = "slab"
 version = "0.4.9"
 authors = ["Carl Lerche <me@carllerche.com>"]
 edition = "2018"
-rust-version = "1.46"
+rust-version = "1.51"
 license = "MIT"
 description = "Pre-allocated storage for a uniform data type"
 repository = "https://github.com/tokio-rs/slab"
diff --git a/src/lib.rs b/src/lib.rs
index cd5fe0e..ff5d6af 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -127,6 +127,17 @@ use alloc::vec::{self, Vec};
 use core::iter::{self, FromIterator, FusedIterator};
 use core::{fmt, mem, ops, slice};
 
+/// An error returned by [`Slab::get_disjoint_mut`].
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum GetDisjointMutError {
+    /// The same key occurs more than once.
+    OverlappingIndices,
+    /// A key is past the end of the slab's initialized slots.
+    IndexOutOfBounds,
+    /// A key refers to a vacant slot.
+    IndexVacant,
+}
+
 /// Pre-allocated storage for a uniform data type
 ///
 /// See the [module documentation] for more details.
@@ -725,6 +736,55 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to several values, in the order of `keys`.
+    ///
+    /// Duplicate keys return [`GetDisjointMutError::OverlappingIndices`],
+    /// before any bounds or vacancy checks. Otherwise, keys are checked in
+    /// order, returning [`GetDisjointMutError::IndexOutOfBounds`] for a key
+    /// past the end of the slab's slots or [`GetDisjointMutError::IndexVacant`]
+    /// for a vacant slot. An empty array returns `Ok([])`.
+    ///
+    /// # Examples
+    ///
+    /// ```
+    /// # use slab::Slab;
+    /// let mut slab = Slab::new();
+    /// let a = slab.insert(1);
+    /// let b = slab.insert(2);
+    /// let [x, y] = slab.get_disjoint_mut([a, b]).unwrap();
+    /// core::mem::swap(x, y);
+    /// assert_eq!((slab[a], slab[b]), (2, 1));
+    /// ```
+    pub fn get_disjoint_mut<const N: usize>(
+        &mut self,
+        keys: [usize; N],
+    ) -> Result<[&mut T; N], GetDisjointMutError> {
+        for (i, key) in keys.iter().enumerate() {
+            if keys[..i].contains(key) {
+                return Err(GetDisjointMutError::OverlappingIndices);
+            }
+        }
+
+        let mut values = mem::MaybeUninit::<[&mut T; N]>::uninit();
+        let output = values.as_mut_ptr() as *mut &mut T;
+        let entries = self.entries.as_mut_ptr();
+        for (i, &key) in keys.iter().enumerate() {
+            if key >= self.entries.len() {
+                return Err(GetDisjointMutError::IndexOutOfBounds);
+            }
+            // SAFETY: Each key is in bounds and unique, so occupied values
+            // are disjoint. Each output slot is written exactly once.
+            unsafe {
+                match &mut *entries.add(key) {
+                    Entry::Occupied(value) => output.add(i).write(value),
+                    Entry::Vacant(_) => return Err(GetDisjointMutError::IndexVacant),
+                }
+            }
+        }
+        // SAFETY: All N references have been initialized, including when N is zero.
+        Ok(unsafe { values.assume_init() })
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..ed695f3 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -4,6 +4,47 @@ use slab::*;
 
 use std::panic::{catch_unwind, resume_unwind, AssertUnwindSafe};
 
+#[test]
+fn slab_get_disjoint_mut() {
+    use GetDisjointMutError::*;
+
+    let mut slab = Slab::with_capacity(10);
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+    assert_eq!(slab.get_disjoint_mut([0]), Err(IndexOutOfBounds));
+    for value in 0..5 {
+        slab.insert(value);
+    }
+    slab.remove(1);
+
+    assert_eq!(
+        slab.get_disjoint_mut([42, 2, 1, 2]),
+        Err(OverlappingIndices)
+    );
+    assert_eq!(slab.get_disjoint_mut([1, 1]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([5, 5]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(IndexOutOfBounds));
+    assert_eq!(slab.get_disjoint_mut([0, 1]), Err(IndexVacant));
+    assert_eq!(
+        slab.get_disjoint_mut([0, usize::MAX]),
+        Err(IndexOutOfBounds)
+    );
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+
+    let [last, first, middle] = slab.get_disjoint_mut([4, 0, 2]).unwrap();
+    std::mem::swap(last, first);
+    *middle = 20;
+    assert_eq!((slab[0], slab[2], slab[4]), (4, 20, 0));
+    let [value] = slab.get_disjoint_mut([3]).unwrap();
+    *value = 30;
+    assert_eq!(slab[3], 30);
+
+    let mut units = Slab::new();
+    units.insert(());
+    units.insert(());
+    assert_eq!(units.get_disjoint_mut([1, 0]), Ok([&mut (), &mut ()]));
+}
+
 #[test]
 fn insert_get_remove_one() {
     let mut slab = Slab::new();
```

</details>

<details><summary>reply</summary>

Done.
Added `get_disjoint_mut`, public error enum, docs, tests. Tests pass. Minimum Rust raised to 1.51; verification blocked by broken toolchain.

</details>
