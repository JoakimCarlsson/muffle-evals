I’ll check how `Requirement` parses and stores its fields, then add `__replace__` and tests for validation, copying, and subclasses.

Parsing the assembled string will catch invalid syntax. I’ll also compare the parsed fields with the intended fields to catch cases like `name="foo[bar]"`. After validation, I’ll copy the specifiers with their prerelease settings, since those settings aren’t represented in the string.

The requirement tests pass against the workspace source, including `copy.replace()` on Python 3.14. I’m finishing lint and type checks, plus documentation for direct calls on older Python versions.

Added `Requirement.__replace__` with field validation, independent copies, prerelease setting preservation, and subclass initialization support. Added documentation and regression tests, including `copy.replace()`.

Validation: 7,411 tests passed; Ruff and mypy checks passed.
