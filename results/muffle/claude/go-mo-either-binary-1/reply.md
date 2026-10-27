`Either3`, `Either4` and `Either5` now have `MarshalBinary`, `UnmarshalBinary`, `GobEncode` and `GobDecode`, in `either3.go`, `either4.go` and `either5.go`. The tests pass.

- **Encoding:** the first byte is the set side's id (`either3ArgId1` and so on), followed by the gob encoding of that side's value. `GobEncode` and `GobDecode` just call the binary pair.
- **Decoding:** it restores the same side and value, and the other sides stay at their zero value. A decoded value is `Equal` to the original.
- **Errors:** empty input returns an error, and so does an unknown side id.
- **Failed decode:** a decode that fails leaves the receiver unchanged. That differs slightly from `Either`, which can partly overwrite it.

I added `either_n_binary_test.go`. It round-trips each type, including through a real gob encoder, and covers the empty-input and unknown-id errors. I also ran a throwaway test with the three types as fields in a struct, gob-encoded and decoded, then deleted it.

I made no commit.
