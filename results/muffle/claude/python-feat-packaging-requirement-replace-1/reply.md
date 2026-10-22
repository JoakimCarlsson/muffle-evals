Adding the missing `copy` import to the tests, then running them.

Tests are importing an installed copy; use the source tree.

`Requirement.__replace__` is added, so `copy.replace()` works on 3.13+ and you can call it directly on older versions. The requirements, markers and specifiers tests pass (9721) and mypy is clean on `requirements.py`. I didn't run the rest of the suite, and I didn't build the docs. The tests only import this checkout when run with `PYTHONPATH=src`. Without it they pick up the installed `packaging` and fail with `AttributeError`.

- **Arguments:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`, and anything else raises `TypeError`. Passing `url=None` or `marker=None` clears that field.
- **Building the result:** it builds the requirement string from the final values and parses it with `type(self)(...)`. So the result is what parsing gives, values are normalized (`extra == "foo-bar"`), and a subclass gets back its own class with its own `__init__` run.
- **Round-trip check:** after parsing, it compares `name`, `url`, `extras` and whether there is a marker against what you passed. A mismatch raises `InvalidRequirement`, which covers `name="foo[bar]"`, `extras={"a,b"}`, `url="http://x ; os_name == 'a'"` and `url=""`.
- **Specifiers:** the specifier set and each `Specifier` are copied with their `prereleases` settings, so nothing is shared with the input.
- **Extras:** I made a plain string for `extras` raise `TypeError`, because it would otherwise be split into characters.
- **Subclass signature:** a subclass whose `__init__` doesn't take a single requirement string won't work with this.

I moved the string-building logic out of `Requirement._iter_parts` into a module-level function so `__replace__` can reuse it, and the method now just calls it. I also added tests in `tests/test_requirements.py`, a docs example and `:special-members: __replace__` in `docs/requirements.rst`, and a changelog entry. I haven't committed anything.
