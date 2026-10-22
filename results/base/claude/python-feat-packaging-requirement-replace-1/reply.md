Fixing a missing `import sys` in the tests, then re-running.

I added `Requirement.__replace__` in `src/packaging/requirements.py`. It takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`, and any other keyword raises `TypeError`. The new tests pass, along with the rest of `test_requirements.py`, `test_specifiers.py` and `test_markers.py` (9724 passed). I ran those against `src` with `PYTHONPATH=src`, because the default environment imports an older installed `packaging` that has no `__replace__`.

I couldn't run the full suite. With `PYTHONPATH=src`, collecting `tests/` fails with 15 collection errors, starting at `tests/test_pylock.py`. I didn't look into them. Without `PYTHONPATH`, the same 15 failures show up with my changes stashed, so they predate this work.

- **Validation:** the replacement is built and run through the parser, so it is valid exactly when parsing its string form would succeed. Values that would read back differently raise `InvalidRequirement`: `name="foo[bar]"`, `name="foo "`, `extras={"a,b"}`, or a url containing `; marker`.
- **Normalisation:** markers are normalised, so `marker=Marker('extra == "Foo_Bar"')` becomes `extra == "foo-bar"`.
- **Specifiers:** the specifier is always copied, including each `Specifier`, with the `prereleases` settings kept on the set and on the individual specifiers. The input and the original are never shared with the result or mutated.
- **Subclasses:** the result is built through `type(self)(string)`, so a subclass gets its own class and whatever its `__init__` sets up. This assumes the subclass `__init__` takes just the requirement string.

Some choices you didn't specify:
- `url=""` is rejected rather than treated as `None`.
- A bare string for `extras`, or a value of the wrong type, raises `InvalidRequirement`, not `TypeError`.
- A url together with a non-empty specifier is rejected, because the parser doesn't allow that combination.

I added a `TestRequirementReplace` class to `tests/test_requirements.py`, and a changelog entry and docstring notes marked "26.4". That version number is my guess, so please change it if the release will be numbered differently. I didn't commit anything.
