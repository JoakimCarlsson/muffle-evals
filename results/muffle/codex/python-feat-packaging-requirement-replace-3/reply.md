I’ll check how `Requirement` parses and stores its fields, then add `__replace__` with tests for validation, copying, and subclasses.

The implementation reparses the combined fields and checks that none were reinterpreted, which catches cases such as `name="foo[bar]"`. It also copies each specifier separately so prerelease overrides survive without sharing mutable objects. I’m adding tests for those cases now.

Added `Requirement.__replace__` with keyword-only fields, round-trip validation, normalization, independent specifier copies preserving prerelease settings, and subclass initialization support.

Added documentation, changelog entry, and regression tests.

Validation: 7,412 tests passed; Ruff and mypy checks passed.
