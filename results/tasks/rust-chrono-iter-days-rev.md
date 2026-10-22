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
| claude | base | **FAIL** | +102/-35 | 0 | 5,986 | $0.154 |
| claude | muffle | **FAIL** | +113/-27 | 0 | 7,295 | $0.156 |
| claude | hush | **FAIL** | +119/-37 | 0 | 5,527 | $0.143 |
| claude | sloth | **FAIL** | +76/-29 | 0 | 5,895 | $0.146 |
| claude | all | **FAIL** | +84/-39 | 0 | 5,216 | $0.145 |
| codex | base | pass | +93/-21 | 0 | 3,256 | - |
| codex | muffle | **FAIL** | +116/-37 | 0 | 2,685 | - |
| codex | hush | **FAIL** | +88/-35 | 0 | 2,170 | - |
| codex | sloth | pass | +48/-19 | 0 | 2,592 | - |
| codex | all | **FAIL** | +56/-27 | 0 | 2,036 | - |

### claude, base: FAIL

Files: [src/naive/date/mod.rs](../base/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../base/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..1aa1507 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1341,14 +1341,16 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 1).unwrap().iter_days().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// // Reversing a window gives the same dates as going forward, in reverse order.
+    /// let start = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap();
+    /// let mut forward: Vec<_> = start.iter_days().take(4).collect();
+    /// forward.reverse();
+    /// assert_eq!(forward, start.iter_days().take(4).rev().collect::<Vec<_>>());
+    /// assert_eq!(start.iter_days().next_back(), Some(NaiveDate::MAX));
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator::new(*self)
     }
 
     /// Returns an iterator that steps by weeks across all representable dates.
@@ -1372,14 +1374,15 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// // Reversing a window gives the same dates as going forward, in reverse order.
+    /// let start = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap();
+    /// let mut forward: Vec<_> = start.iter_weeks().take(4).collect();
+    /// forward.reverse();
+    /// assert_eq!(forward, start.iter_weeks().take(4).rev().collect::<Vec<_>>());
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        NaiveDateWeeksIterator::new(*self)
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2210,25 +2213,43 @@ impl From<NaiveDateTime> for NaiveDate {
 }
 
 /// Iterator over `NaiveDate` with a step size of one day.
+///
+/// Iterates from the starting date up to and including `NaiveDate::MAX`. Both ends of the range
+/// can be consumed, and the iterator is exhausted when they meet.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
+    /// Next date to be yielded from the front (only meaningful if `remaining > 0`).
     value: NaiveDate,
+    /// Number of dates left to yield.
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
+        // Only fails for `NaiveDate::MAX`, which is always the last item.
+        if let Some(next) = current.succ_opt() {
+            self.value = next;
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        let n = self.remaining as usize;
+        (n, Some(n))
     }
 }
 
@@ -2236,33 +2257,54 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
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
+/// Iterates from the starting date up to the last representable date reachable in whole weeks.
+/// Both ends of the range can be consumed, and the iterator is exhausted when they meet.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
+    /// Next date to be yielded from the front (only meaningful if `remaining > 0`).
     value: NaiveDate,
+    /// Number of dates left to yield.
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
+        // Fails only when no further item exists.
+        if let Some(next) = current.checked_add_days(Days::new(7)) {
+            self.value = next;
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        let n = self.remaining as usize;
+        (n, Some(n))
     }
 }
 
@@ -2270,9 +2312,11 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
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
index 0b47ca4..9643e0e 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -730,20 +730,43 @@ fn test_date_parse_from_str() {
 
 #[test]
 fn test_day_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
-        2
-    );
+    let near_max = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap();
+    assert_eq!(near_max.iter_days().take(4).count(), 3);
+    assert_eq!(near_max.iter_days().last(), Some(NaiveDate::MAX));
+    assert_eq!(near_max.iter_days().next_back(), Some(NaiveDate::MAX));
+    assert_eq!(NaiveDate::MAX.iter_days().collect::<Vec<_>>(), [NaiveDate::MAX]);
 }
 
 #[test]
 fn test_week_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
-    );
+    let near_max = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap();
+    assert_eq!(near_max.iter_weeks().take(4).count(), 3);
+    assert_eq!(near_max.iter_weeks().next_back(), near_max.iter_weeks().last());
+    assert_eq!(NaiveDate::MAX.iter_weeks().collect::<Vec<_>>(), [NaiveDate::MAX]);
+}
+
+#[test]
+fn test_iterator_double_ended() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+
+    let mut fwd: Vec<_> = start.iter_days().take(7).collect();
+    fwd.reverse();
+    assert_eq!(fwd, start.iter_days().take(7).rev().collect::<Vec<_>>());
+    let mut fwd: Vec<_> = start.iter_weeks().take(7).collect();
+    fwd.reverse();
+    assert_eq!(fwd, start.iter_weeks().take(7).rev().collect::<Vec<_>>());
+
+    // Both ends meet without overlap.
+    let mut it = NaiveDate::MAX.pred_opt().unwrap().iter_days();
+    assert_eq!(it.len(), 2);
+    assert_eq!(it.next_back(), Some(NaiveDate::MAX));
+    assert_eq!(it.next(), NaiveDate::MAX.pred_opt());
+    assert_eq!((it.next(), it.next_back(), it.len()), (None, None, 0));
+
+    let mut it = start.iter_weeks();
+    let n = it.len();
+    assert_eq!(it.next_back().map(|d| (d - start).num_days() % 7), Some(0));
+    assert_eq!(it.len(), n - 1);
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

Unit tests pass; I'm checking which 3 doctests failed and whether my change caused them.

`iter_days()` and `iter_weeks()` now work from both ends over the same range, so your reproduction passes. I added a regression test for it. The new tests and the other `naive::date` unit tests pass. Three doctests fail (`checked_sub_months` in `date`, and `checked_add_months` and `checked_sub_months` in `datetime`). The same three fail with my changes stashed, so they aren't caused by this fix.

**What was wrong:** the iterators kept a single cursor, so `next_back` just walked backwards from the start date. It never touched the far end, which is why `len()` and `next_back()` disagreed.

**The change** (`src/naive/date/mod.rs`): each iterator now stores its start date and the number of items left. `next` takes from the front and `next_back` takes from the back, and they stop when they meet. `len()` now matches what `next` actually produces. `next_back()` is `NaiveDate::MAX` for `iter_days()`, and the last whole-week date for `iter_weeks()`.

**Behaviour changes:**
- `iter_days()` now includes `NaiveDate::MAX`. Before, `next()` never yielded it, and `len()` was one too low.
- `iter_weeks()` now includes its last reachable date. Before, it dropped one item for the same reason.
- `.rev()` no longer walks backwards from the start date towards `MIN`. A reversed iterator now yields the same dates as the forward one, in reverse order. Anything relying on the old walk-backwards behaviour will break.
- I rewrote the `iter_days` and `iter_weeks` doc examples to match the new behaviour.
- I updated `test_day_iterator_limit` and `test_week_iterator_limit` for the inclusive end, so their expected counts went from 2 to 3. I also added `test_iterator_double_ended`.

I haven't committed anything.

</details>

### claude, muffle: FAIL

Files: [src/naive/date/mod.rs](../muffle/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../muffle/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..907f3b3 100644
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
+        NaiveDateDaysIterator { value: *self, end: NaiveDate::MAX }
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
+        NaiveDateWeeksIterator { value: *self, end: NaiveDate::MAX }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2210,25 +2210,44 @@ impl From<NaiveDateTime> for NaiveDate {
 }
 
 /// Iterator over `NaiveDate` with a step size of one day.
+///
+/// Iterates over the inclusive range from the starting date to `NaiveDate::MAX`. Both ends can be
+/// consumed; the iterator is exhausted when they meet.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
+    // Inclusive bounds. The iterator is empty when `value > end`.
     value: NaiveDate,
+    end: NaiveDate,
+}
+
+impl NaiveDateDaysIterator {
+    const fn exhausted(&mut self) {
+        self.value = NaiveDate::MAX;
+        self.end = NaiveDate::MIN;
+    }
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
+        if self.value > self.end {
+            return None;
+        }
         let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
-        self.value = current.succ_opt()?;
+        match current.succ_opt() {
+            Some(next) if current < self.end => self.value = next,
+            _ => self.exhausted(),
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        if self.value > self.end {
+            return (0, Some(0));
+        }
+        let exact_size = self.end.signed_duration_since(self.value).num_days() as usize + 1;
+        (exact_size, Some(exact_size))
     }
 }
 
@@ -2236,9 +2255,14 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
+        if self.value > self.end {
+            return None;
+        }
+        let current = self.end;
+        match current.pred_opt() {
+            Some(prev) if self.value < current => self.end = prev,
+            _ => self.exhausted(),
+        }
         Some(current)
     }
 }
@@ -2246,23 +2270,52 @@ impl DoubleEndedIterator for NaiveDateDaysIterator {
 impl FusedIterator for NaiveDateDaysIterator {}
 
 /// Iterator over `NaiveDate` with a step size of one week.
+///
+/// Iterates from the starting date towards `NaiveDate::MAX` in steps of one week. Both ends can be
+/// consumed; the iterator is exhausted when they meet.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
+    // Inclusive bounds, `end` is not necessarily a whole number of weeks after `value`.
+    // The iterator is empty when `value > end`.
     value: NaiveDate,
+    end: NaiveDate,
+}
+
+impl NaiveDateWeeksIterator {
+    const fn exhausted(&mut self) {
+        self.value = NaiveDate::MAX;
+        self.end = NaiveDate::MIN;
+    }
+
+    /// The last date that will be yielded. Must not be called on an empty iterator.
+    fn last_date(&self) -> NaiveDate {
+        let weeks = self.end.signed_duration_since(self.value).num_weeks();
+        // Can't fail: the result lies between `value` and `end`.
+        self.value.checked_add_days(Days::new(weeks as u64 * 7)).unwrap_or(self.value)
+    }
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
+        if self.value > self.end {
+            return None;
+        }
         let current = self.value;
-        self.value = current.checked_add_days(Days::new(7))?;
+        match current.checked_add_days(Days::new(7)) {
+            Some(next) if next <= self.end => self.value = next,
+            _ => self.exhausted(),
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        if self.value > self.end {
+            return (0, Some(0));
+        }
+        let exact_size = self.end.signed_duration_since(self.value).num_weeks() as usize + 1;
+        (exact_size, Some(exact_size))
     }
 }
 
@@ -2270,8 +2323,14 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
+        if self.value > self.end {
+            return None;
+        }
+        let current = self.last_date();
+        match current.checked_sub_days(Days::new(7)) {
+            Some(prev) if prev >= self.value => self.end = prev,
+            _ => self.exhausted(),
+        }
         Some(current)
     }
 }
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..73ffd5a 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -730,20 +730,47 @@ fn test_date_parse_from_str() {
 
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
+    assert_eq!(d.iter_days().next_back(), Some(NaiveDate::MAX));
+    assert_eq!(NaiveDate::MAX.iter_days().collect::<Vec<_>>(), [NaiveDate::MAX]);
+    assert_eq!(NaiveDate::MAX.iter_days().rev().collect::<Vec<_>>(), [NaiveDate::MAX]);
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
+    assert_eq!(d.iter_weeks().next_back(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 26));
+    assert_eq!(NaiveDate::MAX.iter_weeks().collect::<Vec<_>>(), [NaiveDate::MAX]);
+}
+
+#[test]
+fn test_iterators_double_ended() {
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
+    // Both ends meet without overlap.
+    let mut it = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days();
+    assert_eq!(it.next(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29));
+    assert_eq!(it.next_back(), Some(NaiveDate::MAX));
+    assert_eq!(it.next_back(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 30));
+    assert_eq!((it.next(), it.next_back(), it.len()), (None, None, 0));
+
+    let mut it = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks();
+    assert_eq!(it.next_back(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 26));
+    assert_eq!(it.next(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12));
+    assert_eq!(it.next(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 19));
+    assert_eq!((it.next(), it.next_back(), it.len()), (None, None, 0));
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

`iter_days` and `iter_weeks` now iterate both ends over the same range, so your example passes. The new and existing date tests and the two iterator doctests pass. I didn't run the full test suite.

Both iterators now cover the inclusive range from the start date to `NaiveDate::MAX` and stop when the two ends meet. The changes are in `src/naive/date/mod.rs`, plus tests in `src/naive/date/tests.rs`.

- **`next_back()`:** it now returns `NaiveDate::MAX` for days. For weeks it returns the last date reachable from the start in whole weeks. `len()` agrees with what iteration actually yields.
- **`iter_days().rev()`:** `.rev()` used to walk backwards from the start date. It now starts at `NaiveDate::MAX`. The old behaviour is gone, not just changed. To go backwards from a date, use `.take(n).rev()`, or `.rev()` from the end of a window.
- **`NaiveDate::MAX`:** it is now yielded. Before, `next()` stopped one date short of it. At `MAX_YEAR-12-29`, `iter_days().take(4).count()` is now 3, not 2. `iter_weeks` shows the same change.

I added a private `end` field to both iterator structs. Their derived `PartialEq` and `Hash` now include it, and exhausted iterators are normalized so they compare equal. `iter_days` and `iter_weeks` are still `const fn`.

I updated the `iter_days` and `iter_weeks` doc examples and the two `*_iterator_limit` tests to the new semantics. I added `test_iterators_double_ended`, which covers your example, both ends meeting, and `MAX` as the start.

</details>

### claude, hush: FAIL

Files: [src/naive/date/mod.rs](../hush/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../hush/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..df87ad9 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1341,14 +1341,12 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 1).unwrap().iter_days().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// // Reversed, the iterator starts at `NaiveDate::MAX`.
+    /// assert_eq!(NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_days().next_back(), Some(NaiveDate::MAX));
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator { front: *self, back: NaiveDate::MAX }
     }
 
     /// Returns an iterator that steps by weeks across all representable dates.
@@ -1372,14 +1370,19 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// // Reversed, the iterator starts at the last whole-week step not past `NaiveDate::MAX`.
+    /// let last = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_weeks().next_back().unwrap();
+    /// assert!(last <= NaiveDate::MAX && NaiveDate::MAX.signed_duration_since(last).num_days() < 7);
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        // Last date reachable from `self` in whole weeks without passing `NaiveDate::MAX`.
+        let remainder = (NaiveDate::MAX.num_days_from_ce() - self.num_days_from_ce()) % 7;
+        let back = match NaiveDate::MAX.add_days(-remainder) {
+            Some(back) => back,
+            None => NaiveDate::MAX,
+        };
+        NaiveDateWeeksIterator { front: *self, back }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2210,25 +2213,45 @@ impl From<NaiveDateTime> for NaiveDate {
 }
 
 /// Iterator over `NaiveDate` with a step size of one day.
+///
+/// Yields every date from the starting date up to and including `NaiveDate::MAX`. Iterating from
+/// the back starts at `NaiveDate::MAX`; both ends stop when they meet.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
-    value: NaiveDate,
+    // Both ends are inclusive. The iterator is empty when `front > back`.
+    front: NaiveDate,
+    back: NaiveDate,
+}
+
+impl NaiveDateDaysIterator {
+    fn exhaust(&mut self) {
+        self.front = NaiveDate::MAX;
+        self.back = NaiveDate::MIN;
+    }
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
-        let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
-        self.value = current.succ_opt()?;
+        if self.front > self.back {
+            return None;
+        }
+        let current = self.front;
+        match current.succ_opt() {
+            Some(next) if current < self.back => self.front = next,
+            _ => self.exhaust(),
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        let size = if self.front > self.back {
+            0
+        } else {
+            self.back.signed_duration_since(self.front).num_days() as usize + 1
+        };
+        (size, Some(size))
     }
 }
 
@@ -2236,9 +2259,14 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
+        if self.front > self.back {
+            return None;
+        }
+        let current = self.back;
+        match current.pred_opt() {
+            Some(prev) if current > self.front => self.back = prev,
+            _ => self.exhaust(),
+        }
         Some(current)
     }
 }
@@ -2246,23 +2274,46 @@ impl DoubleEndedIterator for NaiveDateDaysIterator {
 impl FusedIterator for NaiveDateDaysIterator {}
 
 /// Iterator over `NaiveDate` with a step size of one week.
+///
+/// Yields the starting date and every date a whole number of weeks after it that is not past
+/// `NaiveDate::MAX`. Iterating from the back starts at the last such date; both ends stop when
+/// they meet.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
-    value: NaiveDate,
+    // Both ends are inclusive. The iterator is empty when `front > back`.
+    front: NaiveDate,
+    back: NaiveDate,
+}
+
+impl NaiveDateWeeksIterator {
+    fn exhaust(&mut self) {
+        self.front = NaiveDate::MAX;
+        self.back = NaiveDate::MIN;
+    }
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_add_days(Days::new(7))?;
+        if self.front > self.back {
+            return None;
+        }
+        let current = self.front;
+        match current.checked_add_days(Days::new(7)) {
+            Some(next) if current < self.back => self.front = next,
+            _ => self.exhaust(),
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        let size = if self.front > self.back {
+            0
+        } else {
+            self.back.signed_duration_since(self.front).num_weeks() as usize + 1
+        };
+        (size, Some(size))
     }
 }
 
@@ -2270,8 +2321,14 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
+        if self.front > self.back {
+            return None;
+        }
+        let current = self.back;
+        match current.checked_sub_days(Days::new(7)) {
+            Some(prev) if current > self.front => self.back = prev,
+            _ => self.exhaust(),
+        }
         Some(current)
     }
 }
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..288b126 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -730,20 +730,45 @@ fn test_date_parse_from_str() {
 
 #[test]
 fn test_day_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
-        2
-    );
+    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 3);
+    assert_eq!(NaiveDate::MAX.iter_days().collect::<Vec<_>>(), vec![NaiveDate::MAX]);
+    assert_eq!(NaiveDate::MAX.iter_days().next_back(), Some(NaiveDate::MAX));
 }
 
 #[test]
 fn test_week_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
-    );
+    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 3);
+    assert_eq!(NaiveDate::MAX.iter_weeks().collect::<Vec<_>>(), vec![NaiveDate::MAX]);
+}
+
+#[test]
+fn test_iterator_double_ended() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut fwd: Vec<_> = start.iter_days().take(7).collect();
+    fwd.reverse();
+    assert_eq!(fwd, start.iter_days().take(7).rev().collect::<Vec<_>>());
+    let mut fwd: Vec<_> = start.iter_weeks().take(7).collect();
+    fwd.reverse();
+    assert_eq!(fwd, start.iter_weeks().take(7).rev().collect::<Vec<_>>());
+
+    // Both ends meet without overlap.
+    let start = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 20).unwrap();
+    let mut it = start.iter_days();
+    assert_eq!(it.len(), 12);
+    let mut n = 0;
+    while let (Some(_), Some(_)) = (it.next(), it.next_back()) {
+        n += 2;
+    }
+    assert_eq!(n, 12);
+    assert_eq!(it.next(), None);
+    assert_eq!(it.next_back(), None);
+
+    let mut it = start.iter_weeks();
+    assert_eq!(it.len(), 2);
+    assert_eq!(it.next_back(), Some(start + TimeDelta::days(7)));
+    assert_eq!(it.next(), Some(start));
+    assert_eq!(it.next(), None);
+    assert_eq!(it.len(), 0);
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

Running tests without `--all-features`; rkyv features conflict.

Done. `NaiveDateDaysIterator` and `NaiveDateWeeksIterator` now hold an inclusive front and back, and both ends stop when they meet. Your example now passes. `.len()` now counts the start and the last date, so it is one higher than before. The lib tests for `naive::date` and the `iter_` doctests pass. I couldn't run `--all-features` because the rkyv features conflict.

- **Behaviour change:** `.rev()` now starts from `NaiveDate::MAX` (weeks: the last whole-week step not past it), not from the start date. I rewrote the two doctests and the two limit tests to match.
- **Tests added:** `test_iterator_double_ended` covers your reversal case and the two ends meeting.
- **Skipped:** I didn't add a CHANGELOG entry.

</details>

### claude, sloth: FAIL

Files: [src/naive/date/mod.rs](../sloth/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../sloth/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..420755b 100644
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
+        NaiveDateDaysIterator::new(*self)
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
+        NaiveDateWeeksIterator::new(*self)
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2210,25 +2210,39 @@ impl From<NaiveDateTime> for NaiveDate {
 }
 
 /// Iterator over `NaiveDate` with a step size of one day.
+///
+/// Iterates the dates from the starting date up to and including `NaiveDate::MAX`; the back end
+/// of a double-ended iteration starts at `NaiveDate::MAX`.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
     value: NaiveDate,
+    remaining: usize,
+}
+
+impl NaiveDateDaysIterator {
+    const fn new(value: NaiveDate) -> Self {
+        let remaining = NaiveDate::MAX.signed_duration_since(value).num_days() as usize + 1;
+        Self { value, remaining }
+    }
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
+        if self.remaining == 0 {
+            return None;
+        }
+        self.remaining -= 1;
         let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
-        self.value = current.succ_opt()?;
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
 
@@ -2236,33 +2250,50 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
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
+/// Iterates the dates from the starting date for as long as they are representable; the back
+/// end of a double-ended iteration starts at the last of those dates.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
     value: NaiveDate,
+    remaining: usize,
+}
+
+impl NaiveDateWeeksIterator {
+    const fn new(value: NaiveDate) -> Self {
+        let remaining = NaiveDate::MAX.signed_duration_since(value).num_weeks() as usize + 1;
+        Self { value, remaining }
+    }
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
+        if self.remaining == 0 {
+            return None;
+        }
+        self.remaining -= 1;
         let current = self.value;
-        self.value = current.checked_add_days(Days::new(7))?;
+        if self.remaining > 0 {
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
 
@@ -2270,9 +2301,11 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
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
index 0b47ca4..248e2e9 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -730,20 +730,34 @@ fn test_date_parse_from_str() {
 
 #[test]
 fn test_day_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
-        2
-    );
+    let start = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap();
+    assert_eq!(start.iter_days().take(4).count(), 3);
+    assert_eq!(start.iter_days().next_back(), Some(NaiveDate::MAX));
+    assert_eq!(start.iter_days().len(), 3);
 }
 
 #[test]
 fn test_week_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
-    );
+    let start = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap();
+    assert_eq!(start.iter_weeks().take(4).count(), 3);
+    assert_eq!(start.iter_weeks().next_back(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 26));
+}
+
+#[test]
+fn test_iterator_reverse_matches_forward() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut forward: Vec<_> = start.iter_days().take(7).collect();
+    forward.reverse();
+    assert_eq!(forward, start.iter_days().take(7).rev().collect::<Vec<_>>());
+
+    let mut forward: Vec<_> = start.iter_weeks().take(7).collect();
+    forward.reverse();
+    assert_eq!(forward, start.iter_weeks().take(7).rev().collect::<Vec<_>>());
+
+    let mut it = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 30).unwrap().iter_days();
+    assert_eq!(it.next(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 30));
+    assert_eq!(it.next_back(), Some(NaiveDate::MAX));
+    assert_eq!((it.next(), it.next_back()), (None, None));
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

Builds. Now updating the doc examples and tests that relied on the old cursor-style `rev()`.

`NaiveDate::iter_days` and `iter_weeks` now iterate correctly from both ends. Your example passes: `start.iter_days().take(7).rev()` gives the same dates as collecting forward and reversing. The unit tests pass (292), but three doctests fail: `checked_sub_months`, and `checked_add_months` and `checked_sub_months` on `NaiveDateTime`. They fail on a deprecated `std::i32::MAX` and don't touch the iterators. I didn't run with `--all-features`, because that build fails on mutually exclusive `rkyv` size features.

**Cause:** each iterator was a single cursor. `next` moved it up and `next_back` moved it down from the same date, so `.rev()` walked towards `NaiveDate::MIN`. That also explains the `[-258092-07-28]` in your output.

**Fix (`src/naive/date/mod.rs`):** each iterator now stores its start date and how many dates remain up to `NaiveDate::MAX`. `next` and `next_back` each take from their own end and stop when the two meet. `len()` is exact and matches what you actually get.

**Behaviour changes:**
- `iter_days` now yields `NaiveDate::MAX` and `len()` is one higher. Before, it never yielded `MAX`.
- `iter_weeks` now yields the last date reachable in 7-day steps from the start. It also counts one more date than before.
- `.rev()` on its own now starts at the far end, so `date.iter_days().rev()` begins at `NaiveDate::MAX`. Code that used `.rev()` to walk backwards from `date` must now use `.take(n).rev()`.

I changed the `iter_days` and `iter_weeks` doc examples to use `.take(4).rev()`. I replaced the old limit tests with new ones, and added a test that reverse matches forward for days, weeks and the `MAX` boundary.

</details>

### claude, all: FAIL

Files: [src/naive/date/mod.rs](../all/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../all/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..dc16e25 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1341,14 +1341,12 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 1).unwrap().iter_days().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// let last_four: Vec<_> = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_days().rev().take(4).collect();
+    /// assert_eq!(last_four[0], NaiveDate::MAX);
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator::new(*self)
     }
 
     /// Returns an iterator that steps by weeks across all representable dates.
@@ -1372,14 +1370,12 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// let last = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_weeks().next_back().unwrap();
+    /// assert!(last <= NaiveDate::MAX && NaiveDate::MAX - last < chrono::TimeDelta::days(7));
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        NaiveDateWeeksIterator::new(*self)
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2210,25 +2206,39 @@ impl From<NaiveDateTime> for NaiveDate {
 }
 
 /// Iterator over `NaiveDate` with a step size of one day.
+///
+/// Yields every date from the start date up to and including `NaiveDate::MAX`; both ends work on
+/// that same range.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
-    value: NaiveDate,
+    front: i32,
+    end_exclusive: i32,
+}
+
+impl NaiveDateDaysIterator {
+    const fn new(start: NaiveDate) -> Self {
+        Self {
+            front: start.num_days_from_ce(),
+            end_exclusive: NaiveDate::MAX.num_days_from_ce() + 1,
+        }
+    }
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
-        let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
-        self.value = current.succ_opt()?;
+        if self.front >= self.end_exclusive {
+            return None;
+        }
+        let current = NaiveDate::from_num_days_from_ce_opt(self.front)?;
+        self.front += 1;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        let exact_size = (self.end_exclusive - self.front).max(0) as usize;
+        (exact_size, Some(exact_size))
     }
 }
 
@@ -2236,33 +2246,57 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
-        Some(current)
+        if self.front >= self.end_exclusive {
+            return None;
+        }
+        self.end_exclusive -= 1;
+        NaiveDate::from_num_days_from_ce_opt(self.end_exclusive)
     }
 }
 
 impl FusedIterator for NaiveDateDaysIterator {}
 
 /// Iterator over `NaiveDate` with a step size of one week.
+///
+/// Yields the start date and every seventh date after it that is not past `NaiveDate::MAX`; both
+/// ends work on that same range.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
-    value: NaiveDate,
+    front: i32,
+    end_exclusive: i32,
+}
+
+impl NaiveDateWeeksIterator {
+    const fn new(start: NaiveDate) -> Self {
+        Self {
+            front: start.num_days_from_ce(),
+            end_exclusive: NaiveDate::MAX.num_days_from_ce() + 1,
+        }
+    }
+
+    const fn remaining(&self) -> usize {
+        if self.front >= self.end_exclusive {
+            return 0;
+        }
+        ((self.end_exclusive - self.front + 6) / 7) as usize
+    }
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_add_days(Days::new(7))?;
+        if self.remaining() == 0 {
+            return None;
+        }
+        let current = NaiveDate::from_num_days_from_ce_opt(self.front)?;
+        self.front += 7;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        let exact_size = self.remaining();
+        (exact_size, Some(exact_size))
     }
 }
 
@@ -2270,9 +2304,13 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
-        Some(current)
+        let remaining = self.remaining();
+        if remaining == 0 {
+            return None;
+        }
+        let last = self.front + 7 * (remaining as i32 - 1);
+        self.end_exclusive = last;
+        NaiveDate::from_num_days_from_ce_opt(last)
     }
 }
 
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..c206abf 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -730,20 +730,27 @@ fn test_date_parse_from_str() {
 
 #[test]
 fn test_day_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
-        2
-    );
+    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 3);
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut forward: Vec<_> = start.iter_days().take(7).collect();
+    forward.reverse();
+    let both_ends: Vec<_> = start.iter_days().take(7).rev().collect();
+    assert_eq!(forward, both_ends);
+    assert_eq!(start.iter_days().next_back(), Some(NaiveDate::MAX));
+    assert_eq!(start.iter_days().len(), start.iter_days().count());
 }
 
 #[test]
 fn test_week_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
-    );
+    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 3);
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut forward: Vec<_> = start.iter_weeks().take(7).collect();
+    forward.reverse();
+    let both_ends: Vec<_> = start.iter_weeks().take(7).rev().collect();
+    assert_eq!(forward, both_ends);
+    let mut iter = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks();
+    assert_eq!(iter.next_back(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 26));
+    assert_eq!(iter.len(), 2);
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

Done. Both iterators now keep a front and an end, so the reversed window matches the forward one. The new tests and the lib tests pass.

- **Behaviour change:** `.rev()` now walks back from `NaiveDate::MAX`, not from the start date. The old `iter_days` and `iter_weeks` doc examples relied on that, so I rewrote them.
- **Last date:** `next_back` now returns `NaiveDate::MAX`. It was never returned before.
- **Length:** `iter_days().len()` now counts `MAX` and is one higher than before.
- **Existing limit tests:** I updated them because the counts near `MAX` changed.
- **Doc-tests:** Three doc-tests fail (`checked_sub_months`, `NaiveDateTime::checked_add_months` and `checked_sub_months`). They fail the same way without my change, on a deprecated `i32::MAX`.

</details>

### codex, base: pass

Files: [src/naive/date/mod.rs](../base/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../base/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..a81dac9 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1320,7 +1320,8 @@ impl NaiveDate {
         self.format_localized_with_items(StrftimeItems::new_with_locale(fmt, locale), locale)
     }
 
-    /// Returns an iterator that steps by days across all representable dates.
+    /// Returns an iterator that steps by days from this date to, but not including,
+    /// [`NaiveDate::MAX`].
     ///
     /// # Example
     ///
@@ -1341,17 +1342,23 @@ impl NaiveDate {
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
+            remaining: NaiveDate::MAX.signed_duration_since(*self).num_days() as usize,
+        }
     }
 
-    /// Returns an iterator that steps by weeks across all representable dates.
+    /// Returns an iterator that steps by weeks starting at this date.
+    ///
+    /// Only dates that can be followed by another representable date one week later
+    /// are returned.
     ///
     /// # Example
     ///
@@ -1372,14 +1379,17 @@ impl NaiveDate {
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
+            remaining: NaiveDate::MAX.signed_duration_since(*self).num_weeks() as usize,
+        }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2213,22 +2223,24 @@ impl From<NaiveDateTime> for NaiveDate {
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
         self.value = current.succ_opt()?;
+        self.remaining -= 1;
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
+        self.value.checked_add_days(Days::new(self.remaining as u64))
     }
 }
 
@@ -2249,20 +2262,24 @@ impl FusedIterator for NaiveDateDaysIterator {}
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
         self.value = current.checked_add_days(Days::new(7))?;
+        self.remaining -= 1;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2270,9 +2287,11 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
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
index 0b47ca4..786bd49 100644
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
@@ -741,11 +741,64 @@ fn test_day_iterator_limit() {
 fn test_week_iterator_limit() {
     assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
+        NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().rev().take(4).count(),
         2
     );
 }
 
+#[test]
+fn test_date_iterators_reverse() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    for step in [1, 7] {
+        let expected: Vec<_> = (0..7).rev().map(|i| start + Days::new(i * step)).collect();
+        let actual: Vec<_> = if step == 1 {
+            start.iter_days().take(7).rev().collect()
+        } else {
+            start.iter_weeks().take(7).rev().collect()
+        };
+        assert_eq!(actual, expected);
+    }
+}
+
+#[test]
+fn test_date_iterators_mixed_ends() {
+    fn check(mut iter: impl DoubleEndedIterator<Item = NaiveDate> + ExactSizeIterator + Clone) {
+        let expected: Vec<_> = iter.clone().collect();
+        assert_eq!(
+            iter.clone().rev().collect::<Vec<_>>(),
+            expected.iter().rev().copied().collect::<Vec<_>>()
+        );
+        let mut front = 0;
+        let mut back = expected.len();
+        while front < back {
+            assert_eq!(iter.len(), back - front);
+            assert_eq!(iter.size_hint(), (back - front, Some(back - front)));
+            assert_eq!(iter.next(), Some(expected[front]));
+            front += 1;
+            if front < back {
+                assert_eq!(iter.len(), back - front);
+                back -= 1;
+                assert_eq!(iter.next_back(), Some(expected[back]));
+            }
+        }
+        assert_eq!(iter.len(), 0);
+        assert_eq!(iter.next_back(), None);
+        assert_eq!(iter.next(), None);
+        assert_eq!(iter.next_back(), None);
+    }
+
+    for days in 0..22 {
+        let start = NaiveDate::MAX - Days::new(days);
+        check(start.iter_days());
+        check(start.iter_weeks());
+    }
+    assert_eq!(NaiveDate::MIN.iter_days().next(), Some(NaiveDate::MIN));
+    assert_eq!(NaiveDate::MIN.iter_days().next_back(), NaiveDate::MAX.pred_opt());
+    let mut weeks = NaiveDate::MIN.iter_weeks();
+    let last = NaiveDate::MIN + Days::new((weeks.len() as u64 - 1) * 7);
+    assert_eq!(weeks.next_back(), Some(last));
+}
+
 #[test]
 fn test_weeks_from() {
     // tests per: https://github.com/chronotope/chrono/issues/961
```

</details>

<details><summary>reply</summary>

I’ll check both iterators, fix their reverse traversal, and add regression tests for the windowed reversal.


Both iterators use the same cursor for forward and reverse traversal, so `next_back()` walks backward from the start instead of consuming the far end of the range. I’ll track the remaining length so both ends consume the same dates, preserving the existing forward behavior at `NaiveDate::MAX`.


The fix now makes both ends consume the same range, with regression coverage for reversed windows, mixed traversal, lengths, and exhaustion. The full doctest run also found three unrelated failures caused by deprecated APIs; I’m checking the two updated iterator examples separately.


Fixed both `iter_days` and `iter_weeks` so forward and reverse traversal consume the same range. Lengths now stay accurate when mixing both ends, and exhausted iterators remain exhausted. Existing forward boundary behavior is preserved.

Added regression tests and updated documentation examples.

Validation: all 293 unit tests and both iterator doctests pass. The full doctest suite has three unrelated failures involving deprecated APIs.

</details>

### codex, muffle: FAIL

Files: [src/naive/date/mod.rs](../muffle/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../muffle/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..c66233f 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1320,7 +1320,7 @@ impl NaiveDate {
         self.format_localized_with_items(StrftimeItems::new_with_locale(fmt, locale), locale)
     }
 
-    /// Returns an iterator that steps by days across all representable dates.
+    /// Returns an iterator that steps by days from this date through [`NaiveDate::MAX`].
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
+    /// Returns an iterator that steps by weeks from this date through the last representable date
+    /// with the same weekday.
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
index 0b47ca4..65cda25 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -729,21 +729,60 @@ fn test_date_parse_from_str() {
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
+    fn check<I>(mut iter: I, expected: &[NaiveDate])
+    where
+        I: DoubleEndedIterator<Item = NaiveDate> + ExactSizeIterator + Clone,
+    {
+        assert_eq!(iter.len(), expected.len());
+        assert_eq!(iter.size_hint(), (expected.len(), Some(expected.len())));
+        assert!(iter.clone().eq(expected.iter().copied()));
+        assert!(iter.clone().rev().eq(expected.iter().rev().copied()));
+        let mut front = 0;
+        let mut back = expected.len();
+        while front < back {
+            assert_eq!(iter.next(), Some(expected[front]));
+            front += 1;
+            assert_eq!(iter.len(), back - front);
+            if front < back {
+                back -= 1;
+                assert_eq!(iter.next_back(), Some(expected[back]));
+                assert_eq!(iter.len(), back - front);
+            }
+        }
+        assert_eq!(iter.next(), None);
+        assert_eq!(iter.next_back(), None);
+        assert_eq!(iter.next(), None);
+        assert_eq!(iter.len(), 0);
+    }
 
-#[test]
-fn test_week_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
-    );
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    for count in [0, 1, 2, 7] {
+        let days: Vec<_> = (0..count).map(|n| start + Days::new(n)).collect();
+        check(start.iter_days().take(count as usize), &days);
+        let weeks: Vec<_> = (0..count).map(|n| start + Days::new(n * 7)).collect();
+        check(start.iter_weeks().take(count as usize), &weeks);
+    }
+    for offset in 0..21 {
+        let start = NaiveDate::MAX - Days::new(offset);
+        let days: Vec<_> = (0..=offset).map(|n| start + Days::new(n)).collect();
+        check(start.iter_days(), &days);
+        let weeks: Vec<_> = (0..=offset / 7).map(|n| start + Days::new(n * 7)).collect();
+        check(start.iter_weeks(), &weeks);
+    }
+    assert_eq!(NaiveDate::MIN.iter_days().next(), Some(NaiveDate::MIN));
+    assert_eq!(NaiveDate::MIN.iter_days().next_back(), Some(NaiveDate::MAX));
+    assert_eq!(start.iter_days().next_back(), Some(NaiveDate::MAX));
+    let last_week = start.iter_weeks().next_back().unwrap();
+    assert_eq!(last_week.weekday(), start.weekday());
+    assert!((NaiveDate::MAX - last_week).num_days() < 7);
+
+    let mut days = start.iter_days();
+    assert_eq!(days.nth(usize::MAX), None);
+    check(days, &[]);
+    let mut weeks = start.iter_weeks();
+    assert_eq!(weeks.nth_back(usize::MAX), None);
+    check(weeks, &[]);
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

I’ll check how the day and week iterators define their ranges, fix reverse iteration, and add regression tests for both.

Both iterators currently use reverse iteration to move backward from the start date. I’ll make both ends consume the same finite range, include the last reachable date, and update the examples to show reversing a taken window.

Fixed both iterators so forward and reverse iteration consume the same range. Days now include `NaiveDate::MAX`; weeks include the last reachable date with the starting weekday.

Added regression coverage for reversed windows, mixed iteration, lengths, boundaries, and exhaustion. Updated the examples.

Validation passed: 290 library tests, 224 without default features, formatting, and both iterator doctests. The full doctest run had three unrelated failures involving deprecated `std::i32::MAX`.

</details>

### codex, hush: FAIL

Files: [src/naive/date/mod.rs](../hush/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../hush/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..b951eaa 100644
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
+            remaining: (NaiveDate::MAX.to_epoch_days() - self.to_epoch_days()) as usize + 1,
+        }
     }
 
-    /// Returns an iterator that steps by weeks across all representable dates.
+    /// Returns an iterator that steps by weeks from this date through the last representable date
+    /// with the same weekday.
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
+            remaining: (NaiveDate::MAX.to_epoch_days() - self.to_epoch_days()) as usize / 7 + 1,
+        }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2213,22 +2220,26 @@ impl From<NaiveDateTime> for NaiveDate {
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
 
@@ -2236,10 +2247,11 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
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
 
@@ -2249,20 +2261,26 @@ impl FusedIterator for NaiveDateDaysIterator {}
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
 
@@ -2270,9 +2288,11 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
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
index 0b47ca4..7715264 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -729,21 +729,54 @@ fn test_date_parse_from_str() {
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
+    fn check(mut iter: impl DoubleEndedIterator<Item = NaiveDate> + ExactSizeIterator) {
+        let initial_len = iter.len();
+        let first = iter.next().unwrap();
+        assert_eq!(iter.len(), initial_len - 1);
+        let last = iter.next_back().unwrap();
+        assert!(last >= first);
+        assert_eq!(iter.len(), initial_len - 2);
+        let remaining: Vec<_> = iter.by_ref().collect();
+        assert_eq!(remaining.len(), initial_len - 2);
+        assert_eq!(iter.len(), 0);
+        assert_eq!(iter.next(), None);
+        assert_eq!(iter.next_back(), None);
+    }
 
-#[test]
-fn test_week_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
-    );
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    for weeks in [false, true] {
+        let step = if weeks { 7 } else { 1 };
+        let expected: Vec<_> =
+            (0..7).rev().map(|i| start.checked_add_days(Days::new(i * step)).unwrap()).collect();
+        if weeks {
+            assert_eq!(start.iter_weeks().take(7).rev().collect::<Vec<_>>(), expected);
+            check(start.iter_weeks().take(7));
+        } else {
+            assert_eq!(start.iter_days().take(7).rev().collect::<Vec<_>>(), expected);
+            assert_eq!(start.iter_days().next_back(), Some(NaiveDate::MAX));
+            check(start.iter_days().take(7));
+        }
+    }
+    for offset in 0..15 {
+        let start = NaiveDate::MAX.checked_sub_days(Days::new(offset)).unwrap();
+        let days: Vec<_> = start.iter_days().collect();
+        assert_eq!(days.len(), offset as usize + 1);
+        assert_eq!(days.last(), Some(&NaiveDate::MAX));
+        assert_eq!(
+            start.iter_days().rev().collect::<Vec<_>>(),
+            days.into_iter().rev().collect::<Vec<_>>()
+        );
+        let weeks: Vec<_> = start.iter_weeks().collect();
+        assert_eq!(weeks.len(), offset as usize / 7 + 1);
+        assert_eq!(start.iter_weeks().len(), weeks.len());
+        assert_eq!(
+            start.iter_weeks().rev().collect::<Vec<_>>(),
+            weeks.into_iter().rev().collect::<Vec<_>>()
+        );
+    }
+    assert_eq!(NaiveDate::MIN.iter_days().next(), Some(NaiveDate::MIN));
+    assert_eq!(NaiveDate::MIN.iter_weeks().next(), Some(NaiveDate::MIN));
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

Iterator bounds need inspection; reverse traversal must share forward range.


Done.
Fixed both iterators’ reverse bounds, lengths, exhaustion, endpoint inclusion; added regression tests. 290 unit tests passed; three unrelated doctests failed on deprecated `std::i32::MAX`.

</details>

### codex, sloth: pass

Files: [src/naive/date/mod.rs](../sloth/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../sloth/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..a36f073 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1320,7 +1320,8 @@ impl NaiveDate {
         self.format_localized_with_items(StrftimeItems::new_with_locale(fmt, locale), locale)
     }
 
-    /// Returns an iterator that steps by days across all representable dates.
+    /// Returns an iterator that steps by days from this date up to, but excluding,
+    /// [`NaiveDate::MAX`].
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
+            remaining: NaiveDate::MAX.signed_duration_since(*self).num_days() as usize,
+        }
     }
 
-    /// Returns an iterator that steps by weeks across all representable dates.
+    /// Returns an iterator that steps by weeks from this date while another full week
+    /// can be added without exceeding [`NaiveDate::MAX`].
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
+            remaining: NaiveDate::MAX.signed_duration_since(*self).num_weeks() as usize,
+        }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2213,22 +2221,24 @@ impl From<NaiveDateTime> for NaiveDate {
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
         self.value = current.succ_opt()?;
+        self.remaining -= 1;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2236,11 +2246,18 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
+        if self.remaining == 0 {
+            return None;
+        }
+        let current = self.value.checked_add_days(Days::new((self.remaining - 1) as u64))?;
+        self.remaining -= 1;
         Some(current)
     }
+
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        self.remaining = self.remaining.saturating_sub(n);
+        self.next_back()
+    }
 }
 
 impl FusedIterator for NaiveDateDaysIterator {}
@@ -2249,20 +2266,24 @@ impl FusedIterator for NaiveDateDaysIterator {}
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
         self.value = current.checked_add_days(Days::new(7))?;
+        self.remaining -= 1;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2270,10 +2291,18 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
+        if self.remaining == 0 {
+            return None;
+        }
+        let current = self.value.checked_add_days(Days::new((self.remaining - 1) as u64 * 7))?;
+        self.remaining -= 1;
         Some(current)
     }
+
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        self.remaining = self.remaining.saturating_sub(n);
+        self.next_back()
+    }
 }
 
 impl FusedIterator for NaiveDateWeeksIterator {}
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..1f4a90a 100644
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
@@ -741,7 +741,7 @@ fn test_day_iterator_limit() {
 fn test_week_iterator_limit() {
     assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
+        NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().rev().take(4).count(),
         2
     );
 }
```

</details>

<details><summary>reply</summary>

I’ll check how both iterators define their ranges and use those bounds to fix reverse iteration, then build and run the existing tests.

Both iterators use one cursor for two different directions, which violates the `DoubleEndedIterator` contract. I’ll track how many dates remain so both ends consume the same range, preserving the existing forward bounds.

The change reaches the two constructors and iterator implementations, their examples, and two existing boundary tests. Exports and configuration need no changes. Reverse iteration will change behavior: it will start at the end of the forward range instead of walking backward from the starting date.

The fix is in place and builds successfully. Both ends now share a remaining count, and reverse skipping is efficient for calls such as `take(7).rev()`.

The existing unit tests pass. The full test run hit three unrelated doctest failures caused by deprecated `std::i32::MAX` references; I’m checking the final run after the reverse-skipping change.

Fixed both iterators so forward and reverse iteration consume the same range, stop when they meet, and report the correct remaining length. `take(7).rev()` now works efficiently.

Updated the examples and existing boundary tests. Build and formatting checks pass, as do all unit and integration tests and both iterator doctests. Three unrelated doctests still fail on deprecated `std::i32::MAX` references.

</details>

### codex, all: FAIL

Files: [src/naive/date/mod.rs](../all/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../all/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..8232930 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1320,7 +1320,7 @@ impl NaiveDate {
         self.format_localized_with_items(StrftimeItems::new_with_locale(fmt, locale), locale)
     }
 
-    /// Returns an iterator that steps by days across all representable dates.
+    /// Returns an iterator that steps by days from this date through [`NaiveDate::MAX`].
     ///
     /// # Example
     ///
@@ -1341,17 +1341,20 @@ impl NaiveDate {
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
+    /// Returns an iterator that steps by weeks from this date through the last representable week.
     ///
     /// # Example
     ///
@@ -1372,14 +1375,17 @@ impl NaiveDate {
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
@@ -2213,22 +2219,26 @@ impl From<NaiveDateTime> for NaiveDate {
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
+            self.value = current.succ_opt().unwrap();
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2236,10 +2246,16 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
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
+    }
+
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        self.remaining = self.remaining.saturating_sub(n);
+        self.next_back()
     }
 }
 
@@ -2249,20 +2265,26 @@ impl FusedIterator for NaiveDateDaysIterator {}
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
 
@@ -2270,9 +2292,16 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
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
+    }
+
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        self.remaining = self.remaining.saturating_sub(n);
+        self.next_back()
     }
 }
 
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..36d4dcc 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -730,19 +730,19 @@ fn test_date_parse_from_str() {
 
 #[test]
 fn test_day_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
+    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 3);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
-        2
+        NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().rev().take(4).count(),
+        3
     );
 }
 
 #[test]
 fn test_week_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
+    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 3);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
+        NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().rev().take(4).count(),
+        3
     );
 }
```

</details>

<details><summary>reply</summary>

Done.
Fixed both iterators’ reverse ranges, lengths, boundary inclusion; updated docs/tests. 291 unit tests, iterator doctests, formatting pass. Three unrelated doctests fail deprecated constants.

</details>
