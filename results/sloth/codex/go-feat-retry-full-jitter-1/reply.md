I’ll check the existing jitter middleware and callers, add `WithFullJitter` in the same style, then build and run the existing tests.

The change needs a new exported function in `backoff.go` and a README example. No callers, fixtures, or configuration need changes. I’ll use the existing random generator and stop convention, with a guard that returns nonpositive durations unchanged.

Added `WithFullJitter(next Backoff) Backoff` and a README example.

- Returns a random duration in `[0, base)`.
- Propagates the wrapped stop signal.
- Returns zero and negative durations unchanged.

Build and existing tests pass.
