Fixing my test: tenacity computes the wait on the final attempt too, so the predicate runs 3 times, not 2.

I added `wait_exception(predicate)` and exported it from `tenacity` next to the other `wait_*` strategies. The test suite passes (122 passed, 1 skipped), but I had to leave out `tests/test_tornado.py` because `tornado` isn't installed here. Nothing is committed.

- **Behaviour:** it calls `predicate` with the exception from the last attempt and waits exactly the number of seconds it returns. It works anywhere a wait strategy does, including `Retrying(wait=wait_exception(predicate))` and combined with `+`.
- **No exception:** if the last attempt didn't fail with an exception, for example a result that `retry_if_result` rejected, it raises `RuntimeError`.
- **Final attempt:** tenacity computes the wait after the last attempt too, so with `stop_after_attempt(3)` your predicate runs 3 times, not 2. The third wait is never slept, but the predicate still runs, so keep it free of side effects.
- **Tests and docs:** I added three tests (exception-dependent waits, the `RuntimeError` case, and a full `@retry` run). I also added a short example in `doc/source/index.rst` and a release note under `releasenotes/notes/`.

The strategy itself is in `tenacity/wait.py`.
