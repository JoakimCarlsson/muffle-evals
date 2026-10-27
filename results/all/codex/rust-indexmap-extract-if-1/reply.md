`extract_if` needs lazy, order-preserving removal for both collections. I’ll inspect iterator internals and tests, then implement and verify it.


Done.
Added both `extract_if` APIs and public iterators. All-feature tests and no-default-features check passed. Each removal takes O(n).
