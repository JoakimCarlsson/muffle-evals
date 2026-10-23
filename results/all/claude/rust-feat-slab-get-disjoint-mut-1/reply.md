Done. Added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum, plus a test, a doc example and a CHANGELOG entry. All tests pass.

- **MSRV:** I raised `rust-version` in `Cargo.toml` from 1.46 to 1.55, because const generics and `array::map` need it. I didn't build on 1.55 itself, only on the installed 1.99.
- **Unsafe:** the method uses a small `unsafe` block internally. Your calling code stays safe, and the keys are checked first.
