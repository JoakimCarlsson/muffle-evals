Fix didn't take; the `*` comes from another code path. Looking for it now.

Applying the edit now; running tests to check.

Done. `decodeMap` in `decode.go` now turns integer keys into decimal strings when the map key type is string, instead of converting them to runes. I added a `42: 100` case to `TestDecoder`, and `go test ./...` passes.

Float keys like `1.5: 2` still fail with `cannot convert "float64" type to "string" type`, as they did before. I left that alone because you only reported integer keys.
