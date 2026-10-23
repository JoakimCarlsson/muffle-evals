I’ll check how requirements are parsed and tested, then add `__replace__` with validation and independent specifier copies.

The change needs to reach `Requirement`, its existing tests, and the requirements documentation; no caller, export, fixture, or configuration changes are needed. I’ll reuse parsing for validation, check that fields don’t get reinterpreted, and copy specifiers separately to preserve prerelease settings. No new dependency or option is needed.

The requirement tests pass, including `copy.replace()` on Python 3.14. I’m checking two remaining edge cases: field values with the wrong type, and duplicate specifiers with different prerelease overrides. Then I’ll run the full suite and build the package.

The specifier copy now preserves duplicate entries and each entry’s prerelease override. Lint, type checks, documentation examples, and the package build pass. The full test suite is still running.

Added `Requirement.__replace__` with validation, normalization, independent specifier copies, preserved prerelease settings, and subclass initialization. It also works through `copy.replace()` on Python 3.13+.

Added tests, documentation, and a changelog entry.

Validation passed: 62,515 tests, lint, type checks, documentation examples, and package build.
