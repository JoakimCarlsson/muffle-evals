I’ll trace how map keys are converted, fix the shared decoding path, and run the existing tests.

The map decoder uses Go’s direct integer-to-string conversion, which turns `42` into the character `*`. The decoder already has a conversion helper that produces `"42"`; I’ll use it here too. Only `decode.go` needs to change. This covers top-level, nested, and merged maps without changing callers, fixtures, config, or exports.

Fixed in [decode.go](/home/jdaddy/.cache/muffle-evals/runs/sloth/codex/go-yaml-int-map-keys-1/work/decode.go:1759) by reusing the existing string conversion helper. Integer key `42` now becomes `"42"`.

Verified positive, negative, and maximum-width integer keys. `go build ./...` and `go test ./...` pass.
