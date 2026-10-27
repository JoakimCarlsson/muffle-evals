Now write code. Errors and signal first.

Forced-retry tests pass. Running the full suite and lint next, then the readme.

An `afterResponse` hook can now force a retry by returning `ky.retry()`. The new tests pass, and so do the retry, hooks, stream, formdata and memory-leak suites. The browser (Playwright) tests can't run here because the browsers aren't installed, so those weren't checked.

`xo` reports one lint error, an unused eslint-disable in `body.ts`; the clean tree already had two `xo` errors, so I left it. I did not commit anything, and `distribution/` was rebuilt as part of `npm run build`.

**Added**
- **`ky.retry(options?)`:** it exists on `ky` and on instances from `extend()`/`create()`, and is typed on `KyInstance`. It validates `delay` (a non-negative finite number) and `request` (a `Request`) and throws a `TypeError` otherwise.
- **`ForceRetryError`:** exported from `ky`, with `name` `'ForceRetryError'`, `code`, and message `Forced retry: <code>` or `Forced retry`. A non-Error `cause` is wrapped. `isForceRetryError()` is exported next to `isHTTPError`.
- **Types:** `AfterResponseHook` accepts the new return value, and `ForceRetryOptions` is exported.
- **Readme:** new `ky.retry` and `ForceRetryError` sections.

**Behaviour**
- **Retry rules:** a forced retry counts against `retry.limit` and skips `retry.methods`, so POST works. `retry.shouldRetry` is never called, and the remaining `afterResponse` hooks are skipped. Both response bodies are cancelled.
- **Limit exceeded:** if the limit is already used up, the `ForceRetryError` itself is thrown.
- **`delay`:** it is used as is, so `0` retries instantly. It is still capped at the maximum safe timer value, as every retry delay is.
- **`request`:** it is applied before the `beforeRetry` hooks, so those can still modify or replace it. Ky's abort signal is attached to it, so the timeout and your signal still apply.

**Changes to existing code**
- **POST and other non-retriable methods:** every request now goes through the retry wrapper, which rethrows immediately for those methods unless the retry was forced. Behaviour for them is otherwise unchanged.
- **Upload progress:** this moved from the constructor into `#fetch`, so every request actually sent reports progress, including custom and `beforeRetry` requests. `totalBytes` uses the options body when the request is the unmodified original. For replaced requests it reads a clone to get the real size.
- **Cleanup:** the request-body cancel at the end of a request now skips locked bodies, because the progress stream locks the body it reads from.

The tests are in `test/force-retry.ts`.
