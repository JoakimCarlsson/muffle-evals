I’ll check how `Requirement` is parsed and tested, then add `__replace__` with validation and independent specifier copies.

Parsing will provide the validation and normalization, with field comparisons to catch values such as `foo[bar]` that parse into different fields. I’ll also preserve the prerelease overrides separately, since requirement strings don’t contain them.

The requirement tests passed, including `copy.replace()` and the prerelease-copy checks. Lint and type checks also pass. I’ve added documentation and am running the full suite now.

Implemented `Requirement.__replace__` with field validation, normalization, independent specifier copies preserving prerelease settings, and subclass initialization support.

Added tests, documentation, and a changelog entry.

Validation: 62,537 tests passed; Ruff and mypy checks passed.
