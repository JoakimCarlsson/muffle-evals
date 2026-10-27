Now pofile.py.

Both commands work end to end. I'm running the existing test suite, then I'll add tests and docs.

That failure also happens without my changes. Next I'll add tests and update the docs.

`pybabel concat` and `pybabel merge` are in as `ConcatenateCatalog` and `MergeCatalog` in `babel/messages/frontend.py`, registered in the subcommand table and listed in `pybabel --help`. I ran both end to end. The full suite passes except `test_setuptools_commands`, which fails the same way without my changes. I added `tests/messages/frontend/test_concat_merge.py` and documented both commands in `docs/cmdline.rst`.

**Catalog and PO changes**
- `Catalog` has `add_conflict` and `get_conflicts`, and `ConflictInfo` is exported from `babel.messages.catalog`.
- `write_po` writes a conflicted message as fuzzy with an empty `msgstr`. Each file's translation follows, preceded by its `#-#-#-#-#  <basename> (<project> <version>)  #-#-#-#-#` line.
- `read_po` raises `PoFileError` on a marker line when `abort_invalid=True`; otherwise it warns.

**How I read the spec**
- **Conflict layout:** your wording could mean GNU's layout (marker lines inside the `msgstr` string) or real comment lines. I used real comment lines, with the `msgstr` / `msgstr[N]` lines after each. This makes the output deliberately unreadable until the conflicts are resolved.
- **Empty translations in concat:** an empty `msgstr` in one file isn't a disagreement. The non-empty translation wins, and empty ones aren't listed in a conflict block.
- **Compendium overwrite:** with `compendium_overwrite`, a compendium translation identical to the existing one changes nothing, so no comment is added and nothing goes to obsolete.
- **`backup`:** it only has an effect together with `update`.

**Short options I picked**
- `-o`, `-w`, `-u`, `-s` and `-F` on `concat`.
- `-o`, `-U`, `-C`, `-N`, `-w`, `-s` and `-F` on `merge`.

Say if you'd prefer different ones.

I didn't add a `CHANGES.rst` entry. Nothing is committed.
