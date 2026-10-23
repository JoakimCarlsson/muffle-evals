I’ll trace how mapping keys are converted to strings, add a regression test, and run the relevant tests.

The decoder was using Go’s integer-to-string conversion, which turns `42` into the Unicode character `*`. I changed it to use the decoder’s existing numeric formatting helper. The regression tests cover signed and unsigned integers, hexadecimal input, and named string key types.

Fixed: integer map keys now use decimal string formatting, so your example produces `map[42:100]`.

Added regression tests for signed and unsigned integers, hexadecimal input, and named string key types.

Validation: `go test ./...` passes.
