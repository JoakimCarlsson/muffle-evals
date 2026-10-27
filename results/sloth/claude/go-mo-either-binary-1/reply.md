`Either3`, `Either4` and `Either5` now have `MarshalBinary`, `UnmarshalBinary`, `GobEncode` and `GobDecode`, in the same style as `Either`. `go vet` and `go test .` pass.

- **Encoding:** the first byte is the side id, using the existing `eitherNArgIdK` constants. The gob encoding of that side's value follows.
- **Id numbering:** those constants start at 0, so side 1 encodes as `0`, side 2 as `1`, and so on.
- **Decoding:** it builds a fresh value and only assigns it to the receiver on success. The other sides stay at their zero value, so a decoded value is `Equal` to the original. A failed decode leaves the receiver unchanged.
- **Errors:** empty input and an unknown side id both return an error. The unknown-id case returns the existing `errEitherNInvalidArgumentId`. `MarshalBinary` also returns that error if the value's own id is invalid.
- **Gob methods:** `GobEncode` and `GobDecode` just call the binary pair.
- **Tests:** each `eitherN_test.go` has a round-trip test and an error-case test. The round-trip test covers every side and both the binary and gob paths. The error test covers empty input, an id one past the last side, and `255`.

`gofmt -l` flags `option/transforms_test.go` and `result/transforms_test.go`. I didn't touch either file.

I haven't committed anything.
