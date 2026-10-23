Fix the test: no `_make_future`; default state has result None.

Done. Added `wait_exception` in `tenacity/wait.py`, exported from `tenacity`. It raises `RuntimeError` when the last attempt didn't raise. I also added a test and a release note, and all tests pass. I did not update the docs in `doc/source/index.rst`.
