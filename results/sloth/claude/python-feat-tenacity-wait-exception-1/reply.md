Tests pass. `black` isn't installed, so I'll wrap the long lines by hand.

I added `wait_exception(predicate)` and exported it from `tenacity` alongside the other `wait_*` strategies. The test suite passes (124 passed, 1 skipped). `black` isn't installed here, so I wrapped the long lines by hand and didn't run the formatter.

- **Behaviour:** it calls `predicate` with the exception from the last attempt and waits exactly the number of seconds returned. It works anywhere a wait strategy does, including `Retrying(wait=wait_exception(predicate))`.
- **No exception:** if the last attempt returned a value, for example one that `retry_if_result` rejected, it raises `RuntimeError`. It raises the same error if no outcome has been set yet.
- **Your `http_error` example:** I checked it against the types and signatures but didn't run it against a real `requests` call. It fits as written. `Retry-After` can also be an HTTP date rather than a number of seconds, and `float()` in your example would fail on that.
- **Code:** the class is in `tenacity/wait.py`, with the export and `__all__` entry in `tenacity/__init__.py`.
- **Test:** `test_wait_exception` in `tests/test_tenacity.py` covers the exception case and both `RuntimeError` cases.
- **Docs and release note:** I added a short example to the README, which `doc/source/index.rst` mirrors, and a reno note, `releasenotes/notes/wait_exception-3f1c9a7d52e84b60.yaml`.

I haven't committed anything.
