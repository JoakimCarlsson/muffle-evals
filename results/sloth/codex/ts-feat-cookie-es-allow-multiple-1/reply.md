I’ll check the parser, its callers, types, and tests, then add the option while preserving first-value-wins behavior by default.

The change reaches the parser, the exported options and result types, the existing parser tests, and a README example. There are no internal callers to update or fixtures/config changes needed. I’ll keep default return types unchanged and include `undefined` in array element types because custom decoders already support returning it. No additional parsing options are needed.

The option is implemented, and all 98 tests pass. The build and lint also pass. Since `pnpm` isn’t installed, I ran the installed tools directly. Validation found an existing TypeScript config deprecation and a formatting issue in the untouched serializer test; I’m checking types with the deprecation suppressed.

Added `allowMultiple: true` with ordered duplicate arrays, unchanged decoding, and option-aware return types. Default behavior remains unchanged. Added tests and README documentation.

Validation: all 98 tests, build, and lint pass. Full type and formatting checks encounter existing issues in unrelated tests/config.
