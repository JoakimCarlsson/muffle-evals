These three "unexpected success" cases are known failures that the fix now makes pass. I'll remove them from the expected-failures list.

The `url` crate now percent-encodes `^` in paths, so `http://localhost/a^b` parses to `http://localhost/a%5Eb`. The full workspace test suite passes.

The fix adds `^` to the `PATH` encode set in `url/src/parser.rs:23`. The userinfo set builds on `PATH` and already listed `^`, so it is unchanged.

Three spec-test cases were listed in `url/tests/expected_failures.txt` because of this bug, and they now pass. The test harness reported them as "unexpected success", so I removed them from that list. Two are the `foo://` and `wss://` host path cases. The third is `set pathname` on `a:/`.

I didn't commit anything.
