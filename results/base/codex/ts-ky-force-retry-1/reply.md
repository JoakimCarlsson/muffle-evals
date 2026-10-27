I’ll check ky’s retry flow and tests, then add forced retries, the public types and exports, and coverage for custom requests and upload progress.

The retry path now recognizes the hook’s return value and passes a `ForceRetryError` to `beforeRetry`. I also moved upload progress wrapping to each send so replacement requests report progress. I’m checking retry limits, hook ordering, cancellation, and body sizes.

The focused tests pass. The full suite could not run its browser tests because Playwright’s browser binaries are missing. I’m finishing validation with the non-browser suite.

Implemented `ky.retry()` with options, hook typing, `ForceRetryError`, and `isForceRetryError`. Added custom request handling, response cancellation, upload progress for each sent request, documentation, and tests.

Validation: build and lint pass; 188 tests pass with 2 known failures. Browser tests remain unverified because Playwright binaries are missing.
