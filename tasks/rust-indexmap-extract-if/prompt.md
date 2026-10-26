I'd like `IndexMap` and `IndexSet` to have an `extract_if`, like the one on `Vec` and `HashMap`, so I can remove the entries matching a predicate and get them back as an iterator, without retaining and collecting in two passes.

Signatures I'm after:

```rust
impl<K, V, S> IndexMap<K, V, S> {
    pub fn extract_if<F, R>(&mut self, range: R, pred: F) -> ExtractIf<'_, K, V, F>
    where
        F: FnMut(&K, &mut V) -> bool,
        R: RangeBounds<usize>;
}

impl<T, S> IndexSet<T, S> {
    pub fn extract_if<F, R>(&mut self, range: R, pred: F) -> ExtractIf<'_, T, F>
    where
        F: FnMut(&T) -> bool,
        R: RangeBounds<usize>;
}
```

`ExtractIf` is a new public iterator type in `indexmap::map` and another in `indexmap::set`, implementing `Iterator` (items are `(K, V)` for the map and `T` for the set), `FusedIterator`, and `Debug`. Only the entries whose index is inside `range` are tested; the predicate gets `&mut V` for maps so it can change values of entries it keeps. Extracted entries come out in index order and the remaining entries keep their relative order. It is lazy: only as many entries are visited as the iterator is advanced, and if it is dropped before it is exhausted (say after `.take(n)`), the rest of the range is left in the map untouched, with the map still in a consistent state (lookups by key still work). `size_hint` has a lower bound of 0 and an upper bound of the entries left in the range.

```rust
let mut map: IndexMap<i32, i32> = (0..8).map(|i| (i, i * 10)).collect();
let odd: Vec<_> = map.extract_if(.., |k, _| k % 2 == 1).collect();
assert_eq!(odd, [(1, 10), (3, 30), (5, 50), (7, 70)]);
assert!(map.keys().copied().eq([0, 2, 4, 6]));
```

Please add this.
