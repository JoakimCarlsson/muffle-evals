Dotted-key replacement must keep sibling keys outside the array of tables.


Shared replacement logic handles tables but misses arrays of tables. Scope: `Container._replace_at` and regression tests; callers and exports need no changes.


Done.
Fixed dotted-key replacement with arrays of tables; sibling keys preserved. Added regression tests. 380 tests passed; full suite blocked by missing toml-test fixtures.
