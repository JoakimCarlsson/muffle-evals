I’ll check how the router builds the 405 `Allow` header, fix the duplicates, and add a regression test for overlapping routes.

The regression test reproduced duplicate `POST` values and duplicates with both `POST` and `PUT`. The handler now tracks which methods it has added to `Allow`. The full test suite is running.

Fixed the 405 `Allow` header so each method appears only once, including when wildcard routes overlap.

Added regression coverage for duplicate methods and multiple distinct methods. `go test ./...` passes.
