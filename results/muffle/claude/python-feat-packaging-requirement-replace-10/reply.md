Checking whether the 15 test failures predate my change.

The same 15 failures happen without my change, so they were already there. Now I'll add tests and a changelog entry.

That failure is a mistake in my test. `<3` has no explicit prereleases setting, but its derived `prereleases` value is `False`. I'll compare `_prereleases` instead.

`Requirement.__replace__` is in `src/packaging/requirements.py`. The full suite passes when run against `src` (62502 passed). `copy.replace()` itself was not run: the interpreter here is 3.14 but I only called `__replace__` directly. I also ran the doctest in the docstring.

- **Arguments:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`, and any other keyword raises `TypeError`. Passing nothing returns an equal but distinct object. Wrong types, such as a `str` for `extras` or a non-`SpecifierSet` for `specifier`, also raise `TypeError`. The brief doesn't say which exception these should raise, so say if you'd rather have `InvalidRequirement`.
- **Validation:** the method builds the requirement string and parses it with `type(self)(...)`. It then checks that name, url, extras and specifier came back unchanged. So `name="foo[bar]"`, `extras={"a,b"}`, `name="not a name!"` and a url combined with a specifier all raise `InvalidRequirement`. `marker=Marker('extra == "Foo_Bar"')` comes out as `extra == "foo-bar"`.
- **Specifiers:** the result gets a new `SpecifierSet` built from new `Specifier` objects. The `prereleases` setting is kept on the set and on each specifier. I checked that none of them are shared with the input.
- **Subclasses:** the result is built through `type(self)(...)`, so you get your subclass back with whatever its `__init__` sets up. This assumes the subclass's `__init__` takes the requirement string as its only argument.
- **Docs and tests:** I added a `CHANGELOG.rst` entry under the unreleased section, and a `TestRequirementReplace` class in `tests/test_requirements.py`.

Plain `pytest` imports the `packaging` installed in the environment, not `src`. Without `PYTHONPATH=src` it fails with an `AttributeError` on `__replace__`, and 15 unrelated tests in `tests/test_requirements.py` fail, with or without my change. Run tests as `PYTHONPATH=src python -m pytest`.

The docstring says `.. versionadded:: 26.3`, which I guessed. The changelog already lists 26.3 as released (2026-08-03), so you'll probably want to change it to the next version.
