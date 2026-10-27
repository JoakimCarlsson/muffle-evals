package mo

import (
	"bytes"
	"encoding/gob"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewEither3(t *testing.T) {
	is := assert.New(t)

	either3Arg1 := NewEither3Arg1[int, bool, float64](42)
	is.Equal(Either3[int, bool, float64]{argId: either3ArgId1, arg1: 42}, either3Arg1)

	either3Arg2 := NewEither3Arg2[int, bool, float64](true)
	is.Equal(Either3[int, bool, float64]{argId: either3ArgId2, arg2: true}, either3Arg2)

	either3Arg3 := NewEither3Arg3[int, bool, float64](1.2)
	is.Equal(Either3[int, bool, float64]{argId: either3ArgId3, arg3: 1.2}, either3Arg3)
}

func TestEither3IsArg(t *testing.T) {
	is := assert.New(t)

	either3Arg1 := NewEither3Arg1[int, bool, float64](42)
	either3Arg2 := NewEither3Arg2[int, bool, float64](true)
	either3Arg3 := NewEither3Arg3[int, bool, float64](1.2)

	is.True(either3Arg1.IsArg1())
	is.False(either3Arg1.IsArg2())
	is.False(either3Arg1.IsArg3())

	is.False(either3Arg2.IsArg1())
	is.True(either3Arg2.IsArg2())
	is.False(either3Arg2.IsArg3())

	is.False(either3Arg3.IsArg1())
	is.False(either3Arg3.IsArg2())
	is.True(either3Arg3.IsArg3())
}

func TestEither3GetArg(t *testing.T) {
	is := assert.New(t)

	either3Arg1 := NewEither3Arg1[int, bool, float64](42)
	either3Arg2 := NewEither3Arg2[int, bool, float64](true)
	either3Arg3 := NewEither3Arg3[int, bool, float64](1.2)

	result1_1, ok1_1 := either3Arg1.Arg1()
	_, ok1_2 := either3Arg1.Arg2()
	_, ok1_3 := either3Arg1.Arg3()

	is.Equal(42, result1_1)
	is.True(ok1_1)
	is.False(ok1_2)
	is.False(ok1_3)

	_, ok2_1 := either3Arg2.Arg1()
	result2, ok2_2 := either3Arg2.Arg2()
	_, ok2_3 := either3Arg2.Arg3()

	is.Equal(true, result2)
	is.False(ok2_1)
	is.True(ok2_2)
	is.False(ok2_3)

	_, ok3_1 := either3Arg3.Arg1()
	_, ok3_2 := either3Arg3.Arg2()
	result3, ok3_3 := either3Arg3.Arg3()

	is.Equal(1.2, result3)
	is.False(ok3_1)
	is.False(ok3_2)
	is.True(ok3_3)
}

func TestEither3MustArg(t *testing.T) {
	is := assert.New(t)

	either3Arg1 := NewEither3Arg1[int, bool, float64](42)
	either3Arg2 := NewEither3Arg2[int, bool, float64](true)
	either3Arg3 := NewEither3Arg3[int, bool, float64](1.2)

	is.NotPanics(func() {
		is.Equal(42, either3Arg1.MustArg1())
	})
	is.Panics(func() {
		either3Arg1.MustArg2()
	})
	is.Panics(func() {
		either3Arg1.MustArg3()
	})

	is.Panics(func() {
		either3Arg2.MustArg1()
	})
	is.NotPanics(func() {
		is.Equal(true, either3Arg2.MustArg2())
	})
	is.Panics(func() {
		either3Arg2.MustArg3()
	})

	is.Panics(func() {
		either3Arg3.MustArg1()
	})
	is.Panics(func() {
		either3Arg3.MustArg2()
	})
	is.NotPanics(func() {
		is.Equal(1.2, either3Arg3.MustArg3())
	})
}

func TestEither3Unpack(t *testing.T) {
	is := assert.New(t)

	either := NewEither3Arg1[int, bool, float64](42)
	either3Arg1, either3Arg2, either3Arg3 := either.Unpack()

	is.Equal(42, either3Arg1)
	is.Equal(false, either3Arg2)
	is.Equal(float64(0), either3Arg3)
}

func TestEither3GetOrElse(t *testing.T) {
	is := assert.New(t)

	either3Arg1 := NewEither3Arg1[int, bool, float64](42)
	either3Arg2 := NewEither3Arg2[int, bool, float64](true)
	either3Arg3 := NewEither3Arg3[int, bool, float64](1.2)

	is.Equal(42, either3Arg1.Arg1OrElse(21))
	is.Equal(false, either3Arg1.Arg2OrElse(false))
	is.Equal(2.1, either3Arg1.Arg3OrElse(2.1))

	is.Equal(21, either3Arg2.Arg1OrElse(21))
	is.Equal(true, either3Arg2.Arg2OrElse(false))
	is.Equal(2.1, either3Arg2.Arg3OrElse(2.1))

	is.Equal(21, either3Arg3.Arg1OrElse(21))
	is.Equal(false, either3Arg3.Arg2OrElse(false))
	is.Equal(1.2, either3Arg3.Arg3OrElse(2.1))
}

func TestEither3GetOrEmpty(t *testing.T) {
	is := assert.New(t)

	either3Arg1 := NewEither3Arg1[int, bool, float64](42)
	either3Arg2 := NewEither3Arg2[int, bool, float64](true)
	either3Arg3 := NewEither3Arg3[int, bool, float64](1.2)

	is.Equal(42, either3Arg1.Arg1OrEmpty())
	is.Equal(false, either3Arg1.Arg2OrEmpty())
	is.Equal(0.0, either3Arg1.Arg3OrEmpty())

	is.Equal(0, either3Arg2.Arg1OrEmpty())
	is.Equal(true, either3Arg2.Arg2OrEmpty())
	is.Equal(0.0, either3Arg2.Arg3OrEmpty())

	is.Equal(0, either3Arg3.Arg1OrEmpty())
	is.Equal(false, either3Arg3.Arg2OrEmpty())
	is.Equal(1.2, either3Arg3.Arg3OrEmpty())
}

func TestEither3ForEach(t *testing.T) {
	is := assert.New(t)

	NewEither3Arg1[int, bool, float64](42).ForEach(func(v1 int) {
		is.Equal(42, v1)
	}, func(v2 bool) {
		is.Fail("should not enter here")
	}, func(v3 float64) {
		is.Fail("should not enter here")
	})

	NewEither3Arg2[int, bool, float64](true).ForEach(func(v1 int) {
		is.Fail("should not enter here")
	}, func(v2 bool) {
		is.Equal(true, v2)
	}, func(v3 float64) {
		is.Fail("should not enter here")
	})

	NewEither3Arg3[int, bool, float64](1.2).ForEach(func(v1 int) {
		is.Fail("should not enter here")
	}, func(v2 bool) {
		is.Fail("should not enter here")
	}, func(v3 float64) {
		is.Equal(1.2, v3)
	})
}

func TestEither3Match(t *testing.T) {
	is := assert.New(t)

	e1 := NewEither3Arg1[int, bool, float64](42).Match(func(v1 int) Either3[int, bool, float64] {
		is.Equal(42, v1)
		return NewEither3Arg1[int, bool, float64](21)
	}, func(v2 bool) Either3[int, bool, float64] {
		is.Fail("should not enter here")
		return NewEither3Arg2[int, bool, float64](false)
	}, func(v3 float64) Either3[int, bool, float64] {
		is.Fail("should not enter here")
		return NewEither3Arg3[int, bool, float64](2.1)
	})

	is.Equal(NewEither3Arg1[int, bool, float64](21), e1)

	e2 := NewEither3Arg2[int, bool, float64](true).Match(func(v1 int) Either3[int, bool, float64] {
		is.Fail("should not enter here")
		return NewEither3Arg1[int, bool, float64](21)
	}, func(v2 bool) Either3[int, bool, float64] {
		is.Equal(true, v2)
		return NewEither3Arg2[int, bool, float64](false)
	}, func(v3 float64) Either3[int, bool, float64] {
		is.Fail("should not enter here")
		return NewEither3Arg3[int, bool, float64](2.1)
	})

	is.Equal(NewEither3Arg2[int, bool, float64](false), e2)

	e3 := NewEither3Arg3[int, bool, float64](1.2).Match(func(v1 int) Either3[int, bool, float64] {
		is.Fail("should not enter here")
		return NewEither3Arg1[int, bool, float64](21)
	}, func(v2 bool) Either3[int, bool, float64] {
		is.Fail("should not enter here")
		return NewEither3Arg2[int, bool, float64](false)
	}, func(v3 float64) Either3[int, bool, float64] {
		is.Equal(1.2, v3)
		return NewEither3Arg3[int, bool, float64](2.1)
	})

	is.Equal(NewEither3Arg3[int, bool, float64](2.1), e3)
}

func TestEither3MapArg(t *testing.T) {
	is := assert.New(t)

	either3Arg1 := NewEither3Arg1[int, bool, float64](42)
	either3Arg2 := NewEither3Arg2[int, bool, float64](true)
	either3Arg3 := NewEither3Arg3[int, bool, float64](1.2)

	result1_1 := either3Arg1.MapArg1(func(v int) Either3[int, bool, float64] {
		is.Equal(42, v)
		return NewEither3Arg1[int, bool, float64](21)
	})
	is.Equal(NewEither3Arg1[int, bool, float64](21), result1_1)

	result1_2 := either3Arg1.MapArg2(func(v bool) Either3[int, bool, float64] {
		is.Fail("should not enter here")
		return NewEither3Arg2[int, bool, float64](false)
	})
	is.Equal(either3Arg1, result1_2)

	result1_3 := either3Arg1.MapArg3(func(v float64) Either3[int, bool, float64] {
		is.Fail("should not enter here")
		return NewEither3Arg3[int, bool, float64](2.1)
	})
	is.Equal(either3Arg1, result1_3)

	result2_1 := either3Arg2.MapArg1(func(v int) Either3[int, bool, float64] {
		is.Fail("should not enter here")
		return NewEither3Arg1[int, bool, float64](21)
	})
	is.Equal(either3Arg2, result2_1)

	result2_2 := either3Arg2.MapArg2(func(v bool) Either3[int, bool, float64] {
		is.Equal(true, v)
		return NewEither3Arg2[int, bool, float64](false)
	})
	is.Equal(NewEither3Arg2[int, bool, float64](false), result2_2)

	result2_3 := either3Arg2.MapArg3(func(v float64) Either3[int, bool, float64] {
		is.Fail("should not enter here")
		return NewEither3Arg3[int, bool, float64](2.1)
	})
	is.Equal(either3Arg2, result2_3)

	result3_1 := either3Arg3.MapArg1(func(v int) Either3[int, bool, float64] {
		is.Fail("should not enter here")
		return NewEither3Arg3[int, bool, float64](21)
	})
	is.Equal(either3Arg3, result3_1)

	result3_2 := either3Arg3.MapArg2(func(v bool) Either3[int, bool, float64] {
		is.Fail("should not enter here")
		return NewEither3Arg2[int, bool, float64](false)
	})
	is.Equal(either3Arg3, result3_2)

	result3_3 := either3Arg3.MapArg3(func(v float64) Either3[int, bool, float64] {
		is.Equal(1.2, v)
		return NewEither3Arg3[int, bool, float64](2.1)
	})
	is.Equal(NewEither3Arg3[int, bool, float64](2.1), result3_3)
}

// TestEither3Binary verifies binary and gob serialization for every side.
func TestEither3Binary(t *testing.T) {
	is := assert.New(t)
	originals := []Either3[int, string, bool]{
		NewEither3Arg1[int, string, bool](42),
		NewEither3Arg2[int, string, bool]("foobar"),
		NewEither3Arg3[int, string, bool](true),
	}
	for id, original := range originals {
		data, err := original.MarshalBinary()
		if !is.NoError(err) {
			continue
		}
		is.Equal(byte(id), data[0])
		switch id {
		case either3ArgId1:
			var value int
			is.NoError(gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&value))
			is.Equal(original.arg1, value)
		case either3ArgId2:
			var value string
			is.NoError(gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&value))
			is.Equal(original.arg2, value)
		case either3ArgId3:
			var value bool
			is.NoError(gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&value))
			is.Equal(original.arg3, value)
		}
		decoded := Either3[int, string, bool]{arg1: 42, arg2: "foobar", arg3: true}
		is.NoError(decoded.UnmarshalBinary(data))
		is.Equal(original, decoded)
		gobData, err := original.GobEncode()
		is.NoError(err)
		is.Equal(data, gobData)
		is.NoError(decoded.GobDecode(gobData))
		is.Equal(original, decoded)
		holder := struct{ Value Either3[int, string, bool] }{Value: original}
		var buf bytes.Buffer
		is.NoError(gob.NewEncoder(&buf).Encode(holder))
		var restored struct{ Value Either3[int, string, bool] }
		is.NoError(gob.NewDecoder(&buf).Decode(&restored))
		is.Equal(holder, restored)
	}
	var decoded Either3[int, string, bool]
	for _, data := range [][]byte{nil, {}, {255}, {3}, {0}, {0, 255}} {
		is.Error(decoded.UnmarshalBinary(data))
		is.Error(decoded.GobDecode(data))
	}
	invalid := Either3[int, string, bool]{argId: -1}
	_, err := invalid.MarshalBinary()
	is.Error(err)
	unsupported := NewEither3Arg1[func(), string, bool](func() {})
	_, err = unsupported.MarshalBinary()
	is.Error(err)
	_, err = unsupported.GobEncode()
	is.Error(err)
}
