I’ll check how `Requirement` parses and stores its fields, then add `__replace__` with validation and tests for copying, prerelease settings, and subclasses.

A parse round trip will validate the replacement, but it needs a field-by-field check to catch values like `name="foo[bar]"` that parse successfully into different fields. I’ll also copy the specifiers separately to preserve their prerelease overrides, which aren’t included in the requirement string.

The requirement tests pass against the local source, including `copy.replace()` on Python 3.14. The first run picked up an installed copy of `packaging`; I corrected the import path. I’m finishing the type and style checks now.

Added `Requirement.__replace__` with field validation, normalization, independent mutable fields, preserved prerelease overrides, and subclass initialization. Added documentation and regression tests.

Validation: 7,432 tests passed, including `copy.replace()` on Python 3.14. Type, lint, and formatting checks passed.
