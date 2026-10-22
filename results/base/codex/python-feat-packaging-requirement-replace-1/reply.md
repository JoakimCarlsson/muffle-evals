I’ll check how `Requirement` is parsed and tested, then add `__replace__` with validation and independent specifier copies.

Parsing the replacement will validate its syntax and normalize markers. I’ll also check that parsing preserves the requested fields, so values such as `name="foo[bar]"` are rejected. Specifiers need a separate copy because their prerelease settings aren’t captured in the requirement string.

The implementation passes 9,734 requirement, specifier, and marker tests, including `copy.replace()` on Python 3.14. The new tests cover invalid field values, subclass initialization, normalization, and mutation isolation. I’m finishing the lint check and documentation.

Added `Requirement.__replace__` with field validation, parsing normalization, independent specifier copies that preserve prerelease settings, and subclass support.

Added tests, documentation, and a changelog entry.

Validation: 9,734 tests passed, including `copy.replace()` integration. Ruff, mypy, and diff checks passed.
