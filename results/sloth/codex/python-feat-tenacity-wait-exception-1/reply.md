I’ll check the wait strategies, exports, and callers, then add `wait_exception` in the same style and run the existing checks.

The change needs a `wait_base` subclass and entries in the package imports and `__all__`. Existing retry runners and wait combinators already support that interface, and the API docs discover wait classes automatically. No fixtures or config changes are needed; HTTP header parsing stays in your callback.

`wait_exception` is implemented. Validation hit missing tools: Tornado blocks full test collection, and `build`, Ruff, and pip are unavailable. I’ll run the remaining tests and try the repository’s build entry point.

Added `tenacity.wait_exception(predicate)` with public exports and wait-strategy composition support. It passes the last exception to your callback and returns its wait unchanged. Missing outcomes or attempts without exceptions raise `RuntimeError`.

Validation: 119 tests passed, 1 skipped. Tornado tests, build, and lint checks were blocked by missing dependencies/tools.
