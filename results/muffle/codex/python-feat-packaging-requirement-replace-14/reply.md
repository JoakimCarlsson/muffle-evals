I’ll check how `Requirement` is parsed and tested, then add `__replace__` with validation and independent specifier copies.

The parser can validate the replacement, but parsing alone can silently move syntax between fields—for example, turning `name="foo[bar]"` into a name plus extras. I’m adding field-by-field checks for that, and copying prerelease settings separately because strings don’t preserve them.

The requirement tests pass, including checks for invalid field syntax, subclass initialization, and independent prerelease settings. Lint and type checks also pass. I’m running the full test suite now.

Added `Requirement.__replace__` with round-trip validation, independent specifier copies that preserve prerelease settings, and subclass support. It works directly and through `copy.replace()`.

Added tests, documentation, and a changelog entry.

Validation: 62,531 tests passed; lint, formatting, and type checks passed.
