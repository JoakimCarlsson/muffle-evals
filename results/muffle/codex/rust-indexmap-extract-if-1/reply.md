I’ll check the existing removal iterators, add `extract_if` for both collections, and test ordering, early drop, and predicate panics.

The crate denies unsafe code. I’ll use a safe iterator design that restores unvisited entries on drop, including when the predicate panics.

The implementation and workspace tests pass, including coverage for early drop, value mutation, range bounds, and predicate panics. The safe design temporarily allocates storage for the suffix; I’ll document that cost and finish the no-std check.

Added `extract_if` to `IndexMap` and `IndexSet`, with public `ExtractIf` iterators implementing `Iterator`, `FusedIterator`, and `Debug`.

Tests cover ordering, ranges, value mutation, early drop, size hints, and panic recovery. All-feature workspace tests and the no-std check pass.

The safe implementation temporarily allocates storage for the suffix; this cost is documented.
