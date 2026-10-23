Fixing test imports, then checking whether the other failures predate my change.

Test bug (URL with specifier is invalid PEP 508). Fix test to drop the specifier.

Done. `Requirement.__replace__` added in `src/packaging/requirements.py`, with tests and a changelog entry. All 5364 tests in `tests/test_requirements.py` pass when run against `src` via `PYTHONPATH=src`. The installed `packaging` shadows `src` otherwise. Under that setup 15 other tests in the file failed before my change. mypy and ruff not run.

It builds the result by re-parsing the candidate string through `type(self)`. It raises `InvalidRequirement` if the parsed fields differ from what you passed.

A `url` replacement on a requirement that has a specifier raises `InvalidRequirement`, since PEP 508 doesn't allow both. You have to pass `specifier=SpecifierSet()` as well.
