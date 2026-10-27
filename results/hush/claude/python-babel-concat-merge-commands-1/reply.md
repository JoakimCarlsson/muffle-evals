Now pofile.py.

Concat works; now testing merge and running the existing suite.

Done. `pybabel concat` and `pybabel merge` are in, plus the `Catalog` and `write_po` conflict support and the `read_po` refusal. I ran both commands by hand; they worked. I wrote no new tests and no docs.

`tests/messages/test_setuptools_frontend.py::test_setuptools_commands` fails with or without my changes. The rest of `tests/messages` and the `babel` doctests pass.

Some choices of mine:
- **Conflict output:** each marker comment is followed by that file's `msgstr` line(s), not wrapped in the message's own `msgstr`.
- **Empty translations:** an empty translation does not count as disagreeing. It is left out of the conflict list.
- **No-conflict case:** `concat` keeps the first non-empty translation and merges locations, comments and flags from every file that defines the message.

Changes are in `babel/messages/frontend.py`, `catalog.py` and `pofile.py`.
