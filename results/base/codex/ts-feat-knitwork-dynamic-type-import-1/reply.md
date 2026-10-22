I’ll check the existing helpers and tests, add `genDynamicTypeImport` alongside them, and verify its output.

Added and exported `genDynamicTypeImport(specifier, name?, options)`.

It supports omitted names, dot access for valid identifiers, escaped bracket access for other names, and the existing comment and import attributes formatting. Added documentation and edge-case tests.

Validation passed: all 74 tests, lint, formatting, and build.
