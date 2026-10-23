I’ll check how `Requirement` is parsed and tested, then add `__replace__` with validation and independent specifier copies.

Parsing the assembled requirement will validate its syntax, but it can also silently reinterpret a field—for example, `name="foo[bar]"` becomes a name plus an extra. I’ll check that fields survive parsing unchanged, then copy the specifiers separately to preserve their prerelease settings.

The requirement tests pass, including `copy.replace()`, subclass initialization, field validation, and independent prerelease settings. I’m finishing the documentation and style checks, then running the related marker and specifier tests.

Added `Requirement.__replace__` with field validation, independent mutable copies, preserved prerelease settings, and subclass initialization support. It works directly and through `copy.replace()`.

Added tests, documentation, and a changelog entry.

Validation: 9,746 tests passed; Ruff and mypy checks passed.
