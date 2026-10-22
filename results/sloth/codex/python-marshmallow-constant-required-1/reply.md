I’ll check how `Constant` handles defaults and loading, make the smallest fix, then run the existing tests.

The conflict comes from `Constant` setting a load default that the base field rejects with `required=True`. I’ll keep the fix inside `Constant`, preserving its `required` metadata and allowing missing input to use the constant. Schema loading and collection fields already use the shared field methods, so no callers, fixtures, config, or exports need changes. I’ll preserve the existing `None` and validation behavior and add no new options or tests.

Fixed `Constant` to accept `required=True` while preserving the required metadata. Missing input returns the constant, supplied values resolve to the constant, and `Constant(None)` still works.

Verified the requested examples, all 1,136 existing tests passed, and the package built successfully.
