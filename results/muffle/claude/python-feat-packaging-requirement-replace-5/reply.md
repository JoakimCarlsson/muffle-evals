Matching the repo's `Self` import style, then testing.

The same 15 tests fail without my change, so they were already failing. Now I'll add tests and a changelog entry.

`Requirement.__replace__` is added in `src/packaging/requirements.py`, and `copy.replace()` works with it on Python 3.13+. `tests/test_requirements.py` now passes with 5362 tests, run with `PYTHONPATH=src`. Plain `pytest` imports an installed `packaging` that lacks the method, and that same installed copy is why 15 other tests fail without my change.

**What it does**
- **Keywords:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`. Any other keyword raises `TypeError`, and so does a value of the wrong type.
- **Fields you don't pass** are kept, and the original is left untouched. With no arguments you get an equal but distinct object.
- **Validation:**
  - The new fields are rendered to a string and parsed, so the result matches what parsing would give. For example, `marker=Marker('extra == "Foo_Bar"')` ends up as `extra == "foo-bar"`.
  - Invalid values raise `InvalidRequirement`. So do values that would read back differently: `name="foo[bar]"`, `extras={"a,b"}` and `extras={""}` all fail rather than changing other fields. A `url` that would swallow the marker, such as `"https://x ; y"`, fails too.
- **Specifiers:** the result gets a fresh `SpecifierSet` with fresh `Specifier`s. Their `prereleases` settings are kept, on the set and on each `Specifier`, and nothing is shared with the input.
- **Subclasses:** the result is built with `type(self)(string)`, so a subclass gets its own class and its own `__init__` setup. This assumes the subclass `__init__` accepts the requirement string.

**URL requirements:** a requirement with a URL can't also have a specifier, as in PEP 508. Calling `r.__replace__(url=...)` on a requirement that has a specifier therefore raises `InvalidRequirement`. You need to pass `specifier=SpecifierSet()` as well.

I also added a `TestRequirementReplace` class in `tests/test_requirements.py` and a changelog entry under unreleased. The method's docstring says `versionadded:: 26.4`, which I took from the current dev version. I didn't commit anything.
