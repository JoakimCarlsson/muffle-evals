I’ll check how `Requirement` parses and stores its fields, add `__replace__`, and test validation, copying, and subclass behavior.

Parsing the assembled requirement will handle validation and normalization. I’ll also compare the parsed fields with the requested fields to catch values such as `name="foo[bar]"` that would silently change another field. Prerelease settings need a separate copy because the requirement string doesn’t preserve them.

The requirement tests pass, including field validation, independent specifier copies, and subclass initialization. I’ve added documentation and a changelog entry; I’m finishing lint and formatting checks now.

Added `Requirement.__replace__` with validation, normalization, independent specifier copies that preserve prerelease settings, and subclass support. Added tests, documentation, and a changelog entry.

Validation passed: 7,411 tests, including `copy.replace()` on Python 3.14, plus Ruff, mypy, and diff checks.
