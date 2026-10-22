I’ll add `wait_exception` alongside the existing wait strategies and test both exception-based waits and the error case for rejected results.

The strategy, export, tests, and documentation are in place. Validation hit missing test tools (`tornado` and `ruff`); I’ll install the development dependencies and rerun the checks.

Added `tenacity.wait_exception(predicate)` with public export, documentation, and release note.

It passes the last exception to the callback and returns its wait time unchanged. It supports wait composition and raises `RuntimeError` when no exception is available.

Validation: 127 tests passed, 1 skipped; all 31 documentation tests passed; formatting passed. Ruff lint reported existing repository issues.
