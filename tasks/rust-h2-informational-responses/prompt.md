h2 has no way to send or receive HTTP/2 informational responses (1xx, such as `100 Continue` or `103 Early Hints`). A server cannot send one before the final response, and a client that receives one either gets confused or silently loses it. I'd like support for both sides.

Server side: add a method on `h2::server::SendResponse`:

```rust
pub fn send_informational(&mut self, response: Response<()>) -> Result<(), h2::Error>
```

It sends a HEADERS frame without END_STREAM and without changing the stream's state, so it can be called any number of times before `send_response`. A response whose status is not 1xx must be rejected with an `h2::Error` (a user error) whose message contains `invalid informational status code`; add a matching new variant `InvalidInformationalStatusCode` to the internal `UserError` enum.

Client side: add a method on `h2::client::ResponseFuture`:

```rust
pub fn poll_informational(&mut self, cx: &mut Context<'_>) -> Poll<Option<Result<Response<()>, h2::Error>>>
```

It returns `Ready(Some(Ok(response)))` for each informational response received so far, in order (the response has the 1xx status and its headers, body type `()`), `Pending` when none has arrived yet but the stream is still open, and `Ready(None)` once the stream can receive no more. A 1xx HEADERS frame arriving on a stream must not end the request or be taken for the final response: awaiting the `ResponseFuture` itself must still yield the real final response (the one with the non-1xx status), even if the caller never polled `poll_informational`, and informational responses that were not consumed are simply dropped.

Please add this.
