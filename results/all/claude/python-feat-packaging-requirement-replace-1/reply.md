Earlier runs imported an installed copy, not `src`. I'm rerunning with `PYTHONPATH=src`.

Done. `Requirement.__replace__` is in `src/packaging/requirements.py`, with a `CHANGELOG.rst` entry. It also works through `copy.replace`.

- **Checked by hand:**
  - Your two examples give the output you showed.
  - Invalid and ambiguous values raise `InvalidRequirement`.
  - Marker values are normalized.
  - The result shares no `SpecifierSet` or `Specifier` with the input, and `prereleases` carries over.
  - A subclass with its own `__init__` gets its own class back, with its `__init__` run.
- **Tests:**
  - The requirements, specifiers and markers tests pass, and mypy is clean.
  - The full suite wasn't run because `hypothesis` isn't installed.
  - I added no tests for `__replace__`.
- **Version:** the docstring and changelog say `versionadded:: 26.4`, which is my guess at the next version.
- **Imports:** run with `PYTHONPATH=src`. Otherwise Python imports an installed `packaging`, which has no `__replace__`.
