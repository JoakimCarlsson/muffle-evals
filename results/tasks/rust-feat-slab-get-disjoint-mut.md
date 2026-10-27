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
| claude | base | pass | +92/-2 | 20 | 4,063 | $0.117 |
| claude | muffle | pass | +84/-1 | 23 | 3,852 | $0.114 |
| claude | hush | pass | +94/-1 | 18 | 3,754 | $0.102 |
| claude | sloth | pass | +65/-1 | 36 | 3,972 | $0.128 |
| claude | all | pass | +57/-1 | 27 | 2,691 | $0.090 |
| codex | base | pass | +73/-1 | 56 | 2,305 | - |
| codex | muffle | pass | +71/-1 | 52 | 2,336 | - |
| codex | hush | pass | +67/-1 | 47 | 2,287 | - |
| codex | sloth | pass | +60/-1 | 78 | 2,802 | - |
| codex | all | pass | +66/-1 | 47 | 2,325 | - |

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
index cd5fe0e..c5aa81f 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -125,7 +125,7 @@ mod builder;
 
 use alloc::vec::{self, Vec};
 use core::iter::{self, FromIterator, FusedIterator};
-use core::{fmt, mem, ops, slice};
+use core::{fmt, mem, ops, ptr, slice};
 
 /// Pre-allocated storage for a uniform data type
 ///
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
+    /// A key is in bounds but has no value.
+    IndexVacant,
+}
+
+impl fmt::Display for GetDisjointMutError {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        let msg = match self {
+            GetDisjointMutError::OverlappingIndices => "an index is repeated",
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
@@ -725,6 +750,66 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with each of the
+    /// given keys simultaneously.
+    ///
+    /// The references are returned in the same order as `keys`.
+    ///
+    /// # Errors
+    ///
+    /// All keys are first checked for duplicates, and
+    /// [`GetDisjointMutError::OverlappingIndices`] is returned if any key
+    /// appears more than once. Then the keys are checked in order, and the
+    /// first invalid one decides the error:
+    /// [`GetDisjointMutError::IndexOutOfBounds`] if it is past the end of the
+    /// slab, or [`GetDisjointMutError::IndexVacant`] if it has no value.
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
+    ///     slab.get_disjoint_mut([a, 10]),
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
+        let mut ptrs: [*mut T; N] = [ptr::null_mut(); N];
+        for (slot, &key) in ptrs.iter_mut().zip(keys.iter()) {
+            *slot = match self.entries.get_mut(key) {
+                Some(Entry::Occupied(val)) => val as *mut T,
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+            };
+        }
+
+        // SAFETY: every pointer was derived from a distinct, occupied entry
+        // (keys were checked to be unique) of `self.entries`, which is
+        // exclusively borrowed for the lifetime of the returned references.
+        // `*mut T` and `&mut T` have identical layout.
+        Ok(unsafe { ptr::read(&ptrs as *const [*mut T; N] as *const [&mut T; N]) })
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..e1ae652 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,23 @@ fn clone_from() {
     assert_eq!(iter2.next(), None);
     assert!(slab2.capacity() >= 10);
 }
+
+#[test]
+fn get_disjoint_mut() {
+    use slab::GetDisjointMutError::*;
+
+    let mut slab = Slab::new();
+    for i in 0..5 {
+        slab.insert(i);
+    }
+    slab.remove(1);
+
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+    let [a, b] = slab.get_disjoint_mut([3, 0]).unwrap();
+    std::mem::swap(a, b);
+    assert_eq!((slab[0], slab[3]), (3, 0));
+
+    assert_eq!(slab.get_disjoint_mut([42, 2, 1, 2]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(IndexOutOfBounds));
+}
```

</details>

<details><summary>reply</summary>

I added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum, with the signature, key-check order and errors you specified. The test suite and doctests pass, including a new test in `tests/slab.rs`. I didn't try `--no-default-features`, so the `no_std` build is unchecked.

- **Where it lives:** `GetDisjointMutError` derives `Debug`, `Clone`, `PartialEq` and `Eq`. It is exported at the crate root because it's defined there. The method and its doc example are in `src/lib.rs`.
- **Test coverage:** The new test covers an empty key array, a swap, and your three error examples: `[42, 2, 1, 2]` gives `OverlappingIndices`, `[1, 5]` gives `IndexVacant`, and `[5, 1]` gives `IndexOutOfBounds`.
- **Unsafe inside:** Your calling code needs no `unsafe`, but the method uses one small `unsafe` block internally. It turns an array of raw pointers into `[&mut T; N]`, which is sound because the keys were already checked to be unique, in bounds and occupied.
- **MSRV bump:** `const N: usize` generics need Rust 1.51, so I raised `rust-version` in `Cargo.toml` from 1.46 to 1.51. If you can't bump the MSRV, tell me and we'll need a different approach.
- **Extras you didn't ask for:** I added `Display` for the error, plus `std::error::Error` behind the `std` feature. I also added an "Unreleased" entry to `CHANGELOG.md`.

I haven't committed anything.

</details>

### claude, muffle: pass

Files: [CHANGELOG.md](../muffle/claude/rust-feat-slab-get-disjoint-mut-1/files/CHANGELOG.md), [Cargo.toml](../muffle/claude/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../muffle/claude/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs), [tests/slab.rs](../muffle/claude/rust-feat-slab-get-disjoint-mut-1/files/tests/slab.rs)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index f46a797..6a1ba6f 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,3 +1,8 @@
+# Unreleased
+
+* Add `Slab::get_disjoint_mut` and `GetDisjointMutError`
+* Raise MSRV to 1.63
+
 # 0.4.9 (August 22, 2023)
 
 * Avoid reallocations in `Slab::clone_from` (#137)
diff --git a/Cargo.toml b/Cargo.toml
index 9e0c186..336e7a7 100644
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -9,7 +9,7 @@ name = "slab"
 version = "0.4.9"
 authors = ["Carl Lerche <me@carllerche.com>"]
 edition = "2018"
-rust-version = "1.46"
+rust-version = "1.63"
 license = "MIT"
 description = "Pre-allocated storage for a uniform data type"
 repository = "https://github.com/tokio-rs/slab"
diff --git a/src/lib.rs b/src/lib.rs
index cd5fe0e..c35e479 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -224,6 +224,30 @@ pub struct IterMut<'a, T> {
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
 /// A draining iterator for `Slab`
 pub struct Drain<'a, T> {
     inner: vec::Drain<'a, Entry<T>>,
@@ -776,6 +800,60 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with the given keys.
+    ///
+    /// The references are returned in the same order as `keys`.
+    ///
+    /// # Errors
+    ///
+    /// Returns [`GetDisjointMutError::OverlappingIndices`] if any key appears
+    /// more than once; this is checked for all keys first. Otherwise the keys
+    /// are checked in order and the first invalid one decides the error:
+    /// [`GetDisjointMutError::IndexOutOfBounds`] if it is past the end of the
+    /// slab, or [`GetDisjointMutError::IndexVacant`] if it has no value.
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
+        for i in 0..N {
+            for j in 0..i {
+                if keys[i] == keys[j] {
+                    return Err(GetDisjointMutError::OverlappingIndices);
+                }
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
+        // SAFETY: every key is in bounds and occupied, and no key repeats, so
+        // each reference points at a distinct, initialized entry.
+        Ok(core::array::from_fn(|i| unsafe {
+            match &mut *base.add(keys[i]) {
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
index dd71f99..332ca66 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,26 @@ fn clone_from() {
     assert_eq!(iter2.next(), None);
     assert!(slab2.capacity() >= 10);
 }
+
+#[test]
+fn get_disjoint_mut() {
+    use slab::GetDisjointMutError::*;
+
+    let mut slab = Slab::new();
+    for i in 0..5 {
+        slab.insert(i);
+    }
+    slab.remove(1);
+
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+    {
+        let [a, b, c] = slab.get_disjoint_mut([3, 0, 4]).unwrap();
+        assert_eq!((*a, *b, *c), (3, 0, 4));
+        core::mem::swap(a, b);
+    }
+    assert_eq!((slab[3], slab[0]), (0, 3));
+
+    assert_eq!(slab.get_disjoint_mut([42, 2, 1, 2]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(IndexOutOfBounds));
+}
```

</details>

<details><summary>reply</summary>

I added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum, which is exported from the crate root. The full test suite passes, including a new test and your swap example as a doctest.

- **Behavior:** it follows your spec. It checks all keys for duplicates first, then checks the keys in order, so `[42, 2, 1, 2]` gives `OverlappingIndices`. On the 5-slot slab with key 1 vacant, `[1, 5]` gives `IndexVacant` and `[5, 1]` gives `IndexOutOfBounds`. An empty key array returns `Ok([])`.
- **Unsafe code:** callers need no unsafe, but the function uses one small `unsafe` block internally. It builds the `[&mut T; N]` from a raw pointer, and only after every key has been checked as in bounds, occupied and unique.
- **Extra trait impls:** beyond what you asked, I gave the error `Display` and, with the `std` feature, `std::error::Error`.
- **MSRV bump:** I raised `rust-version` in `Cargo.toml` from 1.46 to 1.63. Const generics need 1.51, and I used `core::array::from_fn`, which needs 1.63. If you'd rather keep a lower MSRV, say so and I can build the array another way.
- **Tests and changelog:** I added a `get_disjoint_mut` test in `tests/slab.rs` and an "Unreleased" entry in `CHANGELOG.md`.
- **Not done:** nothing is committed, as your instructions say.

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
index cd5fe0e..5fe8efc 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -230,6 +230,30 @@ pub struct Drain<'a, T> {
     len: usize,
 }
 
+/// Error returned by [`Slab::get_disjoint_mut`].
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
+            GetDisjointMutError::OverlappingIndices => "an index was given more than once",
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
@@ -776,6 +800,75 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with the given keys
+    /// simultaneously.
+    ///
+    /// The references are returned in the same order as `keys`.
+    ///
+    /// # Errors
+    ///
+    /// Returns [`GetDisjointMutError::OverlappingIndices`] if any key appears
+    /// more than once. This is checked for all keys before anything else.
+    ///
+    /// Otherwise the keys are checked in order, and the first invalid key
+    /// decides the error: [`GetDisjointMutError::IndexOutOfBounds`] if it is
+    /// past the end of the slab, or [`GetDisjointMutError::IndexVacant`] if it
+    /// has no value.
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
+        for &key in keys.iter() {
+            match self.entries.get(key) {
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                Some(Entry::Occupied(_)) => {}
+            }
+        }
+
+        let base = self.entries.as_mut_ptr();
+        let mut out = mem::MaybeUninit::<[&mut T; N]>::uninit();
+        let out_ptr = out.as_mut_ptr() as *mut &mut T;
+        for (i, &key) in keys.iter().enumerate() {
+            // SAFETY: every key is in bounds, occupied and distinct from all
+            // others, so each reference is valid and unique.
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
index dd71f99..ee8da45 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,21 @@ fn clone_from() {
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
+    assert_eq!(slab.get_disjoint_mut([]).map(|a: [&mut i32; 0]| a.len()), Ok(0));
+    assert_eq!(slab.get_disjoint_mut([42, 2, 1, 2]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(IndexOutOfBounds));
+    let [a, b, c] = slab.get_disjoint_mut([3, 0, 2]).unwrap();
+    assert_eq!((*a, *b, *c), (3, 0, 2));
+    std::mem::swap(a, b);
+    assert_eq!((slab[3], slab[0]), (0, 3));
+}
```

</details>

<details><summary>reply</summary>

Insert the enum before `#[derive(Clone)] enum Entry`, then bump MSRV (const generics need 1.51) and test.

Done. `Slab::get_disjoint_mut` and the public `GetDisjointMutError` are in `src/lib.rs`, with a test in `tests/slab.rs`. Tests pass with default features and with `--no-default-features`. The implementation uses a small `unsafe` block.

- **MSRV bump:** const generics need Rust 1.51, so I raised `rust-version` in `Cargo.toml` from 1.46 to 1.51. Revert that if you'd rather keep 1.46, but then this method can't compile.
- **Extra trait impls:** I also added `Display`, and `std::error::Error` under the `std` feature. You didn't ask for those.
- **Not done:** no `CHANGELOG.md` entry.

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
index cd5fe0e..202820e 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -230,6 +230,17 @@ pub struct Drain<'a, T> {
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
 #[derive(Clone)]
 enum Entry<T> {
     Vacant(usize),
@@ -776,6 +787,59 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with `N` distinct
+    /// keys simultaneously, in the same order as `keys`.
+    ///
+    /// Duplicate keys are reported first, before any other check. Otherwise
+    /// the keys are checked in order and the first bad one decides the error.
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
+    ///
+    /// let [x, y] = slab.get_disjoint_mut([a, b]).unwrap();
+    /// std::mem::swap(x, y);
+    ///
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
+        Ok(keys.map(|key| {
+            // SAFETY: keys are distinct, in bounds and occupied (checked above).
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
index dd71f99..38ea6fc 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,39 @@ fn clone_from() {
     assert_eq!(iter2.next(), None);
     assert!(slab2.capacity() >= 10);
 }
+
+#[test]
+fn get_disjoint_mut_returns_in_key_order() {
+    let mut slab = Slab::new();
+    let a = slab.insert(1);
+    let b = slab.insert(2);
+    let c = slab.insert(3);
+
+    let [x, y, z] = slab.get_disjoint_mut([c, a, b]).unwrap();
+    assert_eq!((*x, *y, *z), (3, 1, 2));
+    std::mem::swap(x, y);
+    assert_eq!((slab[a], slab[b], slab[c]), (3, 2, 1));
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+}
+
+#[test]
+fn get_disjoint_mut_errors() {
+    let mut slab = Slab::new();
+    for i in 0..5 {
+        slab.insert(i);
+    }
+    slab.remove(1);
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

Adding the method and error type now. Const generics and `[T; N]::map` need Rust 1.55, so I'm bumping `rust-version` from 1.46.

`Slab::get_disjoint_mut` is added in `src/lib.rs`, along with a public `GetDisjointMutError` enum. The enum has the variants and derives you specified, and it is exported from the crate root. The full test suite and doctests pass.

- **Behaviour:** results come back in key order, and `[]` gives `Ok([])`. Duplicate keys are checked first, then the keys in order, so `[42, 2, 1, 2]` is `OverlappingIndices`. On a 5-slot slab with key 1 vacant, `[1, 5]` is `IndexVacant` and `[5, 1]` is `IndexOutOfBounds`.
- **Tests:** I added two to `tests/slab.rs`, covering ordering plus the empty array, and each error case. The swap example from your request is the doctest on the method.
- **`unsafe` in the implementation:** the method has one small `unsafe` block, with a safety comment, because turning the checked keys into `N` simultaneous `&mut` references isn't possible in safe Rust. Callers never need `unsafe`.
- **MSRV bump:** const generics and `[T; N]::map` need Rust 1.55, so I raised `rust-version` in `Cargo.toml` from 1.46 to 1.55. That is a visible compatibility change for the crate. I did not touch `CHANGELOG.md` or any CI config.

Nothing is committed.

</details>

### claude, all: pass

Files: [Cargo.toml](../all/claude/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../all/claude/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs), [tests/slab.rs](../all/claude/rust-feat-slab-get-disjoint-mut-1/files/tests/slab.rs)

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
index cd5fe0e..8d9c12b 100644
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
@@ -725,6 +736,51 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with the given keys
+    /// simultaneously, in the same order as `keys`.
+    ///
+    /// Overlapping keys are reported first, then the keys are checked in order
+    /// and the first one that is out of bounds or vacant decides the error.
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
+        for i in 0..N {
+            if keys[i + 1..].contains(&keys[i]) {
+                return Err(GetDisjointMutError::OverlappingIndices);
+            }
+        }
+        let mut ptrs = [core::ptr::null_mut::<T>(); N];
+        for (ptr, &key) in ptrs.iter_mut().zip(keys.iter()) {
+            match self.entries.get_mut(key) {
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                Some(Entry::Occupied(val)) => *ptr = val,
+            }
+        }
+        // SAFETY: the keys are distinct, so the pointers refer to different
+        // entries, and each came from a live `&mut` borrowed from `self`.
+        Ok(unsafe { core::ptr::read(&ptrs as *const [*mut T; N] as *const [&mut T; N]) })
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

Done. `Slab::get_disjoint_mut` and the public `GetDisjointMutError` are added in `src/lib.rs`. Tests for each case you listed and the doctest pass.

Const generics need Rust 1.51, so I bumped `rust-version` in `Cargo.toml` from 1.46 to 1.51. The method uses one `unsafe` block inside the crate, so callers need none. I did not update `CHANGELOG.md`.

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
index cd5fe0e..241ac10 100644
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
+    /// A key is past the end of the slab's allocated entries.
+    IndexOutOfBounds,
+    /// A key refers to a vacant entry.
+    IndexVacant,
+}
+
 /// Pre-allocated storage for a uniform data type
 ///
 /// See the [module documentation] for more details.
@@ -725,6 +736,67 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to several values, in the order of `keys`.
+    ///
+    /// An empty key array returns an empty array of references.
+    /// Checking for duplicate keys takes O(N²) time.
+    ///
+    /// # Errors
+    ///
+    /// Returns [`GetDisjointMutError::OverlappingIndices`] if any keys are
+    /// equal, before checking whether any key is out of bounds or vacant.
+    /// Otherwise, keys are checked in order, returning
+    /// [`GetDisjointMutError::IndexOutOfBounds`] for a key past the end of the
+    /// slab's entries, or [`GetDisjointMutError::IndexVacant`] for a vacant entry.
+    /// Allocated capacity beyond the entries does not count as in bounds.
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
+            // SAFETY: Every key was checked to be in bounds and occupied.
+            // Keys are distinct, so each reference borrows a separate entry.
+            // The slab is exclusively borrowed for the returned references'
+            // lifetime, and its storage is not moved or resized here.
+            unsafe {
+                if let Entry::Occupied(value) = &mut *entries.add(key) {
+                    output.add(i).write(value);
+                }
+            }
+        }
+        // SAFETY: All N elements were initialized above (including when N is 0).
+        Ok(unsafe { result.assume_init() })
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..29b8405 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,59 @@ fn clone_from() {
     assert_eq!(iter2.next(), None);
     assert!(slab2.capacity() >= 10);
 }
+
+#[test]
+fn get_disjoint_mut() {
+    let mut slab = Slab::new();
+    for value in 0..5 {
+        slab.insert(value);
+    }
+    slab.remove(1);
+
+    let [last, first, middle] = slab.get_disjoint_mut([4, 0, 2]).unwrap();
+    std::mem::swap(last, first);
+    *middle = 20;
+    assert_eq!((slab[0], slab[2], slab[4]), (4, 20, 0));
+    let [value] = slab.get_disjoint_mut([3]).unwrap();
+    *value = 30;
+    assert_eq!(slab[3], 30);
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+}
+
+#[test]
+fn get_disjoint_mut_errors() {
+    use GetDisjointMutError::*;
+
+    let mut slab = Slab::with_capacity(16);
+    for value in 0..5 {
+        slab.insert(value);
+    }
+    slab.remove(1);
+    assert_eq!(
+        slab.get_disjoint_mut([42, 2, 1, 2]),
+        Err(OverlappingIndices)
+    );
+    assert_eq!(slab.get_disjoint_mut([42, 42]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([1, 1]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(IndexOutOfBounds));
+    assert_eq!(
+        slab.get_disjoint_mut([0, usize::MAX]),
+        Err(IndexOutOfBounds)
+    );
+    assert_eq!(slab.get_disjoint_mut([0, 1]), Err(IndexVacant));
+    assert_eq!(slab[0], 0);
+    assert_eq!(slab.len(), 4);
+
+    let mut empty = Slab::<i32>::new();
+    assert_eq!(empty.get_disjoint_mut([]), Ok([]));
+    assert_eq!(empty.get_disjoint_mut([0]), Err(IndexOutOfBounds));
+}
+
+#[test]
+fn get_disjoint_mut_zero_sized_values() {
+    let mut slab = Slab::new();
+    let a = slab.insert(());
+    let b = slab.insert(());
+    assert_eq!(slab.get_disjoint_mut([b, a]), Ok([&mut (), &mut ()]));
+}
```

</details>

<details><summary>reply</summary>

I’ll check the slab implementation and compatibility requirements, then add the API, documentation, and tests for the error precedence.

The crate currently declares Rust 1.46 support. The requested const-generic signature requires Rust 1.51, so I’ll update that minimum. The implementation will check all keys before creating references and remain compatible with `no_std`.

Added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum with the requested derives and variants.

The implementation preserves key order, checks duplicates first, and handles empty arrays. Tests cover error precedence, mutation, and zero-sized values.

All-feature and no-default-feature tests pass, including doctests. Raised the minimum Rust version to 1.51 for const generics and verified compilation on that version.

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
index cd5fe0e..dc61c83 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -127,6 +127,17 @@ use alloc::vec::{self, Vec};
 use core::iter::{self, FromIterator, FusedIterator};
 use core::{fmt, mem, ops, slice};
 
+/// An error returned by [`Slab::get_disjoint_mut`].
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum GetDisjointMutError {
+    /// The same key appears more than once.
+    OverlappingIndices,
+    /// A key is past the end of the slab's storage.
+    IndexOutOfBounds,
+    /// A key refers to a vacant slot.
+    IndexVacant,
+}
+
 /// Pre-allocated storage for a uniform data type
 ///
 /// See the [module documentation] for more details.
@@ -725,6 +736,65 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to several values, in the order of `keys`.
+    ///
+    /// Duplicate keys return [`GetDisjointMutError::OverlappingIndices`], even
+    /// if another key is out of bounds or vacant. Otherwise keys are checked
+    /// in order, returning [`GetDisjointMutError::IndexOutOfBounds`] or
+    /// [`GetDisjointMutError::IndexVacant`] for the first invalid key.
+    /// An empty key array returns an empty array of references.
+    ///
+    /// Checking for duplicate keys takes O(N²) time.
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
+            // distinct. Each reference therefore points to a separate entry,
+            // borrowed exclusively for the lifetime of `self`. The raw entry
+            // pointer avoids borrowing the entire storage again.
+            unsafe {
+                if let Entry::Occupied(value) = &mut *entries.add(key) {
+                    output.add(i).write(value);
+                }
+            }
+        }
+        // SAFETY: All N elements have been initialized above. For N = 0,
+        // the empty array requires no initialization.
+        Ok(unsafe { result.assume_init() })
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..51403de 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,55 @@ fn clone_from() {
     assert_eq!(iter2.next(), None);
     assert!(slab2.capacity() >= 10);
 }
+
+#[test]
+fn get_disjoint_mut_order_and_mutation() {
+    let mut slab: Slab<_> = (0..5).map(|i| (i, i)).collect();
+    slab.remove(1);
+    let [a, b, c] = slab.get_disjoint_mut([4, 0, 2]).unwrap();
+    assert_eq!((*a, *b, *c), (4, 0, 2));
+    std::mem::swap(a, b);
+    *c = 20;
+    assert_eq!((slab[0], slab[2], slab[4]), (4, 20, 0));
+    let [value] = slab.get_disjoint_mut([3]).unwrap();
+    *value = 30;
+    assert_eq!(slab[3], 30);
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
+    assert_eq!(slab.get_disjoint_mut([5, 5]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([1, 1]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(IndexOutOfBounds));
+    assert_eq!(slab.get_disjoint_mut([0, 1]), Err(IndexVacant));
+    assert_eq!(
+        slab.get_disjoint_mut([0, usize::MAX]),
+        Err(IndexOutOfBounds)
+    );
+    assert_eq!(slab.len(), 4);
+    assert_eq!(slab[2], 2);
+}
+
+#[test]
+fn get_disjoint_mut_empty_and_zst() {
+    let mut slab = Slab::<()>::with_capacity(10);
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+    assert_eq!(
+        slab.get_disjoint_mut([0]),
+        Err(GetDisjointMutError::IndexOutOfBounds)
+    );
+    slab.insert(());
+    slab.insert(());
+    let [a, b] = slab.get_disjoint_mut([1, 0]).unwrap();
+    std::mem::swap(a, b);
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+}
```

</details>

<details><summary>reply</summary>

I’ll check the crate’s implementation and compatibility requirements, then add the API, docs, and tests for the error ordering.

The crate currently targets Rust 1.46. The requested const-generic signature needs Rust 1.51, so I’ll update the minimum version. I’ll check duplicates first, then validate entries in key order before constructing the references.

The API and tests pass, including duplicate precedence, ordered errors, empty arrays, and mutation through the returned references. The no-default-features build and Clippy also pass. I’ll finish by checking compilation with Rust 1.51.

Added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum with the requested derives, error precedence, key ordering, and empty-array behavior.

Included documentation and tests. All tests, Clippy, formatting, and no-default-features checks pass.

Raised the minimum Rust version to 1.51 for const generics and verified compilation with that version.

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
index cd5fe0e..0a7f313 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -127,6 +127,17 @@ use alloc::vec::{self, Vec};
 use core::iter::{self, FromIterator, FusedIterator};
 use core::{fmt, mem, ops, slice};
 
+/// An error returned by [`Slab::get_disjoint_mut`].
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum GetDisjointMutError {
+    /// A key occurs more than once in the requested keys.
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
@@ -725,6 +736,61 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Returns mutable references to the values at `keys`, in the same order.
+    ///
+    /// Duplicate keys return [`GetDisjointMutError::OverlappingIndices`], even
+    /// if another key is invalid. Otherwise, keys are checked in order: a key
+    /// past the end of the slots returns [`GetDisjointMutError::IndexOutOfBounds`],
+    /// and a vacant slot returns [`GetDisjointMutError::IndexVacant`].
+    /// An empty array returns `Ok([])`. Duplicate checking takes O(N²) time.
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
+        // SAFETY: All keys are in bounds, occupied, and distinct. Each reference
+        // borrows a different entry, and the slab remains exclusively borrowed
+        // for the lifetime of the returned references. Every output element is
+        // initialized before assume_init, including the vacuous N = 0 case.
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
index dd71f99..4a942d7 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,50 @@ fn clone_from() {
     assert_eq!(iter2.next(), None);
     assert!(slab2.capacity() >= 10);
 }
+
+#[test]
+fn get_disjoint_mut_order_and_mutation() {
+    let mut slab: Slab<_> = (0..5).map(|i| (i, i)).collect();
+    slab.remove(1);
+    let [last, first, middle] = slab.get_disjoint_mut([4, 0, 2]).unwrap();
+    std::mem::swap(last, first);
+    *middle = 20;
+    assert_eq!((slab[0], slab[2], slab[4]), (4, 20, 0));
+    let [single] = slab.get_disjoint_mut([3]).unwrap();
+    *single = 30;
+    assert_eq!(slab[3], 30);
+}
+
+#[test]
+fn get_disjoint_mut_errors() {
+    use GetDisjointMutError::*;
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
+    assert_eq!(slab.get_disjoint_mut([usize::MAX]), Err(IndexOutOfBounds));
+    assert_eq!(slab.get_disjoint_mut([0, 1]), Err(IndexVacant));
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
+    slab.insert(());
+    slab.insert(());
+    assert_eq!(slab.get_disjoint_mut([1, 0]), Ok([&mut (), &mut ()]));
+}
```

</details>

<details><summary>reply</summary>

Done.
Added `get_disjoint_mut`, public error enum, docs, tests. Tests and Clippy passed; Rust 1.51 compilation verified. Minimum Rust version raised to 1.51.

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
index cd5fe0e..c86f8b7 100644
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
@@ -725,6 +736,54 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the given keys, in the same order.
+    ///
+    /// Duplicate keys return [`GetDisjointMutError::OverlappingIndices`] before
+    /// any slots are checked. Otherwise, keys are checked in order, returning
+    /// [`GetDisjointMutError::IndexOutOfBounds`] for a key past the end of the
+    /// slots or [`GetDisjointMutError::IndexVacant`] for a vacant slot.
+    /// An empty key array returns an empty array of references.
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
+        for key in &keys {
+            match self.entries.get(*key) {
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                Some(Entry::Occupied(_)) => {}
+            }
+        }
+        let mut result = mem::MaybeUninit::<[&mut T; N]>::uninit();
+        let output = result.as_mut_ptr().cast::<&mut T>();
+        let entries = self.entries.as_mut_ptr();
+        unsafe {
+            for (i, key) in keys.iter().enumerate() {
+                if let Entry::Occupied(value) = &mut *entries.add(*key) {
+                    output.add(i).write(value);
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
index dd71f99..cc165d8 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -125,6 +125,84 @@ fn slab_get_mut() {
     assert_eq!(slab[key], 3);
 }
 
+/// Mutable references retain key order and can be used to swap values.
+#[test]
+fn get_disjoint_mut_values() {
+    let mut slab = Slab::new();
+    let a = slab.insert(1);
+    let b = slab.insert(2);
+    let [x, y] = slab.get_disjoint_mut([a, b]).unwrap();
+    std::mem::swap(x, y);
+    assert_eq!((slab[a], slab[b]), (2, 1));
+    slab.insert(3);
+    let [x, y, z] = slab.get_disjoint_mut([2, 0, 1]).unwrap();
+    assert_eq!((*x, *y, *z), (3, 2, 1));
+    *x = 30;
+    *y = 20;
+    *z = 10;
+    assert_eq!(
+        slab.iter().map(|(_, v)| *v).collect::<Vec<_>>(),
+        [20, 10, 30]
+    );
+}
+
+/// Overlap takes precedence over invalid slots, including repeated invalid keys.
+#[test]
+fn get_disjoint_mut_overlap() {
+    let mut slab: Slab<_> = (0..5).enumerate().collect();
+    slab.remove(1);
+    for keys in [[42, 2, 1, 2], [1, 2, 1, 3], [42, 2, 42, 3]] {
+        assert_eq!(
+            slab.get_disjoint_mut(keys),
+            Err(GetDisjointMutError::OverlappingIndices)
+        );
+    }
+}
+
+/// Invalid slots are reported in key order, using slot bounds rather than length.
+#[test]
+fn get_disjoint_mut_invalid_slots() {
+    let mut slab: Slab<_> = (0..5).enumerate().collect();
+    slab.remove(1);
+    assert_eq!(
+        slab.get_disjoint_mut([1, 5]),
+        Err(GetDisjointMutError::IndexVacant)
+    );
+    assert_eq!(
+        slab.get_disjoint_mut([5, 1]),
+        Err(GetDisjointMutError::IndexOutOfBounds)
+    );
+    assert_eq!(
+        slab.get_disjoint_mut([usize::MAX]),
+        Err(GetDisjointMutError::IndexOutOfBounds)
+    );
+    assert_eq!(slab.get_disjoint_mut([4]).unwrap(), [&mut 4]);
+    let mut empty = Slab::<i32>::with_capacity(5);
+    assert_eq!(
+        empty.get_disjoint_mut([0]),
+        Err(GetDisjointMutError::IndexOutOfBounds)
+    );
+}
+
+/// Empty requests succeed for both empty and occupied slabs.
+#[test]
+fn get_disjoint_mut_empty() {
+    let mut slab = Slab::<i32>::new();
+    let [] = slab.get_disjoint_mut([]).unwrap();
+    slab.insert(1);
+    let [] = slab.get_disjoint_mut([]).unwrap();
+}
+
+/// Distinct slots can hold zero-sized values.
+#[test]
+fn get_disjoint_mut_zero_sized() {
+    let mut slab: Slab<_> = [(), (), ()].iter().copied().enumerate().collect();
+    assert_eq!(
+        slab.get_disjoint_mut([2, 0, 1]).unwrap(),
+        [&mut (), &mut (), &mut ()]
+    );
+}
+
 #[test]
 fn key_of_tagged() {
     let mut slab = Slab::new();
```

</details>

<details><summary>reply</summary>

I’ll check the existing accessors and test style, then add the method, public error type, and focused tests for the specified ordering and edge cases.

The crate currently targets Rust 1.46; the requested const-generic signature requires Rust 1.51, so I’ll raise that minimum. The method will check all duplicates first, then validate slots in key order. Existing accessors can stay unchanged.

Added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum with the requested derives and error precedence.

Tests cover swapping, result order, duplicate precedence, invalid slots, empty arrays, and zero-sized values. Build and tests pass with all features and without default features.

Raised the minimum Rust version to 1.51 for const generics; testing on Rust 1.51 itself was not run. No additional API was added.

</details>

### codex, all: pass

Files: [Cargo.toml](../all/codex/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../all/codex/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs), [tests/slab.rs](../all/codex/rust-feat-slab-get-disjoint-mut-1/files/tests/slab.rs)

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
index cd5fe0e..ad3c375 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -127,6 +127,17 @@ use alloc::vec::{self, Vec};
 use core::iter::{self, FromIterator, FusedIterator};
 use core::{fmt, mem, ops, slice};
 
+/// An error returned when requesting mutable references to several slab entries.
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum GetDisjointMutError {
+    /// The same key was requested more than once.
+    OverlappingIndices,
+    /// A key is past the end of the slab.
+    IndexOutOfBounds,
+    /// A key refers to a vacant entry.
+    IndexVacant,
+}
+
 /// Pre-allocated storage for a uniform data type
 ///
 /// See the [module documentation] for more details.
@@ -725,6 +736,60 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the given entries in the order of `keys`.
+    ///
+    /// Duplicate keys return [`GetDisjointMutError::OverlappingIndices`] before
+    /// any entries are checked. Otherwise, keys are checked in order, returning
+    /// [`GetDisjointMutError::IndexOutOfBounds`] for a key past the end or
+    /// [`GetDisjointMutError::IndexVacant`] for a vacant entry.
+    /// An empty array returns `Ok([])`.
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
+        for key in &keys {
+            match self.entries.get(*key) {
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                Some(Entry::Occupied(_)) => {}
+            }
+        }
+
+        let mut sorted = keys;
+        sorted.sort_unstable();
+        let mut values = [(); N].map(|_| None);
+        let mut remaining = self.entries.as_mut_slice();
+        let mut offset = 0;
+        for key in sorted.iter().copied() {
+            let (_, tail) = remaining.split_at_mut(key - offset);
+            let (entry, tail) = tail.split_first_mut().unwrap();
+            if let Entry::Occupied(value) = entry {
+                values[keys.iter().position(|&k| k == key).unwrap()] = Some(value);
+            }
+            remaining = tail;
+            offset = key + 1;
+        }
+        Ok(values.map(Option::unwrap))
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..3ffe4e1 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,50 @@ fn clone_from() {
     assert_eq!(iter2.next(), None);
     assert!(slab2.capacity() >= 10);
 }
+
+#[test]
+fn get_disjoint_mut() {
+    let mut slab = Slab::new();
+    let a = slab.insert(1);
+    let b = slab.insert(2);
+    let [x, y] = slab.get_disjoint_mut([a, b]).unwrap();
+    std::mem::swap(x, y);
+    assert_eq!((slab[a], slab[b]), (2, 1));
+    let c = slab.insert(3);
+    let [z, x, y] = slab.get_disjoint_mut([c, a, b]).unwrap();
+    *z = 30;
+    *x = 20;
+    *y = 10;
+    assert_eq!((slab[a], slab[b], slab[c]), (20, 10, 30));
+    let [value] = slab.get_disjoint_mut([c]).unwrap();
+    *value = 4;
+    assert_eq!(slab[c], 4);
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+    assert_eq!(Slab::<()>::new().get_disjoint_mut([]), Ok([]));
+    let mut units = Slab::new();
+    units.insert(());
+    units.insert(());
+    assert_eq!(units.get_disjoint_mut([1, 0]), Ok([&mut (), &mut ()]));
+}
+
+#[test]
+fn get_disjoint_mut_errors() {
+    use GetDisjointMutError::*;
+
+    let mut slab: Slab<_> = (0..5).map(|key| (key, key)).collect();
+    slab.remove(1);
+    assert_eq!(
+        slab.get_disjoint_mut([42, 2, 1, 2]),
+        Err(OverlappingIndices)
+    );
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(IndexOutOfBounds));
+    assert_eq!(slab.get_disjoint_mut([1, 1]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([5, 5]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([usize::MAX]), Err(IndexOutOfBounds));
+    assert_eq!(slab.get_disjoint_mut([4]), Ok([&mut 4]));
+    assert_eq!(
+        Slab::<()>::new().get_disjoint_mut([0]),
+        Err(IndexOutOfBounds)
+    );
+}
```

</details>

<details><summary>reply</summary>

Done.
Added `get_disjoint_mut`, public error enum, docs, tests. Builds and tests pass with all features and no defaults. Minimum Rust raised to 1.55.

</details>
