Implementing `__replace__` in `requirements.py` now, then I'll add tests, docs and a changelog entry.

It imported the installed copy; rerun against `src`.

Behaviour is correct (the reorder is just canonical sorting; each specifier keeps its own `prereleases`). Adding tests, changelog and docs.

`Requirement.__replace__` is added in `src/packaging/requirements.py`, and `copy.replace()` works with it on 3.13+. The requirements tests, ruff and mypy pass.

- **Arguments:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`. Any other keyword raises `TypeError`, and so does a value of the wrong type, such as a plain string for `extras` or `specifier`.
- **Result:** unpassed fields are kept and the original is untouched. With no arguments you get an equal but distinct object.
- **Validation:** the new requirement is built by rendering the fields to a string and parsing it with `type(self)(...)`. That gives you the same result as parsing the string, and a subclass gets its own class with its `__init__` run.
- **Round-trip check:** it then checks that name, url, extras and marker-presence survived the parse. So `name="foo[bar]"`, `extras={"a,b"}` and `url="http://x; os_name == 'nt'"` raise `InvalidRequirement`, as does an empty `url=""`. A URL combined with a specifier is invalid too, so `url=...` on a requirement that has specifiers needs `specifier=SpecifierSet()` as well.
- **Markers:** normalized as in parsing, so `Marker('extra == "Foo_Bar"')` becomes `extra == "foo-bar"`.
- **Specifiers:** the `SpecifierSet` and each `Specifier` are copied with their `prereleases` settings, so nothing is shared with the input. This holds whether you pass the set in or it is carried over. The copied specifiers come out in canonical (sorted) order, each still with its own setting.

I also added tests in `tests/test_requirements.py`, a changelog entry under unreleased, and a `:special-members: __replace__` line in `docs/requirements.rst` so the method appears in the docs. I labelled it `versionadded:: 26.3` in the docstring, which is a guess. The changelog lists 26.3 as already released, so change it if the next release has a different number.

I didn't commit anything.
