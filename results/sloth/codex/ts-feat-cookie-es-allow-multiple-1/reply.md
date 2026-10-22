I’ll check the parser, types, and callers, then add the option and run the existing build and tests.

The change reaches the parser, its public options and return type, and a README example. Existing callers can keep their current string return type; callers enabling the option will get a type that includes arrays. No export, fixture, or config changes are needed.

I’ll preserve decoding and filtering, including custom decoders that return `undefined`. I won’t add new tests, per the repository instructions, but will run the existing suite.

The build and all 97 existing tests pass. The full formatting check found an issue in an untouched test file, and TypeScript stopped on an existing config deprecation. I’ll finish checking the requested examples and rerun TypeScript with that deprecation suppressed.

Implemented `allowMultiple` with ordered duplicate arrays, unchanged decoding, and string values for single occurrences. Default first-value-wins behavior remains unchanged. TypeScript return types and README usage are updated.

Build, lint, all 97 existing tests, and requested examples pass. Full formatting and type checks still encounter pre-existing issues in unrelated test files.
