I'd like `Slab` to have a `get_disjoint_mut`, like the one on slices, `HashMap` and `IndexMap`, so I can get mutable references to several entries at once (for example to swap two values) without unsafe code or juggling `remove`/`insert`.

Signature I'm after:

```rust
pub fn get_disjoint_mut<const N: usize>(&mut self, keys: [usize; N]) -> Result<[&mut T; N], GetDisjointMutError>
```

The result is in the same order as `keys`. `GetDisjointMutError` would be a new public enum, exported from the crate root, deriving `Debug`, `Clone`, `PartialEq` and `Eq`, with these variants:

- `OverlappingIndices`: the same key appears twice. This is checked for all keys before anything else, so `[42, 2, 1, 2]` gives this error even though 42 is out of bounds and 1 is vacant.
- `IndexOutOfBounds`: a key is past the end of the slab.
- `IndexVacant`: a key is in bounds but has no value.

Otherwise the keys are checked in order and the first bad one decides the error: with a 5-slot slab where key 1 is vacant, `[1, 5]` is `IndexVacant` and `[5, 1]` is `IndexOutOfBounds`. An empty key array returns `Ok([])`.

```rust
let mut slab = Slab::new();
let a = slab.insert(1);
let b = slab.insert(2);
let [x, y] = slab.get_disjoint_mut([a, b]).unwrap();
std::mem::swap(x, y);
assert_eq!((slab[a], slab[b]), (2, 1));
```

Please add this.
