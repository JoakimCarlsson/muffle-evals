I added `Requirement.__replace__` in `src/packaging/requirements.py`, plus a changelog entry. It works on any Python version, and `copy.replace()` calls it on 3.13+. The existing `tests/test_requirements.py` passes. I also ran a few checks by hand and they gave the results below. I didn't add tests to the repo, since you didn't ask for them.

- **Keywords:** it accepts only `name`, `url`, `extras`, `specifier` and `marker`. Any other keyword raises `TypeError`.
- **Result:** it returns a new requirement and leaves the original untouched. Calling it with no arguments gives an equal but distinct object.
- **Validation:** it builds the requirement string and parses it, which raises `InvalidRequirement` for invalid values. It then compares the parsed `name`, `url`, `extras` and `specifier` with what you passed. So `name="foo[bar]"`, `extras={"a,b"}` and a URL containing `; marker` raise instead of silently changing other fields.
- **Normalization:** `marker=Marker('extra == "Foo_Bar"')` comes out as `extra == "foo-bar"`.
- **Specifier:** the result gets a new `SpecifierSet` holding new `Specifier` objects. The `prereleases` settings carry over on both the set and each specifier. The specifier objects are not shared with the input. I confirmed this with a set that had `prereleases=False` and a specifier with `prereleases=True`.
- **Subclasses:** the result is built with `type(self)(string)`, so a subclass gets its own class and its `__init__` runs. A subclass whose `__init__` takes anything other than the requirement string would need its own `__replace__`.

Setting a `url` on a requirement that has a specifier, as in your `requests>=2.0` example, raises `InvalidRequirement`. A requirement can't have both a URL and a specifier. To add a URL, clear the specifier in the same call: `specifier=SpecifierSet()`.

The changelog entry and the `versionchanged:: 26.4` note in the class docstring assume the next release is 26.4. I guessed that number, so please check it.

I haven't committed anything.
