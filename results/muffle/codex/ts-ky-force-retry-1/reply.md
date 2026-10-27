I’ll check how retries, response hooks, and upload progress work, then add `ky.retry()` with tests and documentation.

Forced retries now use the existing retry loop, so they share the retry limit and `beforeRetry` hooks. I also moved upload progress wrapping to just before sending each request, so replacement requests get their own progress reports and body size.

The new tests pass for forced POST retries, retry limits, custom requests, upload totals, timeout, and abort handling. The full suite hit missing Playwright browser binaries; I’m checking the remaining tests separately to identify any implementation failures.

All 191 tests outside the browser suite passed, and the added request-reuse regression test also passes. Build checks pass. Browser verification remains blocked by missing Playwright binaries; I’m finishing the lint check.

Implemented `ky.retry()` across all instances, with typed hook support, `ForceRetryError`, `isForceRetryError`, custom requests, retry accounting, and response cleanup.

Added documentation and regression tests. Build and lint pass; 191 non-browser tests plus the added request-reuse test pass. Browser tests require missing Playwright binaries.

Upload progress now buffers bodies before sending to report exact sizes.
