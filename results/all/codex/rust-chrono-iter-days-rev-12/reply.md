Reverse iteration must share forward bounds; fix covers day/week iterators, docs, and boundary tests.


Forward dates stay unchanged. Both ends now share bounds; tests cover reversed windows, mixed calls, exhaustion, and date limits.


Done.
Fixed day/week reverse bounds; preserved forward behavior. Added regression tests, updated docs. Tests: 572 passed; 3 unrelated doctests fail on deprecated `std::i32::MAX`.
