Encoder flattens when tag name empty. Match in decoder.

Three tabs, not four.

Done. In `unmarshaler.go` (`addFields`), an embedded struct whose tag has options but no name (`toml:",inline"`) is now flattened, which matches the encoder. A throwaway test with your `Config` shape passed, along with the existing root-package tests. I then deleted it, so no test was added. I didn't re-run the full `./...` suite after the fix.
