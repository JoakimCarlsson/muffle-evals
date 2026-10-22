Iterator bounds need inspection; reverse traversal must share forward range.


Done.
Fixed both iterators’ reverse bounds, lengths, exhaustion, endpoint inclusion; added regression tests. 290 unit tests passed; three unrelated doctests failed on deprecated `std::i32::MAX`.
