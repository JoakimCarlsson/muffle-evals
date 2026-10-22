Encoder flattens when the tag has no name; make the decoder match.

Fixed: embedded structs tagged `toml:",inline"` now decode into the embedded fields again. `Region`, `Name` and `BsPort` from your example are populated, and the full test suite passes. I haven't committed anything.

**Cause:** the decoder's field planner (`addFields` in `unmarshaler.go`) only flattened embedded structs that had no `toml` tag at all. Any tag, even `",inline"` with no name, made it treat the embedded struct as a regular field named `Base`. The encoder already flattens an embedded struct whenever its tag has no name, which is why encoding worked and decoding didn't.

**Fix:** the decoder now uses the same rule as the encoder. An embedded struct is flattened unless its tag gives it a name (for example `toml:"base"`), in which case it still maps to a table of that name.

**Test:** I added `TestUnmarshalEmbeddedStructInlineTag` to `unmarshaler_test.go`, using a trimmed copy of your `Base`/`Config` structs and TOML document.
