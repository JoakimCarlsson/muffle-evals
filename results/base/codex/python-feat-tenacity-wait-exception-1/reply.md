I’ll check how the existing wait strategies are implemented, add `wait_exception`, and test its callback and error behavior.

The strategy is implemented, and all 98 tests in `test_tenacity.py` pass, including the new cases. The full suite cannot collect because Tornado is missing; I’ll run the remaining tests. Ruff is also unavailable.

Added `tenacity.wait_exception(predicate)` with public export, documentation, and tests.

It passes the last exception to the callback and returns its delay unchanged. It raises `RuntimeError` when no exception is available and supports wait-strategy composition.

Validation: 123 passed, 1 skipped with Tornado tests excluded. Full collection requires Tornado; Ruff was unavailable.
