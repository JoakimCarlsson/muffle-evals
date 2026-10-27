I’ll check the existing removal iterators and tests, then add lazy extraction with the same range handling and ordering conventions.

The existing indexed removal code preserves order and updates key lookups immediately. I’ll reuse it and the range validator for both iterators. Each match will shift the entries after it, so extracting many entries can take quadratic time.

Both iterators are implemented. Tests cover the supplied example, bounded ranges, value mutation, early drop, lookup consistency, size hints, repeated exhaustion, and empty or invalid ranges. The all-features tests and no-default-features build check are now running.

Added both public `ExtractIf` iterators with lazy, ordered extraction, range bounds, map value mutation, safe early drop, `size_hint`, `FusedIterator`, and `Debug`.

Passed all-features tests and the no-default-features build check. Workspace member tests were not run.

limit: removals shift following entries, so bulk extraction can be quadratic; revisit if performance requires it. No extra iterator features added.
