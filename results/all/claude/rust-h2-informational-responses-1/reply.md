Some informational handling exists. Let me look.

Implementing now: error variant, stream queue, send path, recv path, and the client poll.

Done. Added `SendResponse::send_informational`, `ResponseFuture::poll_informational` and `UserError::InvalidInformationalStatusCode`, plus three tests (two client, one server). Unit and integration tests passed. The last workspace test run hit the timeout and was still running; I did not check it.

Beyond what you specified, `send_informational` also returns `UnexpectedFrameType` if the response body has already started streaming or the send side is closed. It rejects a 1xx frame that carries END_STREAM.

Failed to authenticate: OAuth session expired and could not be refreshed
