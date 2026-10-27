use http::{Request, Response};
use std::future::poll_fn;
use std::task::Poll;

async fn exchange(consume: bool) {
    let (client_io, server_io) = tokio::io::duplex(4096);
    let server = tokio::spawn(async move {
        let mut connection = h2::server::handshake(server_io).await.unwrap();
        let (_, mut respond) = connection.accept().await.unwrap().unwrap();
        let invalid = respond.send_informational(Response::new(())).unwrap_err();
        assert!(invalid
            .to_string()
            .contains("invalid informational status code"));
        for status in [100, 103] {
            respond
                .send_informational(
                    Response::builder()
                        .status(status)
                        .header("x-hint", status.to_string())
                        .body(())
                        .unwrap(),
                )
                .unwrap();
        }
        respond.send_response(Response::new(()), true).unwrap();
        assert!(respond
            .send_informational(Response::builder().status(103).body(()).unwrap())
            .is_err());
        while connection.accept().await.is_some() {}
    });
    let (mut client, connection) = h2::client::handshake(client_io).await.unwrap();
    let driver = tokio::spawn(connection);
    let (mut response, _) = client
        .send_request(
            Request::builder()
                .uri("https://example.com/")
                .body(())
                .unwrap(),
            true,
        )
        .unwrap();
    // No response has been driven yet, so informational polling must register a waker.
    poll_fn(|cx| {
        assert!(response.poll_informational(cx).is_pending());
        Poll::Ready(())
    })
    .await;
    if consume {
        for status in [100, 103] {
            let hint = poll_fn(|cx| response.poll_informational(cx))
                .await
                .unwrap()
                .unwrap();
            assert_eq!(hint.status().as_u16(), status);
            assert_eq!(hint.headers()["x-hint"], status.to_string());
        }
        assert!(poll_fn(|cx| response.poll_informational(cx))
            .await
            .is_none());
    }
    assert_eq!(response.await.unwrap().status(), 200);
    drop(client);
    driver.await.unwrap().unwrap();
    server.await.unwrap();
}

#[tokio::test]
async fn informational_responses_are_ordered() {
    exchange(true).await;
}

#[tokio::test]
async fn unconsumed_informational_responses_do_not_replace_final_response() {
    exchange(false).await;
}

#[tokio::test]
async fn informational_poll_reports_reset_then_ends() {
    let (client_io, server_io) = tokio::io::duplex(4096);
    let server = tokio::spawn(async move {
        let mut connection = h2::server::handshake(server_io).await.unwrap();
        let (_, mut respond) = connection.accept().await.unwrap().unwrap();
        respond.send_reset(h2::Reason::CANCEL);
        while connection.accept().await.is_some() {}
    });
    let (mut client, connection) = h2::client::handshake(client_io).await.unwrap();
    let driver = tokio::spawn(connection);
    let (mut response, _) = client
        .send_request(
            Request::builder()
                .uri("https://example.com/")
                .body(())
                .unwrap(),
            true,
        )
        .unwrap();
    let error = poll_fn(|cx| response.poll_informational(cx))
        .await
        .unwrap()
        .unwrap_err();
    assert_eq!(error.reason(), Some(h2::Reason::CANCEL));
    assert!(poll_fn(|cx| response.poll_informational(cx))
        .await
        .is_none());
    assert!(response.await.is_err());
    drop(client);
    driver.await.unwrap().unwrap();
    server.await.unwrap();
}
