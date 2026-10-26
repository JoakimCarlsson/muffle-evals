I’ll check how `Requirement` and `SpecifierSet` are implemented, then add `__replace__` and tests for validation, copying, and subclasses.

The implementation validates replacements by parsing their string form and checking that each field survives unchanged. It also copies the specifier set before formatting it, which can update its internal state, and calls the subclass constructor when creating the result.

Added `Requirement.__replace__` with keyword-only fields, round-trip validation, marker normalization, independent specifier copies that preserve prerelease settings, and subclass initialization.

Updated documentation and changelog.

Validation: 7,417 tests passed; Ruff and mypy passed.
