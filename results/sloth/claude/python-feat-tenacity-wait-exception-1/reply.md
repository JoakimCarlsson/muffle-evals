Adding the tests and a docs/release note next, then running the suite.

I added `wait_exception(predicate)` to `tenacity/wait.py` and exported it from `tenacity` next to the other `wait_*` strategies. The full test suite passes (125 passed, 1 skipped). I did not run your `requests` example against a live server.

- **Behaviour:** it calls `predicate(exception)` with the exception from the last attempt and waits exactly the number of seconds returned. It works anywhere a wait strategy does, including `Retrying(wait=...)`. It also accepts a `timedelta` return value, because it converts the result with tenacity's existing `to_seconds`.
- **No exception:** if the last attempt returned a value (for example one that `retry_if_result` rejected), it raises `RuntimeError`.
- **Tests:** I added two to `tests/test_tenacity.py`, one picking the wait by exception type and one for the `RuntimeError` case.
- **Docs:** I added a short example based on your `http_error` function to the wait section of `README.rst`. `doc/source/index.rst` carries the same edit, so I didn't edit it separately. I also added a release note, `releasenotes/notes/add-wait-exception-3f1c9a7d5b2e4c60.yaml`.

Nothing is committed.
