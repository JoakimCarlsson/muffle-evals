Adding `__replace__` to `Requirement` now. I'm editing `requirements.py`, then I'll test it and add docs.

`Requirement.__replace__` is added in `src/packaging/requirements.py`, and `copy.replace()` works on it. Your two examples give the output you showed. The full `tests/test_requirements.py` run passes, including new tests for it. I didn't run the rest of the suite, mypy or the linters.

- **Arguments:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`, and any other keyword raises `TypeError`. Fields you leave out are kept. Passing `url=None` or `marker=None` clears that field.
- **Validation:** it builds the requirement string and parses it again through `type(self)(...)`. It then checks that the name, URL and extras read back unchanged. So `name="foo[bar]"`, `extras={"a,b"}`, `url=""` and a URL containing `; ` all raise `InvalidRequirement`. A specifier together with a URL raises it too, as parsing does. Passing extras as a bare string raises `TypeError`.
- **Normalization:** markers are normalized by the parse, so `extra == "Foo_Bar"` becomes `extra == "foo-bar"`.
- **Specifiers:** the result gets a fresh `SpecifierSet` built from fresh `Specifier` copies. `prereleases` is kept on the set and on each specifier, and nothing is shared with the input. I also made it accept a plain string for `specifier`, which you didn't ask for.
- **Subclasses:** you get an instance of the subclass back, and its `__init__` runs. This assumes the subclass's `__init__` accepts a single requirement string.

I added a CHANGELOG entry. The docstring says `versionadded:: 26.4`, which is my guess at the next version, so please check it.

The tests are in `tests/test_requirements.py` as `TestRequirementReplace`.

I left the changes uncommitted.
