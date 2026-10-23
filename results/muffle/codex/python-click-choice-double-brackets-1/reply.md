I’ll check how argument metavars are built, fix the extra brackets, and add regression coverage for Choice and DateTime.


Argument formatting adds brackets even when the type’s metavar already has them. The fix reuses that existing pair and preserves required arguments and `...`. I’ve added Choice and DateTime regression cases, and the full test suite is running.


Fixed optional Choice and DateTime arguments to display a single pair of square brackets, including with `nargs=-1`. Required argument formatting stays unchanged.

Added regression coverage and a changelog entry. Full test suite: 1,668 passed, 24 skipped, 1 expected failure.
