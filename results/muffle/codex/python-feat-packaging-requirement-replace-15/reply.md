I’ll check how `Requirement` is parsed and tested, then add `__replace__` with validation and independent specifier copies.

The parser can validate and normalize the replacement, but I’ll also compare the parsed fields with the requested fields to catch values such as `name="foo[bar]"`. Specifier prerelease settings need a separate copy step because they aren’t included in the requirement string.

All 5,373 requirement tests pass against the local source, including the new replacement tests. I’m finishing type checks and documentation, then checking the related marker and specifier tests.

Added `Requirement.__replace__` with field validation, parser normalization, independent specifier copies preserving prerelease settings, and subclass initialization support. It works directly and through `copy.replace()`.

Added tests, documentation, and a changelog entry.

Validation: 9,729 tests passed; Ruff and mypy checks passed.
