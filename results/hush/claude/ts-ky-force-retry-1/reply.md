Types, error, guard and exports are in. Now editing `Ky.ts` for the retry flow and upload progress.

Done. `ky.retry()`, `ForceRetryError`, `isForceRetryError` and per-request upload progress are in and the new tests pass. The only full-suite failures are the Playwright browser tests, because the browsers aren't installed here.

I added `test/force-retry.ts` with three tests:
- A forced retry on a `200` response.
- POST with `retry.shouldRetry` never called, and the retry limit enforced.
- A custom request from `ky.retry({request})`, checking its upload progress.

I did not test:
- Cancelling the response bodies.
- A `beforeRetry` hook replacing the custom request.
- Progress for a request returned from a `beforeRetry` hook.

I did not update `readme.md`.

Upload progress for a custom request or a `beforeRetry`-returned request buffers a clone of its body to get the real size. A hook that returns `new Request(url, request)` with an already-wrapped body may report progress twice.
