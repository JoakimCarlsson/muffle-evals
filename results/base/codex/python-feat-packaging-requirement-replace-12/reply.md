I’ll inspect `Requirement` and its tests, then add `__replace__` with validation, independent specifiers, and subclass support.

The implementation passes the requirement tests, including invalid-field rejection, independent specifier objects, and subclass initialization. I’m adding usage documentation and running lint and type checks.

Added `Requirement.__replace__` with keyword validation, parsing and round-trip checks, independent mutable fields, preserved prerelease settings, and subclass support.

Added tests, documentation, and a changelog entry.

Validation: 62,524 tests passed; Ruff and targeted mypy checks passed.
