Decoding broke in v2.4 for embedded structs with the `inline` annotation.

Since v2.4 (tested with v2.4.1), a struct using the `inline` annotation on an embedded struct is encoded properly but not decoded: the embedded fields remain at their default values. It worked with v2.3.

My structs:

```go
type Base struct {
	Region        string
	Name          string
	IPv4          string
	BsPort        int
	WebSocketPort int
	OutOfBandPort int
}

type Config struct {
	Base  `toml:",inline"`
	PID   uint32
	index int `toml:"-"`
}
```

Unmarshalling a document like

```toml
Region = "us"
Name = "srv1"
BsPort = 100
PID = 42
```

into a `Config` sets `PID` but leaves `Region`, `Name` and `BsPort` empty.

Please fix this.
