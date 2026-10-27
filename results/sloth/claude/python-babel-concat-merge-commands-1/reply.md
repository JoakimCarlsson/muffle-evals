Now pofile.py.

Core code is in; now I'm trying it end to end and adding tests.

`pybabel concat` and `pybabel merge` are in. Both are registered in the subcommand table, appear in `pybabel --help`, and are listed in `docs/cmdline.rst`. The full suite passes except `tests/messages/test_setuptools_frontend.py::test_setuptools_commands`, which fails the same way without my changes. I also ran both commands by hand on small PO files, including `--backup`, and the output matched the spec.

- **`ConcatenateCatalog`** (`babel/messages/frontend.py`): covers every concat option and `OptionError` case in your list. Output goes to stdout when `output_file` is unset or `-`.
- **`MergeCatalog`** (`babel/messages/frontend.py`): covers every merge option and `OptionError` case in your list, including `compendium` as a list.
- **Catalog and PO writing**:
  - `Catalog` has `add_conflict` and `get_conflicts`, and `ConflictInfo` is exported from `babel.messages.catalog`.
  - `write_po` writes a conflicted message as fuzzy with an empty `msgstr`.
  - `read_po` raises `PoFileError` on a conflict marker when `abort_invalid=True`.
- **Tests**: new tests are in `tests/messages/frontend/test_concat_merge.py`.

Choices I made where the spec was open, which you may want to change:
- **Conflict layout**: each file's translation is written as a marker comment followed by its own `msgstr` lines, after the empty `msgstr` (`msgstr[N]` per plural form for plurals).
- **Empty translations**: an empty translation counts as a disagreement in concat, so "" in one file and "x" in another is a conflict, not a silent pick of "x".
- **Compendium entries**: merge uses a compendium translation as long as it is non-empty, even if that entry is fuzzy there.
- **`update` with `output_file`**: if both are set, `update` wins and `def.po` is overwritten.

I did not add the new options to the long per-command help sections in `docs/cmdline.rst`, only to the command list.
