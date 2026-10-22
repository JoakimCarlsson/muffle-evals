I added `wait_exception(predicate)` and exported it from `tenacity` next to the other `wait_*` strategies. The test suite passes (121 passed, 1 skipped). I had to skip `tests/test_tornado.py` because it fails at collection, and I didn't look into why.

- **Behaviour:** it passes the last attempt's exception to your function and waits exactly the number of seconds that function returns. It works anywhere a wait strategy does, including `Retrying(wait=wait_exception(predicate))`.
- **No exception:** if the last attempt didn't fail with an exception, for example when `retry_if_result` rejected a returned value, it raises `RuntimeError`.
- **Tests:** I added two tests in `tests/test_tenacity.py`. One checks that different exceptions give different waits. The other checks that a successful result raises `RuntimeError`.
- **Docs and release note:** I added a short example to `doc/source/index.rst`, using a `Retry-After` handler like yours. I also added a release note, `releasenotes/notes/wait-exception-3f1c9a7d2b5e4c68.yaml`.

The strategy itself is in `tenacity/wait.py`. I haven't committed anything.
