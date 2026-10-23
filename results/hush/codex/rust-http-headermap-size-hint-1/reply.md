Header iterator bounds need inspection; fix and regression check follow.


Done.
Fixed `Iter`/`IterMut` bounds, including `values` variants. Added regression coverage. `cargo test`: 415 passed.
