I’ll trace how replacement affects dotted-key serialization, fix the shared logic, and run the existing tests.

The replacement logic already moves ordinary tables past following dotted keys, but its condition excludes arrays of tables. I’ll extend that condition to include them. Assignment and table merging share this path; no caller, fixture, config, or export changes are needed.

Fixed the shared replacement logic in [container.py](tomlkit/container.py) so arrays of tables move past following dotted keys, preserving top-level `c`.

Validation: 360 existing tests passed, plus manual round-trip checks. The conformance suite is blocked by missing fixtures; building is blocked by missing build tooling.
