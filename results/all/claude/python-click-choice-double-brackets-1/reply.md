Done. `Argument.make_metavar` in `src/click/core.py:3576` no longer wraps a metavar that already has brackets. `[foo|bar]...` and `[%Y]` now render with a single pair, and 1656 tests pass.

Not covered: an optional, deprecated argument of these types still gets double brackets (`[[a|b]!]`), because the `!` is appended before the bracket check.
