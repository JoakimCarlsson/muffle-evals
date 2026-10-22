I’ll check `NumDigits` and its callers, fix the coefficient digit count, then build and run the existing tests.

The error comes from the `int64` fast path: floating-point `Log10` can round incorrectly at powers of ten. I’ll replace it with integer division, which also handles negative coefficients exactly. The larger-coefficient path already checks its estimate against an exact power of ten.

Scope is limited to `NumDigits`. Its power, exponential, and logarithm callers need no changes, and neither do fixtures, configuration, or exports. I won’t add new tests or API options.

Fixed [`Decimal.NumDigits`]( /home/jdaddy/.cache/muffle-evals/runs/sloth/codex/go-decimal-numdigits-1/work/decimal.go:1255) by replacing floating-point logarithms with exact integer division for `int64` coefficients. This handles powers of ten, zero, and negative values correctly.

`go build ./...`, existing tests, and `git diff --check` pass.
