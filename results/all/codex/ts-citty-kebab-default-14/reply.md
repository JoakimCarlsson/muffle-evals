Default handling must recognize kebab-case input for camelCase args.


Scope: shared parser defaults and regression tests; callers, exports, fixtures, and config need no changes.


Done.
Defaults now respect explicit alias input, including kebab-case flags. Added regression coverage; all 71 tests, type checks, lint, and formatting pass.
