`wait_exception(predicate)` is added and exported from `tenacity`, next to the other `wait_*` strategies. The existing tests pass (119 passed, 1 skipped), but I left out `tests/test_tornado.py` because `tornado` isn't installed here. That file already failed to import before my change. I didn't add tests for the new strategy, so I checked it with two quick scripts:

- **Retry loop:** with a predicate that returns a fixed wait, a function that always raised was attempted 3 times.
- **Non-exception outcome:** `Retrying(wait=wait_exception(...), retry=retry_if_result(...))` raised `RuntimeError` when the last attempt returned a rejected value.

The strategy is in `tenacity/wait.py`. It waits exactly the number of seconds the predicate returns for the last attempt's exception. If that attempt didn't raise, it raises `RuntimeError` instead.

I also added a release note, `releasenotes/notes/add-wait-exception-3f1c9a7d2b5e4a60.yaml`.

`black` and `flake8` aren't installed, so I haven't run the formatter or linter. The `raise RuntimeError(...)` line in `wait.py` may be longer than the repo's line limit, so you may want to run `black` on it.

I haven't committed anything.
