Implementation works. I'm checking whether the 15 test failures were already there, then I'll add tests.

The same 15 tests fail without my change, so they were already failing. Next I'll add tests.

`Requirement.__replace__` is in `src/packaging/requirements.py`, and it does what your examples show. With `PYTHONPATH=src`, all of `tests/test_requirements.py` passes, including the new tests. I haven't run the rest of the suite or the type checker.

Plain `pytest` imports the installed `packaging` from site-packages, not `src`. Without `PYTHONPATH=src`, the new tests fail with "no attribute `__replace__`". The 15 failures I saw in the first run came from that installed copy. They fail the same way with my change stashed.

- **Arguments:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`. Any other keyword raises `TypeError`. A value of the wrong type also raises `TypeError`, for example `extras="abc"` or a `specifier` that isn't a `SpecifierSet`.
- **Validation:** it builds the requirement string and parses it. It then checks that name, url, extras, specifier count and marker came back as you passed them. That check is what rejects `name="foo[bar]"` and `extras={"a,b"}` with `InvalidRequirement`. Passing a `url` while the requirement still has a specifier is also rejected, since PEP 508 doesn't allow both. Markers are normalized by the parse, so `extra == "Foo_Bar"` becomes `extra == "foo-bar"`.
- **Specifiers:** the result gets a fresh `SpecifierSet` and fresh `Specifier` objects. The `prereleases` setting is kept on the set and on each specifier, and nothing is shared with the input.
- **Subclasses:** it builds the new object with `type(self)(requirement_string)`, so a subclass's `__init__` runs and the result is an instance of that subclass. This assumes the subclass's `__init__` accepts a requirement string like the base class does.
- **Docs and tests:** I added a changelog entry, put `__replace__` in the docs via `:special-members:`, and added a `TestRequirementReplace` class to `tests/test_requirements.py`. The changelog and the docstring's `versionadded` say 26.4, which I took from the `Version.__replace__` docstring. Please confirm that's the release you want.

I made no commit.
