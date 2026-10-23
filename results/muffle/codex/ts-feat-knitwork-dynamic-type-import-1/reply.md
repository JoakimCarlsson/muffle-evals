I’ll check the existing import helpers, add `genDynamicTypeImport` alongside them, and test the requested output forms.

The helper now reuses `genDynamicImport` to render comments and attributes, then adds dot or bracket access based on the export name. I’ve added coverage for the requested examples, escaping, empty names, and Unicode identifiers. Since `pnpm` isn’t installed, I’m running the checks through the local tool binaries.

Added and exported `genDynamicTypeImport(specifier, name?, options)` alongside `genDynamicImport`.

It supports optional names, dot access for valid identifiers, escaped bracket access otherwise, and the existing comment and attributes rendering. Documentation and tests are included.

Validation passed: lint, formatting, all 68 tests, and build.
