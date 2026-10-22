Iterator lower bound needs checking against remaining entries; regression test will cover exhaustion.


Done.
Fixed `Iter` and `IterMut` lower bounds; added regression coverage for empty, exhausted, and multivalue maps. All 415 tests passed.
