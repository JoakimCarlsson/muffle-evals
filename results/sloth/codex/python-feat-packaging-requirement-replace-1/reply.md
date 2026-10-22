I’ll check how `Requirement` is parsed and copied, add `__replace__`, then run the existing tests and build checks.

The change needs to reach `Requirement`, its API documentation, and the changelog; no callers, exports, fixtures, or configuration need changes. I’ll follow the existing `Version.__replace__` keyword-only API, reparse to validate the result, and copy specifiers separately to preserve their prerelease settings. No new options or dependencies are needed.

The implementation, lint, type check, and package build pass. The test suite initially stopped because test dependencies were missing; those are installed and the suite is running again. I’m also checking field-injection rejection, mutable-object isolation, prerelease settings, and subclass initialization directly.

Added `Requirement.__replace__` with keyword-only fields, parsing validation, normalization, independent mutable fields, preserved prerelease settings, and subclass initialization. Updated documentation and changelog.

Validation passed: 62,493 existing tests, direct behavior checks, doctests, lint, type checking, and wheel/source builds.
