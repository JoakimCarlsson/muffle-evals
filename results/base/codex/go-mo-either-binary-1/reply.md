I’ll check `Either`’s implementation, add matching methods to the three larger variants, and test their binary and gob round trips.

Added all four serialization methods to `Either3`, `Either4`, and `Either5`.

Encoding prefixes the gob payload with the side id. Decoding clears inactive sides and rejects empty input or unknown ids. Gob methods delegate to the binary methods.

Added tests for every side, struct gob round trips, stale-value clearing, and invalid inputs. `go test ./...` passes.
