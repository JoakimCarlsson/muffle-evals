Optional arguments of type `Choice` or `DateTime` now show a single pair of brackets in the usage line. Your example prints `[foo|bar]...`, and the `DateTime` argument prints `[%Y]`. The existing test suite passes. I didn't add a regression test.

The cause was that `Argument.make_metavar` already wraps an optional argument's metavar in `[...]`, while `Choice.get_metavar` and `DateTime.get_metavar` added their own brackets as well. I changed the two types in `src/click/types.py`:

- **`Choice`:** it no longer adds brackets for arguments. It still adds them for options, and required arguments still use `{a|b}`.
- **`DateTime`:** it skips its own brackets only for optional arguments. Required arguments and options are unchanged.

I also added an entry to `CHANGES.md`.
