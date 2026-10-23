Optional arguments of type `Choice` or `DateTime` now show single brackets in `--help`. Your example gives `Usage: cli.py [OPTIONS] [foo|bar|baz]...`, and the `required=False` and `DateTime` cases are fixed the same way. The full test suite passes, and I haven't committed anything.

**Cause:** `Choice.get_metavar` and `DateTime.get_metavar` already wrap their output in `[...]`. `Argument.make_metavar` then wrapped it again for any argument that wasn't required.

**Fix:** In `src/click/core.py`, `Argument.make_metavar` now skips its own wrapping when the metavar already starts with `[` and ends with `]`. Required `Choice` arguments still render as `{foo|bar}`.

**Extra changes:**
- **Tests:** I added a parametrized test to `tests/test_arguments.py` covering optional, `nargs=-1`, required and `DateTime` arguments.
- **Changelog:** I added an entry to `CHANGES.md`.

The bracket check is a plain string test. A `Choice` whose first choice begins with `[` and whose last ends with `]` would be treated as already wrapped. For an optional argument that still displays a single pair of brackets, so the output is unaffected.
