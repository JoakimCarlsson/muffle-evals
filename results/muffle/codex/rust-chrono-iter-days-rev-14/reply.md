I’ll check both iterators, fix how their front and back bounds interact, and add regression tests for reversed windows.

Both iterators currently move a single date backward in `next_back()`, outside the range reported by `len()`. I’ll track the remaining range so both ends consume the same dates, including the final representable day or week. The reverse examples and boundary tests also need updating.

The library tests pass, including the new reverse-window, mixed-end, length, and boundary checks. The full doctest run hit three unrelated deprecated-constant errors in month-arithmetic examples; I’ll check the iterator examples separately.

Fixed both iterators to consume one shared range from either end. Reversed windows now match forward collection followed by reversal, and lengths remain accurate when mixing `next()` and `next_back()`.

The ranges now include the final representable date for their step size. Documentation and regression tests are updated.

Validation: 290 library tests and both iterator doctests pass. The full doctest run has three unrelated deprecated-constant failures.
