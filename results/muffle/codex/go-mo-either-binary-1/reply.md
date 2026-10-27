I’ll check the existing `Either` implementation, add matching methods to the three variants, and test round-trips and invalid input.

Added all four serialization methods to `Either3`, `Either4`, and `Either5`.

Encoding uses the side id followed by its gob payload. Decoding clears inactive sides and rejects empty input or unknown ids. Gob methods delegate to the binary methods.

Tests cover every side, reused destinations, struct gob round-trips, and error cases. `go test ./...` passes.
