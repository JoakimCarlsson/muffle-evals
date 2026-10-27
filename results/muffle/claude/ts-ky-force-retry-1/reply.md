Applying the `Ky.ts` edits again. The first run failed on a bad match string, and no file was written.

Types pass. Now tests.

Lint fixes first, then see which failures are browser-only.

Lint is clean. Checking that only browser tests fail.

`ky.retry()` is in. An `afterResponse` hook can return it to force a retry, sync or async. `xo` is clean and `tsc` passes. Under `ava`, the new `test/force-retry.ts` and the stream, retry, hooks and formdata tests pass. The only failures are the browser tests, because Playwright browsers aren't installed here. I haven't committed anything.

**New or changed files**
- `source/errors/ForceRetryError.ts` is new. It holds `ForceRetryError`, the `ForceRetryOptions` type and the internal marker that `ky.retry()` returns.
- `source/index.ts`, `source/types/ky.ts` and `source/types/hooks.ts` add `ky.retry` to every instance, type it on `KyInstance`, and let `AfterResponseHook` return it.
- `source/utils/type-guards.ts` adds `isForceRetryError`, next to `isHTTPError`.
- `ForceRetryError`, `isForceRetryError` and the options type are exported from `ky`.
- `source/core/Ky.ts` and `source/utils/body.ts` have the retry and upload-progress changes.
- The readme documents `ky.retry()`.
- `test/force-retry.ts` is new. It covers a forced retry on a 200 response, a forced retry on POST with `limit` reached, `shouldRetry` skipped and later hooks skipped, a custom request, a `beforeRetry` replacement, and the abort signal.

**Retry behaviour**
- Retry handling now runs for every method. A non-retriable method still rethrows as before, unless the retry was forced.
- A forced retry cancels both response bodies, counts against `retry.limit`, and throws `ForceRetryError` with message `Forced retry: <code>` or `Forced retry`.
- `delay` is used as is when it's a finite number ≥ 0. Anything else falls back to the normal delay.
- If you pass `request`, it replaces the request before the `beforeRetry` hooks run, so those hooks can still change it. It gets ky's abort signal combined with its own. The unused clone of the old request is cancelled.

**Upload progress**
- Progress wrapping moved from the constructor to just before each send in `#fetch`. Every request that actually goes out reports progress, including a custom retry request and one returned from `beforeRetry` or `beforeRequest`.
- `totalBytes` comes from `options.body` only while the request is the original one. After a request is swapped, the body is measured by reading a clone, so the size is real.
- `streamRequest` now takes `totalBytes` instead of the original body.
- One side effect: hooks now see the plain request rather than the progress-wrapped one.
