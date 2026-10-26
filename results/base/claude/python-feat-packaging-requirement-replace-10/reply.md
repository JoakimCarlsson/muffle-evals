Adding the missing test imports, then running the tests.

`Requirement.__replace__` is added in `src/packaging/requirements.py`. The full test suite passes (62505 tests) when run against `src` with `PYTHONPATH=src`.

That setting matters: the environment has a separate non-editable `packaging` in site-packages. A plain `pytest` run imports that copy instead of the working tree, so it fails.

- **Arguments:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`, and any other keyword raises `TypeError`. Fields you don't pass are kept. `url=None` and `marker=None` clear those fields.
- **Validation:** the candidate is built as a string and parsed again. The result is then checked against the values you asked for. This catches `name="foo[bar]"`, `extras={"a,b"}`, `extras={""}` and a URL containing `; `, and they raise `InvalidRequirement`. The marker is re-parsed first, so `extra == "Foo_Bar"` becomes `extra == "foo-bar"`.
- **Specifiers:** the `SpecifierSet` and each `Specifier` in it are copied, and `prereleases` is preserved on the set and on each `Specifier`. Nothing is shared with the original.
- **Subclasses:** the result is built by calling `type(self)(string)`, so a subclass gets its own class back with its `__init__` run. This assumes the subclass `__init__` takes the requirement string, as `Requirement` does.
- **Type checks:** a `str` passed as `extras`, a non-`SpecifierSet` specifier or a non-`Marker` marker raises `TypeError`.

I also added a `TestReplace` class in `tests/test_requirements.py` covering these cases, including `copy.replace` on 3.13+. There is a changelog entry in `CHANGELOG.rst`, and the docstring says `versionadded:: 26.4`, which I took from the current dev version.

I didn't commit anything.
