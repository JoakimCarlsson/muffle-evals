I’ll check how `Requirement` is parsed and tested, then add `__replace__` with validation and independent copies of specifier state.

The implementation reparses the assembled fields and checks that none were reinterpreted—for example, that `name="foo[bar]"` didn’t add an extra. It also preserves prerelease overrides by rebuilding the specifier set and each member independently. I’m adding tests for these cases and subclass initialization.

Added `Requirement.__replace__` with field validation, independent specifier copies that preserve prerelease settings, and subclass initialization support. It also works with `copy.replace()`.

Added tests, documentation, and a changelog entry. Validation passed: 7,417 tests, Ruff, and mypy.
