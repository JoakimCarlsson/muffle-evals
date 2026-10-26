I’ll trace the replacement and serialization logic, add a regression test, and run the relevant tests.

The replacement logic already moves ordinary tables past following dotted keys, but omitted arrays of tables. I’ve extended that handling and added round-trip tests for root and nested tables, with both plain and dotted siblings. The document tests pass.

Fixed dotted-key replacement with an array of tables so following sibling keys retain their scope.

Added regression coverage for root and nested tables with plain and dotted siblings. All 364 available tests pass; the external conformance suite could not run because its fixture files are missing.
