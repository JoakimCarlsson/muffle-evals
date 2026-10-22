The iterator returned by `NaiveDate::iter_days` behaves unexpectedly when iterated in reverse. Consider:

```rust
let start = chrono::NaiveDate::from_ymd_opt(2025, 10, 10).unwrap();

let mut next_seven_rev1: Vec<_> = start.iter_days().take(7).collect();
next_seven_rev1.reverse();

let next_seven_rev2: Vec<_> = start.iter_days().take(7).rev().collect();

assert_eq!(next_seven_rev1, next_seven_rev2);
```

I would expect the assertion to pass, but it does not:

```
assertion `left == right` failed
  left: [2025-10-16, 2025-10-15, 2025-10-14, 2025-10-13, 2025-10-12, 2025-10-11, 2025-10-10]
 right: [-258092-07-28]
```

`iter_weeks` seems to have the same problem. As far as I can tell, `start.iter_days().len()` reports the number of days until `NaiveDate::MAX`, but `start.iter_days().next_back()` is not `NaiveDate::MAX`. Per the `DoubleEndedIterator` docs, both ends should work on the same range and stop when they meet, so taking a window of these iterators and reversing it should give the same dates as going forward, just in reverse order.

Please fix this.
