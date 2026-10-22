I'd like an iterator version of `str::strip_prefix` in `Itertools`. Right now, to check that an iterator starts with some items and then keep going with the rest, I have to write the loop by hand every time.

What I have in mind:

- `iter.strip_prefix(prefix)`, where `prefix` is anything `IntoIterator` whose items `Self::Item` can be compared to with `PartialEq`. If the iterator starts with all of the prefix's items, in order, it returns `Ok(iter)` advanced past the prefix (an empty prefix gives back the whole iterator).
- `iter.strip_prefix_by(prefix, eq)`, the same but with an `FnMut(&Self::Item, &PrefixItem) -> bool` closure to compare items, so the prefix can have a different item type.

When the prefix doesn't match, I'd like to get back what was consumed rather than lose it. The `Err` should be a new public struct `StripPrefixError` with public fields:

- `iterator`: the original iterator, stopped right after the item that didn't match;
- `prefix`: the rest of the prefix iterator, after the prefix item that didn't match;
- `mismatch`: a tuple `(Option<Self::Item>, PrefixItem)`, the iterator's item (or `None` if the iterator ran out first) and the prefix item it was compared with.

For example:

```rust
use itertools::Itertools;

let rest = (1..6).strip_prefix([1, 2]).unwrap().collect_vec(); // [3, 4, 5]

let err = (1..6).strip_prefix([1, 2, 9, 4]).unwrap_err();
// err.mismatch == (Some(3), 9), err.prefix yields [4], err.iterator yields [4, 5]

let err = (1..3).strip_prefix([1, 2, 3]).unwrap_err();
// err.mismatch == (None, 3), err.iterator is empty
```

`"hello".chars().strip_prefix("he".chars())` should agree with `"hello".strip_prefix("he")`.

Please add this.
