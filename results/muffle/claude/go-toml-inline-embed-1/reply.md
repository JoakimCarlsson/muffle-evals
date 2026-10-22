The encoder flattens an embedded struct when the tag has no name. The decoder flattens it only when there's no tag at all. I'll make the decoder use the same rule.

Now I'll add a test and run the suite.

The test file is in package `toml_test`, so my test needs the `toml.` prefix.

Decoding into an embedded struct tagged `toml:",inline"` now fills the embedded fields again. The full test suite passes.

The encoder already flattened an embedded struct when its tag has no name, such as `toml:",inline"`. The decoder only flattened it when it had no tag at all. With a tag, it treated the struct as a nested table called `Base`. Your flat keys like `Region` and `Name` then matched nothing and were silently dropped.

The decoder now uses the same rule as the encoder. I changed `addFields` in `unmarshaler.go` and added a small helper, `parts0`, which returns the name part of a tag.

An embedded struct with a named tag, such as `toml:"base"`, still decodes as a regular nested table.

I added `TestUnmarshalEmbeddedInlineTag` to `unmarshaler_test.go`, using your `Config` shape. I haven't committed anything.
