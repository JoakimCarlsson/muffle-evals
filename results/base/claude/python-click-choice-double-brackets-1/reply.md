Optional arguments of type `Choice` or `DateTime` no longer get a second pair of brackets in the usage line. Your example now prints `Usage: cli.py [OPTIONS] [foo|bar|baz]...`, and the `DateTime` case prints `[%Y-%m-%d]`. The full test suite passes.

The fix is in `Argument.make_metavar` in `src/click/core.py`. Those types already return their metavar wrapped in `[...]`, and optional arguments then wrapped it a second time. It now skips the extra wrapping when the type's metavar is already bracketed. Required arguments and options are unchanged.

I added a test in `tests/test_arguments.py` covering both types with `nargs=-1` and with `required=False`, plus a changelog entry in `CHANGES.md`. I didn't commit anything.
