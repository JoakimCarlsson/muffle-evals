That looks fine; the problem is likely in decodeMap.

`uint64(42)` is "convertible" to `string` via Go's rune conversion, which gives `"*"`. I'll special-case string keys.

The edit failed (probably whitespace), so I'll check the exact text.

I had one tab too many in the old string. Retrying.

Fixed: your example now prints `map[42:100]`.

The cause was in `decodeMap` in `decode.go`. The key was decoded as `uint64(42)`, then converted to `string` with Go's reflect `Convert`. That conversion treats the number as a rune, and rune 42 is `*`.

For string-keyed maps, non-string keys now go through the existing `mapKeyNodeToString` helper. Bool and float keys previously failed with `cannot convert "bool" type to "string" type`. They now work too: `true: 1` gives `true`, and `1.5: 2` gives `1.5`.

I ran your example plus the bool and float cases in a throwaway test, which I deleted. The existing test suite passes. I didn't add a permanent test, since you didn't ask for one.
