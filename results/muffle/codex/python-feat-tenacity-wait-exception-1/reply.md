I’ll check the existing wait strategies and tests, then add `wait_exception` with a top-level export and coverage for exception and result-based retries.

The new tests pass, including exact delays, composition with another wait strategy, and `RuntimeError` for rejected results. The full suite is blocked by a missing Tornado dependency; I’ll run the remaining tests. Ruff is also unavailable in this environment.

Added `tenacity.wait_exception(predicate)` and its top-level export.

It passes the last attempt’s exception to the callback and returns its delay unchanged. It supports wait composition and raises `RuntimeError` when no exception is available.

Added tests, documentation, and a release note. Validation: 123 tests passed, 1 skipped. Tornado tests and Ruff checks were blocked by missing dependencies.
