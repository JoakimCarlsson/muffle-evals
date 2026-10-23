# rust-feat-itertools-strip-prefix

Source: https://github.com/rust-itertools/itertools/pull/1104

## Prompt

> I'd like an iterator version of `str::strip_prefix` in `Itertools`. Right now, to check that an iterator starts with some items and then keep going with the rest, I have to write the loop by hand every time.
> 
> What I have in mind:
> 
> - `iter.strip_prefix(prefix)`, where `prefix` is anything `IntoIterator` whose items `Self::Item` can be compared to with `PartialEq`. If the iterator starts with all of the prefix's items, in order, it returns `Ok(iter)` advanced past the prefix (an empty prefix gives back the whole iterator).
> - `iter.strip_prefix_by(prefix, eq)`, the same but with an `FnMut(&Self::Item, &PrefixItem) -> bool` closure to compare items, so the prefix can have a different item type.
> 
> When the prefix doesn't match, I'd like to get back what was consumed rather than lose it. The `Err` should be a new public struct `StripPrefixError` with public fields:
> 
> - `iterator`: the original iterator, stopped right after the item that didn't match;
> - `prefix`: the rest of the prefix iterator, after the prefix item that didn't match;
> - `mismatch`: a tuple `(Option<Self::Item>, PrefixItem)`, the iterator's item (or `None` if the iterator ran out first) and the prefix item it was compared with.
> 
> For example:
> 
> ```rust
> use itertools::Itertools;
> 
> let rest = (1..6).strip_prefix([1, 2]).unwrap().collect_vec(); // [3, 4, 5]
> 
> let err = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
> // err.mismatch == (Some(3), 9), err.prefix yields [4], err.iterator yields [4, 5]
> 
> let err = (1..3).strip_prefix([1, 2, 3]).unwrap_err();
> // err.mismatch == (None, 3), err.iterator is empty
> ```
> 
> `"hello".chars().strip_prefix("he".chars())` should agree with `"hello".strip_prefix("he")`.
> 
> Please add this.

## Upstream change (tests left out)

Files: [src/lib.rs](../../tasks/rust-feat-itertools-strip-prefix/upstream/src/lib.rs), [tests/quick.rs](../../tasks/rust-feat-itertools-strip-prefix/upstream/tests/quick.rs)

```diff
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..7a8ad26 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -5122,6 +5122,95 @@ pub trait Itertools: Iterator {
             _ => Err(sh),
         }
     }
+
+    /// Removes a prefix from the iterator, returning the rest.
+    ///
+    /// If `self` begins with all the items yielded by `prefix` (in order), this
+    /// returns `Ok` of the iterator advanced past that prefix. Otherwise it
+    /// returns `Err(StripPrefixError { .. })` exposing the partially-consumed
+    /// iterator, the remaining prefix, and the items that failed to match, so
+    /// callers can recover progress made before the mismatch.
+    ///
+    /// See [`strip_prefix_by`](Itertools::strip_prefix_by) for a variant
+    /// taking an explicit equality predicate.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let ok = (1..6).strip_prefix([1, 2]).map(Itertools::collect_vec).ok();
+    /// assert_eq!(ok, Some(vec![3, 4, 5]));
+    /// assert!((1..6).strip_prefix([1, 9]).is_err());
+    /// let empty = (1..6).strip_prefix(std::iter::empty::<i32>()).map(Itertools::collect_vec).ok();
+    /// assert_eq!(empty, Some(vec![1, 2, 3, 4, 5]));
+    /// ```
+    fn strip_prefix<Prefix>(
+        self,
+        prefix: Prefix,
+    ) -> Result<Self, StripPrefixError<Self, Prefix::IntoIter, Self::Item>>
+    where
+        Self: Sized,
+        Prefix: IntoIterator,
+        Self::Item: PartialEq<Prefix::Item>,
+    {
+        self.strip_prefix_by(prefix, |a, b| a == b)
+    }
+
+    /// Removes a prefix from the iterator using `eq` to compare items.
+    ///
+    /// If `self` begins with all the items yielded by `prefix` (in order, as
+    /// judged by `eq`), this returns `Ok` of the iterator advanced past that
+    /// prefix. Otherwise it returns `Err(StripPrefixError { .. })`, allowing
+    /// the prefix items to have a different type than `Self::Item`.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let path = ["home", "user", "file"];
+    /// let stripped = path.iter().strip_prefix_by(["home", "user"], |a, b| **a == *b);
+    /// assert_eq!(stripped.map(Itertools::collect_vec).ok(), Some(vec![&"file"]));
+    /// ```
+    fn strip_prefix_by<Prefix, F>(
+        mut self,
+        prefix: Prefix,
+        mut eq: F,
+    ) -> Result<Self, StripPrefixError<Self, Prefix::IntoIter, Self::Item>>
+    where
+        Self: Sized,
+        Prefix: IntoIterator,
+        F: FnMut(&Self::Item, &Prefix::Item) -> bool,
+    {
+        let mut prefix = prefix.into_iter();
+        match prefix.by_ref().try_for_each(|wanted| match self.next() {
+            Some(got) if eq(&got, &wanted) => Ok(()),
+            got => Err((got, wanted)),
+        }) {
+            Ok(()) => Ok(self),
+            Err(mismatch) => Err(StripPrefixError {
+                iterator: self,
+                prefix,
+                mismatch,
+            }),
+        }
+    }
+}
+
+/// The error returned by [`Itertools::strip_prefix`] and
+/// [`Itertools::strip_prefix_by`] when the iterator does not start with the
+/// requested prefix.
+///
+/// All fields are public so callers can recover the partially-consumed
+/// iterators and the mismatched items.
+#[derive(Debug, Clone)]
+pub struct StripPrefixError<I, Prefix: Iterator, T> {
+    /// The remainder of the original iterator, advanced past the matched
+    /// prefix items but stopped at the position of the mismatch.
+    pub iterator: I,
+    /// The remainder of the prefix iterator, starting just after the prefix
+    /// item that failed to match.
+    pub prefix: Prefix,
+    /// The pair of items that failed to compare equal. The first element is
+    /// `None` if `iterator` was exhausted before the prefix was fully matched.
+    pub mismatch: (Option<T>, Prefix::Item),
 }
 
 impl<T> Itertools for T where T: Iterator + ?Sized {}
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +118/-0 | 17 | 4,957 | $0.167 |
| claude | muffle | pass | +98/-0 | 17 | 6,875 | $0.156 |
| claude | hush | pass | +122/-0 | 0 | 3,426 | $0.111 |
| claude | sloth | pass | +80/-0 | 24 | 4,460 | $0.140 |
| claude | all | pass | +90/-0 | 8 | 3,121 | $0.110 |
| codex | base | pass | +92/-0 | 94 | 3,368 | - |
| codex | muffle | pass | +81/-0 | 73 | 3,123 | - |
| codex | hush | pass | +81/-0 | 83 | 2,914 | - |
| codex | sloth | pass | +76/-0 | 55 | 3,593 | - |
| codex | all | pass | +76/-0 | 77 | 3,137 | - |

### claude, base: pass

Files: [src/lib.rs](../base/claude/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix_err.rs](../base/claude/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix_err.rs), [tests/test_std.rs](../base/claude/rust-feat-itertools-strip-prefix-1/files/tests/test_std.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..112eabb 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -140,6 +140,7 @@ pub mod structs {
     pub use crate::repeatn::RepeatN;
     #[allow(deprecated)]
     pub use crate::sources::{Iterate, Unfold};
+    pub use crate::strip_prefix_err::StripPrefixError;
     pub use crate::take_while_inclusive::TakeWhileInclusive;
     #[cfg(feature = "use_alloc")]
     pub use crate::tee::Tee;
@@ -172,6 +173,7 @@ pub use crate::process_results_impl::process_results;
 pub use crate::repeatn::repeat_n;
 #[allow(deprecated)]
 pub use crate::sources::{iterate, unfold};
+pub use crate::strip_prefix_err::StripPrefixError;
 #[allow(deprecated)]
 pub use crate::structs::*;
 pub use crate::unziptuple::{multiunzip, MultiUnzip};
@@ -235,6 +237,7 @@ mod rciter_impl;
 mod repeatn;
 mod size_hint;
 mod sources;
+mod strip_prefix_err;
 mod take_while_inclusive;
 #[cfg(feature = "use_alloc")]
 mod tee;
@@ -2531,6 +2534,79 @@ pub trait Itertools: Iterator {
         }
     }
 
+    /// If the iterator starts with the items of `prefix`, in order, return `Ok` with the
+    /// iterator advanced past the prefix. An empty prefix returns the whole iterator.
+    ///
+    /// Otherwise return a [`StripPrefixError`] with what was consumed.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = (1..6).strip_prefix([1, 2]).unwrap().collect_vec();
+    /// assert_eq!(rest, [3, 4, 5]);
+    ///
+    /// let err = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    /// assert_eq!(err.mismatch, (Some(3), 9));
+    /// assert_eq!(err.prefix.collect_vec(), [4]);
+    /// assert_eq!(err.iterator.collect_vec(), [4, 5]);
+    ///
+    /// let err = (1..3).strip_prefix([1, 2, 3]).unwrap_err();
+    /// assert_eq!(err.mismatch, (None, 3));
+    /// assert_eq!(err.iterator.count(), 0);
+    /// ```
+    #[allow(clippy::type_complexity)]
+    fn strip_prefix<P>(
+        self,
+        prefix: P,
+    ) -> Result<Self, StripPrefixError<Self, P::IntoIter, P::Item>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        Self::Item: PartialEq<P::Item>,
+    {
+        self.strip_prefix_by(prefix, |x, y| x == y)
+    }
+
+    /// Like [`strip_prefix`](Itertools::strip_prefix), but compares items with the
+    /// closure `eq`, so the prefix may have a different item type.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = ["a", "bb", "c"]
+    ///     .iter().copied()
+    ///     .strip_prefix_by([1usize, 2], |s, n: &usize| s.len() == *n)
+    ///     .unwrap()
+    ///     .collect_vec();
+    /// assert_eq!(rest, ["c"]);
+    /// ```
+    #[allow(clippy::type_complexity)]
+    fn strip_prefix_by<P, F>(
+        mut self,
+        prefix: P,
+        mut eq: F,
+    ) -> Result<Self, StripPrefixError<Self, P::IntoIter, P::Item>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        F: FnMut(&Self::Item, &P::Item) -> bool,
+    {
+        let mut prefix = prefix.into_iter();
+        while let Some(p) = prefix.next() {
+            match self.next() {
+                Some(x) if eq(&x, &p) => {}
+                other => {
+                    return Err(StripPrefixError {
+                        iterator: self,
+                        prefix,
+                        mismatch: (other, p),
+                    })
+                }
+            }
+        }
+        Ok(self)
+    }
+
     /// If there are elements and they are all equal, return a single copy of that element.
     /// If there are no elements, return an Error containing None.
     /// If there are elements and they are not all equal, return a tuple containing the first
diff --git a/src/strip_prefix_err.rs b/src/strip_prefix_err.rs
new file mode 100644
index 0000000..e2ab2da
--- /dev/null
+++ b/src/strip_prefix_err.rs
@@ -0,0 +1,42 @@
+#[cfg(doc)]
+use crate::Itertools;
+#[cfg(feature = "use_std")]
+use std::error::Error;
+use std::fmt::{Debug, Display, Formatter, Result as FmtResult};
+
+/// Value returned for the error case of [`Itertools::strip_prefix`] and
+/// [`Itertools::strip_prefix_by`].
+#[derive(Clone, Debug, PartialEq, Eq)]
+pub struct StripPrefixError<I, P, T>
+where
+    I: Iterator,
+{
+    /// The original iterator, stopped right after the item that did not match.
+    pub iterator: I,
+    /// The rest of the prefix iterator, after the prefix item that did not match.
+    pub prefix: P,
+    /// The iterator's item (`None` if it ran out first) and the prefix item it was compared with.
+    pub mismatch: (Option<I::Item>, T),
+}
+
+impl<I, P, T> Display for StripPrefixError<I, P, T>
+where
+    I: Iterator,
+{
+    fn fmt(&self, f: &mut Formatter) -> FmtResult {
+        match self.mismatch.0 {
+            None => write!(f, "iterator ended before the whole prefix was matched"),
+            Some(_) => write!(f, "iterator does not start with the prefix"),
+        }
+    }
+}
+
+#[cfg(feature = "use_std")]
+impl<I, P, T> Error for StripPrefixError<I, P, T>
+where
+    I: Iterator + Debug,
+    I::Item: Debug,
+    P: Debug,
+    T: Debug,
+{
+}
diff --git a/tests/test_std.rs b/tests/test_std.rs
index 5f5cfd1..53ea493 100644
--- a/tests/test_std.rs
+++ b/tests/test_std.rs
@@ -1675,3 +1675,20 @@ fn counts_by_with_hasher() {
     let _: HashMap<_, _, TestHasher> =
         empty::<u8>().counts_by_with_hasher(|x| x, TestHasher::new());
 }
+
+#[test]
+fn strip_prefix_matches_str() {
+    for (s, p) in [
+        ("hello", "he"),
+        ("hello", ""),
+        ("hello", "hex"),
+        ("he", "hello"),
+    ] {
+        let got = s
+            .chars()
+            .strip_prefix(p.chars())
+            .ok()
+            .map(|i| i.collect::<String>());
+        assert_eq!(got.as_deref(), s.strip_prefix(p));
+    }
+}
```

</details>

<details><summary>reply</summary>

Fixing the failing doctest (closure's `s` is `&&str`).

I added `Itertools::strip_prefix` and `Itertools::strip_prefix_by` in `src/lib.rs`. The full test suite passes with all features, including the new doctests, and `cargo fmt` is clean. I didn't run `cargo clippy` to a clean result, so I can't say whether the new code adds warnings.

- **Success:** both return `Ok(iter)` advanced past the prefix. An empty prefix gives back the whole iterator.
- **`StripPrefixError`:** it's in `src/strip_prefix_err.rs` and exported from the crate root and `itertools::structs`. It has the public fields you listed: `iterator`, `prefix` and `mismatch`.
- **Error type parameters:** the struct is generic over the iterator, the rest-of-prefix iterator and the prefix item type, so `mismatch` can be `(Option<Self::Item>, PrefixItem)`.
- **Extra impls:** it also implements `Display`, and `Error` under `use_std`.
- **`strip_prefix` bound:** it requires `Self::Item: PartialEq<PrefixItem>`, a little looser than plain `PartialEq`, so `u8` against `&u8`-style cases work. Same-type comparisons behave as you described.
- **`strip_prefix_by`:** it takes `FnMut(&Self::Item, &PrefixItem) -> bool`.
- **Tests:** the doctests cover your three examples plus a `strip_prefix_by` example with a different prefix type. `tests/test_std.rs` has a test checking `chars().strip_prefix(..)` against `str::strip_prefix` for matching, empty, mismatching and too-long prefixes.

I didn't add a CHANGELOG entry, and I didn't commit anything.

</details>

### claude, muffle: pass

Files: [CHANGELOG.md](../muffle/claude/rust-feat-itertools-strip-prefix-1/files/CHANGELOG.md), [src/lib.rs](../muffle/claude/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix_err.rs](../muffle/claude/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix_err.rs), [tests/test_std.rs](../muffle/claude/rust-feat-itertools-strip-prefix-1/files/tests/test_std.rs)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index d8d1da9..afc6738 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -8,6 +8,7 @@
 
 ### Added
 - Add `*_with_hasher` adaptors (#1007)
+- Add `strip_prefix` and `strip_prefix_by`
 
 ### Changed
 - Remove `Clone` bounds from `tuple_combinations` and `array_combinations`(#1011)
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..59698b0 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -140,6 +140,7 @@ pub mod structs {
     pub use crate::repeatn::RepeatN;
     #[allow(deprecated)]
     pub use crate::sources::{Iterate, Unfold};
+    pub use crate::strip_prefix_err::StripPrefixError;
     pub use crate::take_while_inclusive::TakeWhileInclusive;
     #[cfg(feature = "use_alloc")]
     pub use crate::tee::Tee;
@@ -186,6 +187,7 @@ pub mod free;
 #[doc(inline)]
 pub use crate::free::*;
 mod all_equal_value_err;
+mod strip_prefix_err;
 #[cfg(feature = "use_alloc")]
 mod combinations;
 #[cfg(feature = "use_alloc")]
@@ -2531,6 +2533,83 @@ pub trait Itertools: Iterator {
         }
     }
 
+    /// Strip `prefix` from the start of the iterator, like [`str::strip_prefix`].
+    ///
+    /// If the iterator starts with all of the items of `prefix`, in order, return
+    /// `Ok` with the iterator advanced past the prefix. An empty prefix returns
+    /// the whole iterator.
+    ///
+    /// Otherwise, return a [`StripPrefixError`] with the consumed iterator, the
+    /// rest of the prefix and the mismatching items.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = (1..6).strip_prefix([1, 2]).unwrap().collect_vec();
+    /// assert_eq!(rest, [3, 4, 5]);
+    ///
+    /// let err = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    /// assert_eq!(err.mismatch, (Some(3), 9));
+    /// assert_eq!(err.prefix.collect_vec(), [4]);
+    /// assert_eq!(err.iterator.collect_vec(), [4, 5]);
+    ///
+    /// let err = (1..3).strip_prefix([1, 2, 3]).unwrap_err();
+    /// assert_eq!(err.mismatch, (None, 3));
+    /// assert_eq!(err.iterator.count(), 0);
+    /// ```
+    #[allow(clippy::type_complexity)]
+    fn strip_prefix<P>(
+        self,
+        prefix: P,
+    ) -> Result<Self, StripPrefixError<Self, <P as IntoIterator>::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        Self::Item: PartialEq<P::Item>,
+    {
+        self.strip_prefix_by(prefix, |x, y| x == y)
+    }
+
+    /// Like [`strip_prefix`](Itertools::strip_prefix), but compares items with
+    /// the closure `eq`, so the prefix may have a different item type.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = ["a", "bb", "ccc"]
+    ///     .iter()
+    ///     .strip_prefix_by([1, 2], |s, n| s.len() == *n)
+    ///     .unwrap()
+    ///     .collect_vec();
+    /// assert_eq!(rest, [&"ccc"]);
+    /// ```
+    #[allow(clippy::type_complexity)]
+    fn strip_prefix_by<P, F>(
+        mut self,
+        prefix: P,
+        mut eq: F,
+    ) -> Result<Self, StripPrefixError<Self, <P as IntoIterator>::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        F: FnMut(&Self::Item, &P::Item) -> bool,
+    {
+        let mut prefix = prefix.into_iter();
+        while let Some(p) = prefix.next() {
+            match self.next() {
+                Some(x) if eq(&x, &p) => {}
+                item => {
+                    return Err(StripPrefixError {
+                        iterator: self,
+                        prefix,
+                        mismatch: (item, p),
+                    })
+                }
+            }
+        }
+        Ok(self)
+    }
+
     /// If there are elements and they are all equal, return a single copy of that element.
     /// If there are no elements, return an Error containing None.
     /// If there are elements and they are not all equal, return a tuple containing the first
diff --git a/src/strip_prefix_err.rs b/src/strip_prefix_err.rs
new file mode 100644
index 0000000..23bced9
--- /dev/null
+++ b/src/strip_prefix_err.rs
@@ -0,0 +1,18 @@
+#[cfg(doc)]
+use crate::Itertools;
+
+/// Value returned for the error case of [`Itertools::strip_prefix`] and
+/// [`Itertools::strip_prefix_by`].
+#[derive(Clone, Debug, PartialEq, Eq)]
+pub struct StripPrefixError<I, P>
+where
+    I: Iterator,
+    P: Iterator,
+{
+    /// The original iterator, stopped right after the item that didn't match.
+    pub iterator: I,
+    /// The rest of the prefix iterator, after the prefix item that didn't match.
+    pub prefix: P,
+    /// The iterator's item (`None` if it ran out) and the prefix item it was compared with.
+    pub mismatch: (Option<I::Item>, P::Item),
+}
diff --git a/tests/test_std.rs b/tests/test_std.rs
index 5f5cfd1..21d392a 100644
--- a/tests/test_std.rs
+++ b/tests/test_std.rs
@@ -1675,3 +1675,20 @@ fn counts_by_with_hasher() {
     let _: HashMap<_, _, TestHasher> =
         empty::<u8>().counts_by_with_hasher(|x| x, TestHasher::new());
 }
+
+#[test]
+fn strip_prefix() {
+    assert_eq!((1..6).strip_prefix([1, 2]).unwrap().collect_vec(), [3, 4, 5]);
+    assert_eq!((1..3).strip_prefix(None::<i32>).unwrap().collect_vec(), [1, 2]);
+    let err = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    assert_eq!(err.mismatch, (Some(3), 9));
+    assert_eq!(err.prefix.collect_vec(), [4]);
+    assert_eq!(err.iterator.collect_vec(), [4, 5]);
+    let err = (1..3).strip_prefix([1, 2, 3]).unwrap_err();
+    assert_eq!(err.mismatch, (None, 3));
+    assert_eq!(err.iterator.count(), 0);
+    assert_eq!(
+        "hello".chars().strip_prefix("he".chars()).unwrap().collect::<String>(),
+        "hello".strip_prefix("he").unwrap()
+    );
+}
```

</details>

<details><summary>reply</summary>

I'm checking whether the `--no-default-features` build failure is already there without my change.

My change caused this. I inserted the `pub use` between a `#[cfg]` attribute and the `Tee` line it applies to. I'll fix that.

I added `Itertools::strip_prefix` and `strip_prefix_by`, plus the public `StripPrefixError` struct. The full test suite and doctests pass with all features, and the crate builds with `--no-default-features`. Clippy shows 4 warnings, all in code I didn't touch.

- **API:** both methods are in `src/lib.rs` and take `self` by value. `strip_prefix` requires `Self::Item: PartialEq<P::Item>`. It calls `strip_prefix_by` with `==`.
- **Error type:** `StripPrefixError<I, P>` is in the new `src/strip_prefix_err.rs` and re-exported from the crate root. It has public `iterator`, `prefix` and `mismatch` fields, laid out as you described.
- **Bounds:** because of `mismatch`, the error type is generic over both iterators, so it needs `I: Iterator` and `P: Iterator`. It derives `Clone`, `Debug`, `PartialEq` and `Eq`. I didn't add `Display` or `Error` impls.
- **Tests and docs:** a `strip_prefix` test in `tests/test_std.rs` covers your three examples, an empty prefix, and agreement with `str::strip_prefix` on `"hello"`. Both methods have doctests. I also added a line to the 0.15.0 "Added" section of `CHANGELOG.md`.

I didn't commit anything.

</details>

### claude, hush: pass

Files: [CHANGELOG.md](../hush/claude/rust-feat-itertools-strip-prefix-1/files/CHANGELOG.md), [src/lib.rs](../hush/claude/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix_err.rs](../hush/claude/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix_err.rs)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index d8d1da9..afc6738 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -8,6 +8,7 @@
 
 ### Added
 - Add `*_with_hasher` adaptors (#1007)
+- Add `strip_prefix` and `strip_prefix_by`
 
 ### Changed
 - Remove `Clone` bounds from `tuple_combinations` and `array_combinations`(#1011)
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..92370fa 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -140,6 +140,7 @@ pub mod structs {
     pub use crate::repeatn::RepeatN;
     #[allow(deprecated)]
     pub use crate::sources::{Iterate, Unfold};
+    pub use crate::strip_prefix_err::StripPrefixError;
     pub use crate::take_while_inclusive::TakeWhileInclusive;
     #[cfg(feature = "use_alloc")]
     pub use crate::tee::Tee;
@@ -186,6 +187,7 @@ pub mod free;
 #[doc(inline)]
 pub use crate::free::*;
 mod all_equal_value_err;
+mod strip_prefix_err;
 #[cfg(feature = "use_alloc")]
 mod combinations;
 #[cfg(feature = "use_alloc")]
@@ -2563,6 +2565,84 @@ pub trait Itertools: Iterator {
         }
     }
 
+    /// Iterator version of [`str::strip_prefix`].
+    ///
+    /// If the iterator starts with all items of `prefix`, in order, return
+    /// `Ok` with the iterator advanced past the prefix. An empty prefix gives
+    /// back the whole iterator.
+    ///
+    /// Otherwise return a [`StripPrefixError`] holding what was consumed.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = (1..6).strip_prefix([1, 2]).unwrap().collect_vec();
+    /// assert_eq!(rest, [3, 4, 5]);
+    ///
+    /// let err = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    /// assert_eq!(err.mismatch, (Some(3), 9));
+    /// assert_eq!(err.prefix.collect_vec(), [4]);
+    /// assert_eq!(err.iterator.collect_vec(), [4, 5]);
+    ///
+    /// let err = (1..3).strip_prefix([1, 2, 3]).unwrap_err();
+    /// assert_eq!(err.mismatch, (None, 3));
+    /// assert_eq!(err.iterator.count(), 0);
+    ///
+    /// assert_eq!("hello".chars().strip_prefix("he".chars()).unwrap().collect::<String>(), "llo");
+    /// ```
+    #[allow(clippy::type_complexity)]
+    fn strip_prefix<P>(
+        self,
+        prefix: P,
+    ) -> Result<Self, StripPrefixError<Self, P::IntoIter, P::Item>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        Self::Item: PartialEq<P::Item>,
+    {
+        self.strip_prefix_by(prefix, |a, b| a == b)
+    }
+
+    /// Like [`strip_prefix`](Itertools::strip_prefix), but compare items with
+    /// the closure `eq`, so the prefix can have a different item type.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = vec!["a", "bb", "c"]
+    ///     .into_iter()
+    ///     .strip_prefix_by([1, 2], |s, n| s.len() == *n)
+    ///     .unwrap()
+    ///     .collect_vec();
+    /// assert_eq!(rest, ["c"]);
+    /// ```
+    #[allow(clippy::type_complexity)]
+    fn strip_prefix_by<P, F>(
+        mut self,
+        prefix: P,
+        mut eq: F,
+    ) -> Result<Self, StripPrefixError<Self, P::IntoIter, P::Item>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        F: FnMut(&Self::Item, &P::Item) -> bool,
+    {
+        let mut prefix = prefix.into_iter();
+        while let Some(expected) = prefix.next() {
+            match self.next() {
+                Some(item) if eq(&item, &expected) => {}
+                other => {
+                    return Err(StripPrefixError {
+                        iterator: self,
+                        prefix,
+                        mismatch: (other, expected),
+                    })
+                }
+            }
+        }
+        Ok(self)
+    }
+
     /// Check whether all elements are unique (non equal).
     ///
     /// Empty iterators are considered to have unique elements:
diff --git a/src/strip_prefix_err.rs b/src/strip_prefix_err.rs
new file mode 100644
index 0000000..698cd81
--- /dev/null
+++ b/src/strip_prefix_err.rs
@@ -0,0 +1,41 @@
+#[cfg(doc)]
+use crate::Itertools;
+use std::fmt::{Debug, Display, Formatter, Result as FmtResult};
+
+/// Value returned for the error case of [`Itertools::strip_prefix`] and
+/// [`Itertools::strip_prefix_by`].
+#[derive(Clone, Debug, PartialEq, Eq)]
+pub struct StripPrefixError<I, P, PrefixItem>
+where
+    I: Iterator,
+{
+    /// The original iterator, stopped right after the item that didn't match.
+    pub iterator: I,
+    /// The rest of the prefix iterator, after the prefix item that didn't match.
+    pub prefix: P,
+    /// The iterator's item (`None` if it ran out first) and the prefix item
+    /// it was compared with.
+    pub mismatch: (Option<I::Item>, PrefixItem),
+}
+
+impl<I, P, PrefixItem> Display for StripPrefixError<I, P, PrefixItem>
+where
+    I: Iterator,
+{
+    fn fmt(&self, f: &mut Formatter) -> FmtResult {
+        match self.mismatch.0 {
+            None => write!(f, "iterator ended before the prefix was fully matched"),
+            Some(_) => write!(f, "iterator item did not match the prefix item"),
+        }
+    }
+}
+
+#[cfg(feature = "use_std")]
+impl<I, P, PrefixItem> std::error::Error for StripPrefixError<I, P, PrefixItem>
+where
+    I: Iterator + Debug,
+    I::Item: Debug,
+    P: Debug,
+    PrefixItem: Debug,
+{
+}
```

</details>

<details><summary>reply</summary>

Done. Added `strip_prefix`, `strip_prefix_by` and public `StripPrefixError` (in `src/strip_prefix_err.rs`, re-exported in `structs`). The bound is `Self::Item: PartialEq<P::Item>`. Doctests cover your examples, and all tests pass. I also added a CHANGELOG line. I didn't add a `tests/` file or a `str::strip_prefix` agreement test. Nothing committed.

</details>

### claude, sloth: pass

Files: [src/lib.rs](../sloth/claude/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix_err.rs](../sloth/claude/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix_err.rs), [tests/test_core.rs](../sloth/claude/rust-feat-itertools-strip-prefix-1/files/tests/test_core.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..194f976 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -140,6 +140,7 @@ pub mod structs {
     pub use crate::repeatn::RepeatN;
     #[allow(deprecated)]
     pub use crate::sources::{Iterate, Unfold};
+    pub use crate::strip_prefix_err::StripPrefixError;
     pub use crate::take_while_inclusive::TakeWhileInclusive;
     #[cfg(feature = "use_alloc")]
     pub use crate::tee::Tee;
@@ -235,6 +236,7 @@ mod rciter_impl;
 mod repeatn;
 mod size_hint;
 mod sources;
+mod strip_prefix_err;
 mod take_while_inclusive;
 #[cfg(feature = "use_alloc")]
 mod tee;
@@ -2504,6 +2506,70 @@ pub trait Itertools: Iterator {
         self.any(|x| x.borrow() == query)
     }
 
+    /// Remove `prefix` from the start of the iterator, like [`str::strip_prefix`].
+    ///
+    /// Returns the iterator advanced past the prefix, or a [`StripPrefixError`]
+    /// holding what was consumed if the iterator does not start with `prefix`.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// assert_eq!((1..6).strip_prefix([1, 2]).unwrap().collect_vec(), [3, 4, 5]);
+    ///
+    /// let err = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    /// assert_eq!(err.mismatch, (Some(3), 9));
+    /// assert_eq!(err.prefix.collect_vec(), [4]);
+    /// assert_eq!(err.iterator.collect_vec(), [4, 5]);
+    ///
+    /// let err = (1..3).strip_prefix([1, 2, 3]).unwrap_err();
+    /// assert_eq!(err.mismatch, (None, 3));
+    /// assert_eq!(err.iterator.count(), 0);
+    /// ```
+    #[allow(clippy::type_complexity)]
+    fn strip_prefix<P>(self, prefix: P) -> Result<Self, StripPrefixError<Self, P::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        Self::Item: PartialEq<P::Item>,
+    {
+        self.strip_prefix_by(prefix, |a, b| a == b)
+    }
+
+    /// Like [`strip_prefix`](Itertools::strip_prefix), comparing items with `eq`.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = ["1", "2", "3"].iter().strip_prefix_by([1, 2], |s, n| s.parse() == Ok(*n));
+    /// assert_eq!(rest.unwrap().collect_vec(), [&"3"]);
+    /// ```
+    #[allow(clippy::type_complexity)]
+    fn strip_prefix_by<P, F>(
+        mut self,
+        prefix: P,
+        mut eq: F,
+    ) -> Result<Self, StripPrefixError<Self, P::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        F: FnMut(&Self::Item, &P::Item) -> bool,
+    {
+        let mut prefix = prefix.into_iter();
+        while let Some(expected) = prefix.next() {
+            match self.next() {
+                Some(item) if eq(&item, &expected) => {}
+                item => {
+                    return Err(StripPrefixError {
+                        iterator: self,
+                        prefix,
+                        mismatch: (item, expected),
+                    })
+                }
+            }
+        }
+        Ok(self)
+    }
+
     /// Check whether all elements compare equal.
     ///
     /// Empty iterators are considered to have equal elements:
diff --git a/src/strip_prefix_err.rs b/src/strip_prefix_err.rs
new file mode 100644
index 0000000..b65b62f
--- /dev/null
+++ b/src/strip_prefix_err.rs
@@ -0,0 +1,14 @@
+#[cfg(doc)]
+use crate::Itertools;
+
+/// Value returned for the error case of [`Itertools::strip_prefix`] and
+/// [`Itertools::strip_prefix_by`].
+#[derive(Clone, Debug)]
+pub struct StripPrefixError<I: Iterator, P: Iterator> {
+    /// The original iterator, stopped right after the item that did not match.
+    pub iterator: I,
+    /// The rest of the prefix iterator, after the prefix item that did not match.
+    pub prefix: P,
+    /// The iterator's item (`None` if it ran out first) and the prefix item it was compared with.
+    pub mismatch: (Option<I::Item>, P::Item),
+}
diff --git a/tests/test_core.rs b/tests/test_core.rs
index adaa06e..4826472 100644
--- a/tests/test_core.rs
+++ b/tests/test_core.rs
@@ -398,3 +398,27 @@ fn collect_array() {
     let iter = v.iter().cloned();
     assert_eq!(iter.collect_array::<2>(), None);
 }
+
+#[test]
+fn strip_prefix() {
+    assert!((1..4).strip_prefix([0; 0]).unwrap().eq([1, 2, 3]));
+    assert!((1..6).strip_prefix([1, 2]).unwrap().eq([3, 4, 5]));
+    assert_eq!((1..3).strip_prefix([1, 2]).unwrap().count(), 0);
+
+    let err = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    assert_eq!(err.mismatch, (Some(3), 9));
+    assert!(err.prefix.eq([4]));
+    assert!(err.iterator.eq([4, 5]));
+
+    let err = (1..3).strip_prefix([1, 2, 3]).unwrap_err();
+    assert_eq!(err.mismatch, (None, 3));
+    assert_eq!(err.iterator.count(), 0);
+
+    let rest = "hello".chars().strip_prefix("he".chars()).unwrap();
+    assert!(rest.eq("hello".strip_prefix("he").unwrap().chars()));
+
+    let rest = ["1", "2"]
+        .iter()
+        .strip_prefix_by([1], |s, n| s.parse() == Ok(*n));
+    assert!(rest.unwrap().eq([&"2"]));
+}
```

</details>

<details><summary>reply</summary>

test_core is no_std-ish; I'll move the String comparison to use `Vec`-free check.

I added `Itertools::strip_prefix` and `strip_prefix_by`, and the new public `StripPrefixError` struct. The full test suite passes with `--all-features`, and `test_core` also passes with `--no-default-features`. `cargo fmt --check` is clean.

- **Methods:** both are in `src/lib.rs`. `strip_prefix` requires `Self::Item: PartialEq<P::Item>` and calls `strip_prefix_by` with `==`. An empty prefix returns the whole iterator.
- **Error type:** `StripPrefixError<I, P>` is in the new `src/strip_prefix_err.rs` and exported with the other structs. Its public fields are `iterator`, `prefix` and `mismatch`, and it derives `Clone` and `Debug`.
- **Tests:** I added a `strip_prefix` test to `tests/test_core.rs`. It covers every example from your request, including the `"hello"` check against `str::strip_prefix`. It also covers an empty prefix and a prefix that exactly consumes the iterator. Doctests are on both methods.

I didn't add a CHANGELOG entry. The `0.15.0` section lists changes by PR number, so I left that for you to add.

</details>

### claude, all: pass

Files: [CHANGELOG.md](../all/claude/rust-feat-itertools-strip-prefix-1/files/CHANGELOG.md), [src/lib.rs](../all/claude/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix_err.rs](../all/claude/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix_err.rs), [tests/test_std.rs](../all/claude/rust-feat-itertools-strip-prefix-1/files/tests/test_std.rs)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index d8d1da9..7764559 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -7,6 +7,7 @@
 - Canonicalize `all_equal_value`'s error type (#1032)
 
 ### Added
+- Add `strip_prefix` and `strip_prefix_by`
 - Add `*_with_hasher` adaptors (#1007)
 
 ### Changed
@@ -32,6 +33,7 @@
 - Removed generic parameter from `cons_tuples` (#988)
 
 ### Added
+- Add `strip_prefix` and `strip_prefix_by`
 - Added `array_combinations` (#991)
 - Added `k_smallest_relaxed` and variants (#925)
 - Added `next_array` and `collect_array` (#560)
@@ -67,6 +69,7 @@
 - Removed `TakeWhileInclusive::new` (#912)
 
 ### Added
+- Add `strip_prefix` and `strip_prefix_by`
 - Added `Itertools::{smallest_by, smallest_by_key, largest, largest_by, largest_by_key}` (#654, #885)
 - Added `Itertools::tail` (#899)
 - Implemented `DoubleEndedIterator` for `ProcessResults` (#910)
@@ -103,6 +106,7 @@
 ## 0.12.1
 
 ### Added
+- Add `strip_prefix` and `strip_prefix_by`
 - Documented iteration order guarantee for `Itertools::[tuple_]combinations` (#822)
 - Documented possible panic in `iterate` (#842)
 - Implemented `Clone` and `Debug` for `Diff` (#845)
@@ -144,6 +148,7 @@
 - Added `Clone` bound to `Unique` (#777)
 
 ### Added
+- Add `strip_prefix` and `strip_prefix_by`
 - Added `Itertools::try_len` (#723)
 - Added free function `sort_unstable` (#796)
 - Added `GroupMap::fold_with` (#778, #785)
@@ -194,6 +199,7 @@
 - Change `with_position` to yield `(Position, Item)` instead of `Position<Item>` (#699)
 
 ### Added
+- Add `strip_prefix` and `strip_prefix_by`
 - Add `Itertools::take_while_inclusive` (#616)
 - Implement `PeekingNext` for `PeekingTakeWhile` (#644)
 - Add `EitherOrBoth::{just_left, just_right, into_left, into_right, as_deref, as_deref_mut, left_or_insert, right_or_insert, left_or_insert_with, right_or_insert_with, insert_left, insert_right, insert_both}` (#629)
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..01c04e5 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -140,6 +140,7 @@ pub mod structs {
     pub use crate::repeatn::RepeatN;
     #[allow(deprecated)]
     pub use crate::sources::{Iterate, Unfold};
+    pub use crate::strip_prefix_err::StripPrefixError;
     pub use crate::take_while_inclusive::TakeWhileInclusive;
     #[cfg(feature = "use_alloc")]
     pub use crate::tee::Tee;
@@ -186,6 +187,7 @@ pub mod free;
 #[doc(inline)]
 pub use crate::free::*;
 mod all_equal_value_err;
+mod strip_prefix_err;
 #[cfg(feature = "use_alloc")]
 mod combinations;
 #[cfg(feature = "use_alloc")]
@@ -2531,6 +2533,74 @@ pub trait Itertools: Iterator {
         }
     }
 
+    /// Remove `prefix` from the start of the iterator, like [`str::strip_prefix`].
+    ///
+    /// Returns the iterator advanced past the prefix. On mismatch, returns a
+    /// [`StripPrefixError`] holding what was consumed.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// assert_eq!((1..6).strip_prefix([1, 2]).unwrap().collect_vec(), [3, 4, 5]);
+    /// assert_eq!((1..3).strip_prefix([]).unwrap().collect_vec(), [1, 2]);
+    ///
+    /// let err = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    /// assert_eq!(err.mismatch, (Some(3), 9));
+    /// assert_eq!(err.prefix.collect_vec(), [4]);
+    /// assert_eq!(err.iterator.collect_vec(), [4, 5]);
+    ///
+    /// let err = (1..3).strip_prefix([1, 2, 3]).unwrap_err();
+    /// assert_eq!(err.mismatch, (None, 3));
+    /// assert_eq!(err.iterator.count(), 0);
+    /// ```
+    #[allow(clippy::type_complexity)]
+    fn strip_prefix<J>(self, prefix: J) -> Result<Self, StripPrefixError<Self, J::IntoIter>>
+    where
+        Self: Sized,
+        J: IntoIterator,
+        Self::Item: PartialEq<J::Item>,
+    {
+        self.strip_prefix_by(prefix, |a, b| a == b)
+    }
+
+    /// Like [`strip_prefix`](Itertools::strip_prefix), comparing items with `eq`.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = ["a", "b", "c"].iter().strip_prefix_by([1, 2], |s, n| s.len() == *n).unwrap_err();
+    /// assert_eq!(rest.mismatch, (Some(&"b"), 2));
+    ///
+    /// let rest = (1..6).strip_prefix_by(["1", "2"], |n, s| n.to_string() == *s).unwrap();
+    /// assert_eq!(rest.collect_vec(), [3, 4, 5]);
+    /// ```
+    #[allow(clippy::type_complexity)]
+    fn strip_prefix_by<J, F>(
+        mut self,
+        prefix: J,
+        mut eq: F,
+    ) -> Result<Self, StripPrefixError<Self, J::IntoIter>>
+    where
+        Self: Sized,
+        J: IntoIterator,
+        F: FnMut(&Self::Item, &J::Item) -> bool,
+    {
+        let mut prefix = prefix.into_iter();
+        while let Some(expected) = prefix.next() {
+            match self.next() {
+                Some(item) if eq(&item, &expected) => {}
+                item => {
+                    return Err(StripPrefixError {
+                        iterator: self,
+                        prefix,
+                        mismatch: (item, expected),
+                    })
+                }
+            }
+        }
+        Ok(self)
+    }
+
     /// If there are elements and they are all equal, return a single copy of that element.
     /// If there are no elements, return an Error containing None.
     /// If there are elements and they are not all equal, return a tuple containing the first
diff --git a/src/strip_prefix_err.rs b/src/strip_prefix_err.rs
new file mode 100644
index 0000000..73f06fe
--- /dev/null
+++ b/src/strip_prefix_err.rs
@@ -0,0 +1,14 @@
+#[cfg(doc)]
+use crate::Itertools;
+
+/// Value returned for the error case of [`Itertools::strip_prefix`] and
+/// [`Itertools::strip_prefix_by`].
+#[derive(Clone, Debug)]
+pub struct StripPrefixError<I: Iterator, P: Iterator> {
+    /// The original iterator, stopped right after the item that did not match.
+    pub iterator: I,
+    /// The rest of the prefix iterator, after the prefix item that did not match.
+    pub prefix: P,
+    /// The iterator's item (`None` if it ran out) and the prefix item it was compared with.
+    pub mismatch: (Option<I::Item>, P::Item),
+}
diff --git a/tests/test_std.rs b/tests/test_std.rs
index 5f5cfd1..1a4337a 100644
--- a/tests/test_std.rs
+++ b/tests/test_std.rs
@@ -1675,3 +1675,11 @@ fn counts_by_with_hasher() {
     let _: HashMap<_, _, TestHasher> =
         empty::<u8>().counts_by_with_hasher(|x| x, TestHasher::new());
 }
+
+#[test]
+fn strip_prefix_matches_str() {
+    for (s, p) in [("hello", "he"), ("hello", ""), ("he", "hello"), ("hello", "hx")] {
+        let got = s.chars().strip_prefix(p.chars()).map(|i| i.collect::<String>());
+        assert_eq!(got.ok().as_deref(), s.strip_prefix(p));
+    }
+}
```

</details>

<details><summary>reply</summary>

Done. Added `strip_prefix`, `strip_prefix_by` and public `StripPrefixError` (`src/strip_prefix_err.rs`), plus doctests, a `str` parity test and a changelog line. All tests pass with `--all-features`. The `--no-default-features` lib test build fails on `catch_unwind` and `vec`. I didn't check whether that failure existed before my change.

</details>

### codex, base: pass

Files: [CHANGELOG.md](../base/codex/rust-feat-itertools-strip-prefix-1/files/CHANGELOG.md), [src/lib.rs](../base/codex/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix_error.rs](../base/codex/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix_error.rs), [tests/quick.rs](../base/codex/rust-feat-itertools-strip-prefix-1/files/tests/quick.rs), [tests/test_core.rs](../base/codex/rust-feat-itertools-strip-prefix-1/files/tests/test_core.rs)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index d8d1da9..03b7050 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -7,6 +7,7 @@
 - Canonicalize `all_equal_value`'s error type (#1032)
 
 ### Added
+- Add `Itertools::strip_prefix`, `strip_prefix_by`, and `StripPrefixError`
 - Add `*_with_hasher` adaptors (#1007)
 
 ### Changed
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..1ef9964 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -140,6 +140,7 @@ pub mod structs {
     pub use crate::repeatn::RepeatN;
     #[allow(deprecated)]
     pub use crate::sources::{Iterate, Unfold};
+    pub use crate::strip_prefix_error::StripPrefixError;
     pub use crate::take_while_inclusive::TakeWhileInclusive;
     #[cfg(feature = "use_alloc")]
     pub use crate::tee::Tee;
@@ -235,6 +236,7 @@ mod rciter_impl;
 mod repeatn;
 mod size_hint;
 mod sources;
+mod strip_prefix_error;
 mod take_while_inclusive;
 #[cfg(feature = "use_alloc")]
 mod tee;
@@ -2504,6 +2506,78 @@ pub trait Itertools: Iterator {
         self.any(|x| x.borrow() == query)
     }
 
+    /// Remove a matching prefix and return the remaining iterator.
+    ///
+    /// An empty prefix always matches and consumes no items from `self`.
+    /// On failure, returns the mismatched items and both remaining iterators
+    /// in a [`StripPrefixError`]. Matched items are consumed and discarded.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// assert!((1..6).strip_prefix([1, 2]).unwrap().eq(3..6));
+    /// let err = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    /// assert_eq!(err.mismatch, (Some(3), 9));
+    /// assert!(err.prefix.eq([4]));
+    /// assert!(err.iterator.eq(4..6));
+    ///
+    /// let rest: String = "hello".chars().strip_prefix("he".chars()).unwrap().collect();
+    /// assert_eq!(Some(rest.as_str()), "hello".strip_prefix("he"));
+    /// ```
+    fn strip_prefix<P>(self, prefix: P) -> Result<Self, StripPrefixError<Self, P::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        Self::Item: PartialEq<P::Item>,
+    {
+        self.strip_prefix_by(prefix, PartialEq::eq)
+    }
+
+    /// Remove a prefix using `eq` to compare each iterator item with a prefix item.
+    ///
+    /// Returns the remaining iterator on success. On failure, returns the first
+    /// mismatched pair and both iterators positioned after that pair. If `self`
+    /// runs out first, the iterator item in the mismatch is `None` and `eq` is
+    /// not called for that pair. No further items are requested after failure.
+    /// Matched items are consumed and discarded. An empty prefix consumes no
+    /// items from `self` and does not call `eq`.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let mut comparisons = 0;
+    /// let rest = ["one", "two", "three"].iter().copied()
+    ///     .strip_prefix_by([3, 3], |word, length| {
+    ///         comparisons += 1;
+    ///         word.len() == *length
+    ///     }).unwrap();
+    /// assert_eq!(comparisons, 2);
+    /// assert!(rest.eq(["three"]));
+    /// ```
+    fn strip_prefix_by<P, F>(
+        mut self,
+        prefix: P,
+        mut eq: F,
+    ) -> Result<Self, StripPrefixError<Self, P::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        F: FnMut(&Self::Item, &P::Item) -> bool,
+    {
+        let mut prefix = prefix.into_iter();
+        while let Some(expected) = prefix.next() {
+            let actual = self.next();
+            if !actual.as_ref().map_or(false, |item| eq(item, &expected)) {
+                return Err(StripPrefixError {
+                    iterator: self,
+                    prefix,
+                    mismatch: (actual, expected),
+                });
+            }
+        }
+        Ok(self)
+    }
+
     /// Check whether all elements compare equal.
     ///
     /// Empty iterators are considered to have equal elements:
diff --git a/src/strip_prefix_error.rs b/src/strip_prefix_error.rs
new file mode 100644
index 0000000..40dc263
--- /dev/null
+++ b/src/strip_prefix_error.rs
@@ -0,0 +1,17 @@
+/// A failed prefix match from [`Itertools::strip_prefix`](crate::Itertools::strip_prefix)
+/// or [`Itertools::strip_prefix_by`](crate::Itertools::strip_prefix_by).
+///
+/// Successfully matched items have been consumed and discarded. The mismatched
+/// items are retained in `mismatch`, and both iterators can be used to continue
+/// after the failed comparison. No allocation or cloning is required.
+#[derive(Debug)]
+pub struct StripPrefixError<I: Iterator, P: Iterator> {
+    /// The original iterator, positioned after the mismatched item (or the
+    /// first `None` if it ran out before the prefix).
+    pub iterator: I,
+    /// The prefix iterator, positioned after the mismatched prefix item.
+    pub prefix: P,
+    /// The mismatched iterator item and prefix item. The first element is
+    /// `None` if the original iterator ran out first.
+    pub mismatch: (Option<I::Item>, P::Item),
+}
diff --git a/tests/quick.rs b/tests/quick.rs
index 538346b..082690d 100644
--- a/tests/quick.rs
+++ b/tests/quick.rs
@@ -2099,3 +2099,15 @@ quickcheck! {
             && itertools::equal(v.iter().filter(|_| true).tail(n), result)
     }
 }
+
+#[test]
+fn strip_prefix_matches_str() {
+    fn property(input: String, prefix: String) -> bool {
+        let expected = input.strip_prefix(prefix.as_str());
+        match input.chars().strip_prefix(prefix.chars()) {
+            Ok(rest) => expected == Some(rest.collect::<String>().as_str()),
+            Err(_) => expected.is_none(),
+        }
+    }
+    qc::quickcheck(property as fn(String, String) -> bool);
+}
diff --git a/tests/test_core.rs b/tests/test_core.rs
index adaa06e..9c41ba9 100644
--- a/tests/test_core.rs
+++ b/tests/test_core.rs
@@ -398,3 +398,85 @@ fn collect_array() {
     let iter = v.iter().cloned();
     assert_eq!(iter.collect_array::<2>(), None);
 }
+
+#[test]
+fn strip_prefix() {
+    assert!((1..6).strip_prefix([1, 2]).unwrap().eq(3..6));
+    assert!((1..3).strip_prefix([1, 2]).unwrap().eq(iter::empty()));
+    assert!((1..3).strip_prefix([]).unwrap().eq(1..3));
+    assert!(iter::empty::<i32>()
+        .strip_prefix([])
+        .unwrap()
+        .next()
+        .is_none());
+
+    let err: it::StripPrefixError<_, _> = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    assert_eq!(err.mismatch, (Some(3), 9));
+    assert!(err.prefix.eq([4]));
+    assert!(err.iterator.eq(4..6));
+
+    let err = (1..3).strip_prefix([1, 2, 3, 4]).unwrap_err();
+    assert_eq!(err.mismatch, (None, 3));
+    assert!(err.prefix.eq([4]));
+    assert!(err.iterator.eq(iter::empty()));
+
+    let err = (1..3).strip_prefix([9, 8]).unwrap_err();
+    assert_eq!(err.mismatch, (Some(1), 9));
+    assert!(err.prefix.eq([8]));
+    assert!(err.iterator.eq([2]));
+}
+
+#[test]
+fn strip_prefix_by() {
+    let mut calls = 0;
+    let err = ["one", "two", "three", "four"]
+        .iter()
+        .copied()
+        .strip_prefix_by([3, 3, 9, 4], |word, length| {
+            calls += 1;
+            word.len() == *length
+        })
+        .unwrap_err();
+    assert_eq!(calls, 3);
+    assert_eq!(err.mismatch, (Some("three"), 9));
+    assert!(err.prefix.eq([4]));
+    assert!(err.iterator.eq(["four"]));
+
+    let mut iterator = (0..3).inspect(|_| panic!("empty prefix polled input"));
+    assert!(iterator
+        .by_ref()
+        .strip_prefix_by([], |_: &i32, _: &i32| {
+            panic!("empty prefix called comparator")
+        })
+        .is_ok());
+
+    let err = iter::empty::<i32>()
+        .strip_prefix_by([1], |_, _| panic!("exhausted input called comparator"))
+        .unwrap_err();
+    assert_eq!(err.mismatch, (None, 1));
+}
+
+#[test]
+fn strip_prefix_non_fused() {
+    let iterator = IntoIterator::into_iter([Some(1), None, Some(3)]).flatten();
+    assert!(iterator.strip_prefix([1]).unwrap().eq([3]));
+    let mut items = IntoIterator::into_iter([Some(1), None, Some(3)]);
+    let iterator = iter::from_fn(move || items.next().flatten());
+    let err = iterator.strip_prefix([1, 2, 3]).err().unwrap();
+    assert_eq!(err.mismatch, (None, 2));
+    assert!(err.iterator.eq([3]));
+    assert!(err.prefix.eq([3]));
+}
+
+#[test]
+fn strip_prefix_different_item_types() {
+    struct Item(i32);
+    impl PartialEq<i32> for Item {
+        fn eq(&self, other: &i32) -> bool {
+            self.0 == *other
+        }
+    }
+    // Neither iterator items nor prefix matching require Clone or Debug.
+    let mut rest = (1..4).map(Item).strip_prefix([1, 2]).ok().unwrap();
+    assert_eq!(rest.next().unwrap().0, 3);
+}
```

</details>

<details><summary>reply</summary>

I’ll check the crate’s conventions, add both methods and the public error type, and test matching, mismatches, and iterator state.

Both methods are implemented without allocation or cloning, including support for different item types. I’m checking that they stop at the first mismatch, preserve both iterator tails, and leave the input untouched for an empty prefix.

Added `Itertools::strip_prefix`, `strip_prefix_by`, and public `StripPrefixError` with the requested fields and iterator positions. Both methods support `no_std` without allocation or cloning.

Added documentation, examples, and tests covering mismatches, exhaustion, empty prefixes, different item types, and agreement with `str::strip_prefix`.

Core tests, property tests, and all 210 doctests pass. Strict Clippy is blocked by four existing warnings in unrelated code.

</details>

### codex, muffle: pass

Files: [CHANGELOG.md](../muffle/codex/rust-feat-itertools-strip-prefix-1/files/CHANGELOG.md), [src/lib.rs](../muffle/codex/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix_error.rs](../muffle/codex/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix_error.rs), [tests/quick.rs](../muffle/codex/rust-feat-itertools-strip-prefix-1/files/tests/quick.rs), [tests/test_core.rs](../muffle/codex/rust-feat-itertools-strip-prefix-1/files/tests/test_core.rs)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index d8d1da9..03b7050 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -7,6 +7,7 @@
 - Canonicalize `all_equal_value`'s error type (#1032)
 
 ### Added
+- Add `Itertools::strip_prefix`, `strip_prefix_by`, and `StripPrefixError`
 - Add `*_with_hasher` adaptors (#1007)
 
 ### Changed
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..edb4768 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -140,6 +140,7 @@ pub mod structs {
     pub use crate::repeatn::RepeatN;
     #[allow(deprecated)]
     pub use crate::sources::{Iterate, Unfold};
+    pub use crate::strip_prefix_error::StripPrefixError;
     pub use crate::take_while_inclusive::TakeWhileInclusive;
     #[cfg(feature = "use_alloc")]
     pub use crate::tee::Tee;
@@ -235,6 +236,7 @@ mod rciter_impl;
 mod repeatn;
 mod size_hint;
 mod sources;
+mod strip_prefix_error;
 mod take_while_inclusive;
 #[cfg(feature = "use_alloc")]
 mod tee;
@@ -2470,6 +2472,71 @@ pub trait Itertools: Iterator {
             self.find(|x| predicate(x)).unwrap_or(first)
         })
     }
+    /// Removes a matching prefix and returns the remaining iterator.
+    ///
+    /// An empty prefix succeeds without advancing `self`. On failure, returns
+    /// the mismatching items and both iterators positioned just after them.
+    /// If `self` runs out first, the iterator item in the mismatch is `None`.
+    /// Neither iterator is advanced beyond what is needed to compare the prefix.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = (1..6).strip_prefix([1, 2]).unwrap();
+    /// assert_eq!(rest.collect_vec(), vec![3, 4, 5]);
+    ///
+    /// let err = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    /// assert_eq!(err.mismatch, (Some(3), 9));
+    /// assert_eq!(err.prefix.collect_vec(), vec![4]);
+    /// assert_eq!(err.iterator.collect_vec(), vec![4, 5]);
+    /// ```
+    fn strip_prefix<P>(self, prefix: P) -> Result<Self, StripPrefixError<Self, P::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        Self::Item: PartialEq<P::Item>,
+    {
+        self.strip_prefix_by(prefix, PartialEq::eq)
+    }
+
+    /// Removes a prefix using `eq` to compare each iterator item with its prefix item.
+    ///
+    /// Like [`strip_prefix`](Itertools::strip_prefix), but the comparison can be
+    /// customized, including comparisons between different item types. `eq` is
+    /// called in order and only when both iterators yield an item.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = IntoIterator::into_iter(["hello", "world", "!"])
+    ///     .strip_prefix_by([5, 5], |word, len| word.len() == *len)
+    ///     .unwrap();
+    /// assert_eq!(rest.collect_vec(), vec!["!"]);
+    /// ```
+    fn strip_prefix_by<P, F>(
+        mut self,
+        prefix: P,
+        mut eq: F,
+    ) -> Result<Self, StripPrefixError<Self, P::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        F: FnMut(&Self::Item, &P::Item) -> bool,
+    {
+        let mut prefix = prefix.into_iter();
+        while let Some(expected) = prefix.next() {
+            let actual = self.next();
+            if !actual.as_ref().map_or(false, |item| eq(item, &expected)) {
+                return Err(StripPrefixError {
+                    iterator: self,
+                    prefix,
+                    mismatch: (actual, expected),
+                });
+            }
+        }
+        Ok(self)
+    }
+
     /// Returns `true` if the given item is present in this iterator.
     ///
     /// This method is short-circuiting. If the given item is present in this
diff --git a/src/strip_prefix_error.rs b/src/strip_prefix_error.rs
new file mode 100644
index 0000000..6d34b71
--- /dev/null
+++ b/src/strip_prefix_error.rs
@@ -0,0 +1,13 @@
+/// A failed prefix comparison from [`Itertools::strip_prefix`](crate::Itertools::strip_prefix)
+/// or [`Itertools::strip_prefix_by`](crate::Itertools::strip_prefix_by).
+#[derive(Debug)]
+pub struct StripPrefixError<I: Iterator, P: Iterator> {
+    /// The original iterator, positioned after the mismatching item (if any).
+    pub iterator: I,
+    /// The prefix iterator, positioned after the mismatching prefix item.
+    pub prefix: P,
+    /// The mismatching iterator and prefix items.
+    ///
+    /// The first element is `None` if the original iterator ran out first.
+    pub mismatch: (Option<I::Item>, P::Item),
+}
diff --git a/tests/quick.rs b/tests/quick.rs
index 538346b..0b74016 100644
--- a/tests/quick.rs
+++ b/tests/quick.rs
@@ -2099,3 +2099,16 @@ quickcheck! {
             && itertools::equal(v.iter().filter(|_| true).tail(n), result)
     }
 }
+
+#[test]
+fn strip_prefix_matches_str() {
+    fn check(input: String, prefix: String) -> bool {
+        input
+            .chars()
+            .strip_prefix(prefix.chars())
+            .ok()
+            .map(|rest| rest.collect::<String>())
+            == input.strip_prefix(prefix.as_str()).map(str::to_owned)
+    }
+    qc::quickcheck(check as fn(String, String) -> bool);
+}
diff --git a/tests/test_core.rs b/tests/test_core.rs
index adaa06e..22e6cc8 100644
--- a/tests/test_core.rs
+++ b/tests/test_core.rs
@@ -398,3 +398,63 @@ fn collect_array() {
     let iter = v.iter().cloned();
     assert_eq!(iter.collect_array::<2>(), None);
 }
+
+#[test]
+fn strip_prefix() {
+    it::assert_equal((1..6).strip_prefix([1, 2]).unwrap(), 3..6);
+    it::assert_equal((1..6).strip_prefix([]).unwrap(), 1..6);
+    it::assert_equal((1..3).strip_prefix([1, 2]).unwrap(), iter::empty());
+    assert!(iter::empty::<i32>().strip_prefix([]).is_ok());
+
+    let err: it::StripPrefixError<_, _> = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    assert_eq!(err.mismatch, (Some(3), 9));
+    it::assert_equal(err.prefix, [4]);
+    it::assert_equal(err.iterator, [4, 5]);
+
+    let err = (1..3).strip_prefix([1, 2, 3, 4]).unwrap_err();
+    assert_eq!(err.mismatch, (None, 3));
+    it::assert_equal(err.prefix, [4]);
+    it::assert_equal(err.iterator, []);
+
+    let err = (1..3).strip_prefix([9, 2]).unwrap_err();
+    assert_eq!(err.mismatch, (Some(1), 9));
+    it::assert_equal(err.prefix, [2]);
+    it::assert_equal(err.iterator, [2]);
+
+    it::assert_equal(
+        IntoIterator::into_iter([Some(1), None])
+            .strip_prefix([Some(1)])
+            .unwrap(),
+        [None],
+    );
+}
+
+#[test]
+fn strip_prefix_by() {
+    let mut calls = 0;
+    let err = IntoIterator::into_iter(["a", "bb", "ccc"])
+        .strip_prefix_by([1, 9, 3], |word, len| {
+            calls += 1;
+            word.len() == *len
+        })
+        .unwrap_err();
+    assert_eq!(calls, 2);
+    assert_eq!(err.mismatch, (Some("bb"), 9));
+    it::assert_equal(err.iterator, ["ccc"]);
+    it::assert_equal(err.prefix, [3]);
+    assert!(iter::empty::<i32>()
+        .strip_prefix_by([1], |_, _| panic!())
+        .is_err());
+    assert!((0..)
+        .strip_prefix_by([], |_: &i32, _: &i32| panic!())
+        .is_ok());
+}
+
+#[test]
+fn strip_prefix_does_not_fuse() {
+    let mut source = IntoIterator::into_iter([Some(1), None, Some(2)]);
+    let iter = iter::from_fn(|| source.next().flatten());
+    let mut err = iter.strip_prefix([1, 2]).err().unwrap();
+    assert_eq!(err.mismatch, (None, 2));
+    assert_eq!(err.iterator.next(), Some(2));
+}
```

</details>

<details><summary>reply</summary>

I’ll check the crate’s conventions, add both methods and the public error type, then test matching, mismatches, and iterator exhaustion.

Both methods and the error type are implemented. The tests cover the returned iterator positions, comparator call order, empty prefixes, and an iterator that resumes after returning `None`. I also adjusted the examples for the crate’s Rust 2018 array iteration behavior; verification is underway.

Added `strip_prefix`, `strip_prefix_by`, and public `StripPrefixError` with the requested fields and consumption behavior. Included documentation, examples, and tests.

Passed 187 core/property tests, both new doctests, and no-default-features checks. Clippy reports four existing `question_mark` warnings in unrelated code.

</details>

### codex, hush: pass

Files: [CHANGELOG.md](../hush/codex/rust-feat-itertools-strip-prefix-1/files/CHANGELOG.md), [src/lib.rs](../hush/codex/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix_error.rs](../hush/codex/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix_error.rs), [tests/quick.rs](../hush/codex/rust-feat-itertools-strip-prefix-1/files/tests/quick.rs), [tests/test_core.rs](../hush/codex/rust-feat-itertools-strip-prefix-1/files/tests/test_core.rs)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index d8d1da9..03b7050 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -7,6 +7,7 @@
 - Canonicalize `all_equal_value`'s error type (#1032)
 
 ### Added
+- Add `Itertools::strip_prefix`, `strip_prefix_by`, and `StripPrefixError`
 - Add `*_with_hasher` adaptors (#1007)
 
 ### Changed
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..d43056b 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -140,6 +140,7 @@ pub mod structs {
     pub use crate::repeatn::RepeatN;
     #[allow(deprecated)]
     pub use crate::sources::{Iterate, Unfold};
+    pub use crate::strip_prefix_error::StripPrefixError;
     pub use crate::take_while_inclusive::TakeWhileInclusive;
     #[cfg(feature = "use_alloc")]
     pub use crate::tee::Tee;
@@ -235,6 +236,7 @@ mod rciter_impl;
 mod repeatn;
 mod size_hint;
 mod sources;
+mod strip_prefix_error;
 mod take_while_inclusive;
 #[cfg(feature = "use_alloc")]
 mod tee;
@@ -2331,6 +2333,70 @@ pub trait Itertools: Iterator {
         self.next_array().filter(|_| self.next().is_none())
     }
 
+    /// Removes a matching prefix and returns the remaining iterator.
+    ///
+    /// An empty prefix leaves the iterator untouched. On failure, the error
+    /// contains both remaining iterators and the first mismatching pair.
+    /// Matching items are consumed and are not included in the error.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// assert_eq!((1..6).strip_prefix([1, 2]).unwrap().collect_vec(), [3, 4, 5]);
+    /// let err = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    /// assert_eq!(err.mismatch, (Some(3), 9));
+    /// assert_eq!(err.prefix.collect_vec(), [4]);
+    /// assert_eq!(err.iterator.collect_vec(), [4, 5]);
+    /// ```
+    fn strip_prefix<P>(self, prefix: P) -> Result<Self, StripPrefixError<Self, P::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        Self::Item: PartialEq<P::Item>,
+    {
+        self.strip_prefix_by(prefix, PartialEq::eq)
+    }
+
+    /// Removes a prefix using `eq` to compare each iterator item with a prefix item.
+    ///
+    /// Like [`strip_prefix`](Itertools::strip_prefix), but the comparison can
+    /// compare different item types and can keep mutable state. It is called
+    /// only for pairs of available items, stopping at the first mismatch.
+    /// If this iterator ends first, the error's mismatch contains `None`.
+    /// Neither iterator is polled again after a mismatch or exhaustion.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = (1..5).strip_prefix_by(["1", "2"], |item, prefix| {
+    ///     prefix.parse::<i32>() == Ok(*item)
+    /// }).unwrap();
+    /// assert_eq!(rest.collect_vec(), [3, 4]);
+    /// ```
+    fn strip_prefix_by<P, F>(
+        mut self,
+        prefix: P,
+        mut eq: F,
+    ) -> Result<Self, StripPrefixError<Self, P::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        F: FnMut(&Self::Item, &P::Item) -> bool,
+    {
+        let mut prefix = prefix.into_iter();
+        while let Some(expected) = prefix.next() {
+            let actual = self.next();
+            if !actual.as_ref().map_or(false, |item| eq(item, &expected)) {
+                return Err(StripPrefixError {
+                    iterator: self,
+                    prefix,
+                    mismatch: (actual, expected),
+                });
+            }
+        }
+        Ok(self)
+    }
+
     /// Advances the iterator and returns the next items grouped in a tuple of
     /// a specific size (up to 12).
     ///
diff --git a/src/strip_prefix_error.rs b/src/strip_prefix_error.rs
new file mode 100644
index 0000000..4ac1409
--- /dev/null
+++ b/src/strip_prefix_error.rs
@@ -0,0 +1,14 @@
+/// A failed [`strip_prefix`](crate::Itertools::strip_prefix) or
+/// [`strip_prefix_by`](crate::Itertools::strip_prefix_by) operation.
+///
+/// Matching items have been consumed. The first mismatching pair is retained
+/// in `mismatch`, and both iterators are positioned immediately after that pair.
+#[derive(Debug)]
+pub struct StripPrefixError<I: Iterator, P: Iterator> {
+    /// The original iterator, positioned after the mismatching item or exhaustion.
+    pub iterator: I,
+    /// The prefix iterator, positioned after the mismatching prefix item.
+    pub prefix: P,
+    /// The mismatching pair, with `None` if the original iterator ended first.
+    pub mismatch: (Option<I::Item>, P::Item),
+}
diff --git a/tests/quick.rs b/tests/quick.rs
index 538346b..b050183 100644
--- a/tests/quick.rs
+++ b/tests/quick.rs
@@ -2099,3 +2099,18 @@ quickcheck! {
             && itertools::equal(v.iter().filter(|_| true).tail(n), result)
     }
 }
+
+quickcheck! {
+    fn strip_prefix_agrees_with_slice(items: Vec<u8>, prefix: Vec<u8>) -> bool {
+        let matched = items.iter().zip(&prefix).take_while(|(a, b)| a == b).count();
+        match items.iter().copied().strip_prefix(prefix.iter().copied()) {
+            Ok(rest) => items.starts_with(&prefix) && rest.eq(items[prefix.len()..].iter().copied()),
+            Err(err) => {
+                !items.starts_with(&prefix)
+                    && err.mismatch == (items.get(matched).copied(), prefix[matched])
+                    && err.prefix.eq(prefix[matched + 1..].iter().copied())
+                    && err.iterator.eq(items[(matched + 1).min(items.len())..].iter().copied())
+            }
+        }
+    }
+}
diff --git a/tests/test_core.rs b/tests/test_core.rs
index adaa06e..6ffa2c0 100644
--- a/tests/test_core.rs
+++ b/tests/test_core.rs
@@ -398,3 +398,71 @@ fn collect_array() {
     let iter = v.iter().cloned();
     assert_eq!(iter.collect_array::<2>(), None);
 }
+
+#[test]
+fn strip_prefix() {
+    assert!(it::equal((1..6).strip_prefix([1, 2]).unwrap(), 3..6));
+    assert!(it::equal((1..3).strip_prefix([]).unwrap(), 1..3));
+    assert!(it::equal((1..3).strip_prefix([1, 2]).unwrap(), []));
+    let err: it::StripPrefixError<_, _> = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    assert_eq!(err.mismatch, (Some(3), 9));
+    assert!(it::equal(err.prefix, [4]));
+    assert!(it::equal(err.iterator, [4, 5]));
+    let err = (1..3).strip_prefix([1, 2, 3, 4]).unwrap_err();
+    assert_eq!(err.mismatch, (None, 3));
+    assert!(it::equal(err.prefix, [4]));
+    assert!(it::equal(err.iterator, []));
+    let err = iter::empty::<i32>().strip_prefix([1]).unwrap_err();
+    assert_eq!(err.mismatch, (None, 1));
+}
+
+#[test]
+fn strip_prefix_by() {
+    let mut calls = 0;
+    let err = (1..6)
+        .strip_prefix_by(["1", "2", "9", "4"], |item, prefix| {
+            calls += 1;
+            prefix.parse::<i32>() == Ok(*item)
+        })
+        .unwrap_err();
+    assert_eq!(calls, 3);
+    assert_eq!(err.mismatch, (Some(3), "9"));
+    assert!(it::equal(err.prefix, ["4"]));
+    assert!(it::equal(err.iterator, [4, 5]));
+    let err = iter::empty::<i32>()
+        .strip_prefix_by([1], |_, _| panic!("no item to compare"))
+        .unwrap_err();
+    assert_eq!(err.mismatch, (None, 1));
+    assert!((1..3)
+        .strip_prefix_by([], |_: &i32, _: &i32| panic!("empty prefix"))
+        .is_ok());
+}
+
+#[test]
+fn strip_prefix_does_not_poll_past_end() {
+    let mut items = [Some(1), None, Some(3)].iter().copied();
+    let iterator = iter::from_fn(move || items.next().flatten());
+    let mut err = iterator.strip_prefix([1, 2, 3]).err().unwrap();
+    assert_eq!(err.mismatch, (None, 2));
+    assert_eq!(err.iterator.next(), Some(3));
+    assert!(it::equal(err.prefix, [3]));
+
+    let iterator = iter::from_fn(|| -> Option<i32> { panic!("empty prefix polled iterator") });
+    assert!(iterator.strip_prefix([]).is_ok());
+}
+
+#[test]
+fn strip_prefix_matches_str() {
+    for text in ["", "hello", "héllo", "🦀rust"] {
+        for prefix in ["", "h", "he", "hello", "helloo", "hé", "🦀", "x"] {
+            match (
+                text.strip_prefix(prefix),
+                text.chars().strip_prefix(prefix.chars()),
+            ) {
+                (Some(rest), Ok(iterator)) => assert!(it::equal(rest.chars(), iterator)),
+                (None, Err(_)) => (),
+                _ => panic!("iterator and string prefix results differ"),
+            }
+        }
+    }
+}
```

</details>

<details><summary>reply</summary>

Adding `Itertools` prefix methods, public mismatch error, and focused tests.


Done.
Added both methods, public `StripPrefixError`, docs, tests. Core, property, doctests, no-default-features checks passed; Clippy blocked by four existing warnings.

</details>

### codex, sloth: pass

Files: [src/lib.rs](../sloth/codex/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix_error.rs](../sloth/codex/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix_error.rs), [tests/test_core.rs](../sloth/codex/rust-feat-itertools-strip-prefix-1/files/tests/test_core.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..95e9949 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -140,6 +140,7 @@ pub mod structs {
     pub use crate::repeatn::RepeatN;
     #[allow(deprecated)]
     pub use crate::sources::{Iterate, Unfold};
+    pub use crate::strip_prefix_error::StripPrefixError;
     pub use crate::take_while_inclusive::TakeWhileInclusive;
     #[cfg(feature = "use_alloc")]
     pub use crate::tee::Tee;
@@ -235,6 +236,7 @@ mod rciter_impl;
 mod repeatn;
 mod size_hint;
 mod sources;
+mod strip_prefix_error;
 mod take_while_inclusive;
 #[cfg(feature = "use_alloc")]
 mod tee;
@@ -2504,6 +2506,68 @@ pub trait Itertools: Iterator {
         self.any(|x| x.borrow() == query)
     }
 
+    /// Remove a matching prefix and return the remaining iterator.
+    ///
+    /// An empty prefix leaves the iterator unchanged. On a mismatch or if this
+    /// iterator runs out first, returns the remaining iterators and the mismatched
+    /// items in a [`StripPrefixError`]. Neither iterator advances past that pair.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// assert_eq!((1..6).strip_prefix([1, 2]).unwrap().collect_vec(), [3, 4, 5]);
+    /// let err = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    /// assert_eq!(err.mismatch, (Some(3), 9));
+    /// assert_eq!(err.prefix.collect_vec(), [4]);
+    /// assert_eq!(err.iterator.collect_vec(), [4, 5]);
+    /// ```
+    fn strip_prefix<P>(self, prefix: P) -> Result<Self, StripPrefixError<Self, P::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        Self::Item: PartialEq<P::Item>,
+    {
+        self.strip_prefix_by(prefix, PartialEq::eq)
+    }
+
+    /// Remove a prefix using `eq` to compare each iterator item with a prefix item.
+    ///
+    /// Like [`strip_prefix`](Itertools::strip_prefix), returns the remaining
+    /// iterator on success or a [`StripPrefixError`] on the first mismatch.
+    /// `eq` is not called when this iterator runs out first.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = (1..4).strip_prefix_by(["1", "2"], |item, prefix| {
+    ///     item.to_string() == *prefix
+    /// }).unwrap();
+    /// assert_eq!(rest.collect_vec(), [3]);
+    /// ```
+    fn strip_prefix_by<P, F>(
+        mut self,
+        prefix: P,
+        mut eq: F,
+    ) -> Result<Self, StripPrefixError<Self, P::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        F: FnMut(&Self::Item, &P::Item) -> bool,
+    {
+        let mut prefix = prefix.into_iter();
+        while let Some(prefix_item) = prefix.next() {
+            let item = self.next();
+            if !item.as_ref().map_or(false, |item| eq(item, &prefix_item)) {
+                return Err(StripPrefixError {
+                    iterator: self,
+                    prefix,
+                    mismatch: (item, prefix_item),
+                });
+            }
+        }
+        Ok(self)
+    }
+
     /// Check whether all elements compare equal.
     ///
     /// Empty iterators are considered to have equal elements:
diff --git a/src/strip_prefix_error.rs b/src/strip_prefix_error.rs
new file mode 100644
index 0000000..50158cb
--- /dev/null
+++ b/src/strip_prefix_error.rs
@@ -0,0 +1,12 @@
+/// The remaining iterators and mismatched items from
+/// [`strip_prefix`](crate::Itertools::strip_prefix) or
+/// [`strip_prefix_by`](crate::Itertools::strip_prefix_by).
+#[derive(Debug)]
+pub struct StripPrefixError<I: Iterator, P: Iterator> {
+    /// The original iterator, advanced past the mismatched item, if any.
+    pub iterator: I,
+    /// The prefix iterator, advanced past the mismatched prefix item.
+    pub prefix: P,
+    /// The mismatched items; `None` means the original iterator ran out first.
+    pub mismatch: (Option<I::Item>, P::Item),
+}
diff --git a/tests/test_core.rs b/tests/test_core.rs
index adaa06e..da9a4be 100644
--- a/tests/test_core.rs
+++ b/tests/test_core.rs
@@ -398,3 +398,58 @@ fn collect_array() {
     let iter = v.iter().cloned();
     assert_eq!(iter.collect_array::<2>(), None);
 }
+
+/// Check prefix matching and the exact iterator positions on failure.
+#[test]
+fn strip_prefix() {
+    it::assert_equal((1..6).strip_prefix([1, 2]).unwrap(), 3..6);
+    it::assert_equal((1..3).strip_prefix([]).unwrap(), 1..3);
+    it::assert_equal((1..3).strip_prefix([1, 2]).unwrap(), iter::empty());
+    assert!(iter::empty::<i32>().strip_prefix([]).is_ok());
+
+    for (input, prefix, mismatch, remaining, remaining_prefix) in [
+        (1..6, [1, 2, 9, 4], (Some(3), 9), 4..6, 3..4),
+        (1..3, [1, 2, 3, 4], (None, 3), 3..3, 3..4),
+        (1..6, [9, 2, 3, 4], (Some(1), 9), 2..6, 1..4),
+        (1..1, [1, 2, 3, 4], (None, 1), 1..1, 1..4),
+    ] {
+        let err: it::StripPrefixError<_, _> = input.strip_prefix(prefix).unwrap_err();
+        assert_eq!(err.mismatch, mismatch);
+        it::assert_equal(err.iterator, remaining);
+        it::assert_equal(err.prefix, prefix[remaining_prefix].iter().copied());
+    }
+
+    for prefix in ["", "he", "hello", "helloo", "ha", "x"] {
+        let result = "hello".chars().strip_prefix(prefix.chars());
+        match "hello".strip_prefix(prefix) {
+            Some(rest) => it::assert_equal(result.unwrap(), rest.chars()),
+            None => assert!(result.is_err()),
+        }
+    }
+
+    let mut calls = 0;
+    let err = (1..4)
+        .strip_prefix_by(["1", "2", "9", "4"], |item, prefix| {
+            calls += 1;
+            Some(*item) == prefix.parse::<i32>().ok()
+        })
+        .unwrap_err();
+    assert_eq!(calls, 3);
+    assert_eq!(err.mismatch, (Some(3), "9"));
+    it::assert_equal(err.prefix, ["4"]);
+    it::assert_equal(err.iterator, iter::empty());
+    it::assert_equal(
+        (1..3)
+            .strip_prefix_by(["1", "2"], |a, b| Some(*a) == b.parse().ok())
+            .unwrap(),
+        iter::empty(),
+    );
+    assert!(iter::empty::<i32>()
+        .strip_prefix_by(["1"], |_, _| panic!("comparison after exhaustion"))
+        .is_err());
+
+    let mut non_fused = [Some(1), None, Some(3)].iter().copied().scan((), |_, x| x);
+    let err = non_fused.by_ref().strip_prefix([1, 2]).unwrap_err();
+    assert_eq!(err.mismatch, (None, 2));
+    assert_eq!(err.iterator.next(), Some(3));
+}
```

</details>

<details><summary>reply</summary>

I’ll check the trait, exports, and test conventions, then add the methods and error type with focused tests.

The change needs two `Itertools` methods, a public error type exported at both the crate root and `structs`, and tests in `tests/test_core.rs`. It needs no allocation or feature flags. Both methods can share one comparison loop, which will stop immediately on mismatch or exhaustion.

The implementation is in place. The tests cover successful and empty prefixes, mismatch recovery, early exhaustion, different item types, a mutable comparator, and agreement with `str::strip_prefix`. They also check that an iterator which resumes after returning `None` is returned without extra polling. I fixed a Rust 2018 array iteration issue in the test; validation is continuing.

Added `strip_prefix`, `strip_prefix_by`, and public `StripPrefixError` with the requested fields and recovery behavior.

Validation passed: all 651 tests, no-default-features tests and builds, and formatting. Clippy passes with four pre-existing `question_mark` warnings suppressed.

</details>

### codex, all: pass

Files: [CHANGELOG.md](../all/codex/rust-feat-itertools-strip-prefix-1/files/CHANGELOG.md), [src/lib.rs](../all/codex/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [tests/test_core.rs](../all/codex/rust-feat-itertools-strip-prefix-1/files/tests/test_core.rs)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index d8d1da9..3059aa5 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -7,6 +7,7 @@
 - Canonicalize `all_equal_value`'s error type (#1032)
 
 ### Added
+- Add `Itertools::strip_prefix`, `Itertools::strip_prefix_by`, and `StripPrefixError`
 - Add `*_with_hasher` adaptors (#1007)
 
 ### Changed
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..a14c85e 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -92,6 +92,18 @@ pub use std::iter as __std_iter;
 
 /// The concrete iterator types.
 pub mod structs {
+    /// A failed comparison from [`Itertools::strip_prefix`](crate::Itertools::strip_prefix)
+    /// or [`Itertools::strip_prefix_by`](crate::Itertools::strip_prefix_by).
+    #[derive(Debug)]
+    pub struct StripPrefixError<I: Iterator, P: Iterator> {
+        /// The input iterator, after the mismatching item or its first `None`.
+        pub iterator: I,
+        /// The prefix iterator, after the mismatching prefix item.
+        pub prefix: P,
+        /// The input item (or `None` if exhausted) and the mismatching prefix item.
+        pub mismatch: (Option<I::Item>, P::Item),
+    }
+
     #[cfg(feature = "use_alloc")]
     pub use crate::adaptors::MultiProduct;
     pub use crate::adaptors::{
@@ -2504,6 +2516,69 @@ pub trait Itertools: Iterator {
         self.any(|x| x.borrow() == query)
     }
 
+    /// Remove a matching prefix, returning the remaining iterator.
+    ///
+    /// An empty prefix leaves the iterator untouched. On a mismatch, the error
+    /// contains both remaining iterators and the items that failed to match.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = (1..6).strip_prefix([1, 2]).unwrap().collect_vec();
+    /// assert_eq!(rest, [3, 4, 5]);
+    ///
+    /// let err = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    /// assert_eq!(err.mismatch, (Some(3), 9));
+    /// assert_eq!(err.prefix.collect_vec(), [4]);
+    /// assert_eq!(err.iterator.collect_vec(), [4, 5]);
+    /// ```
+    fn strip_prefix<P>(self, prefix: P) -> Result<Self, StripPrefixError<Self, P::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        Self::Item: PartialEq<P::Item>,
+    {
+        self.strip_prefix_by(prefix, PartialEq::eq)
+    }
+
+    /// Remove a prefix whose items match using `eq`, returning the remaining iterator.
+    ///
+    /// `eq` receives the input item first and the prefix item second. An empty
+    /// prefix leaves the iterator untouched. On a mismatch or input exhaustion,
+    /// both iterators stop immediately after the items stored in `mismatch`.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = (1..6).strip_prefix_by(["1", "2"], |item, prefix| {
+    ///     item.to_string() == *prefix
+    /// }).unwrap().collect_vec();
+    /// assert_eq!(rest, [3, 4, 5]);
+    /// ```
+    fn strip_prefix_by<P, F>(
+        mut self,
+        prefix: P,
+        mut eq: F,
+    ) -> Result<Self, StripPrefixError<Self, P::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        F: FnMut(&Self::Item, &P::Item) -> bool,
+    {
+        let mut prefix = prefix.into_iter();
+        while let Some(prefix_item) = prefix.next() {
+            let item = self.next();
+            if !item.as_ref().map_or(false, |item| eq(item, &prefix_item)) {
+                return Err(StripPrefixError {
+                    iterator: self,
+                    prefix,
+                    mismatch: (item, prefix_item),
+                });
+            }
+        }
+        Ok(self)
+    }
+
     /// Check whether all elements compare equal.
     ///
     /// Empty iterators are considered to have equal elements:
diff --git a/tests/test_core.rs b/tests/test_core.rs
index adaa06e..4286b17 100644
--- a/tests/test_core.rs
+++ b/tests/test_core.rs
@@ -398,3 +398,80 @@ fn collect_array() {
     let iter = v.iter().cloned();
     assert_eq!(iter.collect_array::<2>(), None);
 }
+
+/// Check prefix removal, mismatch recovery, and comparison boundaries.
+#[test]
+fn strip_prefix() {
+    assert!((1..6).strip_prefix([1, 2]).unwrap().eq(3..6));
+    assert!((1..3).strip_prefix([1, 2]).unwrap().next().is_none());
+    assert!((1..3).strip_prefix([]).unwrap().eq(1..3));
+    assert!(iter::empty::<i32>()
+        .strip_prefix([])
+        .unwrap()
+        .next()
+        .is_none());
+
+    let err: it::StripPrefixError<_, _> = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    assert_eq!(err.mismatch, (Some(3), 9));
+    assert!(err.prefix.eq([4]));
+    assert!(err.iterator.eq([4, 5]));
+
+    let err = (1..3).strip_prefix([1, 2, 3, 4]).unwrap_err();
+    assert_eq!(err.mismatch, (None, 3));
+    assert!(err.prefix.eq([4]));
+    assert!(err.iterator.eq([]));
+
+    let err = (1..3).strip_prefix([9, 2]).unwrap_err();
+    assert_eq!(err.mismatch, (Some(1), 9));
+    assert!(err.prefix.eq([2]));
+    assert!(err.iterator.eq([2]));
+
+    let mut calls = 0;
+    let err = (1..6)
+        .strip_prefix_by(["1", "2", "9", "4"], |item, prefix| {
+            calls += 1;
+            Some(*item) == prefix.parse::<i32>().ok()
+        })
+        .unwrap_err();
+    assert_eq!(calls, 3);
+    assert_eq!(err.mismatch, (Some(3), "9"));
+    assert!(err.prefix.eq(["4"]));
+    assert!(err.iterator.eq([4, 5]));
+
+    assert!((1..3)
+        .strip_prefix_by(["1", "2"], |item, prefix| Some(*item)
+            == prefix.parse::<i32>().ok())
+        .unwrap()
+        .eq([]));
+    assert!((1..3)
+        .strip_prefix_by([], |_: &i32, _: &i32| panic!())
+        .unwrap()
+        .eq(1..3));
+    assert_eq!(
+        iter::empty::<i32>()
+            .strip_prefix_by([0], |_, _| panic!())
+            .unwrap_err()
+            .mismatch,
+        (None, 0)
+    );
+
+    assert!(IntoIterator::into_iter(["a", "b"])
+        .strip_prefix(["a"])
+        .unwrap()
+        .eq(["b"]));
+    for prefix in ["", "h", "he", "hello", "hello!", "hi"] {
+        assert_eq!(
+            "hello"
+                .chars()
+                .strip_prefix(prefix.chars())
+                .ok()
+                .map(|rest| rest.eq("hello".strip_prefix(prefix).unwrap().chars())),
+            "hello".strip_prefix(prefix).map(|_| true),
+        );
+    }
+
+    let mut input = IntoIterator::into_iter([Some(1), None, Some(3)]).map_while(|item| item);
+    let err = input.by_ref().strip_prefix([1, 2]).unwrap_err();
+    assert_eq!(err.mismatch, (None, 2));
+    assert_eq!(err.iterator.next(), Some(3));
+}
```

</details>

<details><summary>reply</summary>

Done.
Added both methods, public `StripPrefixError`, docs, tests. All-feature and no-default-feature tests pass. Clippy blocked by existing warnings.

</details>
