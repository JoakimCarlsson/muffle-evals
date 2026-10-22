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
| claude | muffle | pass | +88/-0 | 28 | 3,601 | $0.102 |
| claude | hush | pass | +72/-0 | 19 | 2,929 | $0.088 |
| claude | sloth | pass | +61/-1 | 0 | 3,085 | $0.094 |
| claude | all | pass | +85/-1 | 0 | 5,946 | $0.171 |
| codex | base | pass | +73/-1 | 58 | 2,753 | - |
| codex | muffle | pass | +71/-1 | 56 | 2,438 | - |
| codex | hush | pass | +70/-1 | 51 | 2,207 | - |
| codex | sloth | pass | +59/-1 | 0 | 1,593 | - |
| codex | all | pass | +67/-1 | 0 | 1,687 | - |

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
index cd5fe0e..85f7e6b 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -230,6 +230,30 @@ pub struct Drain<'a, T> {
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
+            GetDisjointMutError::OverlappingIndices => "keys overlap",
+            GetDisjointMutError::IndexOutOfBounds => "key is out of bounds",
+            GetDisjointMutError::IndexVacant => "key is vacant",
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
@@ -725,6 +749,70 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with several keys
+    /// simultaneously.
+    ///
+    /// The references are returned in the same order as `keys`.
+    ///
+    /// # Errors
+    ///
+    /// All keys are first checked for duplicates, and
+    /// [`GetDisjointMutError::OverlappingIndices`] is returned if any key
+    /// appears twice. Then the keys are checked in order, and the first bad one
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
+        for i in 0..N {
+            for j in 0..i {
+                if keys[i] == keys[j] {
+                    return Err(GetDisjointMutError::OverlappingIndices);
+                }
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
+        // SAFETY: every key is in bounds, refers to an occupied entry, and is
+        // distinct from all others, so the resulting references don't alias.
+        // They borrow `self` mutably for the returned lifetime.
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
index dd71f99..f2eff86 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,31 @@ fn clone_from() {
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
+    assert_eq!((*a, *b), (3, 0));
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

Now a test for the specified orderings, plus a changelog check.

I added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum. All tests pass, including a new test in `tests/slab.rs` and a doc example. I didn't commit anything.

- **Signature:** it matches what you asked for, and the references come back in the order of `keys`.
- **Error order:** it checks all keys for duplicates first, then checks the keys in order. `[42, 2, 1, 2]` gives `OverlappingIndices`. In a 5-slot slab with key 1 vacant, `[1, 5]` gives `IndexVacant` and `[5, 1]` gives `IndexOutOfBounds`. An empty array returns `Ok([])`.
- **Error type:** `GetDisjointMutError` derives `Debug`, `Clone`, `PartialEq` and `Eq`. It is defined in `src/lib.rs`, so it is exported from the crate root. I also gave it `Display` and, with the `std` feature, `std::error::Error`, which you didn't ask for.
- **Unsafe code:** the API needs none from callers, but the implementation has one `unsafe` block. It runs only after the checks above, which guarantee every key is in bounds, occupied and distinct. The block has a `SAFETY` comment.
- **MSRV:** `Cargo.toml` declares `rust-version = "1.46"`, but const generics need Rust 1.51 and the array `map` I used needs 1.55. The MSRV would need raising to at least 1.55 for this to build on the declared minimum. I only built on the local toolchain, so I haven't tested an older compiler.

I left `CHANGELOG.md` alone because its entries are tied to release versions and PR numbers.

</details>

### claude, hush: pass

Files: [src/lib.rs](../hush/claude/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs), [tests/slab.rs](../hush/claude/rust-feat-slab-get-disjoint-mut-1/files/tests/slab.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/lib.rs b/src/lib.rs
index cd5fe0e..afe3938 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -230,6 +230,30 @@ pub struct Drain<'a, T> {
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
+            GetDisjointMutError::OverlappingIndices => "keys overlap",
+            GetDisjointMutError::IndexOutOfBounds => "key out of bounds",
+            GetDisjointMutError::IndexVacant => "key is vacant",
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
@@ -725,6 +749,54 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with the given
+    /// keys simultaneously, in the same order as `keys`.
+    ///
+    /// Returns [`GetDisjointMutError::OverlappingIndices`] if a key appears
+    /// more than once; this is checked for all keys first. Otherwise the keys
+    /// are checked in order, and the first bad key yields
+    /// [`GetDisjointMutError::IndexOutOfBounds`] or
+    /// [`GetDisjointMutError::IndexVacant`].
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
+        for i in 1..N {
+            if keys[..i].contains(&keys[i]) {
+                return Err(GetDisjointMutError::OverlappingIndices);
+            }
+        }
+        let mut ptrs = [core::ptr::null_mut::<T>(); N];
+        for (ptr, &key) in ptrs.iter_mut().zip(keys.iter()) {
+            match self.entries.get_mut(key) {
+                Some(Entry::Occupied(val)) => *ptr = val as *mut T,
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+            }
+        }
+        // SAFETY: keys are distinct, so the pointers refer to distinct
+        // entries, all borrowed from `self` for the returned lifetime.
+        Ok(ptrs.map(|p| unsafe { &mut *p }))
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..6988bd3 100644
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
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+    assert_eq!(
+        slab.get_disjoint_mut([42, 2, 1, 2]),
+        Err(GetDisjointMutError::OverlappingIndices)
+    );
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(GetDisjointMutError::IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(GetDisjointMutError::IndexOutOfBounds));
+    let [a, b] = slab.get_disjoint_mut([3, 0]).unwrap();
+    std::mem::swap(a, b);
+    assert_eq!((slab[0], slab[3]), (3, 0));
+}
```

</details>

<details><summary>reply</summary>

Done. Added `Slab::get_disjoint_mut` and public `GetDisjointMutError` (exported from the crate root) in `src/lib.rs`, plus a test and a doctest. All tests pass.

- **Not asked for:** I also added `Display`, and `std::error::Error` under the `std` feature, for the error type.
- **MSRV risk:** `Cargo.toml` still says `rust-version = "1.46"`, but const generics need Rust 1.51. I didn't change it, so you may want to bump it.
- **Not done:** no `CHANGELOG.md` entry.

</details>

### claude, sloth: pass

Files: [Cargo.toml](../sloth/claude/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../sloth/claude/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs)

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
index cd5fe0e..ddbf523 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -230,6 +230,17 @@ pub struct Drain<'a, T> {
     len: usize,
 }
 
+/// The error returned by [`Slab::get_disjoint_mut`].
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum GetDisjointMutError {
+    /// A key is past the end of the slab.
+    IndexOutOfBounds,
+    /// A key is in bounds but has no value.
+    IndexVacant,
+    /// The same key was given more than once.
+    OverlappingIndices,
+}
+
 #[derive(Clone)]
 enum Entry<T> {
     Vacant(usize),
@@ -725,6 +736,55 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with the given keys
+    /// simultaneously, in the same order as `keys`.
+    ///
+    /// Duplicate keys are rejected first with
+    /// [`GetDisjointMutError::OverlappingIndices`]. Otherwise the keys are
+    /// checked in order and the first bad one decides the error:
+    /// [`GetDisjointMutError::IndexOutOfBounds`] or
+    /// [`GetDisjointMutError::IndexVacant`].
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
+        // SAFETY: every key is in bounds, occupied and distinct, so each
+        // reference points to a different live element of `self.entries`.
+        Ok(keys.map(|key| match unsafe { &mut *base.add(key) } {
+            Entry::Occupied(val) => val,
+            Entry::Vacant(_) => unreachable!(),
+        }))
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
```

</details>

<details><summary>reply</summary>

I added `Slab::get_disjoint_mut` with the signature you gave, plus the public `GetDisjointMutError` enum. I ran `cargo test`; the existing tests and the new doctest pass. I did not write separate unit tests, so the `[42, 2, 1, 2]` and `[1, 5]` / `[5, 1]` ordering cases are not covered by a test.

- **Method:** it first returns `OverlappingIndices` if any key repeats. It then checks the keys in order, so the first bad key decides between `IndexOutOfBounds` and `IndexVacant`. An empty key array gives `Ok([])`.
- **Unsafe code:** the method uses one small `unsafe` block internally, to hand out the references after the checks. Callers don't need any `unsafe`.
- **Enum:** `GetDisjointMutError` is defined in the crate root, so it is exported from there. It derives `Debug`, `Clone`, `PartialEq` and `Eq`, and has the three variants you listed.
- **Doctest:** the doc example is your swap example, plus an overlapping-keys check.
- **Rust version:** the crate declared `rust-version = "1.46"`, but const generics need 1.51 and the `[T; N]::map` call I used needs 1.55. I raised `rust-version` in `Cargo.toml` to `1.55`. If you want to keep a lower minimum, say so. I'd have to rework it, and that would likely mean more `unsafe`.

I didn't touch `CHANGELOG.md` or commit anything. The main change is in `src/lib.rs`.

</details>

### claude, all: pass

Files: [CHANGELOG.md](../all/claude/rust-feat-slab-get-disjoint-mut-1/files/CHANGELOG.md), [Cargo.toml](../all/claude/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../all/claude/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index f46a797..fabb162 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,3 +1,7 @@
+# Unreleased
+
+* Add `Slab::get_disjoint_mut` and `GetDisjointMutError` (MSRV is now 1.51)
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
index cd5fe0e..a23cc79 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -230,6 +230,27 @@ pub struct Drain<'a, T> {
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
+            Self::OverlappingIndices => "keys overlap",
+            Self::IndexOutOfBounds => "key out of bounds",
+            Self::IndexVacant => "key is vacant",
+        })
+    }
+}
+
 #[derive(Clone)]
 enum Entry<T> {
     Vacant(usize),
@@ -725,6 +746,65 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with the given keys
+    /// simultaneously, in the same order as `keys`.
+    ///
+    /// All keys are first checked for duplicates, which yields
+    /// [`GetDisjointMutError::OverlappingIndices`]. Then the keys are checked
+    /// in order and the first invalid one decides the error:
+    /// [`GetDisjointMutError::IndexOutOfBounds`] if it is past the end of the
+    /// slab, [`GetDisjointMutError::IndexVacant`] if it has no value.
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
+        let mut out = mem::MaybeUninit::<[&mut T; N]>::uninit();
+        let out_ptr = out.as_mut_ptr() as *mut &mut T;
+        for (i, &key) in keys.iter().enumerate() {
+            if key >= len {
+                return Err(GetDisjointMutError::IndexOutOfBounds);
+            }
+            // SAFETY: `key < len`, and keys are pairwise distinct, so every
+            // produced reference points to a different entry. `out` slots are
+            // written exactly once and all N are written before `assume_init`.
+            match unsafe { &mut *base.add(key) } {
+                Entry::Occupied(val) => unsafe { out_ptr.add(i).write(val) },
+                Entry::Vacant(_) => return Err(GetDisjointMutError::IndexVacant),
+            }
+        }
+        Ok(unsafe { out.assume_init() })
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
```

</details>

<details><summary>reply</summary>

Done. `Slab::get_disjoint_mut` and `GetDisjointMutError` are added in `src/lib.rs`, and the existing tests and doctests pass. I didn't write dedicated tests for the `[42, 2, 1, 2]` and `[1, 5]` / `[5, 1]` error-order cases.

Const generics need Rust 1.51, so I raised `rust-version` in `Cargo.toml` from 1.46 to 1.51. I also added a `CHANGELOG.md` entry noting the new MSRV. The error enum also implements `Display`, which you didn't ask for.

Stopped background run was the first `cargo test` attempt. Edits had already applied, and the rerun finished with all tests passing. Nothing left to restart.

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
index cd5fe0e..6009f63 100644
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
+    /// A key is beyond the end of the slab's slots.
+    IndexOutOfBounds,
+    /// A key refers to a vacant slot.
+    IndexVacant,
+}
+
 impl<T> Clone for Slab<T>
 where
     T: Clone,
@@ -725,6 +736,65 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to several values, in the order of `keys`.
+    ///
+    /// An empty array of keys returns an empty array of references.
+    /// This method takes O(N²) time to check for duplicate keys.
+    ///
+    /// # Errors
+    ///
+    /// Returns [`GetDisjointMutError::OverlappingIndices`] if any keys are
+    /// equal, before checking whether any key is out of bounds or vacant.
+    /// Otherwise, keys are checked in order, returning
+    /// [`GetDisjointMutError::IndexOutOfBounds`] for a key beyond the slab's
+    /// slots or [`GetDisjointMutError::IndexVacant`] for a vacant slot.
+    /// Reserved capacity beyond the existing slots is out of bounds.
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
+        let mut result = mem::MaybeUninit::<[&mut T; N]>::uninit();
+        let output = result.as_mut_ptr() as *mut &mut T;
+        let entries = self.entries.as_mut_ptr();
+        for (i, &key) in keys.iter().enumerate() {
+            if key >= self.entries.len() {
+                return Err(GetDisjointMutError::IndexOutOfBounds);
+            }
+            // SAFETY: The key is in bounds, and all keys are distinct. Each
+            // reference therefore borrows a separate entry, and the slab is
+            // exclusively borrowed for the lifetime of the returned references.
+            // Writing through `output` initializes element i without reading
+            // uninitialized memory. On error, initialized references need no drop.
+            unsafe {
+                match &mut *entries.add(key) {
+                    Entry::Occupied(value) => output.add(i).write(value),
+                    Entry::Vacant(_) => return Err(GetDisjointMutError::IndexVacant),
+                }
+            }
+        }
+        // SAFETY: Every element has been initialized, including when N is zero.
+        Ok(unsafe { result.assume_init() })
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..a521e83 100644
--- a/tests/slab.rs
+++ b/tests/slab.rs
@@ -730,3 +730,59 @@ fn clone_from() {
     assert_eq!(iter2.next(), None);
     assert!(slab2.capacity() >= 10);
 }
+
+#[test]
+fn get_disjoint_mut_order_and_swap() {
+    let mut slab: Slab<_> = (0..5).map(|i| (i, i)).collect();
+    slab.remove(1);
+    let [last, first, middle] = slab.get_disjoint_mut([4, 0, 2]).unwrap();
+    assert_eq!((*last, *first, *middle), (4, 0, 2));
+    std::mem::swap(last, first);
+    *middle = 20;
+    assert_eq!((slab[0], slab[2], slab[4]), (4, 20, 0));
+    let [value] = slab.get_disjoint_mut([3]).unwrap();
+    *value = 30;
+    assert_eq!(slab[3], 30);
+}
+
+#[test]
+fn get_disjoint_mut_errors() {
+    use GetDisjointMutError::*;
+    let mut slab: Slab<_> = (0..5).map(|i| (i, i)).collect();
+    slab.remove(1);
+    for keys in [[0, 0], [1, 1], [42, 42], [usize::MAX, usize::MAX]] {
+        assert_eq!(slab.get_disjoint_mut(keys), Err(OverlappingIndices));
+    }
+    assert_eq!(
+        slab.get_disjoint_mut([42, 2, 1, 2]),
+        Err(OverlappingIndices)
+    );
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(IndexOutOfBounds));
+    assert_eq!(slab.get_disjoint_mut([0, 1]), Err(IndexVacant));
+    assert_eq!(
+        slab.get_disjoint_mut([0, usize::MAX]),
+        Err(IndexOutOfBounds)
+    );
+    assert_eq!(slab.get_disjoint_mut([0, 2]), Ok([&mut 0, &mut 2]));
+}
+
+#[test]
+fn get_disjoint_mut_empty_and_reserved() {
+    let mut slab = Slab::<i32>::with_capacity(10);
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
+    let mut slab: Slab<_> = (0..3).map(|i| (i, ())).collect();
+    let [a, b, c] = slab.get_disjoint_mut([2, 0, 1]).unwrap();
+    std::mem::swap(a, b);
+    *c = ();
+}
```

</details>

<details><summary>reply</summary>

I’ll check the crate’s MSRV and existing conventions, then add the method, public error type, and tests for ordering and edge cases.

The requested signature requires Rust 1.51 for const generics; the crate currently declares 1.46. I’ll update that minimum and keep the implementation compatible with 1.51, including `no_std` builds.

Added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum with the requested derives, key ordering, and error precedence.

Tests cover swapping, duplicate keys, vacant and out-of-bounds slots, empty arrays, and zero-sized values. All tests and doctests pass with all features and with default features disabled.

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
index cd5fe0e..4c8edb6 100644
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
+    /// A key is past the end of the slab's slots.
+    IndexOutOfBounds,
+    /// A key refers to a vacant slot.
+    IndexVacant,
+}
+
 /// Pre-allocated storage for a uniform data type
 ///
 /// See the [module documentation] for more details.
@@ -725,6 +736,64 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to several values in the order of `keys`.
+    ///
+    /// Duplicate keys return [`GetDisjointMutError::OverlappingIndices`] before
+    /// any slots are checked. Otherwise, keys are checked in order: the first
+    /// out-of-bounds or vacant slot returns [`GetDisjointMutError::IndexOutOfBounds`]
+    /// or [`GetDisjointMutError::IndexVacant`], respectively.
+    /// An empty array returns `Ok([])`.
+    ///
+    /// This method takes O(N²) time to check for duplicate keys.
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
+        let entries = self.entries.as_mut_ptr();
+        let mut result = mem::MaybeUninit::<[&mut T; N]>::uninit();
+        let output = result.as_mut_ptr().cast::<&mut T>();
+        for (i, &key) in keys.iter().enumerate() {
+            // SAFETY: All keys are in bounds, occupied, and distinct. Each
+            // reference borrows a separate entry, and the slab remains exclusively
+            // borrowed for the lifetime of the returned references. Each output
+            // slot is written exactly once, without reading uninitialized memory.
+            unsafe {
+                if let Entry::Occupied(value) = &mut *entries.add(key) {
+                    output.add(i).write(value);
+                }
+            }
+        }
+        // SAFETY: Every array element was initialized above (also valid for N = 0).
+        Ok(unsafe { result.assume_init() })
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
diff --git a/tests/slab.rs b/tests/slab.rs
index dd71f99..1f99a18 100644
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
+    slab.remove(1);
+    let [last, first, middle] = slab.get_disjoint_mut([4, 0, 2]).unwrap();
+    assert_eq!((*last, *first, *middle), (4, 0, 2));
+    std::mem::swap(last, first);
+    *middle = 20;
+    assert_eq!((slab[0], slab[2], slab[4]), (4, 20, 0));
+    let [value] = slab.get_disjoint_mut([3]).unwrap();
+    *value = 30;
+    assert_eq!(slab[3], 30);
+}
+
+#[test]
+fn get_disjoint_mut_errors() {
+    use GetDisjointMutError::*;
+    let mut slab: Slab<_> = (0..5).enumerate().collect();
+    slab.remove(1);
+    assert_eq!(
+        slab.get_disjoint_mut([42, 2, 1, 2]),
+        Err(OverlappingIndices)
+    );
+    assert_eq!(slab.get_disjoint_mut([42, 42]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([1, 1]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([0, 0]), Err(OverlappingIndices));
+    assert_eq!(slab.get_disjoint_mut([1, 5]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([5, 1]), Err(IndexOutOfBounds));
+    assert_eq!(slab.get_disjoint_mut([usize::MAX]), Err(IndexOutOfBounds));
+    assert_eq!(slab.get_disjoint_mut([0, 1]), Err(IndexVacant));
+    assert_eq!(slab.get_disjoint_mut([0, 5]), Err(IndexOutOfBounds));
+    assert_eq!(slab[0], 0);
+}
+
+#[test]
+fn get_disjoint_mut_empty_and_zero_sized() {
+    let mut slab = Slab::<()>::with_capacity(10);
+    assert_eq!(slab.get_disjoint_mut([]), Ok([]));
+    assert_eq!(
+        slab.get_disjoint_mut([0]),
+        Err(GetDisjointMutError::IndexOutOfBounds)
+    );
+    for _ in 0..3 {
+        slab.insert(());
+    }
+    assert_eq!(
+        slab.get_disjoint_mut([2, 0, 1]),
+        Ok([&mut (), &mut (), &mut ()])
+    );
+}
```

</details>

<details><summary>reply</summary>

Slab API addition needs source and test checks.


Done.
Added `get_disjoint_mut`, public error enum, docs, tests. All-feature and no-default-feature tests pass. Const generics raise minimum Rust to 1.51; minimum version untested.

</details>

### codex, sloth: pass

Files: [Cargo.toml](../sloth/codex/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../sloth/codex/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs)

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
index cd5fe0e..24fc195 100644
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
+    /// A key is past the end of the slab's storage.
+    IndexOutOfBounds,
+    /// A key refers to a vacant slot.
+    IndexVacant,
+}
+
 impl<T> Clone for Slab<T>
 where
     T: Clone,
@@ -725,6 +736,53 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with the given keys,
+    /// in the same order as `keys`. An empty array returns `Ok([])`.
+    ///
+    /// # Errors
+    ///
+    /// Returns [`GetDisjointMutError::OverlappingIndices`] if any key is repeated,
+    /// before checking whether keys are in bounds or occupied. Otherwise, keys
+    /// are checked in order, returning [`GetDisjointMutError::IndexOutOfBounds`]
+    /// for a key past the end of the storage or
+    /// [`GetDisjointMutError::IndexVacant`] for a vacant slot.
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
+        for key in &keys {
+            match self.entries.get(*key) {
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                Some(Entry::Occupied(_)) => {}
+            }
+        }
+        let entries = self.entries.as_mut_ptr();
+        Ok(keys.map(|key| unsafe {
+            match &mut *entries.add(key) {
+                Entry::Occupied(value) => value,
+                Entry::Vacant(_) => unreachable!(),
+            }
+        }))
+    }
+
     /// Return two mutable references to the values associated with the two
     /// given keys simultaneously.
     ///
```

</details>

<details><summary>reply</summary>

I’ll check the slab’s storage, exports, and Rust version requirements, then add the method and error type and run the existing tests.

The change reaches `src/lib.rs` for the method, documentation, and crate-root error type, plus `Cargo.toml` for Rust compatibility. The signature needs const generics; using array `map` keeps the implementation small and raises the minimum Rust version from 1.46 to 1.55.

Existing callers need no changes. I’ll preserve the specified error precedence and `no_std` support, with no new dependencies or extra APIs.

Added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum with the requested derives, ordering, error precedence, and empty-array behavior.

Minimum Rust version is now 1.55. No dependencies added.

Formatting, build, and existing tests passed with all features and with default features disabled. Rust 1.55 itself wasn’t available to test.

</details>

### codex, all: pass

Files: [Cargo.toml](../all/codex/rust-feat-slab-get-disjoint-mut-1/files/Cargo.toml), [src/lib.rs](../all/codex/rust-feat-slab-get-disjoint-mut-1/files/src/lib.rs)

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
index cd5fe0e..70691ad 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -144,6 +144,17 @@ pub struct Slab<T> {
     next: usize,
 }
 
+/// An error returned by [`Slab::get_disjoint_mut`].
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum GetDisjointMutError {
+    /// The same key occurs more than once.
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
@@ -725,6 +736,61 @@ impl<T> Slab<T> {
         }
     }
 
+    /// Return mutable references to the values associated with the given keys,
+    /// in the same order as `keys`.
+    ///
+    /// An empty array returns `Ok([])`. Checking for duplicate keys takes
+    /// O(N²) time and requires no allocation.
+    ///
+    /// # Errors
+    ///
+    /// Duplicate keys return [`GetDisjointMutError::OverlappingIndices`], before
+    /// checking any slots. Otherwise, keys are checked in order: a key past the
+    /// end of the slots returns [`GetDisjointMutError::IndexOutOfBounds`], and
+    /// a vacant slot returns [`GetDisjointMutError::IndexVacant`].
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
+                Some(Entry::Occupied(_)) => {}
+                Some(Entry::Vacant(_)) => return Err(GetDisjointMutError::IndexVacant),
+                None => return Err(GetDisjointMutError::IndexOutOfBounds),
+            }
+        }
+
+        let entries = self.entries.as_mut_ptr();
+        let mut result = mem::MaybeUninit::<[&mut T; N]>::uninit();
+        let output = result.as_mut_ptr() as *mut &mut T;
+        unsafe {
+            for (i, &key) in keys.iter().enumerate() {
+                if let Entry::Occupied(value) = &mut *entries.add(key) {
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
```

</details>

<details><summary>reply</summary>

Done.
Added `get_disjoint_mut` and public error enum with required ordering. Builds, 86 tests, formatting, Clippy pass. Minimum Rust raised to 1.51; unverified there.

</details>
