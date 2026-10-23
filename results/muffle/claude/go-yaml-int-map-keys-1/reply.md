That looks fine; the `*` must come from elsewhere. Let me reproduce.

Output is being swallowed by something; let me capture it differently.

Reproduced. Check the decode path for map[string]any.

Let me add a regression test and clean up.

Fixed: `42: 100` now decodes into `map[string]any` as `map[42:100]`, with the key as the string `"42"`.

The cause was in `decodeMap` in `decode.go`. It converted the decoded key (an integer) to the map's key type with reflection. Go converts an integer to a string as a rune, so `42` became `"*"`. When the map key type is a string and the decoded key isn't one, it now formats the key with `fmt.Sprint`. This also covers float and bool keys.

I added a regression test, `TestDecoder_IntegerKeyToStringMap`, in `decode_test.go`. It and the existing test suite pass. I haven't committed anything.
