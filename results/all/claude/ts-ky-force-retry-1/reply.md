Now tests.

Oops: removed the wrong line in body.ts (line 117 was blank line context). Check.

Fix: restore blank line, drop the now-unused disable comment, and fix the Ky.ts misplaced disable.

Done. `ky.retry()` is implemented per your spec, with `ForceRetryError`, `isForceRetryError`, a readme section and three new tests in `test/retry.ts`. `tsc` and `xo` pass. `ava` passes 136 tests across `retry`, `stream`, `hooks`, `main` and `memory-leak`; the browser tests couldn't run because Playwright isn't installed.

Upload progress changed outside the new code: `source/core/Ky.ts` now wraps the request at send time, so every send reports progress. Custom and `beforeRetry` requests measure their real body size by cloning the request, which buffers the body in memory.

Untested: body cancellation on forced retries has no memory-leak test, and the custom-request test doesn't check that the abort signal is applied to it.
