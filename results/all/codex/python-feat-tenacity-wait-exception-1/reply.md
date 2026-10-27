I’ll check the wait strategies, exports, and tests, then add `wait_exception` and verify exception and result-retry behavior.


Done.
Added exported `wait_exception(predicate)` with RuntimeError for missing exceptions. Compilation passed; 127 tests passed, 1 skipped. Lint reports existing violations.
