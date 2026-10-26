I’ll check how `Requirement` is parsed and tested, then add `__replace__` with validation and independent copies of the specifiers.

Reparsing the assembled requirement will provide normalization and syntax validation. I’m also checking that parsing preserves each supplied field, so values such as `name="foo[bar]"` cannot silently introduce extras. Prerelease overrides need a separate copy because the requirement string does not capture them.

The requirement tests, lint checks, and type checks pass. The implementation also calls the subclass constructor and preserves prerelease overrides on separate specifier objects. I’m running the full suite now and finishing the documentation.

Added `Requirement.__replace__` with keyword-only fields, parsing validation, normalization, independent specifier copies, preserved prerelease settings, and subclass support. Added tests, documentation, and a changelog entry.

Validation passed: full suite (62,523 tests), new requirement tests, lint, type checks, and documentation examples.
