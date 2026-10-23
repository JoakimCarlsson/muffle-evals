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
| claude | muffle | **FAIL** | +111/-25 | 0 | 6,892 | $0.140 |
| claude | hush | **FAIL** | +168/-37 | 0 | 6,969 | $0.153 |
| claude | sloth | pass | +65/-27 | 0 | 6,413 | $0.155 |
| claude | all | **FAIL** | +73/-29 | 0 | 5,357 | $0.143 |
| codex | base | pass | +93/-21 | 0 | 3,256 | - |
| codex | muffle | **FAIL** | +112/-37 | 0 | 2,773 | - |
| codex | hush | **FAIL** | +111/-38 | 0 | 2,282 | - |
| codex | sloth | pass | +81/-19 | 0 | 2,880 | - |
| codex | all | pass | +97/-19 | 0 | 3,532 | - |

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
index 4c306b5..97ace7a 100644
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
+        NaiveDateDaysIterator { value: *self, end: NaiveDate::MAX, done: false }
     }
 
     /// Returns an iterator that steps by weeks across all representable dates.
@@ -1372,14 +1372,20 @@ impl NaiveDate {
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
+        let remaining_days = NaiveDate::MAX.num_days_from_ce() - self.num_days_from_ce();
+        // `remaining_days` is within `0..=MAX - MIN`, so stepping back never leaves the range.
+        let end = match NaiveDate::MAX.add_days(-(remaining_days % 7)) {
+            Some(end) => end,
+            None => NaiveDate::MAX,
+        };
+        NaiveDateWeeksIterator { value: *self, end, done: false }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2210,25 +2216,40 @@ impl From<NaiveDateTime> for NaiveDate {
 }
 
 /// Iterator over `NaiveDate` with a step size of one day.
+///
+/// Yields every date from the starting date up to and including `NaiveDate::MAX`. Iterating from
+/// the back starts at `NaiveDate::MAX`.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
+    // Inclusive bounds of the remaining range; `done` is set once it is empty (needed because
+    // `NaiveDate::MAX` has no successor and `NaiveDate::MIN` no predecessor).
     value: NaiveDate,
+    end: NaiveDate,
+    done: bool,
 }
 
 impl Iterator for NaiveDateDaysIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MAX`.
+        if self.done {
+            return None;
+        }
         let current = self.value;
-        // This can't panic because current is < NaiveDate::MAX:
-        self.value = current.succ_opt()?;
+        match current.succ_opt() {
+            Some(next) if current < self.end => self.value = next,
+            _ => self.done = true,
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        let exact_size = if self.done {
+            0
+        } else {
+            (self.end.num_days_from_ce() - self.value.num_days_from_ce()) as usize + 1
+        };
+        (exact_size, Some(exact_size))
     }
 }
 
@@ -2236,9 +2257,14 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
+        if self.done {
+            return None;
+        }
+        let current = self.end;
+        match current.pred_opt() {
+            Some(prev) if self.value < current => self.end = prev,
+            _ => self.done = true,
+        }
         Some(current)
     }
 }
@@ -2246,23 +2272,40 @@ impl DoubleEndedIterator for NaiveDateDaysIterator {
 impl FusedIterator for NaiveDateDaysIterator {}
 
 /// Iterator over `NaiveDate` with a step size of one week.
+///
+/// Yields the starting date and every date a whole number of weeks after it that is not past
+/// `NaiveDate::MAX`. Iterating from the back starts at the last of those dates.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
+    // Inclusive bounds of the remaining range, a whole number of weeks apart; see
+    // `NaiveDateDaysIterator` for `done`.
     value: NaiveDate,
+    end: NaiveDate,
+    done: bool,
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
+        if self.done {
+            return None;
+        }
         let current = self.value;
-        self.value = current.checked_add_days(Days::new(7))?;
+        match current.checked_add_days(Days::new(7)) {
+            Some(next) if current < self.end => self.value = next,
+            _ => self.done = true,
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        let exact_size = if self.done {
+            0
+        } else {
+            ((self.end.num_days_from_ce() - self.value.num_days_from_ce()) / 7) as usize + 1
+        };
+        (exact_size, Some(exact_size))
     }
 }
 
@@ -2270,8 +2313,14 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
+        if self.done {
+            return None;
+        }
+        let current = self.end;
+        match current.checked_sub_days(Days::new(7)) {
+            Some(prev) if self.value < current => self.end = prev,
+            _ => self.done = true,
+        }
         Some(current)
     }
 }
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..9b45682 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -730,20 +730,57 @@ fn test_date_parse_from_str() {
 
 #[test]
 fn test_day_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
+    let last = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap();
+    assert_eq!(last.iter_days().take(4).count(), 3);
+    assert_eq!(last.iter_days().next_back(), Some(NaiveDate::MAX));
+    assert_eq!(NaiveDate::MAX.iter_days().collect::<Vec<_>>(), [NaiveDate::MAX]);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
-        2
+        NaiveDate::MIN.iter_days().len(),
+        (NaiveDate::MAX - NaiveDate::MIN).num_days() as usize + 1
     );
 }
 
+#[test]
+fn test_day_iterator_rev() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut fwd: Vec<_> = start.iter_days().take(7).collect();
+    fwd.reverse();
+    let rev: Vec<_> = start.iter_days().take(7).rev().collect();
+    assert_eq!(fwd, rev);
+
+    // both ends meet without overlap
+    let mut it = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days();
+    assert_eq!(it.next(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29));
+    assert_eq!(it.next_back(), Some(NaiveDate::MAX));
+    assert_eq!(it.len(), 1);
+    assert_eq!(it.next(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 30));
+    assert_eq!(it.next(), None);
+    assert_eq!(it.next_back(), None);
+}
+
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
+    assert_eq!(start.iter_weeks().len(), 3);
+    assert_eq!(NaiveDate::MAX.iter_weeks().collect::<Vec<_>>(), [NaiveDate::MAX]);
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
+    assert_eq!(it.next(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 19));
+    assert_eq!(it.next(), None);
+    assert_eq!(it.next_back(), None);
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

Fix is in and tests pass; I'm doing a last check that the whole library builds and passes.

`iter_days` and `iter_weeks` now work as proper double-ended iterators, and your example passes. The full lib test suite (293 tests), the two `iter_*` doc tests and clippy all pass. I haven't committed anything.

**Cause:** the iterator only stored its current date. `next_back` walked backwards from that same date instead of starting at the far end. `len()` was counting towards `NaiveDate::MAX` while `next_back` ignored it.

**Fix (`src/naive/date/mod.rs`):** both iterators now hold an inclusive front and back plus a `done` flag. Forward and backward iteration share one range and stop when they meet.
- **`iter_days`:** the range is `start..=NaiveDate::MAX`, so `next_back()` returns `NaiveDate::MAX` first.
- **`iter_weeks`:** the back end is the last start-plus-N-weeks date that doesn't pass `MAX`.
- **`len()`:** it now matches what iteration actually yields.

**Behaviour changes:**
- **`MAX` is now yielded:** the old forward iteration silently dropped `NaiveDate::MAX` for days, and the last in-range week date for weeks. So `NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).iter_days().take(4)` now gives 3 items, not 2.
- **`rev()` semantics:** `date.iter_days().rev()` used to walk backwards from `date`. It now starts from `MAX`. To go backwards from a date, use `take(n).rev()` as in your example.
- **Docs and tests:** I updated the doc examples on `iter_days` and `iter_weeks` that relied on the old `rev()` behaviour. I also changed `test_day_iterator_limit` and `test_week_iterator_limit` to the new counts, and added `test_day_iterator_rev` and `test_week_iterator_rev`. They cover your reproduction, front and back meeting, and the `MAX` edge cases.

</details>

### claude, hush: FAIL

Files: [src/naive/date/mod.rs](../hush/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../hush/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..76a49ed 100644
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
+    /// // `rev` walks back from `NaiveDate::MAX`, not from the starting date.
+    /// let start = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap();
+    /// let mut rev = start.iter_days().rev();
+    /// assert_eq!(rev.next(), Some(NaiveDate::MAX));
+    /// let window: Vec<_> = start.iter_days().take(4).rev().collect();
+    /// assert_eq!(window, expected.iter().rev().copied().collect::<Vec<_>>());
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator::new(*self)
     }
 
     /// Returns an iterator that steps by weeks across all representable dates.
@@ -1372,14 +1374,14 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// // `rev` walks back from the last week-aligned date, not from the starting date.
+    /// let start = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap();
+    /// let window: Vec<_> = start.iter_weeks().take(4).rev().collect();
+    /// assert_eq!(window, expected.iter().rev().copied().collect::<Vec<_>>());
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        NaiveDateWeeksIterator::new(*self)
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2210,25 +2212,56 @@ impl From<NaiveDateTime> for NaiveDate {
 }
 
 /// Iterator over `NaiveDate` with a step size of one day.
+///
+/// Both ends cover the same inclusive range, from the starting date up to `NaiveDate::MAX`.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
-    value: NaiveDate,
+    front: NaiveDate,
+    back: NaiveDate,
+    done: bool,
+}
+
+impl NaiveDateDaysIterator {
+    const fn new(start: NaiveDate) -> Self {
+        Self { front: start, back: NaiveDate::MAX, done: false }
+    }
+
+    fn remaining(&self) -> usize {
+        if self.done {
+            0
+        } else {
+            self.back.signed_duration_since(self.front).num_days() as usize + 1
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
+        if self.done {
+            return None;
+        }
+        let current = self.front;
+        match current == self.back {
+            true => self.done = true,
+            false => self.front = current.succ_opt()?,
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        let exact_size = self.remaining();
+        (exact_size, Some(exact_size))
+    }
+
+    fn nth(&mut self, n: usize) -> Option<Self::Item> {
+        if n >= self.remaining() {
+            self.done = true;
+            return None;
+        }
+        self.front = self.front.checked_add_days(Days::new(n as u64))?;
+        self.next()
     }
 }
 
@@ -2236,33 +2269,86 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        // We return the current value, and have no way to return `NaiveDate::MIN`.
-        let current = self.value;
-        self.value = current.pred_opt()?;
+        if self.done {
+            return None;
+        }
+        let current = self.back;
+        match current == self.front {
+            true => self.done = true,
+            false => self.back = current.pred_opt()?,
+        }
         Some(current)
     }
+
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        if n >= self.remaining() {
+            self.done = true;
+            return None;
+        }
+        self.back = self.back.checked_sub_days(Days::new(n as u64))?;
+        self.next_back()
+    }
 }
 
 impl FusedIterator for NaiveDateDaysIterator {}
 
 /// Iterator over `NaiveDate` with a step size of one week.
+///
+/// Both ends cover the same range: the starting date plus whole weeks, up to `NaiveDate::MAX`.
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
-    value: NaiveDate,
+    front: NaiveDate,
+    // Always `front` plus a whole number of weeks.
+    back: NaiveDate,
+    done: bool,
+}
+
+impl NaiveDateWeeksIterator {
+    const fn new(start: NaiveDate) -> Self {
+        let days = NaiveDate::MAX.signed_duration_since(start).num_days();
+        let back = match NaiveDate::MAX.checked_sub_days(Days::new((days % 7) as u64)) {
+            Some(back) => back,
+            None => start,
+        };
+        Self { front: start, back, done: false }
+    }
+
+    fn remaining(&self) -> usize {
+        if self.done {
+            0
+        } else {
+            self.back.signed_duration_since(self.front).num_weeks() as usize + 1
+        }
+    }
 }
 
 impl Iterator for NaiveDateWeeksIterator {
     type Item = NaiveDate;
 
     fn next(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_add_days(Days::new(7))?;
+        if self.done {
+            return None;
+        }
+        let current = self.front;
+        match current == self.back {
+            true => self.done = true,
+            false => self.front = current.checked_add_days(Days::new(7))?,
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_weeks();
-        (exact_size as usize, Some(exact_size as usize))
+        let exact_size = self.remaining();
+        (exact_size, Some(exact_size))
+    }
+
+    fn nth(&mut self, n: usize) -> Option<Self::Item> {
+        if n >= self.remaining() {
+            self.done = true;
+            return None;
+        }
+        self.front = self.front.checked_add_days(Days::new(n as u64 * 7))?;
+        self.next()
     }
 }
 
@@ -2270,10 +2356,25 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
+        if self.done {
+            return None;
+        }
+        let current = self.back;
+        match current == self.front {
+            true => self.done = true,
+            false => self.back = current.checked_sub_days(Days::new(7))?,
+        }
         Some(current)
     }
+
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        if n >= self.remaining() {
+            self.done = true;
+            return None;
+        }
+        self.back = self.back.checked_sub_days(Days::new(n as u64 * 7))?;
+        self.next_back()
+    }
 }
 
 impl FusedIterator for NaiveDateWeeksIterator {}
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..6d2dad4 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -730,20 +730,50 @@ fn test_date_parse_from_str() {
 
 #[test]
 fn test_day_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
-        2
-    );
+    let start = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap();
+    assert_eq!(start.iter_days().take(4).count(), 3);
+    assert_eq!(start.iter_days().len(), 3);
+    assert_eq!(start.iter_days().next_back(), Some(NaiveDate::MAX));
+    assert_eq!(NaiveDate::MAX.iter_days().collect::<Vec<_>>(), [NaiveDate::MAX]);
+    assert_eq!(NaiveDate::MAX.iter_days().rev().collect::<Vec<_>>(), [NaiveDate::MAX]);
+}
+
+#[test]
+fn test_day_iterator_rev() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut forward: Vec<_> = start.iter_days().take(7).collect();
+    forward.reverse();
+    let backward: Vec<_> = start.iter_days().take(7).rev().collect();
+    assert_eq!(forward, backward);
+
+    // Both ends stop where they meet.
+    let mut it = start.iter_days().take(3);
+    assert_eq!(it.next(), Some(start));
+    assert_eq!(it.next_back(), start.checked_add_days(Days::new(2)));
+    assert_eq!(it.next_back(), start.checked_add_days(Days::new(1)));
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
+    let start = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap();
+    assert_eq!(start.iter_weeks().take(4).count(), 3);
+    assert_eq!(start.iter_weeks().len(), 3);
+    assert_eq!(start.iter_weeks().next_back(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 26));
+    assert_eq!(NaiveDate::MAX.iter_weeks().rev().collect::<Vec<_>>(), [NaiveDate::MAX]);
+    // Last item is the last date reachable in whole weeks.
+    let start = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 30).unwrap();
+    assert_eq!(start.iter_weeks().collect::<Vec<_>>(), [start]);
+}
+
+#[test]
+fn test_week_iterator_rev() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut forward: Vec<_> = start.iter_weeks().take(7).collect();
+    forward.reverse();
+    let backward: Vec<_> = start.iter_weeks().take(7).rev().collect();
+    assert_eq!(forward, backward);
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

My test was wrong. Dec 12 plus whole weeks reaches Dec 26, not Dec 31, so `next_back` correctly returns Dec 26. I'm fixing the assertion.

Done. Both iterators now keep front and back ends and stop where they meet. `rev()` now starts at `NaiveDate::MAX` for days, and at the last whole-week date for weeks. `len()` now includes `MAX`. I added `nth` and `nth_back`, because `take(7).rev()` would otherwise step through about 94 million items. The existing `iter_days`/`iter_weeks` doctests and limit tests relied on the old `rev()` and are rewritten. Library tests and the new reverse tests pass. Three unrelated doctests (`checked_add_months`, `checked_sub_months`) fail on a deprecated `std::i32::MAX`, which this change doesn't touch.

</details>

### claude, sloth: pass

Files: [src/naive/date/mod.rs](../sloth/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../sloth/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..5eb107d 100644
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
+    /// let mut reversed: Vec<_> = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_days().take(4).rev().collect();
+    /// reversed.reverse();
+    /// assert_eq!(reversed, expected);
     /// ```
     #[inline]
     pub const fn iter_days(&self) -> NaiveDateDaysIterator {
-        NaiveDateDaysIterator { value: *self }
+        NaiveDateDaysIterator { value: *self, end: NaiveDate::MAX }
     }
 
     /// Returns an iterator that steps by weeks across all representable dates.
@@ -1372,14 +1371,13 @@ impl NaiveDate {
     /// }
     /// assert_eq!(count, 4);
     ///
-    /// for d in NaiveDate::from_ymd_opt(2016, 3, 19).unwrap().iter_weeks().rev().take(4) {
-    ///     count -= 1;
-    ///     assert_eq!(d, expected[count]);
-    /// }
+    /// let mut reversed: Vec<_> = NaiveDate::from_ymd_opt(2016, 2, 27).unwrap().iter_weeks().take(4).rev().collect();
+    /// reversed.reverse();
+    /// assert_eq!(reversed, expected);
     /// ```
     #[inline]
     pub const fn iter_weeks(&self) -> NaiveDateWeeksIterator {
-        NaiveDateWeeksIterator { value: *self }
+        NaiveDateWeeksIterator { value: *self, end: NaiveDate::MAX }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2210,25 +2208,31 @@ impl From<NaiveDateTime> for NaiveDate {
 }
 
 /// Iterator over `NaiveDate` with a step size of one day.
+///
+/// Yields the dates from the starting date up to, but excluding, `NaiveDate::MAX`. Iterating from
+/// the back starts at the last of those dates.
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
+        // This can't panic because current is < end <= NaiveDate::MAX:
         self.value = current.succ_opt()?;
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        let exact_size = self.end.signed_duration_since(self.value).num_days().max(0) as usize;
+        (exact_size, Some(exact_size))
     }
 }
 
@@ -2236,33 +2240,41 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
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
     }
 }
 
 impl FusedIterator for NaiveDateDaysIterator {}
 
 /// Iterator over `NaiveDate` with a step size of one week.
+///
+/// Yields the dates a whole number of weeks after the starting date that are less than
+/// `NaiveDate::MAX`. Iterating from the back starts at the last of those dates.
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
-        (exact_size as usize, Some(exact_size as usize))
+        let exact_size = self.end.signed_duration_since(self.value).num_weeks().max(0) as usize;
+        (exact_size, Some(exact_size))
     }
 }
 
@@ -2270,9 +2282,12 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
-        Some(current)
+        let remaining = self.len() as u64;
+        if remaining == 0 {
+            return None;
+        }
+        self.end = self.value.checked_add_days(Days::new(7 * (remaining - 1)))?;
+        Some(self.end)
     }
 }
 
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..5646699 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -732,18 +732,41 @@ fn test_date_parse_from_str() {
 fn test_day_iterator_limit() {
     assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap().iter_days().take(4).count(), 2);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 3).unwrap().iter_days().rev().take(4).count(),
-        2
+        NaiveDate::from_ymd_opt(MAX_YEAR, 12, 28).unwrap().iter_days().rev().take(4).count(),
+        3
     );
+
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut forward: Vec<_> = start.iter_days().take(7).collect();
+    forward.reverse();
+    assert_eq!(forward, start.iter_days().take(7).rev().collect::<Vec<_>>());
+    assert_eq!(start.iter_days().next_back(), NaiveDate::MAX.pred_opt());
+
+    let mut iter = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 28).unwrap().iter_days();
+    assert_eq!(iter.next_back(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 30));
+    assert_eq!(iter.next(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 28));
+    assert_eq!(iter.next(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29));
+    assert_eq!((iter.next(), iter.next_back()), (None, None));
 }
 
 #[test]
 fn test_week_iterator_limit() {
     assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
+        NaiveDate::from_ymd_opt(MAX_YEAR, 12, 5).unwrap().iter_weeks().rev().take(4).count(),
+        3
     );
+
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut forward: Vec<_> = start.iter_weeks().take(7).collect();
+    forward.reverse();
+    assert_eq!(forward, start.iter_weeks().take(7).rev().collect::<Vec<_>>());
+
+    let mut iter = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 5).unwrap().iter_weeks();
+    assert_eq!(iter.next_back(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 19));
+    assert_eq!(iter.next(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 5));
+    assert_eq!(iter.next(), NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12));
+    assert_eq!((iter.next(), iter.next_back()), (None, None));
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

Running the tests again; `--all-features` clashes with rkyv's size features, so I'm using the default features.

Doc tests were filtered out; running them too.

I fixed it. `iter_days` and `iter_weeks` now keep a front and a back end, so both ends work on the same range and stop when they meet. Your example now passes. The date tests and the two `iter_*` doc tests pass. I didn't run the rest of the suite, and `--all-features` doesn't build here because rkyv's `size_*` features conflict.

**Behaviour change:** `.rev()` used to walk backward from the start date, and the old docs and tests relied on that. It now starts at the end of the range, which matches the `DoubleEndedIterator` docs. If you want a backward walk from a date, use `successors` or an explicit loop. I rewrote the doc examples and the old `rev()` test cases to match.

**`NaiveDate::MAX` is still excluded.** The old forward iteration never yielded it, and `len()` already counted only the dates before it. So `start.iter_days().next_back()` is `NaiveDate::MAX.pred_opt()`, not `MAX`. Including `MAX` would need a different representation, so I left it out.

The change is in `src/naive/date/mod.rs`, with new cases in `test_day_iterator_limit` and `test_week_iterator_limit` in `src/naive/date/tests.rs`. They cover your reverse-equals-reversed-forward example, the meeting of both ends near `MAX_YEAR`, and exhaustion.

I haven't committed anything.

</details>

### claude, all: FAIL

Files: [src/naive/date/mod.rs](../all/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../all/claude/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..4f6261e 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1341,14 +1341,17 @@ impl NaiveDate {
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
+            remaining: (NaiveDate::MAX.num_days_from_ce() - self.num_days_from_ce()) as usize + 1,
+        }
     }
 
     /// Returns an iterator that steps by weeks across all representable dates.
@@ -1372,14 +1375,18 @@ impl NaiveDate {
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
+            remaining: ((NaiveDate::MAX.num_days_from_ce() - self.num_days_from_ce()) / 7) as usize
+                + 1,
+        }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2210,25 +2217,32 @@ impl From<NaiveDateTime> for NaiveDate {
 }
 
 /// Iterator over `NaiveDate` with a step size of one day.
+///
+/// Iterates from the start date up to and including `NaiveDate::MAX`. Iterating in reverse starts
+/// at `NaiveDate::MAX`.
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
 
@@ -2236,33 +2250,43 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
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
+/// Iterates from the start date while the date is representable. Iterating in reverse starts at
+/// the last date of that sequence.
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
 
@@ -2270,9 +2294,11 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
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
index 0b47ca4..7021614 100644
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
+    let start = NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).unwrap();
+    assert_eq!(start.iter_days().take(4).count(), 3);
+    assert_eq!(start.iter_days().next_back(), Some(NaiveDate::MAX));
+    assert_eq!(NaiveDate::MAX.iter_days().collect::<Vec<_>>(), [NaiveDate::MAX]);
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
+fn test_iterator_double_ended() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+
+    let mut days: Vec<_> = start.iter_days().take(7).collect();
+    days.reverse();
+    assert_eq!(days, start.iter_days().take(7).rev().collect::<Vec<_>>());
+    let mut weeks: Vec<_> = start.iter_weeks().take(7).collect();
+    weeks.reverse();
+    assert_eq!(weeks, start.iter_weeks().take(7).rev().collect::<Vec<_>>());
+
+    let mut iter = start.iter_days();
+    let len = iter.len();
+    assert_eq!(iter.next_back(), Some(NaiveDate::MAX));
+    assert_eq!(iter.len(), len - 1);
+    let mut iter = NaiveDate::MAX.pred_opt().unwrap().iter_days();
+    assert_eq!(iter.next_back(), Some(NaiveDate::MAX));
+    assert_eq!(iter.next(), NaiveDate::MAX.pred_opt());
+    assert_eq!((iter.next(), iter.next_back()), (None, None));
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

Doc examples need rewriting: rev now starts from MAX.

Done. `iter_days`/`iter_weeks` now track a remaining count; `next_back` starts at the true end (`NaiveDate::MAX` for days) and both ends meet.

Behavior changes:
- `.rev()` without `take` now starts from the end, not walking back toward `MIN`.
- `NaiveDate::MAX` is now yielded, so limit tests went 2→3.
- Doc examples and limit tests were updated, and I added `test_iterator_double_ended`.

Lib `naive::date` tests and iterator doctests pass. `--all-features` fails on an rkyv feature conflict, so it was not run.

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
index 4c306b5..9d274dd 100644
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
+    /// Returns an iterator that steps by weeks from this date through the last representable date
+    /// on the same weekly step sequence, inclusive.
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
@@ -2213,22 +2220,32 @@ impl From<NaiveDateTime> for NaiveDate {
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateDaysIterator {
     value: NaiveDate,
+    // Number of dates left, starting at `value` and separated by the step size.
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
+        let current = self.value.checked_add_days(Days::new(n as u64)).unwrap();
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
 
@@ -2236,10 +2253,16 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
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
+        self.value.checked_add_days(Days::new(self.remaining as u64))
     }
 }
 
@@ -2249,20 +2272,32 @@ impl FusedIterator for NaiveDateDaysIterator {}
 #[derive(Debug, Copy, Clone, Hash, PartialEq, PartialOrd, Eq, Ord)]
 pub struct NaiveDateWeeksIterator {
     value: NaiveDate,
+    // Number of dates left, starting at `value` and separated by the step size.
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
 
@@ -2270,9 +2305,16 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
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
index 0b47ca4..aae109c 100644
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
+    fn check(mut iter: impl DoubleEndedIterator<Item = NaiveDate> + ExactSizeIterator + Clone) {
+        let expected: Vec<_> = iter.clone().collect();
+        assert_eq!(iter.len(), expected.len());
+        assert_eq!(iter.size_hint(), (expected.len(), Some(expected.len())));
+        assert_eq!(
+            iter.clone().rev().collect::<Vec<_>>(),
+            expected.iter().rev().copied().collect::<Vec<_>>()
+        );
+        let (mut front, mut back) = (0, expected.len());
+        while front < back {
+            assert_eq!(iter.next(), Some(expected[front]));
+            front += 1;
+            if front < back {
+                back -= 1;
+                assert_eq!(iter.next_back(), Some(expected[back]));
+            }
+            assert_eq!(iter.len(), back - front);
+        }
+        assert_eq!(iter.next(), None);
+        assert_eq!(iter.next_back(), None);
+        assert_eq!(iter.next(), None);
+    }
 
-#[test]
-fn test_week_iterator_limit() {
-    assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
-    assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
-        2
-    );
+    for offset in 0..22 {
+        let start = NaiveDate::MAX.checked_sub_days(Days::new(offset)).unwrap();
+        check(start.iter_days());
+        check(start.iter_weeks());
+        assert_eq!(start.iter_days().len(), offset as usize + 1);
+        assert_eq!(start.iter_weeks().len(), offset as usize / 7 + 1);
+        assert_eq!(start.iter_days().next_back(), Some(NaiveDate::MAX));
+        assert_eq!(
+            start.iter_weeks().next_back(),
+            start.checked_add_days(Days::new(offset / 7 * 7))
+        );
+    }
+    for start in [NaiveDate::MIN, NaiveDate::from_ymd_opt(2025, 10, 10).unwrap()] {
+        check(start.iter_days().take(7));
+        check(start.iter_weeks().take(7));
+        assert_eq!(start.iter_days().next_back(), Some(NaiveDate::MAX));
+    }
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    let mut days = start.iter_days();
+    assert_eq!(days.nth(usize::MAX), None);
+    assert_eq!(days.next_back(), None);
+    let mut weeks = start.iter_weeks();
+    assert_eq!(weeks.nth_back(usize::MAX), None);
+    assert_eq!(weeks.next(), None);
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

I’ll check the day and week iterators, fix their reverse traversal, and add regression tests for bounded reversal and mixed forward/backward iteration.

Both iterators currently use the same date as a cursor in either direction, so reversing walks into a different range. I’ll track the remaining range explicitly, include the final representable date on each iterator’s step sequence, and make skipping efficient so `.take(7).rev()` doesn’t walk through millions of dates.

The fix passes all 290 unit tests, including the new regression tests. Those tests also pass with default features disabled. The iterators now report the correct remaining length and stop when forward and backward traversal meet; documentation and integration tests are still running.

Fixed both iterators to traverse the same range from either end. Your assertion now passes.

Lengths are accurate, endpoints are included, and mixed forward/backward iteration stops correctly. Added regression tests and updated documentation.

All unit and integration tests pass. Three unrelated doctests fail because existing deprecated constants trigger `deny(warnings)`.

</details>

### codex, hush: FAIL

Files: [src/naive/date/mod.rs](../hush/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../hush/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..26d9930 100644
--- a/src/naive/date/mod.rs
+++ b/src/naive/date/mod.rs
@@ -1320,7 +1320,9 @@ impl NaiveDate {
         self.format_localized_with_items(StrftimeItems::new_with_locale(fmt, locale), locale)
     }
 
-    /// Returns an iterator that steps by days across all representable dates.
+    /// Returns an iterator that steps by days from this date through the last representable date.
+    ///
+    /// Reversing the iterator starts at the last date in this range.
     ///
     /// # Example
     ///
@@ -1341,17 +1343,22 @@ impl NaiveDate {
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
+            remaining: (NaiveDate::MAX.signed_duration_since(*self).num_days() / 1 + 1) as usize,
+        }
     }
 
-    /// Returns an iterator that steps by weeks across all representable dates.
+    /// Returns an iterator that steps by weeks from this date through the last representable date.
+    ///
+    /// Reversing the iterator starts at the last date in this range.
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
+            remaining: (NaiveDate::MAX.signed_duration_since(*self).num_days() / 7 + 1) as usize,
+        }
     }
 
     /// Returns the [`NaiveWeek`] that the date belongs to, starting with the [`Weekday`]
@@ -2213,22 +2223,31 @@ impl From<NaiveDateTime> for NaiveDate {
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
+            self.value = current.checked_add_days(Days::new(1))?;
+        }
         Some(current)
     }
 
     fn size_hint(&self) -> (usize, Option<usize>) {
-        let exact_size = NaiveDate::MAX.signed_duration_since(self.value).num_days();
-        (exact_size as usize, Some(exact_size as usize))
+        (self.remaining, Some(self.remaining))
     }
 }
 
@@ -2236,10 +2255,16 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
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
 
@@ -2249,20 +2274,31 @@ impl FusedIterator for NaiveDateDaysIterator {}
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
 
@@ -2270,9 +2306,16 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
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
index 0b47ca4..4d728cd 100644
--- a/src/naive/date/tests.rs
+++ b/src/naive/date/tests.rs
@@ -729,21 +729,51 @@ fn test_date_parse_from_str() {
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
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    for step in [1, 7] {
+        let check = |mut iter: Box<dyn DoubleEndedIterator<Item = NaiveDate>>| {
+            assert_eq!(iter.next(), Some(start));
+            assert_eq!(iter.next_back(), Some(start + Days::new(step * 2)));
+            assert_eq!(iter.next_back(), Some(start + Days::new(step)));
+            assert_eq!(iter.next(), None);
+            assert_eq!(iter.next_back(), None);
+        };
+        if step == 1 {
+            check(Box::new(start.iter_days().take(3)));
+        } else {
+            check(Box::new(start.iter_weeks().take(3)));
+        }
+    }
+    let mut expected: Vec<_> = start.iter_days().take(7).collect();
+    expected.reverse();
+    assert_eq!(expected, start.iter_days().take(7).rev().collect::<Vec<_>>());
+    let mut expected: Vec<_> = start.iter_weeks().take(7).collect();
+    expected.reverse();
+    assert_eq!(expected, start.iter_weeks().take(7).rev().collect::<Vec<_>>());
+
+    for offset in 0..15 {
+        let start = NaiveDate::MAX - Days::new(offset);
+        let mut days = start.iter_days();
+        assert_eq!(days.len(), offset as usize + 1);
+        assert_eq!(days.next_back(), Some(NaiveDate::MAX));
+        assert_eq!(days.len(), offset as usize);
+        assert_eq!(days.count(), offset as usize);
+        let mut weeks = start.iter_weeks();
+        assert_eq!(weeks.len(), offset as usize / 7 + 1);
+        assert_eq!(weeks.next_back(), Some(start + Days::new(offset / 7 * 7)));
+        assert_eq!(weeks.len(), offset as usize / 7);
+        assert_eq!(weeks.count(), offset as usize / 7);
+    }
+    let mut days = NaiveDate::MIN.iter_days();
+    assert_eq!(days.next(), Some(NaiveDate::MIN));
+    assert_eq!(days.next_back(), Some(NaiveDate::MAX));
+    assert_eq!(days.nth(usize::MAX), None);
+    assert_eq!(days.next_back(), None);
+    let mut weeks = NaiveDate::MIN.iter_weeks();
+    assert_eq!(weeks.next(), Some(NaiveDate::MIN));
+    assert_eq!(weeks.nth_back(usize::MAX), None);
+    assert_eq!(weeks.next(), None);
 }
 
 #[test]
```

</details>

<details><summary>reply</summary>

Iterator ends must share one range. Checking day/week bounds and reverse tests.


Done.
Fixed day/week reverse ranges, lengths, exhaustion; included endpoints. 290 tests passed; no-default-features check passed. Three unrelated doctests fail on deprecated constants.

</details>

### codex, sloth: pass

Files: [src/naive/date/mod.rs](../sloth/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../sloth/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..c7875da 100644
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
@@ -1341,17 +1341,19 @@ impl NaiveDate {
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
+    /// Returns an iterator that steps by weeks from this date.
+    ///
+    /// Dates are yielded while another full week fits within the representable range.
     ///
     /// # Example
     ///
@@ -1372,14 +1374,14 @@ impl NaiveDate {
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
@@ -2213,21 +2215,23 @@ impl From<NaiveDateTime> for NaiveDate {
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
@@ -2236,10 +2240,11 @@ impl ExactSizeIterator for NaiveDateDaysIterator {}
 
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
     }
 }
 
@@ -2249,19 +2254,23 @@ impl FusedIterator for NaiveDateDaysIterator {}
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
@@ -2270,9 +2279,12 @@ impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
     fn next_back(&mut self) -> Option<Self::Item> {
-        let current = self.value;
-        self.value = current.checked_sub_days(Days::new(7))?;
-        Some(current)
+        let weeks = self.len();
+        if weeks == 0 {
+            return None;
+        }
+        self.end = self.value.checked_add_days(Days::new((weeks as u64 - 1) * 7))?;
+        Some(self.end)
     }
 }
 
diff --git a/src/naive/date/tests.rs b/src/naive/date/tests.rs
index 0b47ca4..c573205 100644
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
@@ -741,11 +741,61 @@ fn test_day_iterator_limit() {
 fn test_week_iterator_limit() {
     assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
+        NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().rev().take(4).count(),
         2
     );
 }
 
+/// Both ends consume the same range, including when a window is reversed.
+#[test]
+fn test_date_iterators_reverse() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    for step in [1, 7] {
+        let expected: Vec<_> =
+            (0..7).rev().map(|n| start.checked_add_days(Days::new(n * step)).unwrap()).collect();
+        if step == 1 {
+            assert_eq!(start.iter_days().take(7).rev().collect::<Vec<_>>(), expected);
+        } else {
+            assert_eq!(start.iter_weeks().take(7).rev().collect::<Vec<_>>(), expected);
+        }
+    }
+    assert_eq!(NaiveDate::MIN.iter_days().next(), Some(NaiveDate::MIN));
+    assert_eq!(NaiveDate::MIN.iter_weeks().next(), Some(NaiveDate::MIN));
+    for offset in 0..22 {
+        let start = NaiveDate::MAX.checked_sub_days(Days::new(offset)).unwrap();
+        let mut days = start.iter_days();
+        assert_eq!(days.len(), offset as usize);
+        assert_eq!(days.next_back(), if offset == 0 { None } else { NaiveDate::MAX.pred_opt() });
+        let mut weeks = start.iter_weeks();
+        assert_eq!(weeks.len(), offset as usize / 7);
+        let expected: Vec<_> = weeks.collect();
+        assert_eq!(
+            weeks.by_ref().rev().collect::<Vec<_>>(),
+            expected.iter().rev().copied().collect::<Vec<_>>()
+        );
+        assert_eq!(weeks.next(), None);
+        assert_eq!(weeks.next_back(), None);
+        let mut weeks = start.iter_weeks();
+        let mut expected = std::collections::VecDeque::from(weeks.collect::<Vec<_>>());
+        while !expected.is_empty() {
+            assert_eq!(weeks.next(), expected.pop_front());
+            assert_eq!(weeks.next_back(), expected.pop_back());
+            assert_eq!(weeks.len(), expected.len());
+        }
+        assert_eq!(weeks.next(), None);
+        assert_eq!(weeks.next_back(), None);
+        let mut days = start.iter_days();
+        let mut expected = std::collections::VecDeque::from(days.collect::<Vec<_>>());
+        while !expected.is_empty() {
+            assert_eq!(days.next(), expected.pop_front());
+            assert_eq!(days.next_back(), expected.pop_back());
+            assert_eq!(days.len(), expected.len());
+        }
+        assert_eq!(days.next(), None);
+        assert_eq!(days.next_back(), None);
+    }
+}
+
 #[test]
 fn test_weeks_from() {
     // tests per: https://github.com/chronotope/chrono/issues/961
```

</details>

<details><summary>reply</summary>

I’ll check how both iterators define their ranges, fix reverse traversal, and add regression coverage for the example and date boundaries.

Both iterators currently move the same date backward in `next_back()`, so reverse traversal leaves the range reported by `len()`. I’ll give each iterator a separate back boundary while preserving its existing forward range, including its upper-limit behavior.

The change reaches the two constructors, iterator implementations, documentation examples, and existing iterator tests. Exports and configuration need no changes. Direct `.rev()` calls will now traverse the forward range from its far end.

The fix passes all 292 unit tests, including the seven-date example, mixed front/back consumption, and exhaustion checks for both iterators. The build without default features also passes. The full test run is still working through the integration tests.

Fixed both iterators to track separate front and back boundaries. Reversing a taken window now produces the expected dates, and mixed-direction iteration stops when the ends meet. Existing forward ranges are preserved.

Added regression tests and updated documentation examples.

Validation: all 292 unit tests, integration tests, and the build without default features pass. Both iterator doctests pass; three unrelated doctests fail because they use deprecated `core::i32::MAX`.

</details>

### codex, all: pass

Files: [src/naive/date/mod.rs](../all/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/mod.rs), [src/naive/date/tests.rs](../all/codex/rust-chrono-iter-days-rev-1/files/src/naive/date/tests.rs)

<details><summary>diff</summary>

```diff
diff --git a/src/naive/date/mod.rs b/src/naive/date/mod.rs
index 4c306b5..f89a9a1 100644
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
@@ -1341,17 +1341,19 @@ impl NaiveDate {
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
+    /// Returns an iterator that steps by weeks from this date.
+    ///
+    /// Only dates with a representable successor one week later are included.
     ///
     /// # Example
     ///
@@ -1372,14 +1374,14 @@ impl NaiveDate {
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
@@ -2213,21 +2215,23 @@ impl From<NaiveDateTime> for NaiveDate {
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
@@ -2235,11 +2239,21 @@ impl Iterator for NaiveDateDaysIterator {
 impl ExactSizeIterator for NaiveDateDaysIterator {}
 
 impl DoubleEndedIterator for NaiveDateDaysIterator {
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        if n >= self.len() {
+            self.end = self.value;
+            return None;
+        }
+        self.end = self.end.checked_sub_days(Days::new(n as u64))?;
+        self.next_back()
+    }
+
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
 
@@ -2249,19 +2263,23 @@ impl FusedIterator for NaiveDateDaysIterator {}
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
@@ -2269,10 +2287,23 @@ impl Iterator for NaiveDateWeeksIterator {
 impl ExactSizeIterator for NaiveDateWeeksIterator {}
 
 impl DoubleEndedIterator for NaiveDateWeeksIterator {
+    fn nth_back(&mut self, n: usize) -> Option<Self::Item> {
+        let remaining = self.len();
+        if n >= remaining {
+            self.end = self.value;
+            return None;
+        }
+        self.end = self.value.checked_add_days(Days::new((remaining - n) as u64 * 7))?;
+        self.next_back()
+    }
+
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
index 0b47ca4..f29de88 100644
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
@@ -741,11 +741,58 @@ fn test_day_iterator_limit() {
 fn test_week_iterator_limit() {
     assert_eq!(NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().take(4).count(), 2);
     assert_eq!(
-        NaiveDate::from_ymd_opt(MIN_YEAR, 1, 15).unwrap().iter_weeks().rev().take(4).count(),
+        NaiveDate::from_ymd_opt(MAX_YEAR, 12, 12).unwrap().iter_weeks().rev().take(4).count(),
         2
     );
 }
 
+/// Checks reverse windows, shared bounds, lengths, and exhaustion for both step sizes.
+#[test]
+fn test_date_iterator_reverse() {
+    let start = NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();
+    for offset in 0..15 {
+        let near_max = NaiveDate::MAX.checked_sub_days(Days::new(offset)).unwrap();
+        for date in [start, NaiveDate::MIN, near_max] {
+            for count in [0, 1, 7, 20] {
+                let mut days: Vec<_> = date.iter_days().take(count).collect();
+                days.reverse();
+                assert_eq!(days, date.iter_days().take(count).rev().collect::<Vec<_>>());
+                let mut weeks: Vec<_> = date.iter_weeks().take(count).collect();
+                weeks.reverse();
+                assert_eq!(weeks, date.iter_weeks().take(count).rev().collect::<Vec<_>>());
+            }
+        }
+        let mut days = near_max.iter_days();
+        let mut weeks = near_max.iter_weeks();
+        while days.len() > 0 {
+            let len = days.len();
+            assert!(days.next().is_some());
+            assert_eq!(days.len(), len - 1);
+            if days.len() > 0 {
+                assert!(days.next_back().is_some());
+                assert_eq!(days.len(), len - 2);
+            }
+        }
+        while weeks.len() > 0 {
+            let len = weeks.len();
+            assert!(weeks.next_back().is_some());
+            assert_eq!(weeks.len(), len - 1);
+            if weeks.len() > 0 {
+                assert!(weeks.next().is_some());
+                assert_eq!(weeks.len(), len - 2);
+            }
+        }
+        assert_eq!(days.next(), None);
+        assert_eq!(days.next_back(), None);
+        assert_eq!(weeks.next(), None);
+        assert_eq!(weeks.next_back(), None);
+    }
+    assert_eq!(start.iter_days().next_back(), NaiveDate::MAX.pred_opt());
+    let mut weeks = start.iter_weeks();
+    let last = start.checked_add_days(Days::new((weeks.len() as u64 - 1) * 7));
+    assert_eq!(weeks.next_back(), last);
+}
+
 #[test]
 fn test_weeks_from() {
     // tests per: https://github.com/chronotope/chrono/issues/961
```

</details>

<details><summary>reply</summary>

Done.
Fixed both iterators’ reverse bounds, exhaustion, lengths; added regression tests. Build/tests pass except 3 unrelated doctests failing deprecated `core::i32::MAX` warnings.

</details>
