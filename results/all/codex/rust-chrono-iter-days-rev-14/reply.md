Reverse iteration must share forward bounds; scope includes day/week iterators, callers, docs, and regression tests.


Forward iterators exclude dates lacking a valid next step; retain that behavior. Reverse iteration will consume the same range from its end.


Done.
Fixed day/week reverse bounds; preserved forward behavior. Updated docs and boundary regressions. All 292 library tests and both iterator doctests passed.
