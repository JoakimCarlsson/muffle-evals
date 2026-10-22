I’ll trace how the reverse-search builtins use the VM stack, compare them with `find` and `findIndex`, and fix the shared cause. Then I’ll build and run the existing tests.

The reverse-loop helper leaves its boundary-check boolean on the stack. Map construction then reads that boolean as a key, causing the error.

The fix belongs in that shared helper, which serves both builtins and optimized `filter(... ) | last()` expressions. I’ll remove the boolean on both loop paths. No caller, fixture, config, or export changes are needed; I’ll use the existing tests and direct reproduction checks.

Fixed in [compiler/compiler.go]( /home/jdaddy/.cache/muffle-evals/runs/sloth/codex/go-expr-findlast-map-1/work/compiler/compiler.go:1207). The shared reverse-loop helper now removes boundary-check booleans from the stack, fixing both builtins inside map literals.

Validation: all existing tests and 20 direct reproduction/edge-case checks passed. Affected packages build successfully. `go build ./...` fails because the existing examples package lacks a `main` function.
