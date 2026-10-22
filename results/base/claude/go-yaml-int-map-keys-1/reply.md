That looks fine; the issue is likely elsewhere. Let me reproduce.

`reflect.Convert` turns the integer 42 into the rune `'*'` when the target is a string. I'll special-case string keys.

Whitespace mismatch in my patch (the test shows the fix was not applied). Using Edit.

Fixed: decoding `42: 100` into a `map[string]any` now gives `map[42:100]`, with the key as the string `"42"`.

**Cause:** in `decodeMap` (`decode.go`), the decoded key was an integer, and `reflect.Convert` turned it into a string by treating it as a rune. 42 became `'*'`.

**Fix:** when the map's key type is a string kind and the decoded key isn't a string, the key is now built with `fmt.Sprint`. The same applies to other non-string scalar keys such as floats and booleans. All other key types go through the original conversion path.

I added `TestDecoder_IntegerKeyToStringMap` to `decode_test.go`. The full test suite passes and `gofmt` is clean. I haven't committed anything.
