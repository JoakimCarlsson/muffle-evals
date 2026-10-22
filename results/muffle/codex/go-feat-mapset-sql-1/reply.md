I’ll check the set implementations and JSON handling, add SQL support to both, and test that failed scans leave the contents unchanged.

The existing JSON decoder adds elements to the set. I’ll keep that behavior and make `Scan` decode into a temporary set, replacing the contents only after decoding succeeds. The thread-safe version will lock when it commits the replacement.

Implemented SQL support for both set implementations in [sql.go](/home/jdaddy/.cache/muffle-evals/runs/muffle/codex/go-feat-mapset-sql-1/work/sql.go).

- `Value()` returns a JSON array as `[]byte`.
- `Scan()` accepts strings and byte slices, replacing existing contents.
- SQL `NULL` clears the set.
- Failed scans preserve existing contents.

Added tests for integer and string sets. Both `go test ./...` and `go test -race ./...` pass.
