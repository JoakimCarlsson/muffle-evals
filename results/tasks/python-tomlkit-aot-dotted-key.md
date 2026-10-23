# python-tomlkit-aot-dotted-key

Source: https://github.com/python-poetry/tomlkit/pull/549

## Prompt

> Assigning an array of tables over a key that came from a dotted key captures the following keys:
> 
> ```python
> import tomlkit
> 
> doc = tomlkit.parse("a.b = 1\nc.d = 2\n")
> aot = tomlkit.aot()
> t = tomlkit.table()
> t["x"] = 9
> aot.append(t)
> doc["a"] = aot
> print(tomlkit.dumps(doc))
> ```
> 
> Result:
> 
> ```
> [[a]]
> x = 9
> c.d = 2
> ```
> 
> `c.d` has wrongly been captured by the array of tables: parsing the output again gives `{"a": [{"x": 9, "c": {"d": 2}}]}` and the top-level `c` is lost. I expected the document to still mean `{"c": {"d": 2}, "a": [{"x": 9}]}`.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [CHANGELOG.md](../../tasks/python-tomlkit-aot-dotted-key/upstream/CHANGELOG.md), [tests/test_toml_document.py](../../tasks/python-tomlkit-aot-dotted-key/upstream/tests/test_toml_document.py), [tomlkit/container.py](../../tasks/python-tomlkit-aot-dotted-key/upstream/tomlkit/container.py)

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index f3ee402..e38d57d 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -34,6 +34,7 @@
 - Fix a `KeyAlreadyPresent` error when parsing or accessing an out-of-order table whose array-of-tables elements are split across the table's parts. ([#505](https://github.com/python-poetry/tomlkit/issues/505))
 - Out-of-order value-vs-table and dotted-key-vs-table redefinitions are now rejected at parse time instead of being silently accepted or raising only on access. The parser also detects when a non-dotted key is a prefix of an existing dotted key, matching the stdlib `tomllib` behaviour. ([#523](https://github.com/python-poetry/tomlkit/issues/523))
 - Reject tables inserted into inline tables instead of serializing invalid TOML. ([#531](https://github.com/python-poetry/tomlkit/issues/531))
+- Fix assigning an array of tables over a dotted key (e.g. `doc["a"] = aot(...)` where `a` came from `a.b = ...`): the new `[[a]]` header kept the dotted key's inline position and swallowed the following dotted sibling on round-trip. The array of tables now renders past the inline entries it would otherwise capture, mirroring the table fix for [#513](https://github.com/python-poetry/tomlkit/issues/513). ([#542](https://github.com/python-poetry/tomlkit/issues/542))
 - Fix invalid serialization with a duplicated `[table]` header when adding a key to an out-of-order table whose concrete header is declared after its sub-tables; the new key now lands in the existing concrete part instead of giving the header-less super part a second header. ([#545](https://github.com/python-poetry/tomlkit/pull/545))
 - Fix a table's display name (its exact header spelling, including whitespace and quoting) being normalised when the table is assigned onto itself, e.g. `doc[k] = doc[k]` rewriting `[keys .'a'.'c']` to `[keys.a.'c']`. ([#291](https://github.com/python-poetry/tomlkit/issues/291))
 - Fix missing newlines when appending a key after a dotted inline table, including when the original document has no trailing newline. ([#533](https://github.com/python-poetry/tomlkit/pull/533))
diff --git a/tomlkit/container.py b/tomlkit/container.py
index e3ee4fd..4e38253 100644
--- a/tomlkit/container.py
+++ b/tomlkit/container.py
@@ -860,11 +860,13 @@ class Container(_CustomDict):  # type: ignore[type-arg]
         assert k is not None
         # A dotted key renders its value inline (e.g. ``a.b = 1``), which is only
         # consistent with a super table. When the replacement value renders with
-        # its own ``[header]`` instead (a non-super table), keeping the dotted key
-        # duplicates the prefix onto the header (#524). Drop the dotted key so the
-        # replacement renders as a plain table.
-        dotted_to_header = (
-            k.is_dotted() and isinstance(value, Table) and not value.is_super_table()
+        # its own ``[header]`` instead (a non-super table, or an array of tables),
+        # keeping the dotted key duplicates the prefix onto the header (#524) and
+        # lets the header swallow following dotted siblings (#542). Drop the dotted
+        # key so the replacement renders as a plain table/array of tables.
+        dotted_to_header = k.is_dotted() and (
+            isinstance(value, AoT)
+            or (isinstance(value, Table) and not value.is_super_table())
         )
         # That new header also captures every sibling that renders inline -- plain
         # values and dotted keys -- if any still follow it (#513), so it must be
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +3/-1 | 11 | 1,521 | $0.077 |
| claude | muffle | pass | +3/-1 | 12 | 1,484 | $0.052 |
| claude | hush | pass | +3/-2 | 0 | 1,075 | $0.064 |
| claude | sloth | pass | +3/-1 | 13 | 2,304 | $0.087 |
| claude | all | pass | +3/-1 | 10 | 2,071 | $0.094 |
| codex | base | pass | +7/-3 | 15 | 1,076 | - |
| codex | muffle | pass | +5/-4 | 20 | 1,133 | - |
| codex | hush | pass | +6/-2 | 17 | 854 | - |
| codex | sloth | pass | +6/-2 | 23 | 1,248 | - |
| codex | all | pass | +6/-1 | 20 | 1,133 | - |

### claude, base: pass

Files: [tests/test_toml_document.py](../base/claude/python-tomlkit-aot-dotted-key-1/files/tests/test_toml_document.py), [tomlkit/container.py](../base/claude/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

<details><summary>diff</summary>

```diff
diff --git a/tests/test_toml_document.py b/tests/test_toml_document.py
index 0e950cb..efb57e1 100644
--- a/tests/test_toml_document.py
+++ b/tests/test_toml_document.py
@@ -1617,3 +1617,14 @@ value = 5
 """
 
     assert doc.as_string() == expected
+
+
+def test_replace_dotted_key_with_aot_keeps_following_keys() -> None:
+    doc = parse("a.b = 1\nc.d = 2\n")
+    aot = tomlkit.aot()
+    t = tomlkit.table()
+    t["x"] = 9
+    aot.append(t)
+    doc["a"] = aot
+
+    assert parse(doc.as_string()) == {"c": {"d": 2}, "a": [{"x": 9}]}
diff --git a/tomlkit/container.py b/tomlkit/container.py
index e3ee4fd..5a564e1 100644
--- a/tomlkit/container.py
+++ b/tomlkit/container.py
@@ -864,7 +864,9 @@ class Container(_CustomDict):  # type: ignore[type-arg]
         # duplicates the prefix onto the header (#524). Drop the dotted key so the
         # replacement renders as a plain table.
         dotted_to_header = (
-            k.is_dotted() and isinstance(value, Table) and not value.is_super_table()
+            k.is_dotted()
+            and isinstance(value, (Table, AoT))
+            and not (isinstance(value, Table) and value.is_super_table())
         )
         # That new header also captures every sibling that renders inline -- plain
         # values and dotted keys -- if any still follow it (#513), so it must be
```

</details>

<details><summary>reply</summary>

Now a regression test, then run the suite (ignoring the collection error from the missing toml-test data).

Your example now round-trips as `{"c": {"d": 2}, "a": [{"x": 9}]}`. The dump is:

```
c.d = 2

[[a]]
x = 9
```

The fix is in `tomlkit/container.py`, in `_replace_at`. That function already handled a dotted key being replaced by a non-super `Table`. It dropped the dotted key and moved the new table past the inline siblings. It didn't do the same when the replacement was an array of tables, so the `[[a]]` header stayed in place and picked up `c.d = 2`. It now treats both cases the same.

I added a regression test in `tests/test_toml_document.py`. The suite passes (361 tests). I had to skip `tests/test_toml_tests.py`, which fails at collection with a `FileNotFoundError`; I didn't look into why.

I left the changes uncommitted.

</details>

### claude, muffle: pass

Files: [tests/test_toml_document.py](../muffle/claude/python-tomlkit-aot-dotted-key-1/files/tests/test_toml_document.py), [tomlkit/container.py](../muffle/claude/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

<details><summary>diff</summary>

```diff
diff --git a/tests/test_toml_document.py b/tests/test_toml_document.py
index 0e950cb..b81529b 100644
--- a/tests/test_toml_document.py
+++ b/tests/test_toml_document.py
@@ -1617,3 +1617,15 @@ value = 5
 """
 
     assert doc.as_string() == expected
+
+
+def test_replace_dotted_key_with_aot_keeps_following_keys():
+    doc = parse("a.b = 1\nc.d = 2\n")
+    aot = tomlkit.aot()
+    t = tomlkit.table()
+    t["x"] = 9
+    aot.append(t)
+    doc["a"] = aot
+
+    assert doc.unwrap() == {"c": {"d": 2}, "a": [{"x": 9}]}
+    assert parse(doc.as_string()).unwrap() == {"c": {"d": 2}, "a": [{"x": 9}]}
diff --git a/tomlkit/container.py b/tomlkit/container.py
index e3ee4fd..5a564e1 100644
--- a/tomlkit/container.py
+++ b/tomlkit/container.py
@@ -864,7 +864,9 @@ class Container(_CustomDict):  # type: ignore[type-arg]
         # duplicates the prefix onto the header (#524). Drop the dotted key so the
         # replacement renders as a plain table.
         dotted_to_header = (
-            k.is_dotted() and isinstance(value, Table) and not value.is_super_table()
+            k.is_dotted()
+            and isinstance(value, (Table, AoT))
+            and not (isinstance(value, Table) and value.is_super_table())
         )
         # That new header also captures every sibling that renders inline -- plain
         # values and dotted keys -- if any still follow it (#513), so it must be
```

</details>

<details><summary>reply</summary>

Fixed. Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

This parses back to `{"c": {"d": 2}, "a": [{"x": 9}]}`.

The change is in `Container._replace_at` in `tomlkit/container.py`. It already handled a dotted key being replaced by a non-super `Table`, but it skipped an `AoT`. Now an `AoT` goes through the same path, so `[[a]]` is moved after the keys that render inline.

I added a regression test in `tests/test_toml_document.py`. The suite passes (360 tests) except `tests/test_toml_tests.py`, which I excluded because it fails at collection with a `FileNotFoundError`. I didn't look into why.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [tomlkit/container.py](../hush/claude/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

<details><summary>diff</summary>

```diff
diff --git a/tomlkit/container.py b/tomlkit/container.py
index e3ee4fd..b8747a4 100644
--- a/tomlkit/container.py
+++ b/tomlkit/container.py
@@ -863,8 +863,9 @@ class Container(_CustomDict):  # type: ignore[type-arg]
         # its own ``[header]`` instead (a non-super table), keeping the dotted key
         # duplicates the prefix onto the header (#524). Drop the dotted key so the
         # replacement renders as a plain table.
-        dotted_to_header = (
-            k.is_dotted() and isinstance(value, Table) and not value.is_super_table()
+        dotted_to_header = k.is_dotted() and (
+            isinstance(value, AoT)
+            or (isinstance(value, Table) and not value.is_super_table())
         )
         # That new header also captures every sibling that renders inline -- plain
         # values and dotted keys -- if any still follow it (#513), so it must be
```

</details>

<details><summary>reply</summary>

Extend the dotted check to AoT.

Done. `tomlkit/container.py` `_replace_at`: dotted-key check now includes `AoT`, so `c.d = 2` stays top-level and `[[a]]` goes after it. Your example round-trips to `{"c": {"d": 2}, "a": [{"x": 9}]}`. 360 tests pass. `tests/test_toml_tests.py` skipped (missing files). I added no regression test.

</details>

### claude, sloth: pass

Files: [tests/test_toml_document.py](../sloth/claude/python-tomlkit-aot-dotted-key-1/files/tests/test_toml_document.py), [tomlkit/container.py](../sloth/claude/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

<details><summary>diff</summary>

```diff
diff --git a/tests/test_toml_document.py b/tests/test_toml_document.py
index 0e950cb..601fab4 100644
--- a/tests/test_toml_document.py
+++ b/tests/test_toml_document.py
@@ -1617,3 +1617,16 @@ value = 5
 """
 
     assert doc.as_string() == expected
+
+
+def test_replace_dotted_key_with_aot_keeps_following_sibling() -> None:
+    for content in ("a.b = 1\nc.d = 2\n", "c.d = 2\na.b = 1\n", "a.b = 1\nc = 2\n"):
+        doc = parse(content)
+        aot = tomlkit.aot()
+        table = tomlkit.table()
+        table["x"] = 9
+        aot.append(table)
+        doc["a"] = aot
+        expected = {**parse(content).unwrap(), "a": [{"x": 9}]}
+        assert doc.unwrap() == expected
+        assert parse(doc.as_string()).unwrap() == expected
diff --git a/tomlkit/container.py b/tomlkit/container.py
index e3ee4fd..78a4638 100644
--- a/tomlkit/container.py
+++ b/tomlkit/container.py
@@ -864,7 +864,9 @@ class Container(_CustomDict):  # type: ignore[type-arg]
         # duplicates the prefix onto the header (#524). Drop the dotted key so the
         # replacement renders as a plain table.
         dotted_to_header = (
-            k.is_dotted() and isinstance(value, Table) and not value.is_super_table()
+            k.is_dotted()
+            and isinstance(value, (AoT, Table))
+            and not (isinstance(value, Table) and value.is_super_table())
         )
         # That new header also captures every sibling that renders inline -- plain
         # values and dotted keys -- if any still follow it (#513), so it must be
```

</details>

<details><summary>reply</summary>

Running the tests, skipping the toml-test suite whose fixtures are missing.

Fixed: assigning an array of tables over a dotted-key entry now leaves the following keys alone. Your example now keeps `c.d = 2` as a top-level table, so the document still means `{"c": {"d": 2}, "a": [{"x": 9}]}`. I ran the tests with `tests/test_toml_tests.py` excluded, because its fixture files (`tests/toml-test/...`) aren't in the checkout. The other 361 pass.

**Cause:** the existing handling for replacing a dotted key with a table (#524/#513) only covered a plain `Table` value. An `AoT` value fell through, so it kept the dotted key and was written in place with its `[[a]]` header, which then took over the sibling keys that followed.

**Fix:** in `tomlkit/container.py` (`_replace_at`), an `AoT` now gets the same treatment as a non-super table. The dotted key is dropped, and the new entry is moved after any inline siblings.

**Test:** I added `test_replace_dotted_key_with_aot_keeps_following_sibling` in `tests/test_toml_document.py`. It covers your case, the reverse key order, and a plain-value sibling. Each time it checks the document before and after a re-parse. It passes.

Nothing is committed.

</details>

### claude, all: pass

Files: [tests/test_toml_document.py](../all/claude/python-tomlkit-aot-dotted-key-1/files/tests/test_toml_document.py), [tomlkit/container.py](../all/claude/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

<details><summary>diff</summary>

```diff
diff --git a/tests/test_toml_document.py b/tests/test_toml_document.py
index 0e950cb..a3f28ff 100644
--- a/tests/test_toml_document.py
+++ b/tests/test_toml_document.py
@@ -1170,6 +1170,16 @@ x = 9
     assert parse(doc.as_string()) == {"c": {"d": 2}, "a": {"x": 9}}
 
 
+def test_replace_dotted_key_with_aot_keeps_following_sibling() -> None:
+    doc = parse("a.b = 1\nc.d = 2\n")
+    aot = tomlkit.aot()
+    table_ = tomlkit.table()
+    table_["x"] = 9
+    aot.append(table_)
+    doc["a"] = aot
+    assert parse(doc.as_string()) == {"c": {"d": 2}, "a": [{"x": 9}]}
+
+
 def test_replace_value_with_table_keeps_following_dotted_sibling() -> None:
     # A plain value turning into a table must likewise clear the inline region
     # (including dotted keys) before emitting its header.
diff --git a/tomlkit/container.py b/tomlkit/container.py
index e3ee4fd..5a564e1 100644
--- a/tomlkit/container.py
+++ b/tomlkit/container.py
@@ -864,7 +864,9 @@ class Container(_CustomDict):  # type: ignore[type-arg]
         # duplicates the prefix onto the header (#524). Drop the dotted key so the
         # replacement renders as a plain table.
         dotted_to_header = (
-            k.is_dotted() and isinstance(value, Table) and not value.is_super_table()
+            k.is_dotted()
+            and isinstance(value, (Table, AoT))
+            and not (isinstance(value, Table) and value.is_super_table())
         )
         # That new header also captures every sibling that renders inline -- plain
         # values and dotted keys -- if any still follow it (#513), so it must be
```

</details>

<details><summary>reply</summary>

Imports lack `aot`/`table`; use `tomlkit.` prefix.

Done. `_replace_at` in `tomlkit/container.py` now treats an AoT replacing a dotted key like a non-super table, so it moves past following inline keys. Output is `c.d = 2` then `[[a]]`, and it round-trips to `{"c": {"d": 2}, "a": [{"x": 9}]}`.

I added a test in `tests/test_toml_document.py`. The other 361 tests pass. `tests/test_toml_tests.py` is excluded because its `toml-test` fixtures are missing.

</details>

### codex, base: pass

Files: [tests/test_toml_document.py](../base/codex/python-tomlkit-aot-dotted-key-1/files/tests/test_toml_document.py), [tomlkit/container.py](../base/codex/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

<details><summary>diff</summary>

```diff
diff --git a/tests/test_toml_document.py b/tests/test_toml_document.py
index 0e950cb..b629440 100644
--- a/tests/test_toml_document.py
+++ b/tests/test_toml_document.py
@@ -1170,6 +1170,21 @@ x = 9
     assert parse(doc.as_string()) == {"c": {"d": 2}, "a": {"x": 9}}
 
 
+@pytest.mark.parametrize("suffix", ["", "c.d = 2\n", "c.d = 2\n\n[e]\nf = 3\n"])
+def test_replace_dotted_key_with_aot(suffix: str) -> None:
+    doc = parse("a.b = 1\n" + suffix)
+    aot = tomlkit.aot()
+    table = tomlkit.table()
+    table["x"] = 9
+    aot.append(table)
+    doc["a"] = aot
+
+    expected = parse(suffix).unwrap()
+    expected["a"] = [{"x": 9}]
+    assert doc.unwrap() == expected
+    assert parse(tomlkit.dumps(doc)).unwrap() == expected
+
+
 def test_replace_value_with_table_keeps_following_dotted_sibling() -> None:
     # A plain value turning into a table must likewise clear the inline region
     # (including dotted keys) before emitting its header.
diff --git a/tomlkit/container.py b/tomlkit/container.py
index e3ee4fd..5bb9711 100644
--- a/tomlkit/container.py
+++ b/tomlkit/container.py
@@ -860,11 +860,15 @@ class Container(_CustomDict):  # type: ignore[type-arg]
         assert k is not None
         # A dotted key renders its value inline (e.g. ``a.b = 1``), which is only
         # consistent with a super table. When the replacement value renders with
-        # its own ``[header]`` instead (a non-super table), keeping the dotted key
+        # its own header instead (an AoT or non-super table), keeping the dotted key
         # duplicates the prefix onto the header (#524). Drop the dotted key so the
-        # replacement renders as a plain table.
+        # replacement renders with its own header.
         dotted_to_header = (
-            k.is_dotted() and isinstance(value, Table) and not value.is_super_table()
+            k.is_dotted()
+            and (
+                isinstance(value, AoT)
+                or isinstance(value, Table) and not value.is_super_table()
+            )
         )
         # That new header also captures every sibling that renders inline -- plain
         # values and dotted keys -- if any still follow it (#513), so it must be
```

</details>

<details><summary>reply</summary>

I’ll check how replacement affects serialization, fix the ordering issue, and add a regression test.

The replacement logic already moves ordinary tables past dotted keys that follow them, but it missed arrays of tables. I’ve extended that handling to arrays of tables. The document tests pass, including the reported case; I’ll run the full suite now.

Fixed the replacement logic so arrays of tables move past following dotted keys, preserving their top-level scope.

Added regression tests covering the reported case and surrounding table headers.

Validation: 363 tests passed. The full suite could not collect because the external `toml-test` fixtures are missing.

</details>

### codex, muffle: pass

Files: [tests/test_toml_document.py](../muffle/codex/python-tomlkit-aot-dotted-key-1/files/tests/test_toml_document.py), [tomlkit/container.py](../muffle/codex/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

<details><summary>diff</summary>

```diff
diff --git a/tests/test_toml_document.py b/tests/test_toml_document.py
index 0e950cb..348efa9 100644
--- a/tests/test_toml_document.py
+++ b/tests/test_toml_document.py
@@ -1170,6 +1170,26 @@ x = 9
     assert parse(doc.as_string()) == {"c": {"d": 2}, "a": {"x": 9}}
 
 
+@pytest.mark.parametrize("table_count", [1, 2])
+@pytest.mark.parametrize("following", ["c.d = 2\n", "c.d = 2\n\n[e]\nf = 3\n"])
+def test_replace_dotted_key_with_aot_keeps_following_sibling(
+    table_count: int, following: str
+) -> None:
+    doc = parse("a.b = 1\n" + following)
+    replacement = tomlkit.aot()
+    for x in range(table_count):
+        entry = tomlkit.table()
+        entry["x"] = x
+        replacement.append(entry)
+
+    doc["a"] = replacement
+
+    expected = parse(following).unwrap()
+    expected["a"] = [{"x": x} for x in range(table_count)]
+    assert doc.unwrap() == expected
+    assert parse(tomlkit.dumps(doc)).unwrap() == expected
+
+
 def test_replace_value_with_table_keeps_following_dotted_sibling() -> None:
     # A plain value turning into a table must likewise clear the inline region
     # (including dotted keys) before emitting its header.
diff --git a/tomlkit/container.py b/tomlkit/container.py
index e3ee4fd..f8a5a23 100644
--- a/tomlkit/container.py
+++ b/tomlkit/container.py
@@ -860,11 +860,12 @@ class Container(_CustomDict):  # type: ignore[type-arg]
         assert k is not None
         # A dotted key renders its value inline (e.g. ``a.b = 1``), which is only
         # consistent with a super table. When the replacement value renders with
-        # its own ``[header]`` instead (a non-super table), keeping the dotted key
+        # its own header instead (a non-super table or AoT), keeping the dotted key
         # duplicates the prefix onto the header (#524). Drop the dotted key so the
-        # replacement renders as a plain table.
-        dotted_to_header = (
-            k.is_dotted() and isinstance(value, Table) and not value.is_super_table()
+        # replacement renders with its own header.
+        dotted_to_header = k.is_dotted() and (
+            isinstance(value, AoT)
+            or (isinstance(value, Table) and not value.is_super_table())
         )
         # That new header also captures every sibling that renders inline -- plain
         # values and dotted keys -- if any still follow it (#513), so it must be
```

</details>

<details><summary>reply</summary>

I’ll trace how dotted keys are serialized when replaced by an array of tables, add a regression test, and fix the ordering.

The replacement logic already moves ordinary tables past following dotted keys, but it excluded arrays of tables. I’ve extended that logic to cover them. The regression tests reproduce the bug with one or multiple entries, including when another table follows.

Fixed the replacement logic so arrays of tables move after following dotted keys, preserving top-level `c` when the output is parsed again.

Added four regression cases. All 364 available tests pass. The TOML conformance suite could not run because its fixture files are missing.

</details>

### codex, hush: pass

Files: [tests/test_toml_document.py](../hush/codex/python-tomlkit-aot-dotted-key-1/files/tests/test_toml_document.py), [tomlkit/container.py](../hush/codex/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

<details><summary>diff</summary>

```diff
diff --git a/tests/test_toml_document.py b/tests/test_toml_document.py
index 0e950cb..46315cb 100644
--- a/tests/test_toml_document.py
+++ b/tests/test_toml_document.py
@@ -1170,6 +1170,23 @@ x = 9
     assert parse(doc.as_string()) == {"c": {"d": 2}, "a": {"x": 9}}
 
 
+@pytest.mark.parametrize("following", ["c.d = 2\n", "c = 2\n", "c.d = 2\n\n[e]\nf = 3\n"])
+def test_replace_dotted_key_with_aot_keeps_following_sibling(following: str) -> None:
+    doc = parse("a.b = 1\n" + following)
+    aot = tomlkit.aot()
+    table = tomlkit.table()
+    table["x"] = 9
+    aot.append(table)
+    doc["a"] = aot
+
+    expected = parse(following).unwrap()
+    expected["a"] = [{"x": 9}]
+    rendered = tomlkit.dumps(doc)
+    assert rendered.index("c") < rendered.index("[[a]]")
+    assert doc.unwrap() == expected
+    assert parse(rendered).unwrap() == expected
+
+
 def test_replace_value_with_table_keeps_following_dotted_sibling() -> None:
     # A plain value turning into a table must likewise clear the inline region
     # (including dotted keys) before emitting its header.
diff --git a/tomlkit/container.py b/tomlkit/container.py
index e3ee4fd..b8c4483 100644
--- a/tomlkit/container.py
+++ b/tomlkit/container.py
@@ -860,11 +860,15 @@ class Container(_CustomDict):  # type: ignore[type-arg]
         assert k is not None
         # A dotted key renders its value inline (e.g. ``a.b = 1``), which is only
         # consistent with a super table. When the replacement value renders with
-        # its own ``[header]`` instead (a non-super table), keeping the dotted key
+        # its own header instead (an AoT or non-super table), keeping the dotted key
         # duplicates the prefix onto the header (#524). Drop the dotted key so the
         # replacement renders as a plain table.
         dotted_to_header = (
-            k.is_dotted() and isinstance(value, Table) and not value.is_super_table()
+            k.is_dotted()
+            and (
+                isinstance(value, AoT)
+                or (isinstance(value, Table) and not value.is_super_table())
+            )
         )
         # That new header also captures every sibling that renders inline -- plain
         # values and dotted keys -- if any still follow it (#513), so it must be
```

</details>

<details><summary>reply</summary>

Dotted-key replacement needs ordering fix. Checking serializer and regression tests.


Done.
AoT replacement preserves top-level siblings. Regression tests added; 363 tests passed. Full suite blocked by missing `toml-test` fixtures.

</details>

### codex, sloth: pass

Files: [tests/test_toml_document.py](../sloth/codex/python-tomlkit-aot-dotted-key-1/files/tests/test_toml_document.py), [tomlkit/container.py](../sloth/codex/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

<details><summary>diff</summary>

```diff
diff --git a/tests/test_toml_document.py b/tests/test_toml_document.py
index 0e950cb..cab52bd 100644
--- a/tests/test_toml_document.py
+++ b/tests/test_toml_document.py
@@ -1170,6 +1170,29 @@ x = 9
     assert parse(doc.as_string()) == {"c": {"d": 2}, "a": {"x": 9}}
 
 
+@pytest.mark.parametrize(
+    "following",
+    ["", "c.d = 2\n", "c = 2\n", "c.d = 2\n[e]\nf = 3\n"],
+)
+@pytest.mark.parametrize("table_count", [1, 2])
+def test_replace_dotted_key_with_aot_keeps_following_siblings(
+    following: str, table_count: int
+) -> None:
+    """Replacing a dotted prefix with an AoT preserves sibling scope."""
+    doc = parse("a.b = 1\n" + following)
+    expected = parse(following).unwrap()
+    aot = tomlkit.aot()
+    for x in range(9, 9 + table_count):
+        table = tomlkit.table()
+        table["x"] = x
+        aot.append(table)
+    doc["a"] = aot
+    expected["a"] = [{"x": x} for x in range(9, 9 + table_count)]
+
+    assert doc.unwrap() == expected
+    assert parse(tomlkit.dumps(doc)).unwrap() == expected
+
+
 def test_replace_value_with_table_keeps_following_dotted_sibling() -> None:
     # A plain value turning into a table must likewise clear the inline region
     # (including dotted keys) before emitting its header.
diff --git a/tomlkit/container.py b/tomlkit/container.py
index e3ee4fd..4e0f44a 100644
--- a/tomlkit/container.py
+++ b/tomlkit/container.py
@@ -860,11 +860,15 @@ class Container(_CustomDict):  # type: ignore[type-arg]
         assert k is not None
         # A dotted key renders its value inline (e.g. ``a.b = 1``), which is only
         # consistent with a super table. When the replacement value renders with
-        # its own ``[header]`` instead (a non-super table), keeping the dotted key
+        # its own header instead (an AoT or non-super table), keeping the dotted key
         # duplicates the prefix onto the header (#524). Drop the dotted key so the
         # replacement renders as a plain table.
         dotted_to_header = (
-            k.is_dotted() and isinstance(value, Table) and not value.is_super_table()
+            k.is_dotted()
+            and (
+                isinstance(value, AoT)
+                or isinstance(value, Table) and not value.is_super_table()
+            )
         )
         # That new header also captures every sibling that renders inline -- plain
         # values and dotted keys -- if any still follow it (#513), so it must be
```

</details>

<details><summary>reply</summary>

I’ll trace the replacement and rendering paths, add a regression test, and run the relevant checks.

The shared replacement code already moves ordinary tables past following dotted keys, but excludes arrays of tables. I’ll extend that rule to arrays of tables and test round-tripping with following values, dotted keys, and table headers. No API, fixture, config, or export changes are needed.

Fixed the shared replacement logic so arrays of tables move past following top-level values and dotted keys, preserving their scope.

Added regression coverage for one or multiple array entries and following siblings.

Validation: 368 tests passed. Full-suite collection requires missing `toml-test` fixtures. Build and lint checks were blocked by unavailable tools.

</details>

### codex, all: pass

Files: [tests/test_toml_document.py](../all/codex/python-tomlkit-aot-dotted-key-1/files/tests/test_toml_document.py), [tomlkit/container.py](../all/codex/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

<details><summary>diff</summary>

```diff
diff --git a/tests/test_toml_document.py b/tests/test_toml_document.py
index 0e950cb..2bbc20e 100644
--- a/tests/test_toml_document.py
+++ b/tests/test_toml_document.py
@@ -1170,6 +1170,26 @@ x = 9
     assert parse(doc.as_string()) == {"c": {"d": 2}, "a": {"x": 9}}
 
 
+@pytest.mark.parametrize("suffix", ["", "c.d = 2\n", "c.d = 2\n[e]\nf = 3\n"])
+@pytest.mark.parametrize("elements", [1, 2])
+def test_replace_dotted_key_with_aot_keeps_following_sibling(
+    suffix: str, elements: int
+) -> None:
+    """Replacing a dotted prefix with an AoT preserves sibling scope."""
+    doc = parse("a.b = 1\n" + suffix)
+    replacement = tomlkit.aot()
+    for _ in range(elements):
+        table = tomlkit.table()
+        table["x"] = 9
+        replacement.append(table)
+    doc["a"] = replacement
+
+    expected = parse(suffix).unwrap()
+    expected["a"] = [{"x": 9}] * elements
+    assert doc.unwrap() == expected
+    assert parse(tomlkit.dumps(doc)).unwrap() == expected
+
+
 def test_replace_value_with_table_keeps_following_dotted_sibling() -> None:
     # A plain value turning into a table must likewise clear the inline region
     # (including dotted keys) before emitting its header.
diff --git a/tomlkit/container.py b/tomlkit/container.py
index e3ee4fd..1c9c783 100644
--- a/tomlkit/container.py
+++ b/tomlkit/container.py
@@ -864,7 +864,12 @@ class Container(_CustomDict):  # type: ignore[type-arg]
         # duplicates the prefix onto the header (#524). Drop the dotted key so the
         # replacement renders as a plain table.
         dotted_to_header = (
-            k.is_dotted() and isinstance(value, Table) and not value.is_super_table()
+            k.is_dotted()
+            and (
+                isinstance(value, AoT)
+                or isinstance(value, Table)
+                and not value.is_super_table()
+            )
         )
         # That new header also captures every sibling that renders inline -- plain
         # values and dotted keys -- if any still follow it (#513), so it must be
```

</details>

<details><summary>reply</summary>

Done.
AoT replacement preserves sibling scope. Regression tests added; 366 tests passed. Full suite blocked by missing fixtures; build blocked by missing tools.

</details>
