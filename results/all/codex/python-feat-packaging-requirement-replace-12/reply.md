`Requirement.__replace__` needs parse validation, independent specifiers, and subclass initialization.


Scope: requirement method, existing tests, usage docs, changelog. No exports or callers need changes; `Version.__replace__` supplies signature style.


5,379 requirement tests pass. New cases cover invalid field injection, prerelease settings, subclass initialization, and `copy.replace`.


Done.
Added validated `Requirement.__replace__`, independent specifiers, subclass support, docs, and tests. All 7,418 tests pass; lint, format, and type checks pass.
