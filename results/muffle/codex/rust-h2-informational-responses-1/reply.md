I’ll trace response handling on both sides, add the APIs, and test that informational responses leave final-response handling intact.

The receive state machine already recognizes 1xx responses, but discards their headers. I’ll add a separate queue for them and ensure sending a 1xx response leaves the stream ready for the final response.

The new end-to-end tests pass: repeated 1xx responses arrive in order, invalid statuses are rejected, and awaiting the final response works when informational responses are left unread. I’m running the existing client and server tests for regressions.

Implemented both APIs with ordered informational response delivery, final-response preservation, and the new `InvalidInformationalStatusCode` user error.

Validation passed: 3 new integration tests and 79 existing client/server tests. Two existing tests remain ignored.
