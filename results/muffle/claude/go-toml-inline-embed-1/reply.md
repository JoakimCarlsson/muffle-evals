The encoder flattens when the tag has no name; the decoder should match.

Test file uses an external package; fix the qualifier.

Decoding now fills the embedded fields. Your `Config` example gets `Region`, `Name` and `BsPort` as well as `PID`, and the full test suite passes.

The decoder treated any embedded struct with a `toml` tag as a regular named field, so `toml:",inline"` made it look for a `Base` table. The encoder already flattens an embedded struct when the tag has no name, which is why encoding worked. I made the decoder follow the same rule in `addFields` in `unmarshaler.go`. Embedded structs with an explicit name, like `toml:"base"`, still decode as named tables.

I added `TestUnmarshalEmbeddedInlineTag` to `unmarshaler_test.go`, using your struct shape. I haven't committed anything.
