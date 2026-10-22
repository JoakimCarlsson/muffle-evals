I’ll check the shared iterator code and its callers, fix the lower-bound calculation, then build and run the existing tests.

Both `Iter` and `IterMut` count the current header after its last value has been consumed. Their `Values` and `ValuesMut` wrappers inherit the same bug. I’ll adjust both calculations to exclude that header when the cursor is empty, including for an empty map. No API, fixture, config, or export changes are needed.

Fixed the lower-bound calculation in [src/header/map.rs](/home/jdaddy/.cache/muffle-evals/runs/sloth/codex/rust-http-headermap-size-hint-1/work/src/header/map.rs:2367) for both `Iter` and `IterMut`, also fixing their values wrappers. Exhausted iterators now report a lower bound of zero, including empty maps.

Build succeeded; all 414 existing tests passed.
