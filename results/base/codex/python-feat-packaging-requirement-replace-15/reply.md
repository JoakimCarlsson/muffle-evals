I’ll check how `Requirement` is parsed and tested, then add `__replace__` with validation and independent copies of the specifiers.

The method now parses the result and checks each field to catch values such as `name="foo[bar]"` that would silently change another field. It also recreates the specifier set and its members to preserve prerelease settings without sharing mutable objects. I’m adding regression tests for those cases and subclass initialization.

Added `Requirement.__replace__` with field validation, normalization, independent specifier copies that preserve prerelease settings, and subclass support.

Added tests, documentation, and a changelog entry. Validation passed: 7,424 tests, mypy, Ruff, and formatting checks.
