I fixed the decoding of embedded structs tagged `toml:",inline"`. Your `Config` now decodes `Region`, `Name` and `BsPort` along with `PID`.

**Cause:** in `addFields` in `unmarshaler.go`, any embedded struct with a `toml` tag was treated as a regular field named `Base`. A tag like `",inline"` has an empty name part, so the embedded fields were never flattened into the parent.

**Fix:** an embedded struct is now flattened unless the tag gives it an explicit name. `toml:"base"` still makes it a named field. The change is only in `unmarshaler.go`.

**Testing:**
- A throwaway test with your struct shape passed: `Region`, `BsPort` and `PID` were all populated.
- I deleted that test afterwards, so no regression test is in the repo. I can add a permanent one if you want.
- `go test ./...` passes.
- I haven't committed anything.
