Now tests.

It was testing an installed copy. I'll run against `src` with PYTHONPATH.

My test's input was invalid (URL needs a space before `;`). I'll fix that and the ignore code.

PYTHONPATH didn't persist across calls; re-run with it set inline.

`Requirement.__replace__` is in `src/packaging/requirements.py`, and all 62,513 tests pass when run against `src`. Because `copy.replace()` just calls it, that works on 3.13+ too. mypy is clean. The one `ruff check` finding is in `tests/test_pylock.py`, which I didn't touch.

The default `python` and `pytest` in this environment import an installed `packaging` from site-packages, not `src`. Run the tests with `PYTHONPATH=$PWD/src`, or the new tests fail.

- **Arguments:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`. Any other keyword raises `TypeError`. Passing `url=None` or `marker=None` clears that field.
- **Validation:** it builds the requirement string from the new parts and parses it with `type(self)(...)`. That gives you normalization, so `Foo_Bar` in a marker's `extra` becomes `foo-bar`. It also means a subclass gets its own class back with its `__init__` run.
- **Values that read back differently:** it compares the parsed result against what you passed and raises `InvalidRequirement` on any mismatch. That catches `name="foo[bar]"`, `extras={"a,b"}`, a name with stray whitespace, and a URL containing a space or `;`.
- **Prereleases:** the specifiers are rebuilt as new `Specifier` objects that keep each one's `prereleases` setting, inside a new `SpecifierSet` that keeps its own. Nothing is shared with the input, and that holds for carried-over fields too. Markers are re-parsed rather than reused.
- **Wrong types:** a `str` for `extras`, or a non-`SpecifierSet` for `specifier`, raises `TypeError` rather than `InvalidRequirement`. I treated that as a type error rather than an invalid value. Say if you'd rather it raise `InvalidRequirement`.

I also added a docstring and a `versionchanged` note, a CHANGELOG entry, and a `TestRequirementReplace` class in `tests/test_requirements.py`. The tests cover your examples, invalid values, prerelease preservation and non-sharing, and a subclass with its own `__init__`.

I used 26.4 for the `versionadded` and `versionchanged` notes. Adjust it if the next release will have a different number. Nothing is committed.
