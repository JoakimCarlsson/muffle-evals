I’ll check how `Requirement` is parsed and tested, then add `__replace__` with validation and independent copies of the specifiers.

Parsing the result will validate its syntax, but I also need to compare the parsed fields with the requested fields to catch values such as `name="foo[bar]"`. I’ll copy the specifiers separately to preserve prerelease settings that aren’t represented in the string.

The requirement tests pass, including `copy.replace()`, field-boundary validation, subclass initialization, and independent specifier copies with preserved prerelease settings. I’ll finish the formatting, type, and broader regression checks.

Implemented `Requirement.__replace__` with field validation, parser normalization, independent specifier copies preserving prerelease settings, and subclass support.

Added tests, documentation, and a changelog entry. Validation passed: 9,729 tests, mypy, Ruff lint, and formatting checks.
