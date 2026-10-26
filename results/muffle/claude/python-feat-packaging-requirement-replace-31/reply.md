Adding the missing `copy` import to the tests, then running them.

An installed copy is shadowing src; run with PYTHONPATH.

`Requirement.__replace__` is added in `src/packaging/requirements.py`. With `PYTHONPATH=src`, `tests/test_requirements.py` passes (5355 tests). Plain `pytest` imports the installed `packaging` in the env rather than `src`, which shows failures. I didn't run the rest of the suite or any type-checking.

- **Keywords:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`. Any other keyword raises `TypeError`, and unpassed fields are kept.
- **Validation:** it builds the candidate's string and parses it back through the class's own `__init__`. That gives parse-identical validation and normalization (for example `extra == "Foo_Bar"` becomes `extra == "foo-bar"`).
- **Silent changes rejected:** if the parsed result differs from what you passed, it raises `InvalidRequirement`. That catches `name="foo[bar]"`, `extras={"a,b"}` and `url=""`. Wrong types for any field also raise `InvalidRequirement`.
- **Specifiers:** the result gets fresh copies of the `SpecifierSet` and each `Specifier`, with their `prereleases` settings kept. Nothing is shared with the input.
- **Subclasses:** the result is an instance of the subclass. This assumes the subclass's `__init__` takes a single requirement string, as `Requirement`'s does.

I added `TestRequirementReplace` in `tests/test_requirements.py`. It covers these cases, plus `copy.replace`, which is skipped on Python older than 3.13.

I also added a changelog entry under the unreleased section. The new method's docstring says `versionadded:: 26.4`, which is my guess at the next version number, so please check it.

Nothing is committed.
