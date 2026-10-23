I’ll check how `findExports` splits declarations, fix the shared parser, and add regression tests for the examples you gave.

The bug is in the shared declaration scanner, which also feeds `findExportNames`. I’ll keep the change there and add cases to the existing export tests; no fixtures, configuration, or public API changes are needed. The scanner needs to distinguish generic calls from comparisons and ignore the `>` in arrow types.

Fixed `findExports` to recognize generic call arguments and ignore `=>` when tracking type brackets, while preserving comparison handling.

Added regression coverage for all reported examples and nested generics.

Validation passed: 196 tests, lint, formatting, type checking, and build.
