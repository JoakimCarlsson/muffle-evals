Default handling needs to recognize kebab-case input before filling camelCase args.


Scope: shared parser defaults and alias regression tests. CLI callers and exports need no changes.


Done.
Kebab-case input now overrides camelCase defaults; both keys match. Added regression tests. All 72 tests, type checks, lint, formatting passed.
