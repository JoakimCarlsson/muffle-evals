`Either3`, `Either4` and `Either5` now have `MarshalBinary`, `UnmarshalBinary`, `GobEncode` and `GobDecode`, in `either3.go`, `either4.go` and `either5.go`.

I checked it with a throwaway test, which I deleted afterwards, so no test file is added. It gob-encoded and decoded a struct holding all three types into a value that already had a different side set. The decoded struct matched the original under `reflect.DeepEqual`. Empty input and an unknown side id (9) both returned errors. The package's existing tests also pass.

- **Encoding:** the first byte is the set side's id (`either3ArgId1` and so on), followed by the gob encoding of that side's value. Because the constants start at 0, side 1 encodes as byte `0`.
- **Decoding:** it decodes into a fresh value and only assigns it on success. That leaves the other sides at their zero value and keeps the receiver untouched if decoding fails.
- **Errors:** empty input returns a "no data" error. An unknown side id returns the type's existing `errEitherNInvalidArgumentId`. `MarshalBinary` returns the same error if `argId` is invalid, which can only happen for a zero-value `EitherN`.
- **`Equal`:** none of the three types has an `Equal` method, so I compared with `reflect.DeepEqual`. I didn't add one, since you didn't ask for it.

Nothing is committed.
