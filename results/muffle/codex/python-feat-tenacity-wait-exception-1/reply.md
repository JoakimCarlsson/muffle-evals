I’ll check the existing wait strategies, add `wait_exception` and its export, then test exception-based waits and result-based retries.

The strategy, export, and documentation are in place. Tests cover passing the original exception, exact sleep durations, composition, and `RuntimeError` for result retries. The full suite hit a missing Tornado dependency; I’ll run the remaining tests and formatting checks.

Added `tenacity.wait_exception(predicate)` with documentation and tests. It passes the last exception to the callback, returns its wait duration unchanged, and raises `RuntimeError` when no exception exists. It also supports wait composition.

Validation: 123 tests passed, 1 skipped. Tornado tests could not run because Tornado is missing; Ruff is also unavailable.
