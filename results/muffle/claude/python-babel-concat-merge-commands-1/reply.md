Now the catalog and pofile.

Quick status: core changes are in place. I'm now tidying the messy merge loop in `_concatenate`, then I'll test.

`pybabel concat` and `pybabel merge` are in. They're registered in the subcommand table and listed in `pybabel --help`. The suite passes except `tests/messages/test_setuptools_frontend.py::test_setuptools_commands`. That test also fails with my changes stashed, so it isn't caused by them. I ran both commands by hand on small sample PO files as well, and added `tests/messages/frontend/test_concat_merge.py`.

- **Catalog:** `ConflictInfo` is exported from `babel.messages.catalog`, and `Catalog` has `add_conflict` and `get_conflicts`.
- **Writing and reading PO files:** `write_po` marks a conflicted message fuzzy and writes an empty `msgstr`. After it come the `#-#-#-#-#  <basename> (<project> <version>)  #-#-#-#-#` marker lines, each followed by that file's translation. `read_po(abort_invalid=True)` raises `PoFileError` on a conflict marker. Without `abort_invalid` it prints a warning instead.
- **`ConcatenateCatalog` and `MergeCatalog`:** both are in `frontend.py` with the options and `OptionError` cases you described. I also added a short `concat`/`merge` section to `docs/cmdline.rst`.

Where the spec left room, I chose:
- **Conflict format:** the translations after each marker are written as `#~ msgstr "..."` lines. That keeps the file valid PO and makes `read_po` reject it at the marker.
- **Empty translations:** an empty `msgstr` in one file doesn't count as disagreeing with a real translation in another. Conflicts, and the pick for `use_first`, only consider non-empty translations.
- **`output_file` with `update`:** if both are set on `merge`, `update` wins and the result goes back over `def.po`.
- **Compendium messages:** compendium messages that are empty or fuzzy are ignored.
- **`--compendium-overwrite`:** an overwritten message is only moved to the obsolete list when the compendium's translation differs from the existing one.
- **`input_files` as a string:** a single string counts as one path. It isn't split on whitespace.

I didn't commit anything.
