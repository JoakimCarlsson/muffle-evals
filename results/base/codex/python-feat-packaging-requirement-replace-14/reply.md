I’ll check how `Requirement` parses and stores its fields, then add `__replace__` and tests for validation, copying, and subclasses.

The implementation now parses the result and checks each field, so embedded syntax such as `name="foo[bar]"` is rejected. It also rebuilds the specifier set and its members to preserve prerelease settings without sharing mutable objects. I’m adding tests for those cases and subclass initialization.

All 7,414 requirement and specifier tests pass, including the new cases and `copy.replace()` on Python 3.14. I’m finishing the type checks and lint checks; the docs and changelog are updated too.

Added `Requirement.__replace__` with validation, independent specifier copies that preserve prerelease settings, subclass initialization, and `copy.replace()` support.

Updated tests, documentation, and changelog. All 7,414 requirement/specifier tests passed; mypy, lint, and formatting checks passed.
