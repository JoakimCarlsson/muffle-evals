Now pofile.py.

Building done; now testing both commands end to end.

Done. `pybabel concat` (`ConcatenateCatalog`) and `pybabel merge` (`MergeCatalog`) are in `babel/messages/frontend.py`, registered and in `--help`. `Catalog.add_conflict`/`get_conflicts`, `ConflictInfo`, conflict output in `write_po` and the `read_po` refusal are also in. New tests in `tests/messages/test_concat_merge.py` and `test_pofile_read.py` pass. I also ran both commands by hand on sample PO files.

Test run: 356 passed, 1 failed. The failure is `tests/messages/test_setuptools_frontend.py`, where the `setup.py init_catalog` subprocess exits 1. I did not check whether it also fails without my changes (the stash-baseline run errored on the untracked test file).

- **Conflict format:** like gettext's `msgcat`, the marker lines go inside the `msgstr` (starting with `msgstr ""`), not as separate `#` comment lines.
- **Marker check:** `read_po` refuses a marker in a `msgstr` or a `#-#-#-#-#` comment line.
- **Empty translations:** an empty `msgstr` counts as a different translation, so it makes a conflict. gettext would let the non-empty one win.
- **`output_file` and `update` together:** `merge` writes to `output_file` and leaves `def.po` untouched.
