package mo

import (
	"bytes"
	"encoding/gob"
	"reflect"
	"testing"
)

func TestEither3BinarySerialization(t *testing.T) {
	values := []Either3[int, string, bool]{
		NewEither3Arg1[int, string, bool](42),
		NewEither3Arg2[int, string, bool]("value"),
		NewEither3Arg3[int, string, bool](true),
	}
	for side, original := range values {
		data, err := original.MarshalBinary()
		if err != nil {
			t.Fatal(err)
		}
		if data[0] != byte(side) {
			t.Fatalf("side: got %d, want %d", data[0], side)
		}
		decoded := Either3[int, string, bool]{arg1: 42, arg2: "value", arg3: true}
		if err := decoded.UnmarshalBinary(data); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(original, decoded) {
			t.Fatalf("round trip: got %#v, want %#v", decoded, original)
		}
		var payload bytes.Buffer
		holder := struct{ Value Either3[int, string, bool] }{original}
		if err := gob.NewEncoder(&payload).Encode(holder); err != nil {
			t.Fatal(err)
		}
		decodedHolder := holder
		if err := gob.NewDecoder(&payload).Decode(&decodedHolder); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(holder, decodedHolder) {
			t.Fatalf("gob round trip: got %#v, want %#v", decodedHolder, holder)
		}
	}
	var decoded Either3[int, string, bool]
	for _, data := range [][]byte{nil, {}, {255}, {0}, {0, 255}} {
		if err := decoded.UnmarshalBinary(data); err == nil {
			t.Fatalf("expected error for %v", data)
		}
		if err := decoded.GobDecode(data); err == nil {
			t.Fatalf("expected gob error for %v", data)
		}
	}
}

func TestEither4BinarySerialization(t *testing.T) {
	values := []Either4[int, string, bool, float64]{
		NewEither4Arg1[int, string, bool, float64](42),
		NewEither4Arg2[int, string, bool, float64]("value"),
		NewEither4Arg3[int, string, bool, float64](true),
		NewEither4Arg4[int, string, bool, float64](3.5),
	}
	for side, original := range values {
		data, err := original.MarshalBinary()
		if err != nil {
			t.Fatal(err)
		}
		if data[0] != byte(side) {
			t.Fatalf("side: got %d, want %d", data[0], side)
		}
		decoded := Either4[int, string, bool, float64]{arg1: 42, arg2: "value", arg3: true, arg4: 3.5}
		if err := decoded.UnmarshalBinary(data); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(original, decoded) {
			t.Fatalf("round trip: got %#v, want %#v", decoded, original)
		}
		var payload bytes.Buffer
		holder := struct {
			Value Either4[int, string, bool, float64]
		}{original}
		if err := gob.NewEncoder(&payload).Encode(holder); err != nil {
			t.Fatal(err)
		}
		decodedHolder := holder
		if err := gob.NewDecoder(&payload).Decode(&decodedHolder); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(holder, decodedHolder) {
			t.Fatalf("gob round trip: got %#v, want %#v", decodedHolder, holder)
		}
	}
	var decoded Either4[int, string, bool, float64]
	for _, data := range [][]byte{nil, {}, {255}, {0}, {0, 255}} {
		if err := decoded.UnmarshalBinary(data); err == nil {
			t.Fatalf("expected error for %v", data)
		}
		if err := decoded.GobDecode(data); err == nil {
			t.Fatalf("expected gob error for %v", data)
		}
	}
}

func TestEither5BinarySerialization(t *testing.T) {
	values := []Either5[int, string, bool, float64, []int]{
		NewEither5Arg1[int, string, bool, float64, []int](42),
		NewEither5Arg2[int, string, bool, float64, []int]("value"),
		NewEither5Arg3[int, string, bool, float64, []int](true),
		NewEither5Arg4[int, string, bool, float64, []int](3.5),
		NewEither5Arg5[int, string, bool, float64, []int]([]int{1, 2}),
	}
	for side, original := range values {
		data, err := original.MarshalBinary()
		if err != nil {
			t.Fatal(err)
		}
		if data[0] != byte(side) {
			t.Fatalf("side: got %d, want %d", data[0], side)
		}
		decoded := Either5[int, string, bool, float64, []int]{arg1: 42, arg2: "value", arg3: true, arg4: 3.5, arg5: []int{1, 2}}
		if err := decoded.UnmarshalBinary(data); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(original, decoded) {
			t.Fatalf("round trip: got %#v, want %#v", decoded, original)
		}
		var payload bytes.Buffer
		holder := struct {
			Value Either5[int, string, bool, float64, []int]
		}{original}
		if err := gob.NewEncoder(&payload).Encode(holder); err != nil {
			t.Fatal(err)
		}
		decodedHolder := holder
		if err := gob.NewDecoder(&payload).Decode(&decodedHolder); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(holder, decodedHolder) {
			t.Fatalf("gob round trip: got %#v, want %#v", decodedHolder, holder)
		}
	}
	var decoded Either5[int, string, bool, float64, []int]
	for _, data := range [][]byte{nil, {}, {255}, {0}, {0, 255}} {
		if err := decoded.UnmarshalBinary(data); err == nil {
			t.Fatalf("expected error for %v", data)
		}
		if err := decoded.GobDecode(data); err == nil {
			t.Fatalf("expected gob error for %v", data)
		}
	}
}
