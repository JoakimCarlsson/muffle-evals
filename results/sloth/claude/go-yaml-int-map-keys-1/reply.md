Probably a whitespace mismatch (the file was read with tabs); let me retry with exact lines.

Decoding `42: 100` into a `map[string]any` now gives `map[42:100]`, with the key as the string `"42"`. The full test suite passes.

The cause was in `decodeMap` in `decode.go`. The integer key was converted straight to a string type, and Go's `uint64` to `string` conversion produces the character with that code point. 42 became `*`. Now, when the map's key type is a string kind and the YAML key isn't a string, the key goes through `fmt.Sprint` first.

This also changes other non-string keys. `1.5:` becomes `"1.5"` and `true:` becomes `"true"`. Previously `true:` into a `map[string]any` returned a "cannot convert" error. A `null:` key still becomes `""`, as before.

I added `TestDecoder_NonStringKeyToStringMap` to `decode_test.go`. It covers the integer, float, bool, null and plain string keys.
