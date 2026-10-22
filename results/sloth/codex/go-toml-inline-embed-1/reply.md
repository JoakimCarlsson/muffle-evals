I’ll trace how decoding handles embedded fields, fix the regression, and run the build and existing tests.

The decoder treats any TOML tag as a field name, so `toml:",inline"` prevents the embedded struct from being flattened. The encoder already handles this correctly by checking whether the tag has a name.

The fix belongs in the shared decoder field mapping, which serves all three decoding paths. No caller, fixture, config, or export changes are needed. Named tags and ignored fields will keep their current behavior.

Fixed in [unmarshaler.go](/home/jdaddy/.cache/muffle-evals/runs/sloth/codex/go-toml-inline-embed-1/work/unmarshaler.go:2260). Embedded structs with unnamed tags such as `toml:",inline"` now decode their promoted fields correctly, matching encoder behavior.

`go build ./...` and all existing tests pass.
