BytesMut method needs range validation before reserve; checking existing range helpers and allocation paths.


Done. Added `BytesMut::extend_from_within`; bounds checked before growth.
All 1,302 tests passed; no-default-features build and formatting passed.
