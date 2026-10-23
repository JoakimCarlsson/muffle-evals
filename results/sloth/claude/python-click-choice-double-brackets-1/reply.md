I'm fixing `Argument.make_metavar` so it doesn't wrap a metavar that is already bracketed, then adding a test.

Optional arguments of type `Choice` or `DateTime` no longer get a second pair of brackets in the usage line. Your example now prints `[OPTIONS] [foo|bar|baz]...`, and the full test suite passes.

The fix is in `Argument.make_metavar` in `src/click/core.py`. It now skips adding brackets when the type's metavar already starts with `[` and ends with `]`. Required arguments, which use `{a|b}`, and plain-type arguments such as `[FOO]` are unchanged.

I added `test_argument_metavar_no_double_brackets` in `tests/test_arguments.py`. It covers `Choice` with `required=False`, `nargs=-1` and `required=True`, plus `DateTime`. I also added a line to `CHANGES.md`.

The check is by text, so a custom type whose metavar happens to start with `[` and end with `]` (for example `[a]|[b]`) would also skip the extra brackets.

I didn't run the tests with `python -m pytest` alone, because `click` isn't installed in this environment. I ran them with `PYTHONPATH=src`.
