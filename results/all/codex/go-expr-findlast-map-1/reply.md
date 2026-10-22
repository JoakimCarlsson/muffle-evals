Compiler stack handling needs checking; then shared fix, build, existing tests.


Done.
Reverse loops pop condition flags. Existing tests pass; compiler/VM build pass. Full build fails: `function main is undeclared in the main package`.
