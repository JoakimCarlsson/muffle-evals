Tests import an installed copy, not the working tree. Run with `PYTHONPATH=src`.

Done. `Requirement.__replace__` is in `src/packaging/requirements.py`, with tests in `tests/test_requirements.py` and a CHANGELOG entry. The full suite passes with `PYTHONPATH=src`, because the default environment imports an installed copy of packaging. I didn't run mypy or lint, and I didn't run the docstring example as a doctest.

- **Version tag:** the docstring says `versionadded:: 26.4`. I guessed that number from the other docstrings, so change it if the release is numbered differently.
- **`url` plus specifier:** replacing `url` on a requirement that has a specifier raises `InvalidRequirement`. A URL requirement can't carry a version specifier.
