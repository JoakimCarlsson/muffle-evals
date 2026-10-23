Done. `Requirement.__replace__` added in `src/packaging/requirements.py`, with a changelog entry and tests. `tests/test_requirements.py` passes (5365) when run with `PYTHONPATH=src`, and mypy is clean. I didn't run the rest of the suite.

- **Test environment:** the venv has an installed `packaging` that shadows `src`, so plain `pytest` fails on the new tests. Without my changes, 15 other tests in that file already fail under the same setup.
- **Not covered:** `copy.replace` itself is tested only on 3.13+. The venv is 3.14, so it ran there.
- **Extra:** `specifier` also accepts a plain string, which I added beyond your spec.
