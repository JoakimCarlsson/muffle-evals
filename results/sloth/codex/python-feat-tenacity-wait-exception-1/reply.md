I’ll check how the existing wait strategies are implemented and tested, then add `wait_exception` and its public export.

The strategy and export are in place. The focused tests pass for decorator and `Retrying` usage, exact callback delays, composition, and `RuntimeError` when no exception is available. I’ll now run the full suite and build the package. The literal HTTP example can’t run here because `requests` isn’t installed.

Added and exported `tenacity.wait_exception(predicate)`. It passes the last exception to the callback, returns its exact delay, and raises `RuntimeError` when no exception exists.

Source build succeeded; tests: **126 passed, 1 skipped**.

Left out HTTP-specific handling; that belongs in the callback. The literal HTTP example wasn’t run because `requests` isn’t installed. Ruff reported existing repository lint issues.
