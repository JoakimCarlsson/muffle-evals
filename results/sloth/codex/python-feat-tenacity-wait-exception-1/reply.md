I’ll check the wait strategies, exports, and tests, then add `wait_exception` using the existing conventions.

The change needs to reach `tenacity/wait.py`, the package import and `__all__`, and the existing wait tests. The API docs discover strategies automatically. I’ll use `wait_base` so composition works as usual, and raise `RuntimeError` when the state has no exception. No HTTP dependency or header parsing is needed; that stays in your callback.

The implementation and tests pass: 124 passed, 1 skipped. The tests cover callback delays, exception identity, retry integration, composition, and states without exceptions. I’m finishing formatting and packaging checks; the environment is missing both `build` and `pip`.

Added `tenacity.wait_exception(predicate)` with public export, strategy composition, and `RuntimeError` when no exception is available.

Tests: 124 passed, 1 skipped. Formatting passed after correction. Lint reports existing repository issues. Package build was blocked by missing build tooling (`build`, `pip`, and `setuptools_scm`).
