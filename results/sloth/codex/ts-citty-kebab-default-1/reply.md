I’ll check how defaults and argument aliases interact, fix the shared parser, then run the build and existing tests.

The parser applies defaults before resolving aliases, so it treats the default as an existing value and won’t replace it. I’ll apply defaults only when neither the argument nor its aliases has a value. This needs one shared-parser change; callers, exports, fixtures, and config need no changes. No new options or dependencies are needed.

Fixed in [src/_parser.ts](src/_parser.ts). Defaults now apply only when neither the argument nor its aliases has an explicit value.

Confirmed your example returns both `fooBar: "one"` and `"foo-bar": "one"`.

Build, lint, type checks, and all 63 existing tests passed. Since `pnpm` wasn’t installed, validation used npm and the installed tools directly.
