I added `Slab::get_disjoint_mut` with the signature you gave, plus the public `GetDisjointMutError` enum. I ran `cargo test`; the existing tests and the new doctest pass. I did not write separate unit tests, so the `[42, 2, 1, 2]` and `[1, 5]` / `[5, 1]` ordering cases are not covered by a test.

- **Method:** it first returns `OverlappingIndices` if any key repeats. It then checks the keys in order, so the first bad key decides between `IndexOutOfBounds` and `IndexVacant`. An empty key array gives `Ok([])`.
- **Unsafe code:** the method uses one small `unsafe` block internally, to hand out the references after the checks. Callers don't need any `unsafe`.
- **Enum:** `GetDisjointMutError` is defined in the crate root, so it is exported from there. It derives `Debug`, `Clone`, `PartialEq` and `Eq`, and has the three variants you listed.
- **Doctest:** the doc example is your swap example, plus an overlapping-keys check.
- **Rust version:** the crate declared `rust-version = "1.46"`, but const generics need 1.51 and the `[T; N]::map` call I used needs 1.55. I raised `rust-version` in `Cargo.toml` to `1.55`. If you want to keep a lower minimum, say so. I'd have to rework it, and that would likely mean more `unsafe`.

I didn't touch `CHANGELOG.md` or commit anything. The main change is in `src/lib.rs`.
