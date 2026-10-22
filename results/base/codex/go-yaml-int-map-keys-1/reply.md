I’ll trace how map keys are converted, fix the integer handling, and add a regression test.

The map decoder uses Go’s integer-to-string conversion, which turns `42` into the character `*`. I’ve changed it to use the decoder’s existing numeric formatting helper and added tests for positive, negative, zero, large, and named-string keys. The test suite is running.

Fixed integer map keys to use decimal string formatting, so your example now produces `map[42:100]`.

Added regression coverage for positive, negative, zero, large integer, and named-string keys. All tests pass with `go test ./...`.
