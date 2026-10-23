Encoder flattens when the tag has no name; mirror that in the decoder.

Fixed. The decoder now flattens an embedded struct whose tag has no name, such as `toml:",inline"`, the same way the encoder already did. Your `Config` example now fills `Region`, `Name` and `BsPort` as well as `PID`.

The change is in `addFields` in `unmarshaler.go`. Before, any tag on an embedded struct made the decoder treat it as a named sub-table. A tag with an explicit name, like `toml:"base"`, still does that.

I added `TestUnmarshalEmbeddedInlineTag` to `unmarshaler_test.go`, using your struct shape and document. The build succeeds and the full test suite passes.
