I’ll check how requirements are parsed and tested, then add `__replace__` with validation and independent specifier copies.

Parsing the assembled string will validate the result, but I’ll also compare its fields with the requested values to catch cases like `name="foo[bar]"`. I’ll copy specifiers separately to preserve their prerelease settings, which the string doesn’t capture.

The implementation and regression tests pass, including round-trip validation, subclass initialization, and prerelease settings on both sets and individual specifiers. Documentation and a changelog entry are added; I’m checking the final diff now.

Added `Requirement.__replace__` with keyword-only fields, round-trip validation, normalization, subclass support, and independent specifier copies that preserve prerelease settings.

Added regression tests, documentation, and a changelog entry.

Validation: 7,427 tests passed; Ruff, mypy, and diff checks passed.
