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
| claude | muffle | pass | +114/-0 | 0 | 4,672 | $0.139 |
| claude | hush | pass | +153/-0 | 17 | 4,292 | $0.124 |
| claude | sloth | pass | +90/-0 | 0 | 3,270 | $0.111 |
| claude | all | pass | +88/-0 | 0 | 2,653 | $0.084 |
| codex | base | pass | +92/-0 | 94 | 3,368 | - |
| codex | muffle | pass | +81/-0 | 87 | 3,578 | - |
| codex | hush | pass | +81/-0 | 66 | 2,569 | - |
| codex | sloth | pass | +90/-0 | 0 | 2,516 | - |
| codex | all | pass | +74/-0 | 0 | 1,664 | - |

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

Files: [CHANGELOG.md](../muffle/claude/rust-feat-itertools-strip-prefix-1/files/CHANGELOG.md), [src/lib.rs](../muffle/claude/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix_err.rs](../muffle/claude/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix_err.rs)

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
index d4b17a6..07d57c5 100644
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
@@ -2531,6 +2533,82 @@ pub trait Itertools: Iterator {
         }
     }
 
+    /// Remove `prefix` from the start of the iterator, like [`str::strip_prefix`].
+    ///
+    /// If the iterator starts with all of the items of `prefix`, in order,
+    /// return `Ok` with the iterator advanced past the prefix.
+    /// An empty prefix returns the whole iterator.
+    ///
+    /// Otherwise return a [`StripPrefixError`] holding the consumed iterator,
+    /// the rest of the prefix and the mismatching pair of items.
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
+    fn strip_prefix<P>(self, prefix: P) -> Result<Self, StripPrefixError<Self, P::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        Self::Item: PartialEq<P::Item>,
+    {
+        self.strip_prefix_by(prefix, |x, p| x == p)
+    }
+
+    /// Like [`strip_prefix`](Itertools::strip_prefix), but compares items with
+    /// the closure `eq`, so the prefix may have a different item type.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = ["1", "2", "3"]
+    ///     .iter()
+    ///     .strip_prefix_by([1, 2], |s, n| s.parse::<i32>() == Ok(*n))
+    ///     .unwrap()
+    ///     .collect_vec();
+    /// assert_eq!(rest, [&"3"]);
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
index 0000000..464197a
--- /dev/null
+++ b/src/strip_prefix_err.rs
@@ -0,0 +1,35 @@
+#[cfg(doc)]
+use crate::Itertools;
+#[cfg(feature = "use_std")]
+use std::error::Error;
+use std::fmt::{Debug, Display, Formatter, Result as FmtResult};
+
+/// Value returned for the error case of [`Itertools::strip_prefix`]
+/// and [`Itertools::strip_prefix_by`].
+#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
+pub struct StripPrefixError<I: Iterator, P: Iterator> {
+    /// The original iterator, stopped right after the item that did not match.
+    pub iterator: I,
+    /// The rest of the prefix iterator, after the prefix item that did not match.
+    pub prefix: P,
+    /// The iterator's item (`None` if it ran out first) and the prefix item
+    /// it was compared with.
+    pub mismatch: (Option<I::Item>, P::Item),
+}
+
+impl<I: Iterator, P: Iterator> Display for StripPrefixError<I, P> {
+    fn fmt(&self, f: &mut Formatter) -> FmtResult {
+        match self.mismatch.0 {
+            None => write!(f, "iterator ended before the prefix was fully matched"),
+            Some(_) => write!(f, "iterator item did not match the prefix item"),
+        }
+    }
+}
+
+#[cfg(feature = "use_std")]
+impl<I: Iterator + Debug, P: Iterator + Debug> Error for StripPrefixError<I, P>
+where
+    I::Item: Debug,
+    P::Item: Debug,
+{
+}
```

</details>

<details><summary>reply</summary>

I wrote a silly first `strip_prefix_by` doc example; fixing it, then testing.

Doc example uses `.iter()`-style refs; fix to by-value.

Edition 2018 crate; use `.iter()` and a `&&str` item.

`Itertools` now has `strip_prefix` and `strip_prefix_by`, plus a public `StripPrefixError` struct. The doc tests pass, and so do the existing tests, fmt, and the build with `--no-default-features`. I didn't add tests under `tests/`. Nothing is committed.

- **`strip_prefix(prefix)`:** takes `self` by value and needs `Self::Item: PartialEq<P::Item>`. It returns `Result<Self, StripPrefixError<Self, P::IntoIter>>`. It calls `strip_prefix_by` with `==`.
- **`strip_prefix_by(prefix, eq)`:** takes `FnMut(&Self::Item, &P::Item) -> bool`. It walks the prefix and pulls one item from the iterator for each. On the first mismatch, or when the iterator runs out early, it returns the error. An empty prefix gives back the whole iterator.
- **`StripPrefixError`:** has public fields `iterator`, `prefix` and `mismatch: (Option<I::Item>, P::Item)`, with the semantics you described. It derives `Clone`, `Debug`, `PartialEq`, `Eq`, `PartialOrd` and `Ord`. It also implements `Display`, and `Error` under `use_std`. It lives in `src/strip_prefix_err.rs` and is re-exported from `structs`, so it is available as `itertools::StripPrefixError`.
- **Docs:** the doc examples cover your cases, including `"hello".chars().strip_prefix("he".chars())`. The `strip_prefix_by` example compares `&str` items against integers. I also added a line to `CHANGELOG.md`.

Because the iterator is passed by value, the original is gone once you call `strip_prefix`. The `Err` carries it back, stopped right after the mismatch, as you asked.

</details>

### claude, hush: pass

Files: [src/lib.rs](../hush/claude/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix_err.rs](../hush/claude/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix_err.rs), [tests/test_std.rs](../hush/claude/rust-feat-itertools-strip-prefix-1/files/tests/test_std.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..5d6ee13 100644
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
@@ -2531,6 +2533,82 @@ pub trait Itertools: Iterator {
         }
     }
 
+    /// Strip `prefix` from the start of the iterator, like [`str::strip_prefix`].
+    ///
+    /// If the iterator starts with all items of `prefix`, in order, return `Ok`
+    /// with the iterator advanced past the prefix. An empty prefix returns the
+    /// whole iterator.
+    ///
+    /// Otherwise return a [`StripPrefixError`] holding the consumed state.
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
+    fn strip_prefix<P>(self, prefix: P) -> Result<Self, StripPrefixError<Self, P::IntoIter>>
+    where
+        Self: Sized,
+        P: IntoIterator,
+        Self::Item: PartialEq<P::Item>,
+    {
+        self.strip_prefix_by(prefix, |a, b| a == b)
+    }
+
+    /// Like [`strip_prefix`](Itertools::strip_prefix), but compare items with
+    /// the closure `eq`, so the prefix may have a different item type.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = ["a", "bb", "c"]
+    ///     .iter()
+    ///     .strip_prefix_by([1, 2], |s, n| s.len() == *n)
+    ///     .unwrap()
+    ///     .count();
+    /// assert_eq!(rest, 1);
+    ///
+    /// let rest = "hello".chars().strip_prefix_by("HE".chars(), |a, b| a.eq_ignore_ascii_case(b));
+    /// assert_eq!(rest.unwrap().collect::<String>(), "llo");
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
+        while let Some(p) = prefix.next() {
+            match self.next() {
+                Some(x) if eq(&x, &p) => {}
+                found => {
+                    return Err(StripPrefixError {
+                        iterator: self,
+                        prefix,
+                        mismatch: (found, p),
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
index 0000000..4acb723
--- /dev/null
+++ b/src/strip_prefix_err.rs
@@ -0,0 +1,75 @@
+use core::fmt;
+
+#[cfg(doc)]
+use crate::Itertools;
+
+/// Value returned for the error case of [`Itertools::strip_prefix`]
+/// and [`Itertools::strip_prefix_by`].
+pub struct StripPrefixError<I, P>
+where
+    I: Iterator,
+    P: Iterator,
+{
+    /// The original iterator, stopped right after the item that did not match.
+    pub iterator: I,
+    /// The rest of the prefix iterator, after the prefix item that did not match.
+    pub prefix: P,
+    /// The iterator's item (`None` if it ran out first) and the prefix item
+    /// it was compared with.
+    pub mismatch: (Option<I::Item>, P::Item),
+}
+
+impl<I, P> Clone for StripPrefixError<I, P>
+where
+    I: Iterator + Clone,
+    P: Iterator + Clone,
+    I::Item: Clone,
+    P::Item: Clone,
+{
+    fn clone(&self) -> Self {
+        Self {
+            iterator: self.iterator.clone(),
+            prefix: self.prefix.clone(),
+            mismatch: self.mismatch.clone(),
+        }
+    }
+}
+
+impl<I, P> fmt::Debug for StripPrefixError<I, P>
+where
+    I: Iterator + fmt::Debug,
+    P: Iterator + fmt::Debug,
+    I::Item: fmt::Debug,
+    P::Item: fmt::Debug,
+{
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        f.debug_struct("StripPrefixError")
+            .field("iterator", &self.iterator)
+            .field("prefix", &self.prefix)
+            .field("mismatch", &self.mismatch)
+            .finish()
+    }
+}
+
+impl<I, P> fmt::Display for StripPrefixError<I, P>
+where
+    I: Iterator,
+    P: Iterator,
+{
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        match self.mismatch.0 {
+            None => f.write_str("iterator ended before the prefix did"),
+            Some(_) => f.write_str("iterator item did not match the prefix"),
+        }
+    }
+}
+
+#[cfg(feature = "use_std")]
+impl<I, P> std::error::Error for StripPrefixError<I, P>
+where
+    I: Iterator + fmt::Debug,
+    P: Iterator + fmt::Debug,
+    I::Item: fmt::Debug,
+    P::Item: fmt::Debug,
+{
+}
diff --git a/tests/test_std.rs b/tests/test_std.rs
index 5f5cfd1..91dea7d 100644
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
+        ("", "a"),
+    ] {
+        let got = s
+            .chars()
+            .strip_prefix(p.chars())
+            .map(|i| i.collect::<String>());
+        assert_eq!(got.ok(), s.strip_prefix(p).map(String::from), "{s} {p}");
+    }
+}
```

</details>

<details><summary>reply</summary>

Done. Added `strip_prefix`, `strip_prefix_by` and public `StripPrefixError` (`src/strip_prefix_err.rs`, `src/lib.rs`). Unit and doc tests pass. No CHANGELOG entry. `cargo test --no-default-features` fails on `chunk_by`, `array_combinations` and `join`. I didn't check whether it failed before my change; `cargo build --no-default-features` passes.

</details>

### claude, sloth: pass

Files: [CHANGELOG.md](../sloth/claude/rust-feat-itertools-strip-prefix-1/files/CHANGELOG.md), [src/lib.rs](../sloth/claude/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix_err.rs](../sloth/claude/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix_err.rs)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index d8d1da9..c3a782d 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -7,6 +7,7 @@
 - Canonicalize `all_equal_value`'s error type (#1032)
 
 ### Added
+- Add `strip_prefix` and `strip_prefix_by`
 - Add `*_with_hasher` adaptors (#1007)
 
 ### Changed
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..8716468 100644
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
@@ -2531,6 +2533,75 @@ pub trait Itertools: Iterator {
         }
     }
 
+    /// Remove `prefix` from the start of the iterator, like [`str::strip_prefix`].
+    ///
+    /// If the iterator starts with all the items of `prefix`, in order, return the iterator
+    /// advanced past them. An empty prefix returns the whole iterator.
+    /// Otherwise return a [`StripPrefixError`] holding what was consumed.
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
+    /// Like [`strip_prefix`](Itertools::strip_prefix), but compares items with `eq`,
+    /// so the prefix can have a different item type.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = (1..6).strip_prefix_by(["1", "2"], |&a, b| a.to_string() == *b);
+    /// assert_eq!(rest.unwrap().collect_vec(), [3, 4, 5]);
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
+                found => {
+                    return Err(StripPrefixError {
+                        iterator: self,
+                        prefix,
+                        mismatch: (found, expected),
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
index 0000000..19b4084
--- /dev/null
+++ b/src/strip_prefix_err.rs
@@ -0,0 +1,18 @@
+#[cfg(doc)]
+use crate::Itertools;
+
+/// Value returned for the error case of [`Itertools::strip_prefix`] and
+/// [`Itertools::strip_prefix_by`].
+#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
+pub struct StripPrefixError<I, P, PrefixItem>
+where
+    I: Iterator,
+    P: Iterator<Item = PrefixItem>,
+{
+    /// The original iterator, stopped right after the item that did not match.
+    pub iterator: I,
+    /// The rest of the prefix, after the prefix item that did not match.
+    pub prefix: P,
+    /// The iterator's item (`None` if it ran out) and the prefix item it was compared with.
+    pub mismatch: (Option<I::Item>, PrefixItem),
+}
```

</details>

<details><summary>reply</summary>

I added `strip_prefix` and `strip_prefix_by` to `Itertools`, plus the public `StripPrefixError` struct. The build and the existing tests pass, and so do the new doc-tests. Clippy reports no warnings from the new code. I didn't add unit tests, and I didn't check the `"hello".chars()` agreement with `str::strip_prefix` separately.

- **`strip_prefix(prefix)`**: it takes `self` by value and returns `Result<Self, StripPrefixError<…>>`. It needs `Self::Item: PartialEq<PrefixItem>`, and an empty prefix returns the whole iterator.
- **`strip_prefix_by(prefix, eq)`**: the same, but compares with your `FnMut(&Self::Item, &PrefixItem) -> bool` closure, so the prefix can have a different item type. `strip_prefix` just calls it with `==`.
- **`StripPrefixError`**: it has the public fields `iterator`, `prefix` and `mismatch`, as you described, and is re-exported from the crate root. It lives in the new `src/strip_prefix_err.rs`.
- **Docs and changelog**: the doc-tests cover your three examples and a `strip_prefix_by` one with a different item type. I also added a line under "Added" in `CHANGELOG.md`.

I left `StripPrefixError` without `Display` or `Error` impls, since the error carries the iterators and can't be shown meaningfully. I haven't committed anything.

</details>

### claude, all: pass

Files: [src/lib.rs](../all/claude/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix_err.rs](../all/claude/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix_err.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..1cf8e6b 100644
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
+    /// Returns the iterator advanced past the prefix. If the items differ or the iterator
+    /// ends early, returns a [`StripPrefixError`] holding what was consumed.
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
+        self.strip_prefix_by(prefix, |a, b| a == b)
+    }
+
+    /// Like [`strip_prefix`](Itertools::strip_prefix), comparing items with `eq`.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = "hello".chars().strip_prefix_by([b'h', b'e'], |&c, &b| c == b as char);
+    /// assert_eq!(rest.unwrap().collect::<String>(), "llo");
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
+        while let Some(expected) = prefix.next() {
+            match self.next() {
+                Some(item) if eq(&item, &expected) => {}
+                found => {
+                    return Err(StripPrefixError {
+                        iterator: self,
+                        prefix,
+                        mismatch: (found, expected),
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
index 0000000..a57f9d6
--- /dev/null
+++ b/src/strip_prefix_err.rs
@@ -0,0 +1,18 @@
+#[cfg(doc)]
+use crate::Itertools;
+
+/// Value returned for the error case of [`Itertools::strip_prefix`] and
+/// [`Itertools::strip_prefix_by`].
+#[derive(Clone, Debug)]
+pub struct StripPrefixError<I, P>
+where
+    I: Iterator,
+    P: Iterator,
+{
+    /// The original iterator, stopped right after the item that did not match.
+    pub iterator: I,
+    /// The rest of the prefix iterator, after the prefix item that did not match.
+    pub prefix: P,
+    /// The iterator's item (`None` if it ran out) and the prefix item it was compared with.
+    pub mismatch: (Option<I::Item>, P::Item),
+}
```

</details>

<details><summary>reply</summary>

Done. I added `strip_prefix` and `strip_prefix_by` to `Itertools`, and the new public `StripPrefixError` is in `src/strip_prefix_err.rs`. Doc tests pass and the `no_std` build works. I didn't run the full test suite or write extra tests, and I didn't add a CHANGELOG entry. Clippy's 4 warnings are all in other code (`lib.rs` lines 2971 and 3004, `adaptors/mod.rs`, `multipeek_impl.rs`), none in the new code.

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

Files: [CHANGELOG.md](../muffle/codex/rust-feat-itertools-strip-prefix-1/files/CHANGELOG.md), [src/lib.rs](../muffle/codex/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix.rs](../muffle/codex/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix.rs), [tests/test_core.rs](../muffle/codex/rust-feat-itertools-strip-prefix-1/files/tests/test_core.rs)

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
index d4b17a6..d7db18d 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -140,6 +140,7 @@ pub mod structs {
     pub use crate::repeatn::RepeatN;
     #[allow(deprecated)]
     pub use crate::sources::{Iterate, Unfold};
+    pub use crate::strip_prefix::StripPrefixError;
     pub use crate::take_while_inclusive::TakeWhileInclusive;
     #[cfg(feature = "use_alloc")]
     pub use crate::tee::Tee;
@@ -235,6 +236,7 @@ mod rciter_impl;
 mod repeatn;
 mod size_hint;
 mod sources;
+mod strip_prefix;
 mod take_while_inclusive;
 #[cfg(feature = "use_alloc")]
 mod tee;
@@ -2504,6 +2506,71 @@ pub trait Itertools: Iterator {
         self.any(|x| x.borrow() == query)
     }
 
+    /// Remove a matching prefix and return the remaining iterator.
+    ///
+    /// An empty prefix always matches without advancing `self`. On failure,
+    /// the error contains both remaining iterators and the mismatching items.
+    /// Matching items are consumed and are not included in the error.
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
+    /// Remove a prefix using `eq` to compare iterator items with prefix items.
+    ///
+    /// The comparator receives the iterator item first and the prefix item
+    /// second. It is called once per pair, stopping at the first mismatch.
+    /// If `self` runs out, the comparator is not called for that prefix item.
+    /// See [`strip_prefix`](Itertools::strip_prefix) for the error semantics.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = (1..5)
+    ///     .strip_prefix_by(["1", "2"], |item, prefix| item.to_string() == *prefix)
+    ///     .unwrap();
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
     /// Check whether all elements compare equal.
     ///
     /// Empty iterators are considered to have equal elements:
diff --git a/src/strip_prefix.rs b/src/strip_prefix.rs
new file mode 100644
index 0000000..8e6bf29
--- /dev/null
+++ b/src/strip_prefix.rs
@@ -0,0 +1,13 @@
+/// A prefix mismatch returned by [`Itertools::strip_prefix`](crate::Itertools::strip_prefix)
+/// or [`Itertools::strip_prefix_by`](crate::Itertools::strip_prefix_by).
+///
+/// Items that matched before the mismatch have been consumed.
+#[derive(Debug)]
+pub struct StripPrefixError<I: Iterator, P: Iterator> {
+    /// The original iterator, advanced past the mismatching item, if any.
+    pub iterator: I,
+    /// The prefix iterator, advanced past the mismatching prefix item.
+    pub prefix: P,
+    /// The mismatching items, with `None` if the original iterator ran out.
+    pub mismatch: (Option<I::Item>, P::Item),
+}
diff --git a/tests/test_core.rs b/tests/test_core.rs
index adaa06e..10a4ae9 100644
--- a/tests/test_core.rs
+++ b/tests/test_core.rs
@@ -398,3 +398,90 @@ fn collect_array() {
     let iter = v.iter().cloned();
     assert_eq!(iter.collect_array::<2>(), None);
 }
+
+#[test]
+fn strip_prefix() {
+    it::assert_equal((1..6).strip_prefix([1, 2]).unwrap(), 3..6);
+    it::assert_equal((1..3).strip_prefix([1, 2]).unwrap(), iter::empty());
+    it::assert_equal((1..3).strip_prefix([]).unwrap(), 1..3);
+    it::assert_equal(iter::empty::<i32>().strip_prefix([]).unwrap(), []);
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
+}
+
+#[test]
+fn strip_prefix_chars() {
+    for text in ["", "hello", "héllo", "🦀rust"] {
+        for prefix in ["", "he", "hé", "hello", "hello!", "🦀", "x"] {
+            match (
+                text.chars().strip_prefix(prefix.chars()),
+                text.strip_prefix(prefix),
+            ) {
+                (Ok(rest), Some(expected)) => it::assert_equal(rest, expected.chars()),
+                (Err(_), None) => (),
+                _ => panic!("iterator and str prefix results differ"),
+            }
+        }
+    }
+}
+
+#[test]
+fn strip_prefix_by() {
+    let mut calls = 0;
+    let err = (1..6)
+        .strip_prefix_by([1_u8, 2, 9, 4], |actual, expected| {
+            calls += 1;
+            *actual == i32::from(*expected)
+        })
+        .unwrap_err();
+    assert_eq!(calls, 3);
+    assert_eq!(err.mismatch, (Some(3), 9));
+    it::assert_equal(err.iterator, [4, 5]);
+    it::assert_equal(err.prefix, [4]);
+
+    let mut calls = 0;
+    let err = (1..2)
+        .strip_prefix_by([1, 2], |a, b| {
+            calls += 1;
+            a == b
+        })
+        .unwrap_err();
+    assert_eq!(calls, 1);
+    assert_eq!(err.mismatch, (None, 2));
+
+    let rest = (1..4)
+        .strip_prefix_by(["one", "two"], |a, b| {
+            matches!((a, *b), (1, "one") | (2, "two"))
+        })
+        .unwrap();
+    it::assert_equal(rest, [3]);
+
+    let rest = (1..4)
+        .strip_prefix_by([], |_: &i32, _: &()| panic!("empty prefix"))
+        .unwrap();
+    it::assert_equal(rest, 1..4);
+}
+
+#[test]
+fn strip_prefix_stops_at_first_none() {
+    // Use a non-fused iterator that resumes after returning None.
+    let mut items = IntoIterator::into_iter([Some(1), None, Some(3)]);
+    let source = iter::from_fn(move || items.next().unwrap_or(None));
+    let mut err = source.strip_prefix([1, 2, 3]).err().unwrap();
+    assert_eq!(err.mismatch, (None, 2));
+    assert_eq!(err.iterator.next(), Some(3));
+    it::assert_equal(err.prefix, [3]);
+}
```

</details>

<details><summary>reply</summary>

I’ll check the crate’s API conventions, add both methods and the error type, then run the relevant tests.

Both methods and the public error type are in place. The tests cover the returned iterator positions, different prefix item types, comparator calls, and agreement with `str::strip_prefix`. I’m also checking that an iterator which resumes after `None` is returned without further polling.

Added `Itertools::strip_prefix`, `strip_prefix_by`, and public `StripPrefixError` with the requested fields and consumption behavior. Includes documentation, examples, and edge-case tests.

Validation passed: all-target tests, core tests without default features, new doctests, and documentation build.

Clippy reports four existing `question_mark` warnings in unrelated code.

</details>

### codex, hush: pass

Files: [src/lib.rs](../hush/codex/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix_err.rs](../hush/codex/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix_err.rs), [tests/test_core.rs](../hush/codex/rust-feat-itertools-strip-prefix-1/files/tests/test_core.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..40ea120 100644
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
@@ -455,6 +457,71 @@ macro_rules! chain {
 ///   [`.next_tuple()`](Itertools::next_tuple) is an example and the first regular
 ///   method in the list.
 pub trait Itertools: Iterator {
+    /// Removes a matching prefix and returns the remaining iterator.
+    ///
+    /// An empty prefix leaves the iterator unchanged. On failure, the error
+    /// contains both remaining iterators and the items at the first mismatch.
+    /// Matching items before the mismatch are consumed.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = (1..6).strip_prefix([1, 2]).unwrap();
+    /// assert_eq!(rest.collect_vec(), [3, 4, 5]);
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
+    /// Removes a prefix using `eq` to compare corresponding items.
+    ///
+    /// Stops at the first mismatch or exhausted input, returning both remaining
+    /// iterators and the mismatching items in [`StripPrefixError`]. The prefix
+    /// item is consumed even when the input is exhausted. `eq` is called only
+    /// when both iterators yield an item. An empty prefix consumes no input.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = "Hello!".chars()
+    ///     .strip_prefix_by(["h", "e"], |ch, text| ch.to_string().eq_ignore_ascii_case(text))
+    ///     .unwrap();
+    /// assert_eq!(rest.collect::<String>(), "llo!");
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
+            let item = self.next();
+            if !item.as_ref().map_or(false, |item| eq(item, &expected)) {
+                return Err(StripPrefixError {
+                    iterator: self,
+                    prefix,
+                    mismatch: (item, expected),
+                });
+            }
+        }
+        Ok(self)
+    }
+
     // adaptors
 
     /// Alternate elements from two iterators until both have run out.
diff --git a/src/strip_prefix_err.rs b/src/strip_prefix_err.rs
new file mode 100644
index 0000000..de7320d
--- /dev/null
+++ b/src/strip_prefix_err.rs
@@ -0,0 +1,14 @@
+/// Error returned by [`Itertools::strip_prefix`](crate::Itertools::strip_prefix)
+/// and [`Itertools::strip_prefix_by`](crate::Itertools::strip_prefix_by).
+///
+/// Matching items before the mismatch have been consumed from both iterators.
+#[derive(Debug, Clone)]
+pub struct StripPrefixError<I: Iterator, P: Iterator> {
+    /// The input iterator, positioned after the mismatching item, if any.
+    pub iterator: I,
+    /// The prefix iterator, positioned after the mismatching prefix item.
+    pub prefix: P,
+    /// The mismatching input and prefix items. The input item is `None` if
+    /// the input iterator returned `None` before the prefix was consumed.
+    pub mismatch: (Option<I::Item>, P::Item),
+}
diff --git a/tests/test_core.rs b/tests/test_core.rs
index adaa06e..e12b10b 100644
--- a/tests/test_core.rs
+++ b/tests/test_core.rs
@@ -398,3 +398,69 @@ fn collect_array() {
     let iter = v.iter().cloned();
     assert_eq!(iter.collect_array::<2>(), None);
 }
+
+#[test]
+fn strip_prefix() {
+    it::assert_equal((1..6).strip_prefix([1, 2]).unwrap(), 3..6);
+    it::assert_equal((1..3).strip_prefix([]).unwrap(), 1..3);
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
+    it::assert_equal(err.iterator, iter::empty());
+
+    let err = (1..3).strip_prefix([9, 2]).unwrap_err();
+    assert_eq!(err.mismatch, (Some(1), 9));
+    it::assert_equal(err.prefix, [2]);
+    it::assert_equal(err.iterator, [2]);
+
+    for text in ["", "h", "hello", "héllo"] {
+        for prefix in ["", "h", "he", "hello", "hello!", "hé"] {
+            match (
+                text.chars().strip_prefix(prefix.chars()),
+                text.strip_prefix(prefix),
+            ) {
+                (Ok(rest), Some(expected)) => it::assert_equal(rest, expected.chars()),
+                (Err(_), None) => {}
+                _ => panic!("iterator and string prefix results differ"),
+            }
+        }
+    }
+}
+
+#[test]
+fn strip_prefix_by() {
+    let mut calls = 0;
+    let err = (1..6)
+        .strip_prefix_by(['1', '2', '9', '4'], |item, expected| {
+            calls += 1;
+            *item == *expected as i32 - '0' as i32
+        })
+        .unwrap_err();
+    assert_eq!(calls, 3);
+    assert_eq!(err.mismatch, (Some(3), '9'));
+    it::assert_equal(err.iterator, [4, 5]);
+    it::assert_equal(err.prefix, ['4']);
+
+    assert!(iter::empty::<i32>()
+        .strip_prefix_by([1], |_, _| panic!())
+        .is_err());
+    assert!((1..3)
+        .strip_prefix_by([], |_: &i32, _: &i32| panic!())
+        .is_ok());
+
+    // Exhaustion must preserve the state of a non-fused input iterator.
+    let mut items = IntoIterator::into_iter([Some(1), None, Some(3)]);
+    let input = iter::from_fn(|| items.next().flatten());
+    let err = input.strip_prefix([1, 2, 4]).err().unwrap();
+    assert_eq!(err.mismatch, (None, 2));
+    it::assert_equal(err.iterator, [3]);
+    it::assert_equal(err.prefix, [4]);
+}
```

</details>

<details><summary>reply</summary>

Adding both methods, public error type, and tests; checking repository conventions first.


Done.
Added both methods, public `StripPrefixError`, docs, tests. Core tests pass with default features and no default features; doctests and formatting pass.

</details>

### codex, sloth: pass

Files: [CHANGELOG.md](../sloth/codex/rust-feat-itertools-strip-prefix-1/files/CHANGELOG.md), [src/lib.rs](../sloth/codex/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix_error.rs](../sloth/codex/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix_error.rs)

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
index d4b17a6..6c6ca56 100644
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
@@ -2504,6 +2506,82 @@ pub trait Itertools: Iterator {
         self.any(|x| x.borrow() == query)
     }
 
+    /// Remove a matching prefix and return the remaining iterator.
+    ///
+    /// An empty prefix returns the iterator unchanged. On the first mismatch,
+    /// returns a [`StripPrefixError`] containing both remaining iterators and
+    /// the mismatching items. If this iterator runs out first, its mismatching
+    /// item is `None`. Neither iterator is advanced beyond the mismatch.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = (1..6).strip_prefix([1, 2]).unwrap();
+    /// assert_eq!(rest.collect_vec(), vec![3, 4, 5]);
+    /// assert_eq!((1..3).strip_prefix([]).unwrap().collect_vec(), vec![1, 2]);
+    ///
+    /// let err = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
+    /// assert_eq!(err.mismatch, (Some(3), 9));
+    /// assert_eq!(err.prefix.collect_vec(), vec![4]);
+    /// assert_eq!(err.iterator.collect_vec(), vec![4, 5]);
+    ///
+    /// let err = (1..3).strip_prefix([1, 2, 3]).unwrap_err();
+    /// assert_eq!(err.mismatch, (None, 3));
+    /// assert_eq!(err.iterator.collect_vec(), vec![]);
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
+    /// Remove a prefix whose items match according to `eq`.
+    ///
+    /// The comparison receives a reference to this iterator's item followed by
+    /// a reference to the prefix item. It is called once for each pair until
+    /// the first mismatch, and is not called if this iterator runs out first.
+    /// An empty prefix returns the iterator unchanged. On failure, the returned
+    /// [`StripPrefixError`] contains the remaining iterators and mismatching
+    /// items, as in [`strip_prefix`](Itertools::strip_prefix).
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = vec!["one", "two", "three"].into_iter()
+    ///     .strip_prefix_by([3, 3], |word, length| word.len() == *length)
+    ///     .unwrap();
+    /// assert_eq!(rest.collect_vec(), vec!["three"]);
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
index 0000000..40555c4
--- /dev/null
+++ b/src/strip_prefix_error.rs
@@ -0,0 +1,11 @@
+/// The first mismatch returned by [`Itertools::strip_prefix`](crate::Itertools::strip_prefix)
+/// or [`Itertools::strip_prefix_by`](crate::Itertools::strip_prefix_by).
+#[derive(Debug)]
+pub struct StripPrefixError<I: Iterator, P: Iterator> {
+    /// The original iterator, advanced past the mismatching item, if any.
+    pub iterator: I,
+    /// The prefix iterator, advanced past the mismatching prefix item.
+    pub prefix: P,
+    /// The mismatching items, with `None` if the original iterator ran out first.
+    pub mismatch: (Option<I::Item>, P::Item),
+}
```

</details>

<details><summary>reply</summary>

I’ll check the trait and public export conventions, then add both methods and the error type. I’ll also check the feature gates and run the existing tests.

This needs changes to `Itertools`, a new error-type module, the public exports, and the changelog. The implementation can work without allocation or new dependencies. I’ll document the iterator positions on failure, including exhaustion; existing callers and configuration need no changes.

Both methods are implemented, along with the public error type and examples. Builds pass with default features, without default features, and with allocation only. A doc example hit Rust 2018’s array `.into_iter()` behavior; I corrected it and am rerunning the tests.

Added both `Itertools` methods and public `StripPrefixError` with the requested fields and consumption behavior. Included documentation examples and a changelog entry.

Validation: all 650 tests pass; formatting, documentation, and feature-variant builds pass. Clippy reports four existing warnings in unrelated code.

</details>

### codex, all: pass

Files: [src/lib.rs](../all/codex/rust-feat-itertools-strip-prefix-1/files/src/lib.rs), [src/strip_prefix.rs](../all/codex/rust-feat-itertools-strip-prefix-1/files/src/strip_prefix.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/lib.rs b/src/lib.rs
index d4b17a6..a8789be 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -140,6 +140,7 @@ pub mod structs {
     pub use crate::repeatn::RepeatN;
     #[allow(deprecated)]
     pub use crate::sources::{Iterate, Unfold};
+    pub use crate::strip_prefix::StripPrefixError;
     pub use crate::take_while_inclusive::TakeWhileInclusive;
     #[cfg(feature = "use_alloc")]
     pub use crate::tee::Tee;
@@ -235,6 +236,7 @@ mod rciter_impl;
 mod repeatn;
 mod size_hint;
 mod sources;
+mod strip_prefix;
 mod take_while_inclusive;
 #[cfg(feature = "use_alloc")]
 mod tee;
@@ -1774,6 +1776,67 @@ pub trait Itertools: Iterator {
         unique_impl::unique_by_with_hasher(self, f, hash_builder)
     }
 
+    /// Remove the items of `prefix` from the start of this iterator.
+    ///
+    /// Return the remaining iterator on success, or a [`StripPrefixError`]
+    /// containing both iterators and the mismatching items on failure.
+    /// An empty prefix leaves this iterator untouched.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = (1..6).strip_prefix([1, 2]).unwrap();
+    /// assert_eq!(rest.collect_vec(), vec![3, 4, 5]);
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
+    /// Remove the items of `prefix` from the start of this iterator using `eq`.
+    ///
+    /// The comparison receives the iterator item first and the prefix item second.
+    /// Return the remaining iterator on success. On failure, both iterators are
+    /// advanced past the mismatching items and returned in [`StripPrefixError`].
+    /// If this iterator ends first, the mismatching iterator item is `None`.
+    /// An empty prefix leaves this iterator untouched and never calls `eq`.
+    ///
+    /// ```
+    /// use itertools::Itertools;
+    ///
+    /// let rest = vec!["one", "two", "three"].into_iter()
+    ///     .strip_prefix_by([3, 3], |word, len| word.len() == *len)
+    ///     .unwrap();
+    /// assert_eq!(rest.collect_vec(), vec!["three"]);
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
+            let item = self.next();
+            if !item.as_ref().map_or(false, |item| eq(item, &expected)) {
+                return Err(StripPrefixError {
+                    iterator: self,
+                    prefix,
+                    mismatch: (item, expected),
+                });
+            }
+        }
+        Ok(self)
+    }
+
     /// Return an iterator adaptor that borrows from this iterator and
     /// takes items while the closure `accept` returns `true`.
     ///
diff --git a/src/strip_prefix.rs b/src/strip_prefix.rs
new file mode 100644
index 0000000..18224d7
--- /dev/null
+++ b/src/strip_prefix.rs
@@ -0,0 +1,11 @@
+/// A mismatch returned by [`Itertools::strip_prefix`](crate::Itertools::strip_prefix)
+/// or [`Itertools::strip_prefix_by`](crate::Itertools::strip_prefix_by).
+#[derive(Debug)]
+pub struct StripPrefixError<I: Iterator, P: Iterator> {
+    /// The original iterator, advanced past the mismatching item, if any.
+    pub iterator: I,
+    /// The prefix iterator, advanced past the mismatching prefix item.
+    pub prefix: P,
+    /// The mismatching items, with `None` if the original iterator ended first.
+    pub mismatch: (Option<I::Item>, P::Item),
+}
```

</details>

<details><summary>reply</summary>

Adding both methods and public error; checking exports, iterator bounds, and existing tests.


Done. Added both methods and public `StripPrefixError`.
Build, formatting, 650 tests pass; no-default-features check passes, tests fail on feature-dependent code.

</details>
