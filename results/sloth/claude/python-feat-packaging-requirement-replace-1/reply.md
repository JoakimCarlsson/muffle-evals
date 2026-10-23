Adding `Requirement.__replace__` now, then a test and a changelog entry.

Tests are importing an installed copy, not `src`. Running against `src`.

Only my test's assumption about spec order was wrong (the set sorts them). Fixing the test and tidying a stray `, )`.

`Requirement.__replace__` is added in `src/packaging/requirements.py`. The requirement tests pass, and ruff and mypy are clean. I haven't run the rest of the suite.

- **How it works:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`, and an unknown keyword raises `TypeError`. It builds the new object with `self.__class__(str(self))`, so subclasses get their own class with their `__init__` run. It then sets the replaced fields and re-parses the resulting string.
- **Validation:** if the re-parse fails, or `name`, `url` or `extras` don't come back as given, it raises `InvalidRequirement`. That catches `name="not a name!"`, `name="foo[bar]"` and `extras={"a,b"}`. The marker comes from the re-parse, so `extra == "Foo_Bar"` ends up as `extra == "foo-bar"`.
- **Specifier:** the result gets a fresh `SpecifierSet` built from fresh `Specifier`s. The `prereleases` setting is kept on the set and on each specifier, and nothing is shared with the input.
- **Added alongside:**
  - tests in `TestRequirementReplace` in `tests/test_requirements.py`
  - an "unreleased" entry in `CHANGELOG.rst`. I put `versionadded:: 26.4` in the docstring to match the other docs, but I guessed that version number.
- **Test setup:** the venv has an installed `packaging` that shadows `src`, so run the tests with `PYTHONPATH=src`. Without it they import the installed copy and fail. Even then, the `copy.replace` test only runs on 3.13+; on 3.14 here it ran and passed.
- **Not covered:** `url=""` is treated as `None`, and a `specifier` that isn't a `SpecifierSet` isn't checked.
