Please add binary serialization to `Either3`, `Either4` and `Either5`.

`Either` already round-trips through `encoding/gob` (`MarshalBinary`, `UnmarshalBinary`, `GobEncode`, `GobDecode`), but the three-, four- and five-way variants do not, so a struct that holds one cannot be gob-encoded or stored as binary.

For each of `Either3[T1, T2, T3]`, `Either4[...]` and `Either5[...]` add, in the same style as `Either`:

```go
func (e EitherN[...]) MarshalBinary() ([]byte, error)
func (e *EitherN[...]) UnmarshalBinary(data []byte) error
func (e EitherN[...]) GobEncode() ([]byte, error)
func (e *EitherN[...]) GobDecode(data []byte) error
```

- The first byte of the encoded form is the id of the side that is set (the same constants the type already uses, such as `either3ArgId1`), followed by the gob encoding of that side's value.
- Decoding restores the same side and value, and leaves the other sides at their zero value, so a decoded value is `Equal` to the original.
- Empty input is an error, and so is an unknown side id.
- `GobEncode` and `GobDecode` just call the binary pair.
