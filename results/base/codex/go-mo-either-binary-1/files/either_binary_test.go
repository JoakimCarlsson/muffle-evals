package mo

import (
	"bytes"
	"encoding/gob"
	"testing"
)

func TestEither3BinarySerialization(t *testing.T) {
	originals := []Either3[int, int, int]{
		{argId: either3ArgId1, arg1: 10},
		{argId: either3ArgId2, arg2: 20},
		{argId: either3ArgId3, arg3: 30},
	}
	for _, original := range originals {
		data, err := original.MarshalBinary()
		if err != nil {
			t.Fatal(err)
		}
		if data[0] != byte(original.argId) {
			t.Fatalf("unexpected side id: %d", data[0])
		}
		var payload int
		if err := gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload != (int(original.argId)+1)*10 {
			t.Fatalf("unexpected payload: %d", payload)
		}
		decoded := Either3[int, int, int]{arg1: 99, arg2: 99, arg3: 99}
		if err := decoded.UnmarshalBinary(data); err != nil {
			t.Fatal(err)
		}
		if decoded != original {
			t.Fatalf("binary round trip: got %#v, want %#v", decoded, original)
		}
		var buf bytes.Buffer
		holder := struct{ Value Either3[int, int, int] }{original}
		if err := gob.NewEncoder(&buf).Encode(holder); err != nil {
			t.Fatal(err)
		}
		decodedHolder := holder
		if err := gob.NewDecoder(&buf).Decode(&decodedHolder); err != nil {
			t.Fatal(err)
		}
		if decodedHolder.Value != original {
			t.Fatalf("gob round trip: got %#v, want %#v", decodedHolder.Value, original)
		}
	}
	var decoded Either3[int, int, int]
	for _, data := range [][]byte{nil, {}, {255}, {3}, {0}, {0, 255}} {
		if err := decoded.UnmarshalBinary(data); err == nil {
			t.Fatalf("expected error for %v", data)
		}
	}
	invalid := Either3[int, int, int]{argId: -1}
	if _, err := invalid.MarshalBinary(); err == nil {
		t.Fatal("expected invalid side error")
	}
	unsupported := Either3[func(), int, int]{arg1: func() {}}
	if _, err := unsupported.MarshalBinary(); err == nil {
		t.Fatal("expected gob encoding error")
	}
}

func TestEither4BinarySerialization(t *testing.T) {
	originals := []Either4[int, int, int, int]{
		{argId: either4ArgId1, arg1: 10},
		{argId: either4ArgId2, arg2: 20},
		{argId: either4ArgId3, arg3: 30},
		{argId: either4ArgId4, arg4: 40},
	}
	for _, original := range originals {
		data, err := original.MarshalBinary()
		if err != nil {
			t.Fatal(err)
		}
		if data[0] != byte(original.argId) {
			t.Fatalf("unexpected side id: %d", data[0])
		}
		var payload int
		if err := gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload != (int(original.argId)+1)*10 {
			t.Fatalf("unexpected payload: %d", payload)
		}
		decoded := Either4[int, int, int, int]{arg1: 99, arg2: 99, arg3: 99, arg4: 99}
		if err := decoded.UnmarshalBinary(data); err != nil {
			t.Fatal(err)
		}
		if decoded != original {
			t.Fatalf("binary round trip: got %#v, want %#v", decoded, original)
		}
		var buf bytes.Buffer
		holder := struct{ Value Either4[int, int, int, int] }{original}
		if err := gob.NewEncoder(&buf).Encode(holder); err != nil {
			t.Fatal(err)
		}
		decodedHolder := holder
		if err := gob.NewDecoder(&buf).Decode(&decodedHolder); err != nil {
			t.Fatal(err)
		}
		if decodedHolder.Value != original {
			t.Fatalf("gob round trip: got %#v, want %#v", decodedHolder.Value, original)
		}
	}
	var decoded Either4[int, int, int, int]
	for _, data := range [][]byte{nil, {}, {255}, {4}, {0}, {0, 255}} {
		if err := decoded.UnmarshalBinary(data); err == nil {
			t.Fatalf("expected error for %v", data)
		}
	}
	invalid := Either4[int, int, int, int]{argId: -1}
	if _, err := invalid.MarshalBinary(); err == nil {
		t.Fatal("expected invalid side error")
	}
	unsupported := Either4[func(), int, int, int]{arg1: func() {}}
	if _, err := unsupported.MarshalBinary(); err == nil {
		t.Fatal("expected gob encoding error")
	}
}

func TestEither5BinarySerialization(t *testing.T) {
	originals := []Either5[int, int, int, int, int]{
		{argId: either5ArgId1, arg1: 10},
		{argId: either5ArgId2, arg2: 20},
		{argId: either5ArgId3, arg3: 30},
		{argId: either5ArgId4, arg4: 40},
		{argId: either5ArgId5, arg5: 50},
	}
	for _, original := range originals {
		data, err := original.MarshalBinary()
		if err != nil {
			t.Fatal(err)
		}
		if data[0] != byte(original.argId) {
			t.Fatalf("unexpected side id: %d", data[0])
		}
		var payload int
		if err := gob.NewDecoder(bytes.NewReader(data[1:])).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload != (int(original.argId)+1)*10 {
			t.Fatalf("unexpected payload: %d", payload)
		}
		decoded := Either5[int, int, int, int, int]{arg1: 99, arg2: 99, arg3: 99, arg4: 99, arg5: 99}
		if err := decoded.UnmarshalBinary(data); err != nil {
			t.Fatal(err)
		}
		if decoded != original {
			t.Fatalf("binary round trip: got %#v, want %#v", decoded, original)
		}
		var buf bytes.Buffer
		holder := struct {
			Value Either5[int, int, int, int, int]
		}{original}
		if err := gob.NewEncoder(&buf).Encode(holder); err != nil {
			t.Fatal(err)
		}
		decodedHolder := holder
		if err := gob.NewDecoder(&buf).Decode(&decodedHolder); err != nil {
			t.Fatal(err)
		}
		if decodedHolder.Value != original {
			t.Fatalf("gob round trip: got %#v, want %#v", decodedHolder.Value, original)
		}
	}
	var decoded Either5[int, int, int, int, int]
	for _, data := range [][]byte{nil, {}, {255}, {5}, {0}, {0, 255}} {
		if err := decoded.UnmarshalBinary(data); err == nil {
			t.Fatalf("expected error for %v", data)
		}
	}
	invalid := Either5[int, int, int, int, int]{argId: -1}
	if _, err := invalid.MarshalBinary(); err == nil {
		t.Fatal("expected invalid side error")
	}
	unsupported := Either5[func(), int, int, int, int]{arg1: func() {}}
	if _, err := unsupported.MarshalBinary(); err == nil {
		t.Fatal("expected gob encoding error")
	}
}
