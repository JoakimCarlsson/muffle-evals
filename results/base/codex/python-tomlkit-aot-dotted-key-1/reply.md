I’ll check how replacement affects serialization, fix the ordering issue, and add a regression test.

The replacement logic already moves ordinary tables past dotted keys that follow them, but it missed arrays of tables. I’ve extended that handling to arrays of tables. The document tests pass, including the reported case; I’ll run the full suite now.

Fixed the replacement logic so arrays of tables move past following dotted keys, preserving their top-level scope.

Added regression tests covering the reported case and surrounding table headers.

Validation: 363 tests passed. The full suite could not collect because the external `toml-test` fixtures are missing.
