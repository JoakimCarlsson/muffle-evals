I’ll check argument parsing, fix how defaults interact with kebab-case input, and add a regression test.

Node’s parser applies the default before citty resolves aliases, so alias resolution sees `fooBar` as already set. I’ll apply defaults only when neither the argument nor an alias has an explicit value, with tests for enum, string, and boolean arguments.

Fixed. Explicit kebab-case input now overrides the camelCase argument’s default and populates both `fooBar` and `"foo-bar"`.

Added regression coverage for enums, strings, booleans, and aliases. All 66 tests pass, along with type, lint, and formatting checks.
