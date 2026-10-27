I've read the stream/recv code and I'm now implementing the server send path and the client-side informational queue.

Fix the misplaced derive, then add the remaining plumbing.

Add tests.

Both halves are in. The full test suite passes, including three new tests (two in `client_request.rs`, one in `server.rs`). I haven't committed anything.

**Server: `SendResponse::send_informational`**
- It sends a HEADERS frame without END_STREAM and leaves the stream state unchanged, so you can call it repeatedly before `send_response`.
- A non-1xx status is rejected with a user error whose message is `invalid informational status code`, backed by the new `UserError::InvalidInformationalStatusCode`.
- It also errors if the final response has already been sent or the stream is closed for sending.

**Client: `ResponseFuture::poll_informational`**
- Incoming 1xx frames are now queued on the stream, separately from the final response. Awaiting the `ResponseFuture` still returns the real non-1xx response even if you never poll `poll_informational`, and unconsumed 1xx responses are dropped.
- It returns `Ready(Some(Ok(..)))` for each queued response in order.
- It returns `Pending` while the stream is still waiting for response headers.
- It returns `Ready(None)` once the final response has arrived or the stream is closed.
- A reset stream surfaces its error instead.

**Behaviour you didn't specify**
- **Queue cap:** each stream keeps at most 16 unconsumed informational responses (`MAX_PENDING_INFORMATIONAL` in `recv.rs`); extras are dropped. This stops a peer from flooding memory with 1xx frames. Say if you'd rather have a different limit or none.
- **Remaining 1xx after the final response:** `poll_informational` still hands out any queued 1xx responses first, then returns `None`.

The new tests cover:
- the client receiving a 103 and then the final 200;
- the client never polling `poll_informational` and still getting the final response;
- the server sending 100 and 103 and rejecting a 200.

The server test checks that the error message contains `invalid informational status code`, not that it is a user error. `h2::Error` has no public method to check that.

The background full-suite run has finished with exit code 0. As I reported above, every test passed and there were no failures. Nothing is committed, and no further work is pending.
