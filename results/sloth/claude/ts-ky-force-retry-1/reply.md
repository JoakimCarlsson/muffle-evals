Fixing strict-optional type errors, then I'll add tests.

Now tests, covering each named behavior.

An `afterResponse` hook can now return `ky.retry()` to force a retry. The type check, build and lint pass, and so do all the Node tests, including four new ones in `test/hooks.ts` that cover the behaviours you listed. I haven't updated the readme, so `ky.retry()` and `isForceRetryError` aren't documented there yet.

The full `npm test` run reports 38 failures. All of them are the browser tests, which can't start because Playwright's Chromium and Firefox aren't installed here. I didn't run those, so the upload-progress change is untested in browsers.

- **`ky.retry(options?)`:** it's on `ky`, `ky.extend()` and `ky.create()` instances, and typed on `KyInstance`. `AfterResponseHook` accepts it, sync or async, and it takes `delay`, `code`, `cause` and `request` as specified. A `cause` that isn't an `Error` is wrapped.
- **Forced retries:** they count against `retry.limit`, skip `retry.methods` (so POST retries) and `retry.shouldRetry`, and stop the remaining `afterResponse` hooks. Both response bodies (the original and the clone passed to the hook) are cancelled. When the limit is exceeded, the `ForceRetryError` itself is thrown.
- **`beforeRetry`:** it runs as usual with `error` being a `ForceRetryError` (exported from `ky`). A custom `request` is in place before the `beforeRetry` hooks run, so a hook can still change or replace it.
- **`isForceRetryError`:** it's exported next to `isHTTPError`.
- **Upload progress:** it moved from the constructor to the point of sending in `#fetch`, so every request actually sent reports progress, including retries. `totalBytes` for a custom request or one returned from a hook is measured by reading a clone of its body. The new `ky.retry({request})` test checks this: a one-byte body and a 12-byte body report 1 and 12.

Changes you might not expect:
- **Normal retries now report progress:** retries without a custom request previously reported none, and now do.
- **Stream-based bodies:** a request given as a `Request` input with a body and no `body` option previously reported `totalBytes` as 0. It now reports the real size.
- **Non-retriable methods:** `Ky.create` now always goes through `#retry`. That method rethrows ordinary errors for methods outside `retry.methods`, so those methods behave as before.

The core logic is in `source/core/Ky.ts`, and the new error class is in `source/errors/ForceRetryError.ts`.
