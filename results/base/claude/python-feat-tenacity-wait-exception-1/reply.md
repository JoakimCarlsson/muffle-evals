I added `wait_exception(predicate)` and exported it from `tenacity` alongside the other `wait_*` strategies. The test suite passes (121 passed, 1 skipped). I had to skip `tests/test_tornado.py` because `tornado` isn't installed here.

- **Behaviour:** it calls your function with the exception from the last attempt and waits exactly the number of seconds it returns. It works anywhere a wait strategy does, such as `Retrying(wait=wait_exception(predicate))`.
- **No exception:** if the last attempt returned a value, for example one that `retry_if_result` rejected, it raises `RuntimeError`.
- **Tests:** I added two to `tests/test_tenacity.py`, one for the wait value and the exception passed to your function, and one for the `RuntimeError` case.
- **Docs and release note:** I added a short example to `doc/source/index.rst` and a release note at `releasenotes/notes/add-wait-exception-3f9a1c7e5b2d4a60.yaml`.

The strategy itself is in `tenacity/wait.py`. I haven't committed anything.
