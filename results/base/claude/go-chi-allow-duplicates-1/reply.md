Dedupe in the handler.

The 405 `Allow` header now lists each method once, so your example returns `Allow: [POST]` instead of four `POST` entries. The full test suite passes.

The fix is in `methodNotAllowedHandler` in `mux.go`. It now skips any method it has already added to the header. Overlapping wildcard routes still each contribute their methods during lookup, so the duplicates are removed at the point the header is written.

I added a regression test, `TestMuxMethodNotAllowedNoDuplicateAllow` in `mux_test.go`, which uses the four routes from your report. I haven't committed anything.
