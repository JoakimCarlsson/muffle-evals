package mo

import (
	"bytes"
	"encoding/gob"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEitherNBinary(t *testing.T) {
	is := assert.New(t)

	e3 := NewEither3Arg2[int, string, bool]("a")
	bin, err := e3.MarshalBinary()
	is.NoError(err)
	is.Equal(byte(either3ArgId2), bin[0])
	var d3 Either3[int, string, bool]
	is.NoError(d3.UnmarshalBinary(bin))
	is.Equal(e3, d3)

	e4 := NewEither4Arg4[int, string, bool, float64](2.5)
	bin, err = e4.GobEncode()
	is.NoError(err)
	var d4 Either4[int, string, bool, float64]
	is.NoError(d4.GobDecode(bin))
	is.Equal(e4, d4)

	e5 := NewEither5Arg1[int, string, bool, float64, uint](0)
	var buf bytes.Buffer
	is.NoError(gob.NewEncoder(&buf).Encode(e5))
	var d5 Either5[int, string, bool, float64, uint]
	is.NoError(gob.NewDecoder(&buf).Decode(&d5))
	is.Equal(e5, d5)

	is.Error(d3.UnmarshalBinary(nil))
	is.Error(d3.UnmarshalBinary([]byte{9}))
	is.Error(d4.UnmarshalBinary(nil))
	is.Error(d4.UnmarshalBinary([]byte{9}))
	is.Error(d5.UnmarshalBinary(nil))
	is.Error(d5.UnmarshalBinary([]byte{9}))
}
