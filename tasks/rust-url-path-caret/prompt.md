The `url` crate does not percent-encode the caret `^` (U+005E) in URL paths, which does not match the WHATWG URL Standard.

The spec defines the path percent-encode set as the query percent-encode set plus U+003F (?), U+005E (^), U+0060 (`), U+007B ({), and U+007D (}): https://url.spec.whatwg.org/#path-percent-encode-set

The path percent-encode set in this crate does not include `^`. As a consequence:

- With the reference WHATWG implementation, `new URL("http://localhost/a^b")` produces a URL whose `href` is `http://localhost/a%5Eb`.
- With the `url` crate, parsing `"http://localhost/a^b"` gives `"http://localhost/a^b"`, with the caret left unencoded.

Please fix this.
