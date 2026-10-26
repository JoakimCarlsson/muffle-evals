Requirement needs validated replacement, independent specifiers, and subclass construction.


Scope: Requirement method, existing requirement tests, docs, changelog. Parsing will validate fields before subclass construction; specifier copies will retain explicit prerelease settings.


5,379 requirement tests pass. Specifier formatting can mutate its input; replacement must clone before validation.


Done.
Added validated `Requirement.__replace__`, subclass support, independent specifiers preserving prerelease settings, docs, and tests. 7,417 tests passed; Ruff and mypy passed.
