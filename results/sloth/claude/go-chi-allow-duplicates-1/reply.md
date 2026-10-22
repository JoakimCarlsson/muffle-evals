Dedupe in the shared handler with a bitmask-free seen set (works for any Go version).

The 405 `Allow` header now lists each method once. I haven't run your four-route example to see the new output. The build passes and the existing tests pass. I didn't add a test, since you didn't ask for one.

The cause is that the router collects allowed methods from every route that matches the path. Overlapping wildcard routes each add their own copy of `POST`. I fixed it in `methodNotAllowedHandler` in `mux.go`, which now skips any method it has already written. That is the one place every 405 response goes through.

The order of methods in the header is still random, as it was before, because they come from a map.

I made no git commit.
