Checking whether the 24 failures predate my change.

Pytest imports an installed copy, not `src`. Rerunning with `PYTHONPATH=src`.

Done. `Requirement.__replace__` added in `src/packaging/requirements.py`, with a changelog entry and 9 tests. With `PYTHONPATH=src`, all 5359 tests in `tests/test_requirements.py` pass.

Without `PYTHONPATH=src`, pytest imports the installed `packaging` copy, not `src`. Against that copy, 15 tests failed before my change, and I didn't look into why.

Not checked: `copy.replace()` itself (the runtime is Python 3.14, but I only called `__replace__` directly), lint and type checks, and the docs page.
