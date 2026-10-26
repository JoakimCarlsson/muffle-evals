Core is done and checked by hand. I'm now adding the docs entry and tests.

Fixing one lint error (an import inside a test) and then I'm done.

`Requirement.__replace__` is added. It takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`, and works through `copy.replace()` on 3.13+. `tests/test_requirements.py` passes (5364 tests) when run with `PYTHONPATH=src`. Plain `pytest` imports an older installed `packaging` and fails, so use `PYTHONPATH=src`. `ruff` is clean.

It does what you listed:
- **Arguments:** any other keyword raises `TypeError`. Unpassed fields are kept, the original is untouched, and no arguments gives an equal but distinct object.
- **Validation:** the result is built by parsing the new requirement's string form, so values are normalized as in parsing (`extra == "Foo_Bar"` becomes `extra == "foo-bar"`). It then checks that name, url, extras and specifier came back unchanged. `name="not a name!"`, `name="foo[bar]"` and `extras={"a,b"}` raise `InvalidRequirement`, as does a url combined with a specifier.
- **Specifiers:** the `SpecifierSet` and its `Specifier`s are copied, keeping `prereleases` on both the set and each specifier. Nothing is shared with the input.
- **Subclasses:** the result is built with `type(self)(string)`, so a subclass gets its own class and its `__init__` runs. This assumes a subclass `__init__` still takes the requirement string.

Two behaviours you didn't specify:
- **Wrong types:** a wrong type, such as a bare string for `extras`, raises `TypeError`, not `InvalidRequirement`.
- **Empty url:** `url=""` is treated as `None`, the same as parsing.

I also added tests in `TestReplace`, a changelog entry under unreleased, and `:special-members: __replace__` in `docs/requirements.rst` so the method shows up in the docs. I haven't built the docs, so the `:special-members:` line is untested. I didn't commit anything.

The code is in `src/packaging/requirements.py`.
