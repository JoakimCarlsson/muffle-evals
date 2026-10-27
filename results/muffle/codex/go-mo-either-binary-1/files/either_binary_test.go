package mo

import (
	"bytes"
	"encoding/gob"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEither3BinarySerialization(t *testing.T) {
	originals := []Either3[int, string, bool]{
		NewEither3Arg1[int, string, bool](42),
		NewEither3Arg2[int, string, bool]("hello"),
		NewEither3Arg3[int, string, bool](true),
	}
	for id, original := range originals {
		data, err := original.MarshalBinary()
		require.NoError(t, err)
		require.NotEmpty(t, data)
		assert.Equal(t, byte(id), data[0])
		// Decode into every previously selected side to check that stale values are cleared.
		for _, decoded := range originals {
			require.NoError(t, decoded.UnmarshalBinary(data))
			assert.Equal(t, original, decoded)
		}
		gobData, err := original.GobEncode()
		require.NoError(t, err)
		assert.Equal(t, data, gobData)
		var decoded Either3[int, string, bool]
		require.NoError(t, decoded.GobDecode(gobData))
		assert.Equal(t, original, decoded)
		var buf bytes.Buffer
		holder := struct{ Value Either3[int, string, bool] }{Value: original}
		require.NoError(t, gob.NewEncoder(&buf).Encode(holder))
		restored := holder
		require.NoError(t, gob.NewDecoder(&buf).Decode(&restored))
		assert.Equal(t, holder, restored)
	}
	var decoded Either3[int, string, bool]
	for _, data := range [][]byte{nil, {}, {255}, {0}, {0, 255}} {
		assert.Error(t, decoded.UnmarshalBinary(data))
		assert.Error(t, decoded.GobDecode(data))
	}
	_, err := (Either3[int, string, bool]{argId: -1}).MarshalBinary()
	assert.Error(t, err)
	_, err = NewEither3Arg1[chan int, int, int](make(chan int)).MarshalBinary()
	assert.Error(t, err)
}

func TestEither4BinarySerialization(t *testing.T) {
	originals := []Either4[int, string, bool, float64]{
		NewEither4Arg1[int, string, bool, float64](42),
		NewEither4Arg2[int, string, bool, float64]("hello"),
		NewEither4Arg3[int, string, bool, float64](true),
		NewEither4Arg4[int, string, bool, float64](1.5),
	}
	for id, original := range originals {
		data, err := original.MarshalBinary()
		require.NoError(t, err)
		require.NotEmpty(t, data)
		assert.Equal(t, byte(id), data[0])
		// Decode into every previously selected side to check that stale values are cleared.
		for _, decoded := range originals {
			require.NoError(t, decoded.UnmarshalBinary(data))
			assert.Equal(t, original, decoded)
		}
		gobData, err := original.GobEncode()
		require.NoError(t, err)
		assert.Equal(t, data, gobData)
		var decoded Either4[int, string, bool, float64]
		require.NoError(t, decoded.GobDecode(gobData))
		assert.Equal(t, original, decoded)
		var buf bytes.Buffer
		holder := struct {
			Value Either4[int, string, bool, float64]
		}{Value: original}
		require.NoError(t, gob.NewEncoder(&buf).Encode(holder))
		restored := holder
		require.NoError(t, gob.NewDecoder(&buf).Decode(&restored))
		assert.Equal(t, holder, restored)
	}
	var decoded Either4[int, string, bool, float64]
	for _, data := range [][]byte{nil, {}, {255}, {0}, {0, 255}} {
		assert.Error(t, decoded.UnmarshalBinary(data))
		assert.Error(t, decoded.GobDecode(data))
	}
	_, err := (Either4[int, string, bool, float64]{argId: -1}).MarshalBinary()
	assert.Error(t, err)
	_, err = NewEither4Arg1[chan int, int, int, int](make(chan int)).MarshalBinary()
	assert.Error(t, err)
}

func TestEither5BinarySerialization(t *testing.T) {
	originals := []Either5[int, string, bool, float64, []int]{
		NewEither5Arg1[int, string, bool, float64, []int](42),
		NewEither5Arg2[int, string, bool, float64, []int]("hello"),
		NewEither5Arg3[int, string, bool, float64, []int](true),
		NewEither5Arg4[int, string, bool, float64, []int](1.5),
		NewEither5Arg5[int, string, bool, float64, []int]([]int{1, 2}),
	}
	for id, original := range originals {
		data, err := original.MarshalBinary()
		require.NoError(t, err)
		require.NotEmpty(t, data)
		assert.Equal(t, byte(id), data[0])
		// Decode into every previously selected side to check that stale values are cleared.
		for _, decoded := range originals {
			require.NoError(t, decoded.UnmarshalBinary(data))
			assert.Equal(t, original, decoded)
		}
		gobData, err := original.GobEncode()
		require.NoError(t, err)
		assert.Equal(t, data, gobData)
		var decoded Either5[int, string, bool, float64, []int]
		require.NoError(t, decoded.GobDecode(gobData))
		assert.Equal(t, original, decoded)
		var buf bytes.Buffer
		holder := struct {
			Value Either5[int, string, bool, float64, []int]
		}{Value: original}
		require.NoError(t, gob.NewEncoder(&buf).Encode(holder))
		restored := holder
		require.NoError(t, gob.NewDecoder(&buf).Decode(&restored))
		assert.Equal(t, holder, restored)
	}
	var decoded Either5[int, string, bool, float64, []int]
	for _, data := range [][]byte{nil, {}, {255}, {0}, {0, 255}} {
		assert.Error(t, decoded.UnmarshalBinary(data))
		assert.Error(t, decoded.GobDecode(data))
	}
	_, err := (Either5[int, string, bool, float64, []int]{argId: -1}).MarshalBinary()
	assert.Error(t, err)
	_, err = NewEither5Arg1[chan int, int, int, int, int](make(chan int)).MarshalBinary()
	assert.Error(t, err)
}
