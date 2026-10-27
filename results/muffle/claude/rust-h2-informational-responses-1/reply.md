Now the streams internals.

Let me add tests, modelled on existing ones.

Both sides are in. The full test suite passes, including three new tests for the sending, polling and ignored-informational cases.

**Server.** `SendResponse::send_informational(Response<()>)` queues a HEADERS frame without END_STREAM and leaves the stream state alone, so you can call it any number of times before `send_response`.
- A non-1xx status returns a user error with the message `invalid informational status code`, from the new `UserError::InvalidInformationalStatusCode` variant.
- It returns a user error if the final response has already been sent or the stream was reset. It also rejects headers that `send_response` would reject, such as connection-specific ones.

**Client.** `ResponseFuture::poll_informational` hands back 1xx responses in the order received, with their headers and body type `()`.
- It returns `Pending` while the stream is still waiting for headers, and `Ready(None)` once the final response has arrived or the stream can no longer receive.
- Awaiting the `ResponseFuture` itself still yields the real final response, whether or not you polled `poll_informational`. Informational responses you didn't consume are dropped at that point.

- **Resets:** if the stream is reset, `poll_informational` returns `Ready(None)` rather than an error. The reset error still comes out of the `ResponseFuture`.
- **Queue cap (not in your spec):** each stream keeps at most 64 unconsumed informational responses, and later ones are discarded. This stops a server that sends endless 1xx frames from growing memory without bound. Say if you'd rather have no cap or a different limit.

The changes are mostly in `src/proto/streams/recv.rs`, `send.rs` and `streams.rs`, plus the two public methods in `src/server.rs` and `src/client.rs`. Nothing is committed.
