Checking why my new tests fail (15 failures already exist without my change).

`Requirement.__replace__` is added in `src/packaging/requirements.py`, so `copy.replace()` works on Python 3.13+ and you can call `__replace__` directly on older versions.

With `PYTHONPATH=src`, all of `tests/test_requirements.py` passes (5362 tests, including the new ones). The `python` here imports an installed `packaging` that lacks the method. Run plainly, 15 tests fail even without my change, and the new tests fail too.

- **Arguments:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`, and any other keyword raises `TypeError`. Fields you don't pass are kept.
- **Validity:** the result is built by parsing the assembled string, so it matches what parsing would give. If a value doesn't survive that round trip, it raises `InvalidRequirement` instead of silently changing other fields. `name="foo[bar]"`, `name="a @ http://x"`, `extras={"a,b"}` and `url=""` all raise this way.
- **Normalization:** markers are normalized as in parsing, so `marker=Marker('extra == "Foo_Bar"')` ends up as `extra == "foo-bar"`.
- **Specifiers:** the set and each `Specifier` are copied with their `prereleases` settings, and nothing is shared with the input.
- **Subclasses:** the result is `type(self)(string)`, so a subclass gets its own class and `__init__` runs. That assumes the subclass's `__init__` takes the requirement string.
- **Argument types:** I added `TypeError` for wrong types, such as a bare string for `extras`. Your spec didn't ask for this.
- **URL and specifier together:** replacing `url` on a requirement that has a specifier raises `InvalidRequirement`, because PEP 508 doesn't allow both. Pass `specifier=SpecifierSet()` alongside the URL.
- **Docs:** I labelled the method `versionadded:: 26.4` to match the other unreleased notes in the repo, so adjust if the release number differs. I also added a CHANGELOG entry.

I added a `TestRequirementReplace` class to `tests/test_requirements.py`. It covers:
- replacing fields and the no-argument copy,
- unknown keywords and invalid values,
- `prereleases` and copy independence,
- subclasses and `copy.replace`.

Nothing is committed.
