I’ll check the existing wait strategies and tests, then add `wait_exception`, its public export, and coverage for both exception and result-based retries.

The strategy is implemented, exported, and documented. All tests pass, including checks that the callback receives the original exception and that result-based retries raise `RuntimeError`. I’m finishing verification; the repository-wide lint check reports existing issues, and mypy is unavailable in this environment.

Added `tenacity.wait_exception(predicate)` with public export, documentation, and a release note.

It passes the last exception to the callback and returns its wait time unchanged. It raises `RuntimeError` when no exception is available and supports composition with other wait strategies.

Validation: 126 tests passed, 1 skipped; documentation doctests and formatting passed. Lint reports existing issues; mypy is unavailable.
