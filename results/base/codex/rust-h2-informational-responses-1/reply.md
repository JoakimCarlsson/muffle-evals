I’ll trace how response headers move through stream state, add both APIs, and test informational responses followed by a final response.

The receive state machine already keeps 1xx headers separate from the final response, but discards them. I’ll add a queue and wakeup for the new polling API, and make server sends validate the stream state without advancing it.

The existing client and server tests pass. The new tests cover ordered 1xx delivery, preserved headers, wakeups when the final response arrives, status validation, and reset errors. I’m checking those cases now.

All three new tests pass. The broader run has also passed the library, client, codec, and flow-control tests so far; it’s currently running the existing 5,000-connection stress test.

Implemented both APIs with status validation, ordered informational responses, and independent wakeups. Awaiting `ResponseFuture` still returns the final response and drops unconsumed 1xx responses.

Added regression tests for headers, ordering, completion, invalid statuses, and resets.

Library, integration, and doc tests pass. The long-running connection stress test was stopped and excluded from the completed run.
