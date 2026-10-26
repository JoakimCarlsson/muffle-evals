I’ll check how dotted keys are replaced and serialized, then add a regression test for this case.

The replacement logic already moves regular table headers past following dotted keys, but it missed arrays of tables. I’ve extended that handling to arrays of tables. The document tests pass, including new cases at the root and inside a parent table; I’ll run the full suite now.

Fixed the replacement logic so arrays of tables move past following dotted keys, preserving top-level `c` in your example.

Added regression tests for root and nested tables. All 364 available tests pass. The external TOML conformance tests couldn’t run because their fixture files are missing.
