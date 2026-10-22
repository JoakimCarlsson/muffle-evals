Edit failed (whitespace mismatch); retrying with exact lines.

Done. `decodeMap` in `decode.go` now turns non-string scalar keys into strings with `fmt.Sprint` when the map key type is string-kinded. Before, the int was converted to a rune, so 42 became `*`. I added `TestDecoder_IntKeyToStringMap`, and the full suite passes. Not committed.
