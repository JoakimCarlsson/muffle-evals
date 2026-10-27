I’ll trace response handling and the existing tests, then add both APIs and focused coverage.


The receive state machine already recognizes 1xx responses, but discards them. I’ll retain them in the existing response queue and make polling the final response skip any unconsumed informational responses.


The APIs and focused tests are in place. Coverage checks ordered delivery of 100, 103, and 199 responses, preserved headers, invalid-status errors, and final-response delivery when informational responses are never polled. I’m running the full integration suite now.


The client tests passed, including the new informational-response test and the existing early-hints tests. The suite is now running its 5,000-connection stress test; the remaining integration tests will follow.


Implemented both APIs and `InvalidInformationalStatusCode`.

Informational responses preserve stream state, arrive in order with headers, and leave final-response delivery intact when unconsumed.

Validation: 177 integration tests passed. Interrupted and skipped the long-running concurrency stress test; 12 existing tests remained ignored. No dependencies or extra options added.
