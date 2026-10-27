use futures::StreamExt;
use h2_support::prelude::*;

#[tokio::test]
async fn send_informational_before_final_response() {
    let (io, mut peer) = mock::new();
    let peer = async move {
        peer.assert_server_handshake().await;
        peer.send_frame(
            frames::headers(1)
                .request("GET", "https://example.com/")
                .eos(),
        )
        .await;
        peer.recv_frame(frames::headers(1).response(100)).await;
        peer.recv_frame(
            frames::headers(1)
                .response(103)
                .field("link", "</style.css>; rel=preload"),
        )
        .await;
        peer.recv_frame(frames::headers(1).response(200).eos())
            .await;
    };
    let server = async move {
        let mut connection = server::handshake(io).await.unwrap();
        let (_, mut respond) = connection.next().await.unwrap().unwrap();
        for status in [200, 204, 302, 400, 500] {
            let err = respond
                .send_informational(Response::builder().status(status).body(()).unwrap())
                .unwrap_err();
            assert!(format!("{:?}", err).contains("User"));
            assert!(err
                .to_string()
                .contains("invalid informational status code"));
        }
        respond
            .send_informational(Response::builder().status(100).body(()).unwrap())
            .unwrap();
        respond
            .send_informational(
                Response::builder()
                    .status(103)
                    .header("link", "</style.css>; rel=preload")
                    .body(())
                    .unwrap(),
            )
            .unwrap();
        respond.send_response(Response::new(()), true).unwrap();
        assert!(respond
            .send_informational(Response::builder().status(103).body(()).unwrap())
            .unwrap_err()
            .to_string()
            .contains("unexpected frame type"));
        assert!(connection.next().await.is_none());
    };
    join(peer, server).await;
}

#[tokio::test]
async fn receive_informational_in_order_and_wake_for_final() {
    let (io, mut peer) = mock::new();
    let (send_final, wait_final) = futures::channel::oneshot::channel();
    let peer = async move {
        peer.assert_client_handshake().await;
        peer.recv_frame(
            frames::headers(1)
                .request("GET", "https://example.com/")
                .eos(),
        )
        .await;
        peer.send_frame(frames::headers(1).response(100)).await;
        peer.send_frame(
            frames::headers(1)
                .response(103)
                .field("link", "</style.css>; rel=preload"),
        )
        .await;
        wait_final.await.unwrap();
        peer.send_frame(frames::headers(1).response(200)).await;
        peer.send_frame(frames::data(1, "ok").eos()).await;
    };
    let client = async move {
        let (mut client, connection) = client::handshake(io).await.unwrap();
        tokio::spawn(async move {
            connection.await.unwrap();
        });
        let (mut response, _) = client
            .send_request(
                Request::builder()
                    .uri("https://example.com/")
                    .body(())
                    .unwrap(),
                true,
            )
            .unwrap();
        let first = poll_fn(|cx| response.poll_informational(cx))
            .await
            .unwrap()
            .unwrap();
        assert_eq!(first.status(), 100);
        let second = poll_fn(|cx| response.poll_informational(cx))
            .await
            .unwrap()
            .unwrap();
        assert_eq!(second.status(), 103);
        assert_eq!(second.headers()["link"], "</style.css>; rel=preload");
        poll_fn(|cx| {
            assert!(response.poll_informational(cx).is_pending());
            std::task::Poll::Ready(())
        })
        .await;
        send_final.send(()).unwrap();
        assert!(poll_fn(|cx| response.poll_informational(cx))
            .await
            .is_none());
        let mut final_response = response.await.unwrap();
        assert_eq!(final_response.status(), 200);
        assert_eq!(
            final_response.body_mut().data().await.unwrap().unwrap(),
            "ok"
        );
    };
    join(peer, client).await;
}

#[tokio::test]
async fn informational_reports_reset_once() {
    let (io, mut peer) = mock::new();
    let peer = async move {
        peer.assert_client_handshake().await;
        peer.recv_frame(
            frames::headers(1)
                .request("GET", "https://example.com/")
                .eos(),
        )
        .await;
        peer.send_frame(frames::headers(1).response(103)).await;
        peer.send_frame(frames::reset(1).cancel()).await;
    };
    let client = async move {
        let (mut client, connection) = client::handshake(io).await.unwrap();
        tokio::spawn(async move {
            connection.await.unwrap();
        });
        let (mut response, _) = client
            .send_request(
                Request::builder()
                    .uri("https://example.com/")
                    .body(())
                    .unwrap(),
                true,
            )
            .unwrap();
        assert_eq!(
            poll_fn(|cx| response.poll_informational(cx))
                .await
                .unwrap()
                .unwrap()
                .status(),
            103
        );
        let err = poll_fn(|cx| response.poll_informational(cx))
            .await
            .unwrap()
            .unwrap_err();
        assert_eq!(err.reason(), Some(Reason::CANCEL));
        assert!(poll_fn(|cx| response.poll_informational(cx))
            .await
            .is_none());
        assert_eq!(response.await.unwrap_err().reason(), Some(Reason::CANCEL));
    };
    join(peer, client).await;
}
