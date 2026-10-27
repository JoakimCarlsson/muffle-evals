use futures_core::Future;
use http::{Request, Response};
use std::future::poll_fn;
use std::pin::Pin;
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
    if consume {
        for status in [100, 103] {
            let info = poll_fn(|cx| response.poll_informational(cx))
                .await
                .unwrap()
                .unwrap();
            assert_eq!(info.status().as_u16(), status);
            assert_eq!(info.headers()["x-hint"], status.to_string());
        }
        assert!(poll_fn(|cx| response.poll_informational(cx))
            .await
            .is_none());
    }
    let final_response = poll_fn(|cx| Pin::new(&mut response).poll(cx))
        .await
        .unwrap();
    assert_eq!(final_response.status(), 200);
    assert!(poll_fn(|cx| response.poll_informational(cx))
        .await
        .is_none());
    drop(final_response);
    drop(response);
    drop(client);
    driver.await.unwrap().unwrap();
    server.await.unwrap();
}

#[tokio::test]
async fn receives_informational_in_order() {
    exchange(true).await;
}

#[tokio::test]
async fn final_response_drops_unconsumed_informational() {
    exchange(false).await;
}

#[tokio::test]
async fn informational_pending_before_headers() {
    let (client_io, _server_io) = tokio::io::duplex(4096);
    let (mut client, _connection) = h2::client::handshake(client_io).await.unwrap();
    let (mut response, _) = client
        .send_request(
            Request::builder()
                .uri("https://example.com/")
                .body(())
                .unwrap(),
            true,
        )
        .unwrap();
    poll_fn(|cx| {
        assert!(response.poll_informational(cx).is_pending());
        Poll::Ready(())
    })
    .await;
}
