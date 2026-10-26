I'd like `pybabel` to cover the same ground as GNU gettext's `msgcat` and `msgmerge`, as two new subcommands built the same way as the existing ones in `babel/messages/frontend.py` (command classes with `initialize_options`, `finalize_options` and `run`, registered in the subcommand table, and listed in `pybabel --help`).

`pybabel concat` is implemented by a new class `babel.messages.frontend.ConcatenateCatalog`. It takes `input_files` (one or more PO files) and combines them into one catalog, written to `output_file`, or to standard output when that is unset or `-`. Options:
- `less_than` and `more_than`: only keep messages defined in fewer than / more than that many input files (`more_than` defaults to 0, `less_than` to unlimited). `unique` is shorthand for `less_than = 2` and is an `OptionError` together with `less_than` or a non-zero `more_than`.
- `use_first`: when files disagree on a translation, keep the first one. Otherwise the message is written as a conflict: marked fuzzy, with an empty `msgstr`, followed by each file's translation, each preceded by a comment line of the form `#-#-#-#-#  <basename> (<project> <version>)  #-#-#-#-#` (for plurals, one `msgstr[N]` per plural form). Messages with the same translation everywhere are not conflicts.
- `no_location`, `width`, `no_wrap`, `sort_output`, `sort_by_file`, passed through to `write_po`. `no_wrap` together with `width` is an `OptionError`; the default width is 76.
- No `input_files` is an `OptionError`.

To record conflicts, `Catalog` gets `add_conflict(message, filename, project, version)` and `get_conflicts(id, context=None)` (a list of dicts with keys `message`, `filename`, `project`, `version`), and `write_po` writes conflicted messages as described. A `ConflictInfo` typed dict for those entries is exported from `babel.messages.catalog`. `read_po` must refuse a file containing such a conflict marker comment: it raises `PoFileError` when `abort_invalid=True`.

`pybabel merge` is implemented by `babel.messages.frontend.MergeCatalog`. `input_files` must be exactly two files, `def.po` and `ref.pot`, otherwise `OptionError`; either `output_file` or `update` must be set, otherwise `OptionError`. It reads both, updates the catalog from the template with `Catalog.update` (`no_fuzzy_matching` turns off fuzzy matching), and writes the result to `output_file`, or back over `def.po` when `update` is set. Options:
- `compendium` (may be given several times, so a list): extra PO files whose translations fill messages that are untranslated or fuzzy in the result (clearing fuzzy), and add the compendium path as an automatic comment unless `no_compendium_comment` is set. Existing real translations are kept, unless `compendium_overwrite` is set, in which case the compendium wins and the old translation goes to the obsolete messages. Messages not in the template are never added from a compendium.
- `backup` with `update`: copy `def.po` to `def.po` + `suffix` (default `~`) first.
- `no_location`, `width`, `no_wrap`, `sort_output`, `sort_by_file` as above. The result's `fuzzy` flag reflects whether any message is fuzzy.

Please build this.
