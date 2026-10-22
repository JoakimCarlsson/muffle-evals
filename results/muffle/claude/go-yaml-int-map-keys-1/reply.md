That looks fine; the issue is likely in the typed-map path. Let me reproduce.

The cause is that `reflect.Convert` turns the integer 42 into the rune `'*'` when the target key type is `string`. I'll fix that case.

The edit failed, probably on whitespace, but the test reproduces the bug. I'll re-read the exact lines.

I had the indentation wrong, with 4 tabs where the file has 3.

Decoding `42: 100` into a `map[string]any` now gives `map[42:100]`, with the key as the string `"42"`. The full test suite passes.

The cause was in `decodeMap` in `decode.go`. It used `reflect.Convert` to turn the decoded key into the map's key type. Go converts an integer to a string as the character with that code point, so 42 became `*`. For string-keyed maps, non-string keys now go through `fmt.Sprint` instead. This also covers floats and bools, so a key like `true` becomes `"true"`.

I added a regression test, `TestDecoder_IntKeyToStringMapKey`, in `decode_test.go`. It failed before the fix with `map[*:100]` and passes now. I haven't committed anything.
