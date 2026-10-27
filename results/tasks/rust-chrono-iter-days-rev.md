# rust-chrono-iter-days-rev

Source: https://github.com/chronotope/chrono/pull/1809

## Prompt

> The iterator returned by `NaiveDate::iter_days` behaves unexpectedly when iterated in reverse. Consider:
> 
> ```rust
> let start = chrono::NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
> 
> let mut next_seven_rev1: Vec<_> = start.iter_days().take(7).collect();
> next_seven_rev1.reverse();
> 
> let next_seven_rev2: Vec<_> = start.iter_days().take(7).rev().collect();
> 
> assert_eq!(next_seven_rev1, next_seven_rev2);
> ```
> 
> I would expect the assertion to pass, but it does not:
> 
> ```
> assertion `left == right` failed
>   left: [2025-10-16, 2025-10-15, 2025-10-14, 2025-10-13, 2025-10-12, 2025-10-11, 2025-10-10]
>  right: [-258092-07-28]
> ```
> 
> `iter_weeks` seems to have the same problem. As far as I can tell, `start.iter_days().len()` reports the number of days until `NaiveDate::MAX`, but `start.iter_days().next_back()` is not `NaiveDate::MAX`. Per the `DoubleEndedIterator` docs, both ends should work on the same range and stop when they meet, so taking a window of these iterators and reversing it should give the same dates as going forward, just in reverse order.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [src/naive/date/mod.rs](../../tasks/rust-chrono-iter-days-rev/upstream/src/naive/date/mod.rs), [src/naive/date/tests.rs](../../tasks/rust-chrono-iter-days-rev/upstream/src/naive/date/tests.rs)

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..0dd0408 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1341,14 +1341,16 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 1).unwrap().iter_days().rev().take(4) {
+    /// // The iterator is double-ended: reversing a bounded range yields the same
+    /// // dates in reverse order.
+    /// for d in NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_days().take(4).rev() {
     ///     count -= 1;
     ///     assert_eq!(d, expected[count]);
     /// }
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator { value: *self, end: NaiveDate::MAX }
     }
 
     /// Returns an iterator that steps by weeks across all representable dates.
@@ -1372,14 +1374,24 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
+    /// // The iterator is double-ended: reversing a bounded range yields the same
+    /// // dates in reverse order.
+    /// for d in NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_weeks().take(4).rev() {
     ///     count -= 1;
     ///     assert_eq!(d, expected[count]);
     /// }
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        // Align the exclusive upper bound to the weekly grid starting at `*self`, so
+        // that `next_back` yields the same weeks as `next`, only in reverse order.
+        let weeks = NaiveDate::MAX.signed_duration_since(*self).num_weeks();
+        // `weeks * 7` days is at most `NaiveDate::MAX - *self`, so this never overflows.
+        let end = match self.checked_add_days(Days::new((weeks * 7) as u64)) {
+            Some(end) => end,
+            None => *self,
+        };
+        NaiveDateWeeksIterator { value: *self, end }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2213,21 +2225,26 @@ impl From<NaiveDateTime> for NaiveDate {
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
     value: NaiveDate,
+    // Exclusive upper bound. The iterator yields the half-open range `[value, end)`;
+    // `next` advances `value` from the front and `next_back` lowers `end` from the back.
+    end: NaiveDate,
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
+        if self.value >= self.end {
+            return None;
+        }
         let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
+        // `succ_opt()` can't return `None` because `current < end <= NaiveDate::MAX`.
         self.value = current.succ_opt()?;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
+        let exact_size = self.end.signed_duration_since(self.value).num_days();
         (exact_size as usize, Some(exact_size as usize))
     }
 }
@@ -2236,10 +2253,25 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
-        Some(current)
+        if self.value >= self.end {
+            return None;
+        }
+        // `pred_opt()` can't return `None` because `end > value >= NaiveDate::MIN`.
+        self.end = self.end.pred_opt()?;
+        Some(self.end)
+    }
+
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        // Skipping from the back in O(1) keeps `take(k).rev()` cheap despite the
+        // iterator spanning up to `NaiveDate::MAX`.
+        if n >= self.len() {
+            self.end = self.value;
+            return None;
+        }
+        // The `n`-th element from the back is `end - (n + 1)` days, which stays
+        // within `[value, end)` and so can't underflow past `NaiveDate::MIN`.
+        self.end = self.end.checked_sub_days(Days::new(n as u64 + 1))?;
+        Some(self.end)
     }
 }
 
@@ -2249,19 +2281,27 @@ impl FusedIterator for NaiveDateDaysIterator {}
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
     value: NaiveDate,
+    // Exclusive upper bound, aligned to the weekly grid starting at `value`. The
+    // iterator yields `[value, end)` in weekly steps; `next` advances `value` from
+    // the front and `next_back` lowers `end` from the back.
+    end: NaiveDate,
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
+        if self.value >= self.end {
+            return None;
+        }
         let current = self.value;
+        // Can't overflow because `current + 7 days <= end <= NaiveDate::MAX`.
         self.value = current.checked_add_days(Days::new(7))?;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
+        let exact_size = self.end.signed_duration_since(self.value).num_weeks();
         (exact_size as usize, Some(exact_size as usize))
     }
 }
@@ -2270,9 +2310,25 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
-        Some(current)
+        if self.value >= self.end {
+            return None;
+        }
+        // Can't underflow because `end - 7 days >= value >= NaiveDate::MIN`.
+        self.end = self.end.checked_sub_days(Days::new(7))?;
+        Some(self.end)
+    }
+
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        // Skipping from the back in O(1) keeps `take(k).rev()` cheap despite the
+        // iterator spanning up to `NaiveDate::MAX`.
+        if n >= self.len() {
+            self.end = self.value;
+            return None;
+        }
+        // The `n`-th element from the back is `end - 7 * (n + 1)` days, which stays
+        // within `[value, end)` and so can't underflow past `NaiveDate::MIN`.
+        self.end = self.end.checked_sub_days(Days::new((n as u64 + 1) * 7))?;
+        Some(self.end)
     }
 }
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | **FAIL** | +111/-35 | 0 | 6,490 | $0.151 |
| claude | muffle | **FAIL** | +103/-33 | 0 | 6,615 | $0.170 |
| claude | hush | pass | +54/-31 | 0 | 5,700 | $0.143 |
| claude | sloth | **FAIL** | +72/-29 | 0 | 6,664 | $0.157 |
| claude | all | pass | +55/-27 | 0 | 5,508 | $0.136 |
| codex | base | **FAIL** | +115/-38 | 0 | 2,479 | - |
| codex | muffle | **FAIL** | +117/-37 | 0 | 2,758 | - |
| codex | hush | **FAIL** | +80/-35 | 0 | 2,388 | - |
| codex | sloth | pass | +98/-19 | 0 | 2,710 | - |
| codex | all | pass | +69/-19 | 0 | 1,941 | - |

### claude, base: FAIL

Files: [src/naive/date/mod.rs](../base/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../base/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..e2e0c6b 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1341,14 +1341,14 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 1).unwrap().iter_days().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// // Both ends of the iterator cover the same range, ending at `NaiveDate::MAX`.
+    /// let mut iter = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_days();
+    /// assert_eq!(iter.next_back(), Some(NaiveDate::MAX));
+    /// assert_eq!(iter.next(), Some(expected[0]));
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator::new(*self)
     }
 
     /// Returns an iterator that steps by weeks across all representable dates.
@@ -1372,14 +1372,15 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// // Both ends of the iterator cover the same range.
+    /// let mut iter = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_weeks();
+    /// let last = iter.next_back().unwrap();
+    /// assert!(last > expected[3] && last <= NaiveDate::MAX);
+    /// assert_eq!(iter.next(), Some(expected[0]));
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        NaiveDateWeeksIterator::new(*self)
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2210,25 +2211,43 @@ impl From<NaiveDateTime> for NaiveDate {
 }
 
 /// Iterator over `NaiveDate` with a step size of one day.
+///
+/// Yields every date from the starting date up to and including [`NaiveDate::MAX`]. Iterating from
+/// the back starts at `NaiveDate::MAX`.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
+    /// Next date to yield from the front; only meaningful while `remaining > 0`.
     value: NaiveDate,
+    /// Number of dates not yet yielded.
+    remaining: u64,
+}
+
+impl NaiveDateDaysIterator {
+    const fn new(start: NaiveDate) -> Self {
+        let days = NaiveDate::MAX.signed_duration_since(start).num_days();
+        NaiveDateDaysIterator { value: start, remaining: days as u64 + 1 }
+    }
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
+        if self.remaining == 0 {
+            return None;
+        }
         let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
-        self.value = current.succ_opt()?;
+        self.remaining -= 1;
+        if self.remaining > 0 {
+            // Can't fail: there are more dates left, so `current` is < NaiveDate::MAX.
+            self.value = current.succ_opt()?;
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        let exact_size = usize::try_from(self.remaining).unwrap_or(usize::MAX);
+        (exact_size, Some(exact_size))
     }
 }
 
@@ -2236,33 +2255,54 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
-        Some(current)
+        if self.remaining == 0 {
+            return None;
+        }
+        self.remaining -= 1;
+        self.value.checked_add_days(Days::new(self.remaining))
     }
 }
 
 impl FusedIterator for NaiveDateDaysIterator {}
 
 /// Iterator over `NaiveDate` with a step size of one week.
+///
+/// Yields the starting date and every date a whole number of weeks after it that is not past
+/// [`NaiveDate::MAX`]. Iterating from the back starts at the last of those dates.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
+    /// Next date to yield from the front; only meaningful while `remaining > 0`.
     value: NaiveDate,
+    /// Number of dates not yet yielded.
+    remaining: u64,
+}
+
+impl NaiveDateWeeksIterator {
+    const fn new(start: NaiveDate) -> Self {
+        let days = NaiveDate::MAX.signed_duration_since(start).num_days();
+        NaiveDateWeeksIterator { value: start, remaining: days as u64 / 7 + 1 }
+    }
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
+        if self.remaining == 0 {
+            return None;
+        }
         let current = self.value;
-        self.value = current.checked_add_days(Days::new(7))?;
+        self.remaining -= 1;
+        if self.remaining > 0 {
+            // Can't fail: the last date we will yield is representable.
+            self.value = current.checked_add_days(Days::new(7))?;
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        let exact_size = usize::try_from(self.remaining).unwrap_or(usize::MAX);
+        (exact_size, Some(exact_size))
     }
 }
 
@@ -2270,9 +2310,11 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
-        Some(current)
+        if self.remaining == 0 {
+            return None;
+        }
+        self.remaining -= 1;
+        self.value.checked_add_days(Days::new(self.remaining * 7))
     }
 }
 
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..cd12a5d 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -730,20 +730,54 @@ fn test_date_parse_from_str() {
 
 #[test]
 fn test_day_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
-        2
-    );
+    let d = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap();
+    assert_eq!(d.iter_days().take(4).count(), 3);
+    assert_eq!(d.iter_days().len(), 3);
+    assert_eq!(d.iter_days().last(), Some(NaiveDate::MAX));
+    assert_eq!(d.iter_days().next_back(), Some(NaiveDate::MAX));
+    assert_eq!(NaiveDate::MAX.iter_days().collect::<Vec<_>>(), [NaiveDate::MAX]);
+}
+
+#[test]
+fn test_day_iterator_rev() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut fwd: Vec<_> = start.iter_days().take(7).collect();
+    fwd.reverse();
+    let rev: Vec<_> = start.iter_days().take(7).rev().collect();
+    assert_eq!(fwd, rev);
+
+    // Both ends meet in the middle.
+    let mut it = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 28).unwrap().iter_days();
+    assert_eq!(it.next(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 28));
+    assert_eq!(it.next_back(), Some(NaiveDate::MAX));
+    assert_eq!(it.next_back(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 30));
+    assert_eq!(it.next(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29));
+    assert_eq!(it.next(), None);
+    assert_eq!(it.next_back(), None);
 }
 
 #[test]
 fn test_week_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
-    );
+    let d = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap();
+    assert_eq!(d.iter_weeks().take(4).count(), 3);
+    assert_eq!(d.iter_weeks().len(), 3);
+    assert_eq!(d.iter_weeks().last(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 26));
+    assert_eq!(d.iter_weeks().next_back(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 26));
+}
+
+#[test]
+fn test_week_iterator_rev() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut fwd: Vec<_> = start.iter_weeks().take(7).collect();
+    fwd.reverse();
+    let rev: Vec<_> = start.iter_weeks().take(7).rev().collect();
+    assert_eq!(fwd, rev);
+
+    let mut it = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks();
+    assert_eq!(it.next_back(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 26));
+    assert_eq!(it.next(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12));
+    assert_eq!(it.next_back(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 19));
+    assert_eq!(it.next(), None);
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

Now update doc examples and tests to the new semantics.

`iter_days` and `iter_weeks` now work from both ends over one range, so your example passes. The `naive::date` unit tests, the two iterator doc tests and `cargo fmt --check` all pass. I didn't run the full test suite or clippy.

**Cause:** each iterator only stored its current date. `next()` stepped forward and `next_back()` stepped backward from the same date, so `.rev()` walked towards `NaiveDate::MIN` instead of back from the far end. That is why `.take(7).rev()` gave a different result than reversing `.take(7)`.

**Fix** (`src/naive/date/mod.rs`): each iterator now also stores how many items are left.
- **Range and ends:** the range runs from the start date to `NaiveDate::MAX` inclusive. `next_back()` yields `NaiveDate::MAX` (or the last date reachable in whole weeks, for `iter_weeks`), and the two ends stop when they meet.
- **`len()`:** it now matches the number of items actually yielded.

**Behaviour changes:**
- `iter_days` now includes `NaiveDate::MAX`, which the old forward iteration never produced. `iter_weeks` likewise now includes its last reachable date. The old limit tests counted 2 items near the end; they now count 3.
- `.rev()` on a fresh iterator now starts at the far end instead of walking backwards from the start date. The doc examples relied on the old behaviour, so I rewrote them.

I replaced the old limit tests and added new ones in `src/naive/date/tests.rs`, including your reverse-window case and the two ends meeting in the middle.

</details>

### claude, muffle: FAIL

Files: [src/naive/date/mod.rs](../muffle/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../muffle/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..7d8dbd6 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1341,14 +1341,14 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 1).unwrap().iter_days().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// // Both ends iterate over the same range, which ends at `NaiveDate::MAX`.
+    /// let mut days = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_days();
+    /// assert_eq!(days.next_back(), Some(NaiveDate::MAX));
+    /// assert_eq!(days.next(), Some(expected[0]));
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator::new(*self)
     }
 
     /// Returns an iterator that steps by weeks across all representable dates.
@@ -1372,14 +1372,15 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// // Both ends iterate over the same range.
+    /// let mut weeks = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_weeks();
+    /// assert_eq!(weeks.len(), weeks.clone().count());
+    /// assert_eq!(weeks.next(), Some(expected[0]));
+    /// assert!(weeks.next_back().unwrap() > expected[3]);
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        NaiveDateWeeksIterator::new(*self)
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2210,25 +2211,42 @@ impl From<NaiveDateTime> for NaiveDate {
 }
 
 /// Iterator over `NaiveDate` with a step size of one day.
+///
+/// Iterates from the starting date up to and including [`NaiveDate::MAX`]. Both ends can be
+/// consumed, and the iterator is exhausted when they meet.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
+    /// The next date yielded from the front.
     value: NaiveDate,
+    /// The number of dates not yet yielded.
+    remaining: usize,
+}
+
+impl NaiveDateDaysIterator {
+    const fn new(start: NaiveDate) -> Self {
+        let remaining = (NaiveDate::MAX.num_days_from_ce() - start.num_days_from_ce()) as usize + 1;
+        NaiveDateDaysIterator { value: start, remaining }
+    }
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
+        if self.remaining == 0 {
+            return None;
+        }
         let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
-        self.value = current.succ_opt()?;
+        self.remaining -= 1;
+        if self.remaining > 0 {
+            // Another date remains, so `current` is < `NaiveDate::MAX`.
+            self.value = current.succ_opt()?;
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2236,33 +2254,54 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
-        Some(current)
+        if self.remaining == 0 {
+            return None;
+        }
+        self.remaining -= 1;
+        NaiveDate::from_num_days_from_ce_opt(self.value.num_days_from_ce() + self.remaining as i32)
     }
 }
 
 impl FusedIterator for NaiveDateDaysIterator {}
 
 /// Iterator over `NaiveDate` with a step size of one week.
+///
+/// Iterates from the starting date up to the last date at or before [`NaiveDate::MAX`] that is
+/// a whole number of weeks away. Both ends can be consumed, and the iterator is exhausted when
+/// they meet.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
+    /// The next date yielded from the front.
     value: NaiveDate,
+    /// The number of dates not yet yielded.
+    remaining: usize,
+}
+
+impl NaiveDateWeeksIterator {
+    const fn new(start: NaiveDate) -> Self {
+        let days = NaiveDate::MAX.num_days_from_ce() - start.num_days_from_ce();
+        NaiveDateWeeksIterator { value: start, remaining: (days / 7) as usize + 1 }
+    }
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
+        if self.remaining == 0 {
+            return None;
+        }
         let current = self.value;
-        self.value = current.checked_add_days(Days::new(7))?;
+        self.remaining -= 1;
+        if self.remaining > 0 {
+            // Another date remains, so adding a week can't overflow.
+            self.value = current.checked_add_days(Days::new(7))?;
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2270,9 +2309,13 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
-        Some(current)
+        if self.remaining == 0 {
+            return None;
+        }
+        self.remaining -= 1;
+        NaiveDate::from_num_days_from_ce_opt(
+            self.value.num_days_from_ce() + 7 * self.remaining as i32,
+        )
     }
 }
 
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..054bbf2 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -730,20 +730,47 @@ fn test_date_parse_from_str() {
 
 #[test]
 fn test_day_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
+    let end = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap();
+    assert_eq!(end.iter_days().take(4).count(), 3);
+    assert_eq!(end.iter_days().last(), Some(NaiveDate::MAX));
+    assert_eq!(NaiveDate::MAX.iter_days().collect::<Vec<_>>(), [NaiveDate::MAX]);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
-        2
+        NaiveDate::MIN.iter_days().len(),
+        (NaiveDate::MAX - NaiveDate::MIN).num_days() as usize + 1
     );
 }
 
 #[test]
 fn test_week_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
-    );
+    let end = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap();
+    assert_eq!(end.iter_weeks().take(4).count(), 3);
+    assert_eq!(end.iter_weeks().len(), 3);
+    assert_eq!(end.iter_weeks().last(), end.checked_add_days(Days::new(14)));
+}
+
+#[test]
+fn test_date_iterators_double_ended() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+
+    let mut fwd: Vec<_> = start.iter_days().take(7).collect();
+    fwd.reverse();
+    assert_eq!(fwd, start.iter_days().take(7).rev().collect::<Vec<_>>());
+
+    let mut fwd: Vec<_> = start.iter_weeks().take(7).collect();
+    fwd.reverse();
+    assert_eq!(fwd, start.iter_weeks().take(7).rev().collect::<Vec<_>>());
+
+    // The ends meet in the middle without overlap.
+    let mut it = NaiveDate::MAX.pred_opt().unwrap().iter_days();
+    assert_eq!(it.next_back(), Some(NaiveDate::MAX));
+    assert_eq!(it.next(), NaiveDate::MAX.pred_opt());
+    assert_eq!((it.next(), it.next_back()), (None, None));
+
+    let mut it = start.iter_weeks();
+    let n = it.len();
+    let last = it.next_back().unwrap();
+    assert_eq!(it.len(), n - 1);
+    assert!(last <= NaiveDate::MAX && last.checked_add_days(Days::new(7)).is_none());
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

Unit tests pass; checking which doctests failed, since the filter matched unrelated ones.

`iter_days` and `iter_weeks` are now double-ended, so your example passes and reversing a window gives the same dates as going forward. The new unit tests pass, and so do the `iter_days` and `iter_weeks` doctests. Three unrelated `checked_*_months` doctests fail, and they fail identically with my changes stashed.

**The cause:** each iterator held a single cursor. `next_back` walked backwards from the start date instead of working from the other end of the range, even though `len()` counted forward to `NaiveDate::MAX`.

**The fix:** both iterators now track the start date and how many dates remain. `next` and `next_back` each take from their own end and stop when they meet. `len()` and `size_hint` now agree with what the iterator yields. The changes are in `src/naive/date/mod.rs`.

**Behaviour changes:**
- `iter_days()` now includes `NaiveDate::MAX`, which it never yielded before. Without that, `next_back()` couldn't be `NaiveDate::MAX`, which is what you expected. Its `len()` is one larger as a result.
- `iter_weeks()` ends at the last date that is a whole number of weeks from the start and not past `MAX`.
- `.rev()` no longer walks backwards from the start date. It now starts from the far end of the range.
- I rewrote the `.rev()` examples in the `iter_days` and `iter_weeks` docs and the two `*_iterator_limit` tests, which relied on the old behaviour. For example, the day-limit test now expects 3 items from `MAX_YEAR-12-29`, not 2.
- I added `test_date_iterators_double_ended` in `src/naive/date/tests.rs`. It covers your reversed-window case for days and weeks, and the two ends meeting in the middle.

I didn't commit anything.

</details>

### claude, hush: pass

Files: [src/naive/date/mod.rs](../hush/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../hush/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..320841a 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1341,14 +1341,18 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 1).unwrap().iter_days().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// // Both ends share one range, so reverse a window with `rev` after `take`.
+    /// let start = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap();
+    /// let mut window: Vec<_> = start.iter_days().take(4).collect();
+    /// window.reverse();
+    /// assert_eq!(window, start.iter_days().take(4).rev().collect::<Vec<_>>());
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator {
+            value: *self,
+            remaining: NaiveDate::MAX.signed_duration_since(*self).num_days() as usize,
+        }
     }
 
     /// Returns an iterator that steps by weeks across all representable dates.
@@ -1372,14 +1376,17 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// let start = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap();
+    /// let mut window: Vec<_> = start.iter_weeks().take(4).collect();
+    /// window.reverse();
+    /// assert_eq!(window, start.iter_weeks().take(4).rev().collect::<Vec<_>>());
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        NaiveDateWeeksIterator {
+            value: *self,
+            remaining: NaiveDate::MAX.signed_duration_since(*self).num_weeks() as usize,
+        }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2210,25 +2217,30 @@ impl From<NaiveDateTime> for NaiveDate {
 }
 
 /// Iterator over `NaiveDate` with a step size of one day.
+///
+/// Both ends cover the range from the starting date up to (but excluding) `NaiveDate::MAX`.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
     value: NaiveDate,
+    remaining: usize,
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
+        if self.remaining == 0 {
+            return None;
+        }
         let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
+        self.remaining -= 1;
+        // This can't fail because `current` is < NaiveDate::MAX:
         self.value = current.succ_opt()?;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2236,33 +2248,41 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
-        Some(current)
+        if self.remaining == 0 {
+            return None;
+        }
+        self.remaining -= 1;
+        self.value.checked_add_days(Days::new(self.remaining as u64))
     }
 }
 
 impl FusedIterator for NaiveDateDaysIterator {}
 
 /// Iterator over `NaiveDate` with a step size of one week.
+///
+/// Both ends cover the same range: dates `start + 7k` for which `start + 7(k + 1)` is still
+/// representable.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
     value: NaiveDate,
+    remaining: usize,
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
+        if self.remaining == 0 {
+            return None;
+        }
         let current = self.value;
+        self.remaining -= 1;
         self.value = current.checked_add_days(Days::new(7))?;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2270,9 +2290,11 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
-        Some(current)
+        if self.remaining == 0 {
+            return None;
+        }
+        self.remaining -= 1;
+        self.value.checked_add_days(Days::new(7 * self.remaining as u64))
     }
 }
 
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..98f91c0 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -731,19 +731,20 @@ fn test_date_parse_from_str() {
 #[test]
 fn test_day_iterator_limit() {
     assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
-        2
-    );
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut fwd: Vec<_> = start.iter_days().take(7).collect();
+    fwd.reverse();
+    assert_eq!(fwd, start.iter_days().take(7).rev().collect::<Vec<_>>());
+    assert_eq!(start.iter_days().next_back(), NaiveDate::MAX.pred_opt());
 }
 
 #[test]
 fn test_week_iterator_limit() {
     assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
-    );
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut fwd: Vec<_> = start.iter_weeks().take(7).collect();
+    fwd.reverse();
+    assert_eq!(fwd, start.iter_weeks().take(7).rev().collect::<Vec<_>>());
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

Done. Both iterators now track a shared remaining count, so `next_back` ends the same range `next` walks and the two ends meet. The two iterator unit tests and the two doctests pass. I didn't run the full suite.

`.rev()` on its own now starts at the far end of the range, just below `NaiveDate::MAX`, instead of walking backwards from the start date. I rewrote the `iter_days` and `iter_weeks` doc examples and the limit tests to match. The range still excludes `NaiveDate::MAX`, as `next` always did, so `start.iter_days().next_back()` is `NaiveDate::MAX.pred_opt()`, not `MAX`.

</details>

### claude, sloth: FAIL

Files: [src/naive/date/mod.rs](../sloth/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../sloth/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..4bb19d0 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1341,14 +1341,14 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 1).unwrap().iter_days().rev().take(4) {
+    /// for d in NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_days().take(4).rev() {
     ///     count -= 1;
     ///     assert_eq!(d, expected[count]);
     /// }
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator { value: *self, remaining: self.days_until_max() + 1 }
     }
 
     /// Returns an iterator that steps by weeks across all representable dates.
@@ -1372,14 +1372,14 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
+    /// for d in NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_weeks().take(4).rev() {
     ///     count -= 1;
     ///     assert_eq!(d, expected[count]);
     /// }
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        NaiveDateWeeksIterator { value: *self, remaining: self.days_until_max() / 7 + 1 }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -1449,6 +1449,12 @@ impl NaiveDate {
         YearFlags((self.yof() & YEAR_FLAGS_MASK) as u8)
     }
 
+    /// Counts the days from this date up to `NaiveDate::MAX`.
+    #[inline]
+    const fn days_until_max(&self) -> usize {
+        (NaiveDate::MAX.num_days_from_ce() - self.num_days_from_ce()) as usize
+    }
+
     /// Counts the days in the proleptic Gregorian calendar, with January 1, Year 1 (CE) as day 1.
     // This duplicates `Datelike::num_days_from_ce()`, because trait methods can't be const yet.
     pub(crate) const fn num_days_from_ce(&self) -> i32 {
@@ -2210,25 +2216,32 @@ impl From<NaiveDateTime> for NaiveDate {
 }
 
 /// Iterator over `NaiveDate` with a step size of one day.
+///
+/// Iterates over the dates from the starting date up to and including `NaiveDate::MAX`, from
+/// either end.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
     value: NaiveDate,
+    remaining: usize,
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
+        if self.remaining == 0 {
+            return None;
+        }
         let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
-        self.value = current.succ_opt()?;
+        self.remaining -= 1;
+        if self.remaining > 0 {
+            self.value = current.succ_opt()?;
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2236,33 +2249,43 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
-        Some(current)
+        if self.remaining == 0 {
+            return None;
+        }
+        self.remaining -= 1;
+        self.value.add_days(self.remaining as i32)
     }
 }
 
 impl FusedIterator for NaiveDateDaysIterator {}
 
 /// Iterator over `NaiveDate` with a step size of one week.
+///
+/// Iterates over the dates from the starting date up to the last one not after `NaiveDate::MAX`,
+/// from either end.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
     value: NaiveDate,
+    remaining: usize,
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
+        if self.remaining == 0 {
+            return None;
+        }
         let current = self.value;
-        self.value = current.checked_add_days(Days::new(7))?;
+        self.remaining -= 1;
+        if self.remaining > 0 {
+            self.value = current.add_days(7)?;
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2270,9 +2293,11 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
-        Some(current)
+        if self.remaining == 0 {
+            return None;
+        }
+        self.remaining -= 1;
+        self.value.add_days(self.remaining as i32 * 7)
     }
 }
 
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..a39cd89 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -730,20 +730,38 @@ fn test_date_parse_from_str() {
 
 #[test]
 fn test_day_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
-        2
-    );
+    let last = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap();
+    assert_eq!(last.iter_days().take(4).count(), 3);
+    assert_eq!(last.iter_days().next_back(), Some(NaiveDate::MAX));
+    assert_eq!(last.iter_days().len(), 3);
+    assert_eq!(NaiveDate::MAX.iter_days().collect::<Vec<_>>(), [NaiveDate::MAX]);
 }
 
 #[test]
 fn test_week_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
-    );
+    let last = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap();
+    assert_eq!(last.iter_weeks().take(4).count(), 3);
+    assert_eq!(last.iter_weeks().next_back(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 26));
+    assert_eq!(last.iter_weeks().len(), 3);
+}
+
+#[test]
+fn test_iterator_double_ended() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+
+    let mut days: Vec<_> = start.iter_days().take(7).collect();
+    days.reverse();
+    assert_eq!(days, start.iter_days().take(7).rev().collect::<Vec<_>>());
+
+    let mut weeks: Vec<_> = start.iter_weeks().take(7).collect();
+    weeks.reverse();
+    assert_eq!(weeks, start.iter_weeks().take(7).rev().collect::<Vec<_>>());
+
+    let mut iter = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days();
+    assert_eq!(iter.next_back(), Some(NaiveDate::MAX));
+    assert_eq!(iter.next(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29));
+    assert_eq!(iter.next_back(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 30));
+    assert_eq!((iter.next(), iter.next_back()), (None, None));
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

Misplaced insertion (it split the doc comment); fix that.

`iter_days` and `iter_weeks` now work from both ends over the same range. The `naive::date` unit tests and the `iter_` doc-tests pass; I ran with `--features std,clock` because `--all-features` doesn't build here (rkyv's `size_16`/`size_32`/`size_64` features conflict). I didn't run the rest of the suite.

Each iterator now tracks how many items remain instead of just a cursor. That makes `len()` exact and lets `next_back()` return the true last item.

- **`iter_days`:** it covers `start..=NaiveDate::MAX`, so `next_back()` is `NaiveDate::MAX`. Your example now passes.
- **`iter_weeks`:** it covers `start, start+7, …` up to the last one not after `MAX`, and `next_back()` returns that last date.
- **`rev()` semantics:** `.rev()` on a fresh iterator used to walk backward from the start date. It now starts at the far end, which is what the `DoubleEndedIterator` contract requires. Use `.take(n).rev()` to walk the window backward.
- **`MAX` is yielded:** the old forward iteration silently dropped `MAX`, so `NaiveDate::MAX.iter_days()` now yields one item rather than none. `len()` is one higher than before.

I updated the two doc examples on `iter_days` and `iter_weeks` to use `.take(4).rev()`. I rewrote `test_day_iterator_limit` and `test_week_iterator_limit` to the new boundary counts. I also added `test_iterator_double_ended`, which covers your reverse-window case and the two ends meeting. The changes are in `src/naive/date/mod.rs` and `src/naive/date/tests.rs`, uncommitted.

</details>

### claude, all: pass

Files: [src/naive/date/mod.rs](../all/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../all/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..db35fb9 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1341,14 +1341,13 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 1).unwrap().iter_days().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// let mut rev: Vec<_> = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_days().take(4).rev().collect();
+    /// rev.reverse();
+    /// assert_eq!(rev, expected);
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator { value: *self, end: NaiveDate::MAX }
     }
 
     /// Returns an iterator that steps by weeks across all representable dates.
@@ -1372,14 +1371,17 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// let mut rev: Vec<_> = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_weeks().take(4).rev().collect();
+    /// rev.reverse();
+    /// assert_eq!(rev, expected);
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        let weeks = (NaiveDate::MAX.num_days_from_ce() - self.num_days_from_ce()) / 7;
+        match self.add_days(weeks * 7) {
+            Some(end) => NaiveDateWeeksIterator { value: *self, end },
+            None => unreachable!(),
+        }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2210,25 +2212,29 @@ impl From<NaiveDateTime> for NaiveDate {
 }
 
 /// Iterator over `NaiveDate` with a step size of one day.
+///
+/// Yields every date in `[start, NaiveDate::MAX)`; both ends iterate the same range.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
     value: NaiveDate,
+    end: NaiveDate,
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
+        if self.value >= self.end {
+            return None;
+        }
         let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
-        self.value = current.succ_opt()?;
+        self.value = current.add_days(1)?;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        let exact_size = self.end.signed_duration_since(self.value).num_days().max(0) as usize;
+        (exact_size, Some(exact_size))
     }
 }
 
@@ -2236,33 +2242,41 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
-        Some(current)
+        if self.value >= self.end {
+            return None;
+        }
+        self.end = self.end.add_days(-1)?;
+        Some(self.end)
     }
 }
 
 impl FusedIterator for NaiveDateDaysIterator {}
 
 /// Iterator over `NaiveDate` with a step size of one week.
+///
+/// Yields `start + 7k` while `start + 7(k + 1) <= NaiveDate::MAX`; both ends iterate the same
+/// range.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
     value: NaiveDate,
+    end: NaiveDate,
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
+        if self.value >= self.end {
+            return None;
+        }
         let current = self.value;
-        self.value = current.checked_add_days(Days::new(7))?;
+        self.value = current.add_days(7)?;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        let exact_size = self.end.signed_duration_since(self.value).num_weeks().max(0) as usize;
+        (exact_size, Some(exact_size))
     }
 }
 
@@ -2270,9 +2284,11 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
-        Some(current)
+        if self.value >= self.end {
+            return None;
+        }
+        self.end = self.end.add_days(-7)?;
+        Some(self.end)
     }
 }
 
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..ba02cb8 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -732,18 +732,30 @@ fn test_date_parse_from_str() {
 fn test_day_iterator_limit() {
     assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
+        NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().rev().take(4).count(),
         2
     );
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut forward: Vec<_> = start.iter_days().take(7).collect();
+    forward.reverse();
+    assert_eq!(forward, start.iter_days().take(7).rev().collect::<Vec<_>>());
+    assert_eq!(start.iter_days().next_back(), NaiveDate::MAX.pred_opt());
 }
 
 #[test]
 fn test_week_iterator_limit() {
     assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
+        NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().rev().take(4).count(),
         2
     );
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut forward: Vec<_> = start.iter_weeks().take(7).collect();
+    forward.reverse();
+    assert_eq!(forward, start.iter_weeks().take(7).rev().collect::<Vec<_>>());
+    let mut it = start.iter_weeks();
+    let len = it.len();
+    assert_eq!(it.next_back().unwrap(), start + Days::new(7 * (len as u64 - 1)));
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

Done. `iter_days` and `iter_weeks` now keep a front and an end, so both ends walk the same range and `.take(7).rev()` matches your forward-then-reverse result. Tests and doctests for both iterators pass; I did not run the full suite.

- **`NaiveDate::MAX` still not yielded:** forward iteration already stopped before it, and the existing limit test relies on that. `len()` is unchanged, and `next_back()` returns `MAX - 1` for `iter_days`. Including `MAX` is a small change, but it would alter `len()` and that test.
- **Changed `.rev()` behaviour:** `.rev()` now starts from the end of the range instead of walking backward from the start date. I rewrote the two doctests and the two `.rev()` limit tests to match.

</details>

### codex, base: FAIL

Files: [src/naive/date/mod.rs](../base/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../base/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..445fd77 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1320,7 +1320,7 @@ impl NaiveDate {
         self.format_localized_with_items(StrftimeItems::new_with_locale(fmt, locale), locale)
     }
 
-    /// Returns an iterator that steps by days across all representable dates.
+    /// Returns an iterator that steps by days from this date through [`NaiveDate::MAX`], inclusive.
     ///
     /// # Example
     ///
@@ -1341,17 +1341,21 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 1).unwrap().iter_days().rev().take(4) {
+    /// for d in NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_days().take(4).rev() {
     ///     count -= 1;
     ///     assert_eq!(d, expected[count]);
     /// }
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator {
+            value: *self,
+            remaining: (NaiveDate::MAX.signed_duration_since(*self).num_days() / 1) as usize + 1,
+        }
     }
 
-    /// Returns an iterator that steps by weeks across all representable dates.
+    /// Returns an iterator that steps by weeks from this date through the last representable date
+    /// with the same weekday, inclusive.
     ///
     /// # Example
     ///
@@ -1372,14 +1376,17 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
+    /// for d in NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_weeks().take(4).rev() {
     ///     count -= 1;
     ///     assert_eq!(d, expected[count]);
     /// }
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        NaiveDateWeeksIterator {
+            value: *self,
+            remaining: (NaiveDate::MAX.signed_duration_since(*self).num_days() / 7) as usize + 1,
+        }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2213,22 +2220,31 @@ impl From<NaiveDateTime> for NaiveDate {
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
     value: NaiveDate,
+    remaining: usize,
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
-        let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
-        self.value = current.succ_opt()?;
+        self.nth(0)
+    }
+
+    fn nth(&mut self, n: usize) -> Option<Self::Item> {
+        if n >= self.remaining {
+            self.remaining = 0;
+            return None;
+        }
+        let current = self.value.checked_add_days(Days::new(n as u64 * 1)).unwrap();
+        self.remaining -= n + 1;
+        if self.remaining > 0 {
+            self.value = current.checked_add_days(Days::new(1)).unwrap();
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2236,10 +2252,16 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
-        Some(current)
+        self.nth_back(0)
+    }
+
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        if n >= self.remaining {
+            self.remaining = 0;
+            return None;
+        }
+        self.remaining -= n + 1;
+        self.value.checked_add_days(Days::new(self.remaining as u64 * 1))
     }
 }
 
@@ -2249,20 +2271,31 @@ impl FusedIterator for NaiveDateDaysIterator {}
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
     value: NaiveDate,
+    remaining: usize,
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_add_days(Days::new(7))?;
+        self.nth(0)
+    }
+
+    fn nth(&mut self, n: usize) -> Option<Self::Item> {
+        if n >= self.remaining {
+            self.remaining = 0;
+            return None;
+        }
+        let current = self.value.checked_add_days(Days::new(n as u64 * 7)).unwrap();
+        self.remaining -= n + 1;
+        if self.remaining > 0 {
+            self.value = current.checked_add_days(Days::new(7)).unwrap();
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2270,9 +2303,16 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
-        Some(current)
+        self.nth_back(0)
+    }
+
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        if n >= self.remaining {
+            self.remaining = 0;
+            return None;
+        }
+        self.remaining -= n + 1;
+        self.value.checked_add_days(Days::new(self.remaining as u64 * 7))
     }
 }
 
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..490bd1c 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -729,21 +729,58 @@ fn test_date_parse_from_str() {
 }
 
 #[test]
-fn test_day_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
-        2
-    );
-}
-
-#[test]
-fn test_week_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
-    );
+fn test_date_iterators() {
+    fn check(mut iter: impl DoubleEndedIterator<Item = NaiveDate> + ExactSizeIterator + Clone) {
+        let expected: Vec<_> = iter.clone().take(7).collect();
+        assert_eq!(
+            iter.clone().take(7).rev().collect::<Vec<_>>(),
+            expected.iter().rev().copied().collect::<Vec<_>>()
+        );
+        let len = iter.len();
+        assert_eq!(iter.next(), Some(expected[0]));
+        assert_eq!(iter.len(), len - 1);
+        let last = iter.next_back().unwrap();
+        assert_eq!(iter.len(), len - 2);
+        assert_eq!(iter.nth_back(len - 4), Some(expected[2]));
+        assert_eq!(iter.len(), 1);
+        assert_eq!(iter.next_back(), Some(expected[1]));
+        assert_eq!(iter.next(), None);
+        assert_eq!(iter.next_back(), None);
+        assert_eq!(iter.len(), 0);
+        assert!(last > expected[6]);
+        let mut exhausted = iter;
+        assert_eq!(exhausted.nth(usize::MAX), None);
+        assert_eq!(exhausted.nth_back(usize::MAX), None);
+    }
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    check(start.iter_days());
+    check(start.iter_weeks());
+    assert_eq!(start.iter_days().next_back(), Some(NaiveDate::MAX));
+    let last_week = start.iter_weeks().next_back().unwrap();
+    assert_eq!(last_week.weekday(), start.weekday());
+    assert!((NaiveDate::MAX - last_week).num_days() < 7);
+}
+
+#[test]
+fn test_date_iterator_limits() {
+    for offset in 0..15 {
+        let start = NaiveDate::MAX.checked_sub_days(Days::new(offset)).unwrap();
+        let days: Vec<_> = start.iter_days().collect();
+        assert_eq!(days.len(), offset as usize + 1);
+        assert_eq!(days.last(), Some(&NaiveDate::MAX));
+        assert_eq!(
+            start.iter_days().rev().collect::<Vec<_>>(),
+            days.iter().rev().copied().collect::<Vec<_>>()
+        );
+        let weeks: Vec<_> = start.iter_weeks().collect();
+        assert_eq!(weeks.len(), offset as usize / 7 + 1);
+        assert_eq!(
+            start.iter_weeks().rev().collect::<Vec<_>>(),
+            weeks.iter().rev().copied().collect::<Vec<_>>()
+        );
+    }
+    assert_eq!(NaiveDate::MIN.iter_days().next(), Some(NaiveDate::MIN));
+    assert_eq!(NaiveDate::MIN.iter_weeks().next(), Some(NaiveDate::MIN));
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

I’ll check how the day and week iterators track their range, fix reverse iteration, and add regression tests for reversed windows and mixed front/back iteration.


Both iterators use one cursor: `next()` moves it forward and `next_back()` moves it backward, while `len()` counts toward the maximum date. I’ll make both ends consume the same range, include the final representable step, and update the documentation examples to reverse a finite window.


Fixed both iterators to consume one shared range from either end, with accurate lengths and consistent exhaustion. Days now include `NaiveDate::MAX`; weeks include the last reachable date with the starting weekday. Reversing a taken window now works as expected.

Added regression tests and updated documentation examples.

Validation: 291 default and 225 no-default-feature unit tests passed. Both iterator doctests passed; three unrelated doctests failed on existing deprecated `core::i32::MAX` usage.

</details>

### codex, muffle: FAIL

Files: [src/naive/date/mod.rs](../muffle/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../muffle/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..e1991b3 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1320,7 +1320,7 @@ impl NaiveDate {
         self.format_localized_with_items(StrftimeItems::new_with_locale(fmt, locale), locale)
     }
 
-    /// Returns an iterator that steps by days across all representable dates.
+    /// Returns an iterator that steps by days from this date through [`NaiveDate::MAX`], inclusive.
     ///
     /// # Example
     ///
@@ -1341,17 +1341,21 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 1).unwrap().iter_days().rev().take(4) {
+    /// for d in NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_days().take(4).rev() {
     ///     count -= 1;
     ///     assert_eq!(d, expected[count]);
     /// }
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator {
+            value: *self,
+            remaining: NaiveDate::MAX.signed_duration_since(*self).num_days() as usize + 1,
+        }
     }
 
-    /// Returns an iterator that steps by weeks across all representable dates.
+    /// Returns an iterator that steps by weeks from this date through the last representable
+    /// date with the same weekday, inclusive.
     ///
     /// # Example
     ///
@@ -1372,14 +1376,17 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
+    /// for d in NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_weeks().take(4).rev() {
     ///     count -= 1;
     ///     assert_eq!(d, expected[count]);
     /// }
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        NaiveDateWeeksIterator {
+            value: *self,
+            remaining: NaiveDate::MAX.signed_duration_since(*self).num_weeks() as usize + 1,
+        }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2213,22 +2220,31 @@ impl From<NaiveDateTime> for NaiveDate {
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
     value: NaiveDate,
+    remaining: usize,
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
-        let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
-        self.value = current.succ_opt()?;
+        self.nth(0)
+    }
+
+    fn nth(&mut self, n: usize) -> Option<Self::Item> {
+        if n >= self.remaining {
+            self.remaining = 0;
+            return None;
+        }
+        let current = self.value.checked_add_days(Days::new(n as u64 * 1))?;
+        self.remaining -= n + 1;
+        if self.remaining > 0 {
+            self.value = current.checked_add_days(Days::new(1)).unwrap();
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2236,10 +2252,16 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
-        Some(current)
+        self.nth_back(0)
+    }
+
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        if n >= self.remaining {
+            self.remaining = 0;
+            return None;
+        }
+        self.remaining -= n + 1;
+        self.value.checked_add_days(Days::new(self.remaining as u64 * 1))
     }
 }
 
@@ -2249,20 +2271,31 @@ impl FusedIterator for NaiveDateDaysIterator {}
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
     value: NaiveDate,
+    remaining: usize,
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_add_days(Days::new(7))?;
+        self.nth(0)
+    }
+
+    fn nth(&mut self, n: usize) -> Option<Self::Item> {
+        if n >= self.remaining {
+            self.remaining = 0;
+            return None;
+        }
+        let current = self.value.checked_add_days(Days::new(n as u64 * 7))?;
+        self.remaining -= n + 1;
+        if self.remaining > 0 {
+            self.value = current.checked_add_days(Days::new(7)).unwrap();
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2270,9 +2303,16 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
-        Some(current)
+        self.nth_back(0)
+    }
+
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        if n >= self.remaining {
+            self.remaining = 0;
+            return None;
+        }
+        self.remaining -= n + 1;
+        self.value.checked_add_days(Days::new(self.remaining as u64 * 7))
     }
 }
 
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..733eeb6 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -729,21 +729,61 @@ fn test_date_parse_from_str() {
 }
 
 #[test]
-fn test_day_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
-        2
-    );
-}
+fn test_date_iterators() {
+    fn check(mut iter: impl DoubleEndedIterator<Item = NaiveDate> + ExactSizeIterator + Clone) {
+        let forward: Vec<_> = iter.clone().take(7).collect();
+        let backward: Vec<_> = iter.clone().take(7).rev().collect();
+        assert_eq!(forward.into_iter().rev().collect::<Vec<_>>(), backward);
+
+        let mut exhausted = iter.clone();
+        assert_eq!(exhausted.nth(usize::MAX), None);
+        assert_eq!(exhausted.next_back(), None);
+        assert_eq!(exhausted.len(), 0);
+        let mut exhausted = iter.clone();
+        assert_eq!(exhausted.nth_back(usize::MAX), None);
+        assert_eq!(exhausted.next(), None);
+        assert_eq!(exhausted.len(), 0);
+
+        let len = iter.len();
+        let last = iter.clone().nth(len - 1).unwrap();
+        assert_eq!(iter.next_back(), Some(last));
+        assert_eq!(iter.len(), len - 1);
+        assert!(iter.next().is_some());
+        assert_eq!(iter.len(), len.saturating_sub(2));
+        while iter.len() > 1 {
+            iter.nth(iter.len() - 2);
+        }
+        if iter.len() == 1 {
+            let last = iter.clone().next_back();
+            assert_eq!(iter.next(), last);
+        }
+        assert_eq!(iter.next(), None);
+        assert_eq!(iter.next_back(), None);
+        assert_eq!(iter.size_hint(), (0, Some(0)));
+        assert_eq!(iter.nth(usize::MAX), None);
+        assert_eq!(iter.nth_back(usize::MAX), None);
+    }
 
-#[test]
-fn test_week_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
-    );
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    for date in [NaiveDate::MIN, start, NaiveDate::MAX - Days::new(14)] {
+        check(date.iter_days());
+        check(date.iter_weeks());
+    }
+    assert_eq!(start.iter_days().next_back(), Some(NaiveDate::MAX));
+    for days in 0..14 {
+        let date = NaiveDate::MAX - Days::new(days);
+        assert_eq!(date.iter_days().count(), days as usize + 1);
+        assert_eq!(date.iter_weeks().count(), days as usize / 7 + 1);
+        assert_eq!(date.iter_weeks().next_back(), Some(date + Days::new(days / 7 * 7)));
+    }
+    for reverse in [false, true] {
+        let mut iter = NaiveDate::MAX.iter_days();
+        assert_eq!(if reverse { iter.next_back() } else { iter.next() }, Some(NaiveDate::MAX));
+        assert_eq!(iter.next(), None);
+    }
+    let mut iter = NaiveDate::MAX.iter_weeks();
+    assert_eq!(iter.next(), Some(NaiveDate::MAX));
+    assert_eq!(iter.next_back(), None);
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

I’ll check both iterators, fix their reverse traversal, and add regression tests for reversing a finite window.

Both iterators move a single cursor backward, which makes `next_back()` disagree with their reported length. I’ll track the remaining range so the two ends meet correctly, including the final representable date (or final aligned week). I’ll also update the examples that currently show `.rev()` walking backward from the starting date.

Fixed both iterators so forward and reverse traversal consume the same range, with accurate lengths and proper exhaustion. Your example now passes.

The range includes `NaiveDate::MAX` for days and the final matching weekday for weeks. Updated examples and added regression tests.

Validation: 290 unit tests pass; formatting and no-default-features checks pass. Three unrelated doctests fail on deprecated `std::i32::MAX` usage.

</details>

### codex, hush: FAIL

Files: [src/naive/date/mod.rs](../hush/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../hush/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..6edac2c 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1320,7 +1320,8 @@ impl NaiveDate {
         self.format_localized_with_items(StrftimeItems::new_with_locale(fmt, locale), locale)
     }
 
-    /// Returns an iterator that steps by days across all representable dates.
+    /// Returns an iterator that steps by days from this date through [`NaiveDate::MAX`], inclusive.
+    /// Reversing the iterator starts at `NaiveDate::MAX`.
     ///
     /// # Example
     ///
@@ -1341,17 +1342,21 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 1).unwrap().iter_days().rev().take(4) {
+    /// for d in NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_days().take(4).rev() {
     ///     count -= 1;
     ///     assert_eq!(d, expected[count]);
     /// }
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator {
+            value: *self,
+            remaining: NaiveDate::MAX.signed_duration_since(*self).num_days() as usize + 1,
+        }
     }
 
-    /// Returns an iterator that steps by weeks across all representable dates.
+    /// Returns an iterator that steps by weeks from this date through the last representable date
+    /// on the same weekday, inclusive. Reversing the iterator starts at that last date.
     ///
     /// # Example
     ///
@@ -1372,14 +1377,17 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
+    /// for d in NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_weeks().take(4).rev() {
     ///     count -= 1;
     ///     assert_eq!(d, expected[count]);
     /// }
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        NaiveDateWeeksIterator {
+            value: *self,
+            remaining: NaiveDate::MAX.signed_duration_since(*self).num_weeks() as usize + 1,
+        }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2213,22 +2221,26 @@ impl From<NaiveDateTime> for NaiveDate {
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
     value: NaiveDate,
+    remaining: usize,
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
+        if self.remaining == 0 {
+            return None;
+        }
         let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
-        self.value = current.succ_opt()?;
+        self.remaining -= 1;
+        if self.remaining > 0 {
+            self.value = current.checked_add_days(Days::new(1)).unwrap();
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2236,10 +2248,11 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
-        Some(current)
+        if self.remaining == 0 {
+            return None;
+        }
+        self.remaining -= 1;
+        self.value.checked_add_days(Days::new(self.remaining as u64 * 1))
     }
 }
 
@@ -2249,20 +2262,26 @@ impl FusedIterator for NaiveDateDaysIterator {}
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
     value: NaiveDate,
+    remaining: usize,
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
+        if self.remaining == 0 {
+            return None;
+        }
         let current = self.value;
-        self.value = current.checked_add_days(Days::new(7))?;
+        self.remaining -= 1;
+        if self.remaining > 0 {
+            self.value = current.checked_add_days(Days::new(7)).unwrap();
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2270,9 +2289,11 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
-        Some(current)
+        if self.remaining == 0 {
+            return None;
+        }
+        self.remaining -= 1;
+        self.value.checked_add_days(Days::new(self.remaining as u64 * 7))
     }
 }
 
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..01af619 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -729,21 +729,45 @@ fn test_date_parse_from_str() {
 }
 
 #[test]
-fn test_day_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
-        2
-    );
-}
+fn test_date_iterators() {
+    fn check<I>(iter: I)
+    where
+        I: DoubleEndedIterator<Item = NaiveDate> + ExactSizeIterator + Clone,
+    {
+        let forward: Vec<_> = iter.clone().collect();
+        let reverse: Vec<_> = iter.clone().rev().collect();
+        assert_eq!(forward.len(), iter.len());
+        assert!(forward.iter().rev().copied().eq(reverse));
+        let mut mixed = iter;
+        let mut front = 0;
+        let mut back = forward.len();
+        while front < back {
+            assert_eq!(mixed.len(), back - front);
+            assert_eq!(mixed.next(), Some(forward[front]));
+            front += 1;
+            if front < back {
+                back -= 1;
+                assert_eq!(mixed.next_back(), Some(forward[back]));
+            }
+        }
+        assert_eq!(mixed.size_hint(), (0, Some(0)));
+        assert_eq!(mixed.next(), None);
+        assert_eq!(mixed.next_back(), None);
+        assert_eq!(mixed.next(), None);
+    }
 
-#[test]
-fn test_week_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
-    );
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    check(start.iter_days().take(7));
+    check(start.iter_weeks().take(7));
+    check(NaiveDate::MIN.iter_days().take(7));
+    check(NaiveDate::MIN.iter_weeks().take(7));
+    for days in 0..22 {
+        let start = NaiveDate::MAX.checked_sub_days(Days::new(days)).unwrap();
+        check(start.iter_days());
+        check(start.iter_weeks());
+        assert_eq!(start.iter_days().next_back(), Some(NaiveDate::MAX));
+        assert_eq!(start.iter_weeks().next_back(), start.checked_add_days(Days::new(days / 7 * 7)));
+    }
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

Done.
Fixed both iterators’ reverse traversal, lengths, exhaustion, endpoint inclusion; updated docs. 290 unit tests passed. Iterator doctests passed; three unrelated doctests failed deprecated-constant lint.

</details>

### codex, sloth: pass

Files: [src/naive/date/mod.rs](../sloth/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../sloth/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..4017124 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1320,7 +1320,7 @@ impl NaiveDate {
         self.format_localized_with_items(StrftimeItems::new_with_locale(fmt, locale), locale)
     }
 
-    /// Returns an iterator that steps by days across all representable dates.
+    /// Returns an iterator that steps by days from this date up to, but excluding, `NaiveDate::MAX`.
     ///
     /// # Example
     ///
@@ -1341,17 +1341,17 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 1).unwrap().iter_days().rev().take(4) {
+    /// for d in NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_days().take(4).rev() {
     ///     count -= 1;
     ///     assert_eq!(d, expected[count]);
     /// }
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator { value: *self, end: NaiveDate::MAX }
     }
 
-    /// Returns an iterator that steps by weeks across all representable dates.
+    /// Returns an iterator that steps by weeks from this date while another full week is representable.
     ///
     /// # Example
     ///
@@ -1372,14 +1372,14 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
+    /// for d in NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_weeks().take(4).rev() {
     ///     count -= 1;
     ///     assert_eq!(d, expected[count]);
     /// }
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        NaiveDateWeeksIterator { value: *self, end: NaiveDate::MAX }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2213,21 +2213,23 @@ impl From<NaiveDateTime> for NaiveDate {
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
     value: NaiveDate,
+    end: NaiveDate,
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
+        if self.value >= self.end {
+            return None;
+        }
         let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
         self.value = current.succ_opt()?;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
+        let exact_size = self.end.signed_duration_since(self.value).num_days();
         (exact_size as usize, Some(exact_size as usize))
     }
 }
@@ -2236,10 +2238,20 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
-        Some(current)
+        if self.value >= self.end {
+            return None;
+        }
+        self.end = self.end.pred_opt()?;
+        Some(self.end)
+    }
+
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        if n >= self.len() {
+            self.end = self.value;
+            return None;
+        }
+        self.end = self.end.checked_sub_days(Days::new(n as u64))?;
+        self.next_back()
     }
 }
 
@@ -2249,19 +2261,23 @@ impl FusedIterator for NaiveDateDaysIterator {}
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
     value: NaiveDate,
+    end: NaiveDate,
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
+        if self.len() == 0 {
+            return None;
+        }
         let current = self.value;
         self.value = current.checked_add_days(Days::new(7))?;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
+        let exact_size = self.end.signed_duration_since(self.value).num_weeks();
         (exact_size as usize, Some(exact_size as usize))
     }
 }
@@ -2270,9 +2286,21 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
-        Some(current)
+        let remaining = self.len();
+        if remaining == 0 {
+            return None;
+        }
+        self.end = self.value.checked_add_days(Days::new((remaining as u64 - 1) * 7))?;
+        Some(self.end)
+    }
+
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        if n >= self.len() {
+            self.end = self.value;
+            return None;
+        }
+        self.end = self.end.checked_sub_days(Days::new(n as u64 * 7))?;
+        self.next_back()
     }
 }
 
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..86b457c 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -732,7 +732,7 @@ fn test_date_parse_from_str() {
 fn test_day_iterator_limit() {
     assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
+        NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().rev().take(4).count(),
         2
     );
 }
@@ -741,11 +741,62 @@ fn test_day_iterator_limit() {
 fn test_week_iterator_limit() {
     assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
+        NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().rev().take(4).count(),
         2
     );
 }
 
+/// Checks reverse windows, both boundaries, and exhaustion from alternating ends.
+#[test]
+fn test_date_iterators_reverse() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    check(start.iter_days(), 1);
+    check(start.iter_weeks(), 7);
+    check(NaiveDate::MIN.iter_days(), 1);
+    check(NaiveDate::MIN.iter_weeks(), 7);
+    for days in 0..=15 {
+        let start = NaiveDate::MAX.checked_sub_days(Days::new(days)).unwrap();
+        check(start.iter_days(), 1);
+        check(start.iter_weeks(), 7);
+    }
+
+    /// Checks one exact-size, double-ended date iterator against its forward range.
+    fn check(
+        iter: impl ExactSizeIterator<Item = NaiveDate> + DoubleEndedIterator + Clone,
+        step: u64,
+    ) {
+        let mut expected: Vec<_> = iter.clone().take(7).collect();
+        expected.reverse();
+        assert_eq!(expected, iter.clone().take(7).rev().collect::<Vec<_>>());
+        let len = iter.len();
+        let mut mixed = iter.clone();
+        if len > 0 {
+            let first = mixed.next().unwrap();
+            let last = first.checked_add_days(Days::new((len as u64 - 1) * step)).unwrap();
+            assert_eq!(iter.clone().next_back(), Some(last));
+            assert_eq!(mixed.len(), len - 1);
+            if len > 1 {
+                assert_eq!(mixed.next_back(), Some(last));
+                assert_eq!(mixed.len(), len - 2);
+            }
+        }
+        assert_eq!(mixed.nth_back(mixed.len()), None);
+        assert_eq!(mixed.len(), 0);
+        assert_eq!(mixed.next(), None);
+        assert_eq!(mixed.next_back(), None);
+        let mut window = iter.take(7);
+        while window.len() > 1 {
+            assert!(window.next().is_some());
+            assert!(window.next_back().is_some());
+        }
+        if window.len() == 1 {
+            assert!(window.next_back().is_some());
+        }
+        assert_eq!(window.next(), None);
+        assert_eq!(window.next_back(), None);
+    }
+}
+
 #[test]
 fn test_weeks_from() {
     // tests per: https://github.com/chronotope/chrono/issues/961
```

</details>

<details><summary>reply</summary>

I’ll check how both iterators define their range, then fix reverse traversal and add regression tests for reversed windows and date boundaries.

Both iterators currently move the same cursor in either direction, so reverse traversal leaves the range reported by `len()`. I’ll add a separate back boundary while preserving the existing forward range, including its exclusion of the final date or incomplete week. The reverse examples and tests also need updating because they currently expect traversal toward earlier dates.

The regression tests pass for reversed seven-item windows, mixed front/back traversal, exact lengths, and exhaustion at both date boundaries. The full test run hit three unrelated doctest failures caused by deprecated `std::i32::MAX` constants. I’ll finish with a targeted run covering the iterator tests and examples.

Fixed both iterators so front and back traversal share one range, lengths stay accurate, and iteration stops when the ends meet. Added regression tests and updated examples.

Validation: all 5 targeted unit tests and both iterator doctests pass. The full suite encountered 3 unrelated doctest failures involving deprecated `std::i32::MAX`.

Preserved existing forward endpoint behavior; no new APIs or dependencies.

</details>

### codex, all: pass

Files: [src/naive/date/mod.rs](../all/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../all/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..c742383 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1320,7 +1320,7 @@ impl NaiveDate {
         self.format_localized_with_items(StrftimeItems::new_with_locale(fmt, locale), locale)
     }
 
-    /// Returns an iterator that steps by days across all representable dates.
+    /// Returns an iterator that steps by days from this date up to, but excluding, `NaiveDate::MAX`.
     ///
     /// # Example
     ///
@@ -1341,17 +1341,17 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 1).unwrap().iter_days().rev().take(4) {
+    /// for d in NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_days().take(4).rev() {
     ///     count -= 1;
     ///     assert_eq!(d, expected[count]);
     /// }
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator { value: *self, end: NaiveDate::MAX }
     }
 
-    /// Returns an iterator that steps by weeks across all representable dates.
+    /// Returns an iterator that steps by weeks from this date, yielding dates whose next week is representable.
     ///
     /// # Example
     ///
@@ -1372,14 +1372,14 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
+    /// for d in NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_weeks().take(4).rev() {
     ///     count -= 1;
     ///     assert_eq!(d, expected[count]);
     /// }
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        NaiveDateWeeksIterator { value: *self, end: NaiveDate::MAX }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2213,21 +2213,23 @@ impl From<NaiveDateTime> for NaiveDate {
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
     value: NaiveDate,
+    end: NaiveDate,
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
+        if self.value == self.end {
+            return None;
+        }
         let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
         self.value = current.succ_opt()?;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
+        let exact_size = self.end.signed_duration_since(self.value).num_days();
         (exact_size as usize, Some(exact_size as usize))
     }
 }
@@ -2236,10 +2238,11 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
-        Some(current)
+        if self.value == self.end {
+            return None;
+        }
+        self.end = self.end.pred_opt()?;
+        Some(self.end)
     }
 }
 
@@ -2249,19 +2252,23 @@ impl FusedIterator for NaiveDateDaysIterator {}
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
     value: NaiveDate,
+    end: NaiveDate,
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
+        if self.len() == 0 {
+            return None;
+        }
         let current = self.value;
         self.value = current.checked_add_days(Days::new(7))?;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
+        let exact_size = self.end.signed_duration_since(self.value).num_weeks();
         (exact_size as usize, Some(exact_size as usize))
     }
 }
@@ -2270,9 +2277,12 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
-        Some(current)
+        let remaining = self.len();
+        if remaining == 0 {
+            return None;
+        }
+        self.end = self.value.checked_add_days(Days::new((remaining as u64 - 1) * 7))?;
+        Some(self.end)
     }
 }
 
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..e09840f 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -732,7 +732,7 @@ fn test_date_parse_from_str() {
 fn test_day_iterator_limit() {
     assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
+        NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().rev().take(4).count(),
         2
     );
 }
@@ -741,11 +741,51 @@ fn test_day_iterator_limit() {
 fn test_week_iterator_limit() {
     assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
+        NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().rev().take(4).count(),
         2
     );
 }
 
+/// Checks reversed windows, shared bounds, and exhaustion for both step sizes.
+#[test]
+fn test_date_iterator_reverse() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut days: Vec<_> = start.iter_days().take(7).collect();
+    days.reverse();
+    assert_eq!(days, start.iter_days().take(7).rev().collect::<Vec<_>>());
+    let mut weeks: Vec<_> = start.iter_weeks().take(7).collect();
+    weeks.reverse();
+    assert_eq!(weeks, start.iter_weeks().take(7).rev().collect::<Vec<_>>());
+
+    let mut days = start.iter_days();
+    assert_eq!(days.next_back(), NaiveDate::MAX.pred_opt());
+    assert_eq!(days.next(), Some(start));
+    assert_eq!(days.len(), NaiveDate::MAX.signed_duration_since(start).num_days() as usize - 2);
+    let mut weeks = start.iter_weeks();
+    let count = weeks.len();
+    assert_eq!(weeks.next_back(), start.checked_add_days(Days::new((count as u64 - 1) * 7)));
+    assert_eq!(weeks.next(), Some(start));
+    assert_eq!(weeks.len(), count - 2);
+
+    for offset in 0..22 {
+        let start = NaiveDate::MAX.checked_sub_days(Days::new(offset)).unwrap();
+        let mut days = start.iter_days();
+        let mut weeks = start.iter_weeks();
+        for remaining in (1..=days.len()).rev() {
+            assert!(if remaining % 2 == 0 { days.next() } else { days.next_back() }.is_some());
+            assert_eq!(days.len(), remaining - 1);
+        }
+        for remaining in (1..=weeks.len()).rev() {
+            assert!(if remaining % 2 == 0 { weeks.next() } else { weeks.next_back() }.is_some());
+            assert_eq!(weeks.len(), remaining - 1);
+        }
+        assert_eq!(days.next(), None);
+        assert_eq!(days.next_back(), None);
+        assert_eq!(weeks.next(), None);
+        assert_eq!(weeks.next_back(), None);
+    }
+}
+
 #[test]
 fn test_weeks_from() {
     // tests per: https://github.com/chronotope/chrono/issues/961
```

</details>

<details><summary>reply</summary>

Done.
Fixed shared bounds for day/week iterators; added regression tests. 292 unit tests and iterator doctests pass; three unrelated doctests fail on deprecated constants.

</details>
