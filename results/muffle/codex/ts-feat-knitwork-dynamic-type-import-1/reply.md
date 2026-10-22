I’ll check how `genDynamicImport` handles options, add the helper, and test the requested output forms.

Added and exported `genDynamicTypeImport(specifier, name?, options)` alongside `genDynamicImport`.

It handles omitted names, dot access for valid identifiers, bracket access for other names, and existing comment, attributes, and quoting options. Added README documentation and regression tests.

Validation passed: all 68 tests, lint, formatting, TypeScript checks, and build.
