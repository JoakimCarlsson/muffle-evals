Checking why my new tests weren't collected.

I added `wait_exception(predicate)` in `tenacity/wait.py` and exported it from `tenacity` next to the other `wait_*` strategies.

It calls your function with the last attempt's exception and waits exactly the number of seconds it returns, with no clamping. It works anywhere a wait strategy does, including `Retrying(wait=...)`. If the last attempt didn't raise (for example, a result that `retry_if_result` rejected), it raises `RuntimeError`.

The two new tests (the predicate's value is used per exception, and `RuntimeError` when there's no exception) pass. I didn't run the rest of the suite. An earlier full pytest run timed out, and I only ran the new tests after that. I didn't run your `requests` example against a real server.

I also added a short example to the docs in `doc/source/index.rst` (`README.rst` is a symlink to it) and a release note in `releasenotes/notes/`. Nothing is committed.

That notification is for the earlier background pytest run, which hit its time limit and was stopped. I didn't restart it. I re-ran the new tests separately and they passed (2 passed), and the stopped run isn't needed for the work. As I said before, I haven't run the full test suite, and nothing is committed.
