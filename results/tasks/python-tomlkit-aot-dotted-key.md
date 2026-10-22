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
| claude | muffle | pass | +3/-1 | 11 | 1,756 | $0.041 |
| claude | hush | pass | +3/-1 | 0 | 1,618 | $0.075 |
| claude | sloth | pass | +3/-2 | 0 | 1,716 | $0.075 |
| claude | all | pass | +3/-1 | 0 | 1,361 | $0.075 |
| codex | base | pass | +7/-3 | 15 | 1,076 | - |
| codex | muffle | pass | +9/-4 | 17 | 1,288 | - |
| codex | hush | pass | +5/-4 | 25 | 912 | - |
| codex | sloth | pass | +3/-1 | 0 | 1,241 | - |
| codex | all | pass | +6/-2 | 0 | 689 | - |

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
index 0e950cb..ddd9d2c 100644
--- a/tests/test_toml_document.py
+++ b/tests/test_toml_document.py
@@ -1617,3 +1617,14 @@ value = 5
 """
 
     assert doc.as_string() == expected
+
+
+def test_replace_dotted_key_with_aot_does_not_capture_siblings():
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

Script ran outside the repo; rerun from the repo with PYTHONPATH.

Let me add a regression test.

Fixed. Assigning an array of tables over a dotted key no longer captures the keys after it. Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

Parsing that back gives `{"c": {"d": 2}, "a": [{"x": 9}]}`.

The cause was in `Container._replace_at` in `tomlkit/container.py`. It already dropped the dotted key and moved the replacement past the keys that render inline when a non-super `Table` was assigned, but it skipped `AoT`. I extended that check to cover `AoT`.

I added a regression test, `test_replace_dotted_key_with_aot_does_not_capture_siblings`, in `tests/test_toml_document.py`. The suite passes (360 tests), except `tests/test_toml_tests.py`. That file fails at collection with a `FileNotFoundError`, so I excluded it from the run.

I didn't commit anything.

</details>

### claude, hush: pass

Files: [tomlkit/container.py](../hush/claude/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

<details><summary>diff</summary>

```diff
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

Script ran from outside the repo; I deleted it. Rerun with PYTHONPATH.

Done. In `tomlkit/container.py` `_replace_at`, an AoT replacing a dotted key now gets the same handling as a non-super table, so `c.d = 2` stays before `[[a]]`. Your example now parses back to `{"c": {"d": 2}, "a": [{"x": 9}]}`. The 360 tests pass, but I skipped `tests/test_toml_tests.py` because it fails at collection with a missing-file error. I added no regression test.

</details>

### claude, sloth: pass

Files: [tomlkit/container.py](../sloth/claude/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

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

Script ran outside the repo path; rerun from the repo.

Fixed in `tomlkit/container.py` (`_replace_at`). Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

Parsing that back gives `{'c': {'d': 2}, 'a': [{'x': 9}]}`, so `c` is no longer lost.

When you replace a dotted-key entry with a table that renders its own `[header]`, `_replace_at` already drops the dotted key and moves the new header after the inline siblings. An array of tables needs the same handling, so I extended that check to cover it.

I ran the test suite without `tests/test_toml_tests.py`, which fails at collection with a `FileNotFoundError` (I didn't investigate why). The other 360 tests pass. I didn't add a regression test, since you didn't ask for one.

</details>

### claude, all: pass

Files: [tomlkit/container.py](../all/claude/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

<details><summary>diff</summary>

```diff
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

Done. In `tomlkit/container.py`, `_replace_at` now treats an AoT replacing a dotted key like a non-super table. It drops the dotted key and moves the new `[[a]]` after `c.d = 2`. Your example round-trips to `{'c': {'d': 2}, 'a': [{'x': 9}]}`. I ran 360 tests and they passed. I skipped `tests/test_toml_tests.py` because it fails at collection with a missing-file error. I added no regression test.

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
index 0e950cb..ad8f8cc 100644
--- a/tests/test_toml_document.py
+++ b/tests/test_toml_document.py
@@ -1170,6 +1170,23 @@ x = 9
     assert parse(doc.as_string()) == {"c": {"d": 2}, "a": {"x": 9}}
 
 
+@pytest.mark.parametrize("suffix", ["", "e = 3\n", "[f]\ng = 4\n"])
+def test_replace_dotted_key_with_aot_keeps_following_siblings(suffix: str) -> None:
+    doc = parse("a.b = 1\nc.d = 2\n" + suffix)
+    aot = tomlkit.aot()
+    table = tomlkit.table()
+    table["x"] = 9
+    aot.append(table)
+    doc["a"] = aot
+
+    rendered = tomlkit.dumps(doc)
+    assert rendered.index("c.d = 2") < rendered.index("[[a]]")
+    expected = {"c": {"d": 2}, "a": [{"x": 9}]}
+    expected.update(parse(suffix).unwrap())
+    assert doc.unwrap() == expected
+    assert parse(rendered).unwrap() == expected
+
+
 def test_replace_value_with_table_keeps_following_dotted_sibling() -> None:
     # A plain value turning into a table must likewise clear the inline region
     # (including dotted keys) before emitting its header.
diff --git a/tomlkit/container.py b/tomlkit/container.py
index e3ee4fd..52876b7 100644
--- a/tomlkit/container.py
+++ b/tomlkit/container.py
@@ -860,11 +860,16 @@ class Container(_CustomDict):  # type: ignore[type-arg]
         assert k is not None
         # A dotted key renders its value inline (e.g. ``a.b = 1``), which is only
         # consistent with a super table. When the replacement value renders with
-        # its own ``[header]`` instead (a non-super table), keeping the dotted key
-        # duplicates the prefix onto the header (#524). Drop the dotted key so the
-        # replacement renders as a plain table.
+        # its own header instead (a non-super table or array of tables), keeping
+        # the dotted key duplicates the prefix onto the header (#524). Drop it so the
+        # replacement renders with its own header.
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

I’ll trace how dotted-key entries are replaced, fix the ordering, and add a regression test for the round trip.

The replacement code already handles this ordering issue for regular tables, but excludes arrays of tables. I’ve extended that handling, and the regression cases pass with both dotted siblings and explicit tables following the replaced key.

Fixed dotted-key replacement so arrays of tables move after inline siblings, preserving top-level `c` when the output is parsed again.

Added regression coverage. All 363 available tests pass. The full suite is blocked by a missing `toml-test` fixture file.

</details>

### codex, hush: pass

Files: [tests/test_toml_document.py](../hush/codex/python-tomlkit-aot-dotted-key-1/files/tests/test_toml_document.py), [tomlkit/container.py](../hush/codex/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

<details><summary>diff</summary>

```diff
diff --git a/tests/test_toml_document.py b/tests/test_toml_document.py
index 0e950cb..b581a96 100644
--- a/tests/test_toml_document.py
+++ b/tests/test_toml_document.py
@@ -1170,6 +1170,31 @@ x = 9
     assert parse(doc.as_string()) == {"c": {"d": 2}, "a": {"x": 9}}
 
 
+@pytest.mark.parametrize("nested", [False, True])
+@pytest.mark.parametrize("following_table", [False, True])
+def test_replace_dotted_key_with_aot_keeps_following_sibling(
+    nested: bool, following_table: bool
+) -> None:
+    content = "a.b = 1\nc.d = 2\n"
+    if following_table:
+        content += "\n[other]\ny = 3\n"
+    if nested:
+        content = "[parent]\n" + content
+    doc = parse(content)
+    target = doc["parent"] if nested else doc
+    replacement = tomlkit.aot()
+    replacement.append(tomlkit.table().add("x", 9))
+    target["a"] = replacement
+
+    expected = {"c": {"d": 2}, "a": [{"x": 9}]}
+    if nested:
+        expected = {"parent": expected}
+    if following_table:
+        expected["other"] = {"y": 3}
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

Replacement serialization needs scope check. Inspecting container code and regression tests.


Done.
AoT replacement preserves sibling scope; regression tests added. 364 tests passed. Full suite blocked by missing toml-test fixtures.

</details>

### codex, sloth: pass

Files: [tomlkit/container.py](../sloth/codex/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

<details><summary>diff</summary>

```diff
diff --git a/tomlkit/container.py b/tomlkit/container.py
index e3ee4fd..a517597 100644
--- a/tomlkit/container.py
+++ b/tomlkit/container.py
@@ -864,7 +864,9 @@ class Container(_CustomDict):  # type: ignore[type-arg]
         # duplicates the prefix onto the header (#524). Drop the dotted key so the
         # replacement renders as a plain table.
         dotted_to_header = (
-            k.is_dotted() and isinstance(value, Table) and not value.is_super_table()
+            k.is_dotted()
+            and isinstance(value, (Table, AoT))
+            and (isinstance(value, AoT) or not value.is_super_table())
         )
         # That new header also captures every sibling that renders inline -- plain
         # values and dotted keys -- if any still follow it (#513), so it must be
```

</details>

<details><summary>reply</summary>

I’ll trace how replacement affects dotted-key serialization, fix the shared logic, and run the existing tests.

The replacement logic already moves ordinary tables past following dotted keys, but its condition excludes arrays of tables. I’ll extend that condition to include them. Assignment and table merging share this path; no caller, fixture, config, or export changes are needed.

Fixed the shared replacement logic in [container.py](tomlkit/container.py) so arrays of tables move past following dotted keys, preserving top-level `c`.

Validation: 360 existing tests passed, plus manual round-trip checks. The conformance suite is blocked by missing fixtures; building is blocked by missing build tooling.

</details>

### codex, all: pass

Files: [tomlkit/container.py](../all/codex/python-tomlkit-aot-dotted-key-1/files/tomlkit/container.py)

<details><summary>diff</summary>

```diff
diff --git a/tomlkit/container.py b/tomlkit/container.py
index e3ee4fd..5634a81 100644
--- a/tomlkit/container.py
+++ b/tomlkit/container.py
@@ -860,11 +860,15 @@ class Container(_CustomDict):  # type: ignore[type-arg]
         assert k is not None
         # A dotted key renders its value inline (e.g. ``a.b = 1``), which is only
         # consistent with a super table. When the replacement value renders with
-        # its own ``[header]`` instead (a non-super table), keeping the dotted key
+        # its own header instead (a non-super table or AoT), keeping the dotted key
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

Done.
AoT replacements move past dotted siblings, preserving top-level keys. 360 tests passed; round-trips checked. Conformance suite blocked by missing fixtures.

</details>
