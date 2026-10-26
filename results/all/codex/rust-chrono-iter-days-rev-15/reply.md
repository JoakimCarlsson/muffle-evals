Reverse iteration must share forward bounds; fix covers day/week iterators, docs, and boundary tests.


Forward bounds stay unchanged: days exclude `MAX`; weeks yield only dates with a full next week. Reverse now consumes that same range.


Done.
Fixed day/week reverse bounds; added regression tests. All 291 unit tests pass; three unrelated doctests fail on deprecated `std::i32::MAX`. Forward bounds unchanged.
