I’ll trace the replacement and serialization logic, add a regression test, and fix the ordering so `c.d` stays at the top level.

The replacement code already moves regular table headers past following top-level keys, but it leaves arrays of tables in place. I’ve extended that logic to arrays of tables and added regression cases for dotted and plain siblings. The full test run is blocked by a missing TOML conformance fixture; I’ll run the remaining suite.

Fixed dotted-key replacement with an array of tables so following top-level keys stay outside the array.

Added regression tests covering dotted siblings, plain siblings, and a following table. All 363 available tests pass. The conformance suite could not run because its fixture files are missing.
