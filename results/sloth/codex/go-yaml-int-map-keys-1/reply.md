I’ll trace map-key decoding, fix the shared conversion, and add a regression test. I’ll check that typed map keys and existing error behavior stay intact; no new options or dependencies are needed.

The map decoder uses Go’s integer-to-string conversion, which turns `42` into the Unicode character `*`. The existing scalar conversion helper already formats integers as decimal strings. I’ll reuse it in the map decoder and add cases to the existing decoder tests. No public API, fixture, or config changes are needed.

Fixed integer map keys to use decimal string formatting, so the example now produces `map[42:100]`.

Added regression coverage for zero, negative integers, large integer boundaries, and named string key types.

Validation passed: `go test ./...`, `go build ./...`, and `git diff --check`.
