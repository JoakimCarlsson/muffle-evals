BytesMut needs range checks before reserve, then copying within allocated storage.


Done.
Added `BytesMut::extend_from_within` with bounds checks, growth, docs, tests. All-feature tests, no-default-features check, formatting passed.
