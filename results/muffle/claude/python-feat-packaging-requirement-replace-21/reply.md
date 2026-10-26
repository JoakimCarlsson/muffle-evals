Running the new tests. They fail on a missing `Specifier` import in the test file, which I'm fixing now. I'll also check whether the other 24 failures were already there.

The tests import an installed copy of `packaging`, not the working tree. I'll put `src` on the path.

That failure is a bug in my test. Canonical sorting reorders `_specs`, so index 0 isn't `>=1`. I'll look the specifier up by string instead.

`Requirement.__replace__` is added in `src/packaging/requirements.py`. `copy.replace()` works on 3.13+ and you can call it directly on older versions. The full `tests/test_requirements.py` passes (5360 tests) when run against the source tree.

- **Arguments:** it takes only `name`, `url`, `extras`, `specifier` and `marker`, and any other keyword raises `TypeError`. Fields you don't pass are kept, and the original is untouched.
- **Validation:** it builds the new requirement's string and parses it back. It also checks that name, url, extras and specifier read back exactly as given, so `name="foo[bar]"`, `extras={"a,b"}` and `name="not a name!"` raise `InvalidRequirement`. Marker normalization comes from parsing, so `extra == "Foo_Bar"` becomes `extra == "foo-bar"`.
- **Specifiers:** the result gets a new `SpecifierSet` built from new `Specifier` objects. The `prereleases` setting is kept on the set and on each specifier, and nothing is shared with the input.
- **Subclasses:** the result is built with `type(self)(string)`, so a subclass gets its own class and its `__init__` runs. This means a subclass whose `__init__` takes something other than the requirement string won't work.
- **Extras:** the extras you pass keep their spelling, since parsing doesn't normalize extras.
- **Edge cases:** a plain-string `specifier` is accepted and parsed. `url=""` is treated as `None`. A non-string `extras` or an extras value that is a bare string raises `InvalidRequirement`.

I added a `TestRequirementReplace` class to `tests/test_requirements.py` and a "Features" entry in `CHANGELOG.rst`. I didn't check the docs for a place to mention the new method.

The default Python environment imports an installed copy of `packaging`, not the working tree, so a plain `pytest` run misses the change. Use `PYTHONPATH=src python -m pytest ...`. Without it, 15 tests in this file already fail; I didn't investigate why. Nothing is committed.
