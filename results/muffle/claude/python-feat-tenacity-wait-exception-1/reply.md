I've added `wait_exception(predicate)` and the full test suite passes (125 passed, 1 skipped).

- **Strategy:** it's in `tenacity/wait.py` and exported from `tenacity` next to the other `wait_*` strategies. It passes the last attempt's exception to your function and waits the number of seconds returned. That can be a float, an int or a `timedelta`, like the other waits.
- **No exception:** if the last attempt returned a value, for example one a `retry_if_result` rejected, it raises `RuntimeError("last attempt did not raise an exception")`.
- **Tests:** two new tests in `tests/test_tenacity.py` cover the exception-dependent wait and the `RuntimeError` case. I also ran it through `Retrying(wait=wait_exception(...))` directly.
- **Docs:** I added a short example to `doc/source/index.rst` and a release note in `releasenotes/notes/`.

I didn't run your `requests` example against a real server. I haven't committed anything.
