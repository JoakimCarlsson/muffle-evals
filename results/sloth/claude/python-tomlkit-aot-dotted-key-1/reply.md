Running the tests, skipping the toml-test suite whose fixtures are missing.

Fixed: assigning an array of tables over a dotted-key entry now leaves the following keys alone. Your example now keeps `c.d = 2` as a top-level table, so the document still means `{"c": {"d": 2}, "a": [{"x": 9}]}`. I ran the tests with `tests/test_toml_tests.py` excluded, because its fixture files (`tests/toml-test/...`) aren't in the checkout. The other 361 pass.

**Cause:** the existing handling for replacing a dotted key with a table (#524/#513) only covered a plain `Table` value. An `AoT` value fell through, so it kept the dotted key and was written in place with its `[[a]]` header, which then took over the sibling keys that followed.

**Fix:** in `tomlkit/container.py` (`_replace_at`), an `AoT` now gets the same treatment as a non-super table. The dotted key is dropped, and the new entry is moved after any inline siblings.

**Test:** I added `test_replace_dotted_key_with_aot_keeps_following_sibling` in `tests/test_toml_document.py`. It covers your case, the reverse key order, and a plain-value sibling. Each time it checks the document before and after a re-parse. It passes.

Nothing is committed.
