I’ll check how `Requirement` is parsed and tested, then add `__replace__` with validation and independent specifier copies.

Parsing the assembled string will validate the result, but I’ll also compare the parsed fields with the requested ones to catch values that would silently change another field. I’ll copy specifiers separately to preserve their prerelease settings.

The requirement tests pass against the workspace source, including the new round-trip and copying cases. I’m finishing the documentation and lint/type checks. The first test run used the installed `packaging`; I corrected the import path for the passing run.

Implemented `Requirement.__replace__` with field validation, parsing normalization, independent specifier copies that preserve prerelease settings, and subclass construction.

Added tests, documentation examples, and a changelog entry.

Validation: 7,414 tests passed; doctests, Ruff, and mypy passed.
