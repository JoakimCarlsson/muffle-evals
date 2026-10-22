# python-feat-packaging-requirement-replace

Source: https://github.com/pypa/packaging/pull/1377

## Prompt

> I often need a copy of a `packaging.requirements.Requirement` with one part changed, for example the same requirement under another name or with a different version specifier. Today I have to mutate the object's attributes or build a new string by hand. I'd like `Requirement` to support `__replace__`, so that `copy.replace()` works on Python 3.13+ and I can call it directly on older versions:
> 
> ```python
> >>> r = Requirement('requests[security]>=2.0; python_version >= "3"')
> >>> r.__replace__(name="flask")
> <Requirement('flask[security]>=2.0; python_version >= "3"')>
> >>> copy.replace(Requirement("requests>=2.0"), specifier=SpecifierSet(">=3.0"))
> <Requirement('requests>=3.0')>
> ```
> 
> What I expect:
> 
> - `__replace__` takes only keyword arguments: `name`, `url`, `extras`, `specifier` and `marker`, the same fields a `Requirement` has. Any other keyword raises `TypeError`.
> - It returns a new requirement; fields I don't pass are kept, and the original is left untouched. Calling it with no arguments gives an equal but distinct object.
> - The result must be a valid requirement, the same as what parsing its string would give. Invalid values, such as `name="not a name!"`, raise `InvalidRequirement`. So does a value that would read back as something different, such as `name="foo[bar]"` or `extras={"a,b"}`, rather than silently changing other fields. Values get normalized like parsing does, so `marker=Marker('extra == "Foo_Bar"')` ends up as `extra == "foo-bar"`.
> - A `SpecifierSet` I pass in, or the one carried over, keeps its `prereleases` settings, both on the set and on the individual `Specifier`s in it. The result must not share the `SpecifierSet` or its `Specifier` objects with the input, since those can be mutated.
> - Subclasses of `Requirement` get back an instance of their own class, with whatever their `__init__` sets up.
> 
> Please add this.

## Upstream change (tests left out)

Files: [src/packaging/requirements.py](../../tasks/python-feat-packaging-requirement-replace/upstream/src/packaging/requirements.py), [tests/test_requirements.py](../../tasks/python-feat-packaging-requirement-replace/upstream/tests/test_requirements.py)

```diff
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..22f3b4d 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -3,7 +3,10 @@
 # for complete details.
 from __future__ import annotations
 
-from typing import TYPE_CHECKING
+import builtins
+import copy
+import sys
+from typing import TYPE_CHECKING, Any
 
 from ._parser import parse_requirement as _parse_requirement
 from ._tokenizer import ParserSyntaxError
@@ -14,6 +17,8 @@ from .utils import canonicalize_name
 if TYPE_CHECKING:
     from collections.abc import Iterator
 
+    from typing_extensions import Self
+
 __all__ = [
     "InvalidRequirement",
     "Requirement",
@@ -24,6 +29,11 @@ def __dir__() -> list[str]:
     return __all__
 
 
+# Sentinel for __replace__, typed as Any so it can be the default for any field.
+# mypy is missing sentinel currently
+_UNSET: Any = object() if sys.version_info < (3, 15) else builtins.sentinel("_UNSET")  # type: ignore[attr-defined]
+
+
 class InvalidRequirement(ValueError):
     """
     Raised when attempting to create a :class:`Requirement` with a string that
@@ -71,6 +81,10 @@ class Requirement:
         equivalent specifiers. The string representation still preserves the
         parsed name and extras spelling.
 
+    .. versionchanged:: 26.4
+
+        Added ``__replace__``, enabling :func:`copy.replace` on Python 3.13+.
+
     :param str requirement_string: The string representation of a requirement.
     :raises InvalidRequirement: If the given ``requirement_string`` is not
         parseable, then this exception will be raised.
@@ -106,6 +120,45 @@ class Requirement:
             self.marker = Marker.__new__(Marker)
             self.marker._markers = _normalize_extra_values(parsed.marker)
 
+    def __replace__(
+        self,
+        *,
+        name: str = _UNSET,
+        url: str | None = _UNSET,
+        extras: set[str] = _UNSET,
+        specifier: SpecifierSet = _UNSET,
+        marker: Marker | None = _UNSET,
+    ) -> Self:
+        """Return a copy with the given fields replaced.
+
+        This also enables :func:`copy.replace` on Python 3.13+. The result is
+        validated and normalized by re-parsing its string form, so invalid
+        replacements raise :exc:`InvalidRequirement`.
+
+        .. versionadded:: 26.4
+        """
+        tmp = Requirement.__new__(Requirement)
+        tmp.name = self.name if name is _UNSET else name
+        tmp.url = self.url if url is _UNSET else url or None
+        tmp.extras = self.extras if extras is _UNSET else extras
+        tmp.specifier = self.specifier if specifier is _UNSET else specifier
+        tmp.marker = self.marker if marker is _UNSET else marker
+
+        result = self.__class__(str(tmp))
+        # A field that parses as something more than itself (for example
+        # ``name="foo[bar]"``) would silently change other fields; reject it.
+        if (
+            result.name != tmp.name
+            or result.url != tmp.url
+            or result.extras != tmp.extras
+        ):
+            raise InvalidRequirement(
+                f"Replacement fields do not round-trip: {str(tmp)!r}"
+            )
+        # Specifiers technically can be mutated, so deep copy needed
+        result.specifier = copy.deepcopy(tmp.specifier)
+        return result
+
     def _iter_parts(self, name: str) -> Iterator[str]:
         yield name
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | **FAIL** | +91/-2 | 92 | 12,590 | $0.310 |
| claude | muffle | pass | +111/-17 | 80 | 8,576 | $0.234 |
| claude | hush | **FAIL** | +64/-1 | 47 | 7,325 | $0.186 |
| claude | sloth | pass | +49/-2 | 0 | 4,603 | $0.129 |
| claude | all | pass | +64/-1 | 0 | 6,374 | $0.183 |
| codex | base | pass | +88/-1 | 106 | 4,297 | - |
| codex | muffle | pass | +76/-0 | 97 | 4,129 | - |
| codex | hush | pass | +73/-0 | 105 | 3,137 | - |
| codex | sloth | pass | +89/-2 | 0 | 3,334 | - |
| codex | all | pass | +77/-2 | 0 | 3,012 | - |

### claude, base: FAIL

Files: [CHANGELOG.rst](../base/claude/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [src/packaging/requirements.py](../base/claude/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py), [tests/test_requirements.py](../base/claude/python-feat-packaging-requirement-replace-1/files/tests/test_requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..5c02482 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,11 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add :meth:`Requirement.__replace__() <packaging.requirements.Requirement.__replace__>`
+  to support :func:`copy.replace` on Python 3.13+.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..9a0e9df 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -8,11 +8,12 @@ from typing import TYPE_CHECKING
 from ._parser import parse_requirement as _parse_requirement
 from ._tokenizer import ParserSyntaxError
 from .markers import Marker, _normalize_extra_values
-from .specifiers import InvalidSpecifier, SpecifierSet
+from .specifiers import InvalidSpecifier, Specifier, SpecifierSet
 from .utils import canonicalize_name
+from .version import _UNSET
 
 if TYPE_CHECKING:
-    from collections.abc import Iterator
+    from collections.abc import Iterable, Iterator
 
 __all__ = [
     "InvalidRequirement",
@@ -71,6 +72,13 @@ class Requirement:
         equivalent specifiers. The string representation still preserves the
         parsed name and extras spelling.
 
+    Use :meth:`__replace__` (or :func:`copy.replace` on Python 3.13+) to make a
+    copy with some fields changed.
+
+    .. versionchanged:: 26.4
+
+        Added :meth:`__replace__`.
+
     :param str requirement_string: The string representation of a requirement.
     :raises InvalidRequirement: If the given ``requirement_string`` is not
         parseable, then this exception will be raised.
@@ -124,6 +132,82 @@ class Requirement:
         if self.marker:
             yield f"; {self.marker}"
 
+    def __replace__(
+        self,
+        *,
+        name: str = _UNSET,
+        url: str | None = _UNSET,
+        extras: Iterable[str] = _UNSET,
+        specifier: SpecifierSet = _UNSET,
+        marker: Marker | None = _UNSET,
+    ) -> Requirement:
+        """Return a copy of this requirement with the given fields replaced.
+
+        Fields that are not passed are kept. The result is validated as if its
+        string form had been parsed, and is an instance of ``type(self)``.
+
+        :raises InvalidRequirement: If the result is not a valid requirement,
+            or a value would not read back unchanged (for example
+            ``name="foo[bar]"``).
+
+        .. versionadded:: 26.4
+        """
+        if name is _UNSET:
+            name = self.name
+        if url is _UNSET:
+            url = self.url
+        if extras is _UNSET:
+            extras = self.extras
+        if specifier is _UNSET:
+            specifier = self.specifier
+        if marker is _UNSET:
+            marker = self.marker
+
+        if not isinstance(name, str):
+            raise InvalidRequirement(f"name must be a str, not {name!r}")
+        if url is not None and (not isinstance(url, str) or not url):
+            raise InvalidRequirement(f"url must be a non-empty str or None: {url!r}")
+        if isinstance(extras, str) or not all(isinstance(e, str) for e in extras):
+            raise InvalidRequirement(f"extras must be an iterable of str: {extras!r}")
+        if not isinstance(specifier, SpecifierSet):
+            raise InvalidRequirement(f"specifier must be a SpecifierSet: {specifier!r}")
+        if marker is not None and not isinstance(marker, Marker):
+            raise InvalidRequirement(f"marker must be a Marker or None: {marker!r}")
+
+        extras = set(extras)
+        # Copy the specifiers so nothing is shared with the input, keeping the
+        # explicit prereleases overrides.
+        new_specifier = SpecifierSet(
+            [Specifier(str(s), prereleases=s._prereleases) for s in specifier._specs],
+            prereleases=specifier._prereleases,
+        )
+        expected_marker = (
+            None
+            if marker is None
+            else Marker._from_markers(_normalize_extra_values(marker._markers))
+        )
+
+        # Parse the string form, which validates the result and builds an
+        # instance through the (sub)class's own __init__.
+        tmp = self.__class__.__new__(self.__class__)
+        tmp.name, tmp.url, tmp.extras = name, url, extras
+        tmp.specifier, tmp.marker = new_specifier, expected_marker
+        new = self.__class__(str(tmp))
+
+        # Reject values that would read back as something different.
+        if (
+            new.name != name
+            or new.url != url
+            or new.extras != extras
+            or str(new.specifier) != str(new_specifier)
+            or (new.marker is None) != (expected_marker is None)
+            or (new.marker is not None and str(new.marker) != str(expected_marker))
+        ):
+            raise InvalidRequirement(f"Cannot represent {str(tmp)!r} unchanged")
+
+        new.specifier = new_specifier
+        return new
+
     def __getstate__(self) -> tuple[str, bool | None]:
         # Return the requirement string for compactness and stability, paired
         # with the specifier's explicit prereleases override, which is not
diff --git a/tests/test_requirements.py b/tests/test_requirements.py
index ad78c2b..6667e5b 100644
--- a/tests/test_requirements.py
+++ b/tests/test_requirements.py
@@ -5,6 +5,7 @@
 from __future__ import annotations
 
 import pickle
+import sys
 
 import pytest
 
@@ -1085,3 +1086,94 @@ def test_pickle_requirement_25_0_format_loads() -> None:
     assert str(r.specifier) == ">=2.0"
     assert r.marker is None
     assert r == Requirement("requests>=2.0")
+
+
+class TestRequirementReplace:
+    def test_replace_fields(self) -> None:
+        r = Requirement('requests[security]>=2.0; python_version >= "3"')
+        assert str(r.__replace__(name="flask")) == (
+            'flask[security]>=2.0; python_version >= "3"'
+        )
+        assert str(r) == 'requests[security]>=2.0; python_version >= "3"'
+        assert r.__replace__(marker=None).marker is None
+        assert r.__replace__(extras={"a"}).extras == {"a"}
+        u = r.__replace__(specifier=SpecifierSet(), url="https://x/y.whl")
+        assert u.url == "https://x/y.whl"
+
+    def test_no_args(self) -> None:
+        r = Requirement("a>=1")
+        c = r.__replace__()
+        assert c == r
+        assert c is not r
+        assert c.specifier is not r.specifier
+
+    def test_unknown_keyword(self) -> None:
+        with pytest.raises(TypeError):
+            Requirement("a").__replace__(foo=1)  # type: ignore[call-arg]
+        with pytest.raises(TypeError):
+            Requirement("a").__replace__("b")  # type: ignore[misc]
+
+    @pytest.mark.parametrize(
+        "kwargs",
+        [
+            {"name": "not a name!"},
+            {"name": "foo[bar]"},
+            {"name": "foo "},
+            {"extras": {"a,b"}},
+            {"extras": "ab"},
+            {"url": "http://x y"},
+            {"url": "http://x ; python_version > '3'"},
+            {"url": ""},
+            {"specifier": ">=1"},
+            {"marker": "os_name == 'a'"},
+        ],
+    )
+    def test_invalid(self, kwargs: dict[str, object]) -> None:
+        with pytest.raises(InvalidRequirement):
+            Requirement("a").__replace__(**kwargs)  # type: ignore[arg-type]
+
+    def test_url_with_specifier_invalid(self) -> None:
+        with pytest.raises(InvalidRequirement):
+            Requirement("a @ http://x/y").__replace__(specifier=SpecifierSet(">=1"))
+
+    def test_marker_normalized(self) -> None:
+        r = Requirement("a").__replace__(marker=Marker('extra == "Foo_Bar"'))
+        assert str(r.marker) == 'extra == "foo-bar"'
+
+    def test_prereleases_kept_and_not_shared(self) -> None:
+        spec = SpecifierSet(">=1,<3", prereleases=True)
+        next(s for s in spec._specs if str(s) == ">=1").prereleases = False
+
+        def flags(ss: SpecifierSet) -> dict[str, bool | None]:
+            return {str(s): s._prereleases for s in ss._specs}
+
+        r = Requirement("a").__replace__(specifier=spec)
+        assert r.specifier._prereleases is True
+        assert flags(r.specifier) == {">=1": False, "<3": None}
+        assert r.specifier is not spec
+        assert not {id(s) for s in r.specifier._specs} & {id(s) for s in spec._specs}
+        c = r.__replace__()
+        assert c.specifier._prereleases is True
+        assert flags(c.specifier) == {">=1": False, "<3": None}
+        assert not {id(s) for s in c.specifier._specs} & {
+            id(s) for s in r.specifier._specs
+        }
+
+    def test_subclass(self) -> None:
+        class Sub(Requirement):
+            __slots__ = ("extra_attr",)
+
+            def __init__(self, s: str) -> None:
+                super().__init__(s)
+                self.extra_attr = 1
+
+        c = Sub("a").__replace__(name="b")
+        assert type(c) is Sub
+        assert c.extra_attr == 1
+
+    @pytest.mark.skipif(sys.version_info < (3, 13), reason="copy.replace is 3.13+")
+    def test_copy_replace(self) -> None:
+        import copy
+
+        r = copy.replace(Requirement("requests>=2.0"), specifier=SpecifierSet(">=3.0"))  # type: ignore[attr-defined]
+        assert str(r) == "requests>=3.0"
```

</details>

<details><summary>reply</summary>

Fixing a missing `import sys` in the tests, then re-running.

I added `Requirement.__replace__` in `src/packaging/requirements.py`. It takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`, and any other keyword raises `TypeError`. The new tests pass, along with the rest of `test_requirements.py`, `test_specifiers.py` and `test_markers.py` (9724 passed). I ran those against `src` with `PYTHONPATH=src`, because the default environment imports an older installed `packaging` that has no `__replace__`.

I couldn't run the full suite. With `PYTHONPATH=src`, collecting `tests/` fails with 15 collection errors, starting at `tests/test_pylock.py`. I didn't look into them. Without `PYTHONPATH`, the same 15 failures show up with my changes stashed, so they predate this work.

- **Validation:** the replacement is built and run through the parser, so it is valid exactly when parsing its string form would succeed. Values that would read back differently raise `InvalidRequirement`: `name="foo[bar]"`, `name="foo "`, `extras={"a,b"}`, or a url containing `; marker`.
- **Normalisation:** markers are normalised, so `marker=Marker('extra == "Foo_Bar"')` becomes `extra == "foo-bar"`.
- **Specifiers:** the specifier is always copied, including each `Specifier`, with the `prereleases` settings kept on the set and on the individual specifiers. The input and the original are never shared with the result or mutated.
- **Subclasses:** the result is built through `type(self)(string)`, so a subclass gets its own class and whatever its `__init__` sets up. This assumes the subclass `__init__` takes just the requirement string.

Some choices you didn't specify:
- `url=""` is rejected rather than treated as `None`.
- A bare string for `extras`, or a value of the wrong type, raises `InvalidRequirement`, not `TypeError`.
- A url together with a non-empty specifier is rejected, because the parser doesn't allow that combination.

I added a `TestRequirementReplace` class to `tests/test_requirements.py`, and a changelog entry and docstring notes marked "26.4". That version number is my guess, so please change it if the release will be numbered differently. I didn't commit anything.

</details>

### claude, muffle: pass

Files: [CHANGELOG.rst](../muffle/claude/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [docs/requirements.rst](../muffle/claude/python-feat-packaging-requirement-replace-1/files/docs/requirements.rst), [src/packaging/requirements.py](../muffle/claude/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py), [tests/test_requirements.py](../muffle/claude/python-feat-packaging-requirement-replace-1/files/tests/test_requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..fb268ee 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,11 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add :meth:`Requirement.__replace__() <packaging.requirements.Requirement.__replace__>`,
+  supporting :func:`copy.replace` on Python 3.13+.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/docs/requirements.rst b/docs/requirements.rst
index fede671..58c549a 100644
--- a/docs/requirements.rst
+++ b/docs/requirements.rst
@@ -60,6 +60,9 @@ Usage
     >>> requirements2 = {Requirement("pip"), Requirement("packaging")}
     >>> requirements1 == requirements2
     True
+    >>> # A modified copy can be made with __replace__ (or copy.replace on 3.13+):
+    >>> Requirement("requests[security]>=2.0").__replace__(name="flask")
+    <Requirement('flask[security]>=2.0')>
 
 .. versionchanged:: 23.2
 
@@ -74,4 +77,5 @@ Reference
 
 .. automodule:: packaging.requirements
     :members:
+    :special-members: __replace__
     :exclude-members: __init__, __new__
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..df79a48 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -3,16 +3,16 @@
 # for complete details.
 from __future__ import annotations
 
-from typing import TYPE_CHECKING
+from typing import TYPE_CHECKING, Any
 
 from ._parser import parse_requirement as _parse_requirement
 from ._tokenizer import ParserSyntaxError
 from .markers import Marker, _normalize_extra_values
-from .specifiers import InvalidSpecifier, SpecifierSet
+from .specifiers import InvalidSpecifier, Specifier, SpecifierSet
 from .utils import canonicalize_name
 
 if TYPE_CHECKING:
-    from collections.abc import Iterator
+    from collections.abc import Iterable, Iterator
 
 __all__ = [
     "InvalidRequirement",
@@ -24,6 +24,43 @@ def __dir__() -> list[str]:
     return __all__
 
 
+_MISSING: Any = object()
+
+
+def _copy_specifier_set(specifier: SpecifierSet) -> SpecifierSet:
+    """Copy a specifier set and its specifiers, keeping ``prereleases``."""
+    specs = [
+        Specifier(str(s), prereleases=getattr(s, "_prereleases", None))
+        for s in specifier._specs
+    ]
+    return SpecifierSet(specs, prereleases=specifier._prereleases)
+
+
+def _iter_parts(
+    name: str,
+    extras: Iterable[str],
+    specifier: SpecifierSet,
+    url: str | None,
+    marker: Marker | None,
+) -> Iterator[str]:
+    yield name
+
+    if extras:
+        formatted_extras = ",".join(sorted(extras))
+        yield f"[{formatted_extras}]"
+
+    if specifier:
+        yield str(specifier)
+
+    if url:
+        yield f" @ {url}"
+        if marker:
+            yield " "
+
+    if marker:
+        yield f"; {marker}"
+
+
 class InvalidRequirement(ValueError):
     """
     Raised when attempting to create a :class:`Requirement` with a string that
@@ -106,23 +143,71 @@ class Requirement:
             self.marker = Marker.__new__(Marker)
             self.marker._markers = _normalize_extra_values(parsed.marker)
 
-    def _iter_parts(self, name: str) -> Iterator[str]:
-        yield name
-
-        if self.extras:
-            formatted_extras = ",".join(sorted(self.extras))
-            yield f"[{formatted_extras}]"
+    def __replace__(
+        self,
+        *,
+        name: str = _MISSING,
+        url: str | None = _MISSING,
+        extras: Iterable[str] = _MISSING,
+        specifier: SpecifierSet = _MISSING,
+        marker: Marker | None = _MISSING,
+    ) -> Requirement:
+        """Return a copy with the given fields replaced.
+
+        Supports :func:`copy.replace` on Python 3.13+. Fields that are not
+        given are kept. The result does not share mutable state with ``self``
+        or the arguments, and is validated and normalized as if its string
+        form had been parsed.
+
+        :raises InvalidRequirement: If the result is not a valid requirement,
+            or would parse back differently than the values given.
+        """
+        if name is _MISSING:
+            name = self.name
+        if url is _MISSING:
+            url = self.url
+        if extras is _MISSING:
+            extras = self.extras
+        elif isinstance(extras, str):
+            raise TypeError("extras must be an iterable of strings, not a string")
+        extras = set(extras)
+        if specifier is _MISSING:
+            specifier = self.specifier
+        elif isinstance(specifier, str):
+            specifier = SpecifierSet(specifier)
+        if marker is _MISSING:
+            marker = self.marker
+
+        if not isinstance(name, str):
+            raise InvalidRequirement(f"Invalid name: {name!r}")
+        if url is not None and not isinstance(url, str):
+            raise InvalidRequirement(f"Invalid url: {url!r}")
+        if not all(isinstance(e, str) for e in extras):
+            raise InvalidRequirement(f"Invalid extras: {extras!r}")
 
-        if self.specifier:
-            yield str(self.specifier)
+        try:
+            new_specifier = _copy_specifier_set(specifier)
+        except InvalidSpecifier as e:
+            raise InvalidRequirement(str(e)) from e
 
-        if self.url:
-            yield f" @ {self.url}"
-            if self.marker:
-                yield " "
+        # Round-trip through the string form, so the result is exactly what
+        # parsing would give, then reject anything that parsed differently.
+        text = "".join(_iter_parts(name, extras, new_specifier, url, marker))
+        new = type(self)(text)
+        if (
+            new.name != name
+            or new.url != url
+            or new.extras != extras
+            or (new.marker is None) != (marker is None)
+        ):
+            raise InvalidRequirement(
+                f"Replacement values do not form a valid requirement: {text!r}"
+            )
+        new.specifier = new_specifier
+        return new
 
-        if self.marker:
-            yield f"; {self.marker}"
+    def _iter_parts(self, name: str) -> Iterator[str]:
+        return _iter_parts(name, self.extras, self.specifier, self.url, self.marker)
 
     def __getstate__(self) -> tuple[str, bool | None]:
         # Return the requirement string for compactness and stability, paired
diff --git a/tests/test_requirements.py b/tests/test_requirements.py
index ad78c2b..4e4e299 100644
--- a/tests/test_requirements.py
+++ b/tests/test_requirements.py
@@ -4,6 +4,7 @@
 
 from __future__ import annotations
 
+import copy
 import pickle
 
 import pytest
@@ -1085,3 +1086,82 @@ def test_pickle_requirement_25_0_format_loads() -> None:
     assert str(r.specifier) == ">=2.0"
     assert r.marker is None
     assert r == Requirement("requests>=2.0")
+
+
+class TestRequirementReplace:
+    def test_example(self) -> None:
+        r = Requirement('requests[security]>=2.0; python_version >= "3"')
+        assert str(r.__replace__(name="flask")) == (
+            'flask[security]>=2.0; python_version >= "3"'
+        )
+
+    def test_no_args_equal_distinct(self) -> None:
+        r = Requirement("a[x]>=1; os_name == 'a'")
+        n = r.__replace__()
+        assert n == r
+        assert n is not r
+        assert n.specifier is not r.specifier
+        assert n.extras is not r.extras
+
+    def test_copy_replace(self) -> None:
+        if not hasattr(copy, "replace"):
+            pytest.skip("needs Python 3.13+")
+        n = copy.replace(Requirement("requests>=2.0"), specifier=SpecifierSet(">=3.0"))
+        assert str(n) == "requests>=3.0"
+
+    def test_unknown_keyword(self) -> None:
+        with pytest.raises(TypeError):
+            Requirement("a").__replace__(foo=1)  # type: ignore[call-arg]
+
+    def test_clear_url_and_marker(self) -> None:
+        r = Requirement("a @ http://x/y ; os_name == 'a'")
+        n = r.__replace__(url=None, marker=None)
+        assert str(n) == "a"
+        assert str(r) == 'a @ http://x/y ; os_name == "a"'
+
+    @pytest.mark.parametrize(
+        "kwargs",
+        [
+            {"name": "not a name!"},
+            {"name": "foo[bar]"},
+            {"name": ""},
+            {"extras": {"a,b"}},
+            {"extras": {"a b"}},
+            {"url": "http://x ; os_name == 'a'"},
+            {"url": ""},
+        ],
+    )
+    def test_invalid(self, kwargs: dict[str, object]) -> None:
+        with pytest.raises(InvalidRequirement):
+            Requirement("a").__replace__(**kwargs)  # type: ignore[arg-type]
+
+    def test_marker_normalized(self) -> None:
+        n = Requirement("a").__replace__(marker=Marker('extra == "Foo_Bar"'))
+        assert str(n) == 'a; extra == "foo-bar"'
+        assert n.marker is not None
+
+    def test_prereleases_preserved_and_not_shared(self) -> None:
+        spec = SpecifierSet(">=1,<3", prereleases=True)
+        list(spec)[0].prereleases = False
+        r = Requirement("a")
+        n = r.__replace__(specifier=spec)
+        assert n.specifier is not spec
+        assert n.specifier._prereleases is True
+        assert {str(s): s._prereleases for s in n.specifier} == {
+            ">=1": False,
+            "<3": None,
+        }
+        assert all(a is not b for a in n.specifier for b in spec)
+        again = n.__replace__(name="b")
+        assert again.specifier._prereleases is True
+        assert again.specifier is not n.specifier
+
+    def test_subclass(self) -> None:
+        class Sub(Requirement):
+            def __init__(self, s: str) -> None:
+                super().__init__(s)
+                self.extra_state = 1
+
+        n = Sub("a").__replace__(name="b")
+        assert type(n) is Sub
+        assert n.extra_state == 1
```

</details>

<details><summary>reply</summary>

Adding the missing `copy` import to the tests, then running them.

Tests are importing an installed copy; use the source tree.

`Requirement.__replace__` is added, so `copy.replace()` works on 3.13+ and you can call it directly on older versions. The requirements, markers and specifiers tests pass (9721) and mypy is clean on `requirements.py`. I didn't run the rest of the suite, and I didn't build the docs. The tests only import this checkout when run with `PYTHONPATH=src`. Without it they pick up the installed `packaging` and fail with `AttributeError`.

- **Arguments:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`, and anything else raises `TypeError`. Passing `url=None` or `marker=None` clears that field.
- **Building the result:** it builds the requirement string from the final values and parses it with `type(self)(...)`. So the result is what parsing gives, values are normalized (`extra == "foo-bar"`), and a subclass gets back its own class with its own `__init__` run.
- **Round-trip check:** after parsing, it compares `name`, `url`, `extras` and whether there is a marker against what you passed. A mismatch raises `InvalidRequirement`, which covers `name="foo[bar]"`, `extras={"a,b"}`, `url="http://x ; os_name == 'a'"` and `url=""`.
- **Specifiers:** the specifier set and each `Specifier` are copied with their `prereleases` settings, so nothing is shared with the input.
- **Extras:** I made a plain string for `extras` raise `TypeError`, because it would otherwise be split into characters.
- **Subclass signature:** a subclass whose `__init__` doesn't take a single requirement string won't work with this.

I moved the string-building logic out of `Requirement._iter_parts` into a module-level function so `__replace__` can reuse it, and the method now just calls it. I also added tests in `tests/test_requirements.py`, a docs example and `:special-members: __replace__` in `docs/requirements.rst`, and a changelog entry. I haven't committed anything.

</details>

### claude, hush: FAIL

Files: [CHANGELOG.rst](../hush/claude/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [src/packaging/requirements.py](../hush/claude/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py), [tests/test_requirements.py](../hush/claude/python-feat-packaging-requirement-replace-1/files/tests/test_requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..c587d48 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,10 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add ``Requirement.__replace__``, supporting :func:`copy.replace` on Python 3.13+.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..1beb238 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -3,7 +3,8 @@
 # for complete details.
 from __future__ import annotations
 
-from typing import TYPE_CHECKING
+import copy
+from typing import TYPE_CHECKING, Any
 
 from ._parser import parse_requirement as _parse_requirement
 from ._tokenizer import ParserSyntaxError
@@ -106,6 +107,64 @@ class Requirement:
             self.marker = Marker.__new__(Marker)
             self.marker._markers = _normalize_extra_values(parsed.marker)
 
+    def __replace__(self, /, **changes: Any) -> Requirement:
+        """Return a copy of this requirement with the given fields replaced.
+
+        Accepts only the keyword arguments ``name``, ``url``, ``extras``,
+        ``specifier`` and ``marker``. The result is validated like a parsed
+        requirement string.
+
+        :raises TypeError: On an unknown keyword argument.
+        :raises InvalidRequirement: If the resulting requirement is invalid or
+            would not read back as the given values.
+
+        .. versionadded:: 26.3
+        """
+        unknown = changes.keys() - set(self.__slots__)
+        if unknown:
+            raise TypeError(
+                f"__replace__() got an unexpected keyword argument {sorted(unknown)[0]!r}"
+            )
+
+        name = changes.get("name", self.name)
+        url = changes.get("url", self.url) or None
+        extras = changes.get("extras", self.extras)
+        specifier = changes.get("specifier", self.specifier)
+        marker = changes.get("marker", self.marker)
+
+        if not isinstance(name, str):
+            raise InvalidRequirement(f"Invalid name: {name!r}")
+        if url is not None and not isinstance(url, str):
+            raise InvalidRequirement(f"Invalid url: {url!r}")
+        if isinstance(extras, str):
+            raise InvalidRequirement(f"Invalid extras: {extras!r}")
+        extras = set(extras)
+        if not all(isinstance(e, str) for e in extras):
+            raise InvalidRequirement(f"Invalid extras: {extras!r}")
+        if not isinstance(specifier, SpecifierSet):
+            raise InvalidRequirement(f"Invalid specifier: {specifier!r}")
+        if marker is not None and not isinstance(marker, Marker):
+            raise InvalidRequirement(f"Invalid marker: {marker!r}")
+
+        # Build via the string form so validation and normalization match
+        # parsing, and subclasses run their own __init__.
+        tmp = copy.copy(self)
+        tmp.name, tmp.url, tmp.extras = name, url, extras
+        tmp.specifier, tmp.marker = specifier, marker
+        result = type(self)(str(tmp))
+
+        if result.name != name or result.url != url or result.extras != extras:
+            raise InvalidRequirement(
+                f"Replacement values do not round-trip: {str(tmp)!r}"
+            )
+
+        # Copy the specifier set and its specifiers, keeping prereleases.
+        result.specifier = SpecifierSet(
+            tuple(copy.copy(s) for s in specifier._specs),
+            prereleases=specifier._prereleases,
+        )
+        return result
+
     def _iter_parts(self, name: str) -> Iterator[str]:
         yield name
 
diff --git a/tests/test_requirements.py b/tests/test_requirements.py
index ad78c2b..769ace9 100644
--- a/tests/test_requirements.py
+++ b/tests/test_requirements.py
@@ -1085,3 +1085,50 @@ def test_pickle_requirement_25_0_format_loads() -> None:
     assert str(r.specifier) == ">=2.0"
     assert r.marker is None
     assert r == Requirement("requests>=2.0")
+
+
+class TestRequirementReplace:
+    def test_replace_name_and_specifier(self) -> None:
+        r = Requirement('requests[security]>=2.0; python_version >= "3"')
+        new = r.__replace__(name="flask", specifier=SpecifierSet(">=3.0"))
+        assert str(new) == 'flask[security]>=3.0; python_version >= "3"'
+        assert str(r) == 'requests[security]>=2.0; python_version >= "3"'
+
+    def test_no_args_equal_distinct(self) -> None:
+        r = Requirement("a>=1")
+        new = r.__replace__()
+        assert new == r
+        assert new is not r
+        assert new.specifier is not r.specifier
+
+    @pytest.mark.parametrize(
+        "kwargs", [{"name": "foo[bar]"}, {"name": "x y!"}, {"extras": {"a,b"}}]
+    )
+    def test_invalid(self, kwargs: dict[str, object]) -> None:
+        with pytest.raises(InvalidRequirement):
+            Requirement("a").__replace__(**kwargs)
+
+    def test_unknown_keyword(self) -> None:
+        with pytest.raises(TypeError):
+            Requirement("a").__replace__(foo=1)
+
+    def test_prereleases_kept_and_unshared(self) -> None:
+        ss = SpecifierSet(">=1,<2", prereleases=True)
+        new = Requirement("a").__replace__(specifier=ss)
+        assert new.specifier.prereleases is True
+        assert new.specifier is not ss
+        assert not {id(s) for s in new.specifier} & {id(s) for s in ss}
+
+    def test_marker_normalized(self) -> None:
+        new = Requirement("a").__replace__(marker=Marker('extra == "Foo_Bar"'))
+        assert str(new.marker) == 'extra == "foo-bar"'
+
+    def test_subclass(self) -> None:
+        class Sub(Requirement):
+            def __init__(self, s: str) -> None:
+                super().__init__(s)
+                self.extra_attr = 1
+
+        new = Sub("a").__replace__(name="b")
+        assert type(new) is Sub
+        assert new.extra_attr == 1
```

</details>

<details><summary>reply</summary>

Checking whether the 24 failures predate my change.

Pytest imports an installed copy, not `src`. Rerunning with `PYTHONPATH=src`.

Done. `Requirement.__replace__` added in `src/packaging/requirements.py`, with a changelog entry and 9 tests. With `PYTHONPATH=src`, all 5359 tests in `tests/test_requirements.py` pass.

Without `PYTHONPATH=src`, pytest imports the installed `packaging` copy, not `src`. Against that copy, 15 tests failed before my change, and I didn't look into why.

Not checked: `copy.replace()` itself (the runtime is Python 3.14, but I only called `__replace__` directly), lint and type checks, and the docs page.

</details>

### claude, sloth: pass

Files: [CHANGELOG.rst](../sloth/claude/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [src/packaging/requirements.py](../sloth/claude/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..fb268ee 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,11 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add :meth:`Requirement.__replace__() <packaging.requirements.Requirement.__replace__>`,
+  supporting :func:`copy.replace` on Python 3.13+.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..b2677e2 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -3,12 +3,12 @@
 # for complete details.
 from __future__ import annotations
 
-from typing import TYPE_CHECKING
+from typing import TYPE_CHECKING, Any
 
 from ._parser import parse_requirement as _parse_requirement
 from ._tokenizer import ParserSyntaxError
 from .markers import Marker, _normalize_extra_values
-from .specifiers import InvalidSpecifier, SpecifierSet
+from .specifiers import InvalidSpecifier, Specifier, SpecifierSet
 from .utils import canonicalize_name
 
 if TYPE_CHECKING:
@@ -71,6 +71,11 @@ class Requirement:
         equivalent specifiers. The string representation still preserves the
         parsed name and extras spelling.
 
+    .. versionchanged:: 26.4
+
+        Added :meth:`__replace__`, so :func:`copy.replace` works on
+        Python 3.13+.
+
     :param str requirement_string: The string representation of a requirement.
     :raises InvalidRequirement: If the given ``requirement_string`` is not
         parseable, then this exception will be raised.
@@ -124,6 +129,43 @@ class Requirement:
         if self.marker:
             yield f"; {self.marker}"
 
+    def __replace__(self, /, **changes: Any) -> Requirement:
+        """Return a copy with the given fields replaced.
+
+        Accepts the keyword arguments ``name``, ``url``, ``extras``,
+        ``specifier`` and ``marker``. The result is validated and normalized as
+        if its string form had been parsed. The specifier is copied, keeping the
+        ``prereleases`` settings of the set and of each of its specifiers.
+
+        :raises TypeError: On an unknown keyword argument.
+        :raises InvalidRequirement: If the resulting requirement is invalid, or
+            a value would be read back as something different.
+        """
+        unknown = changes.keys() - set(self.__slots__)
+        if unknown:
+            raise TypeError(f"Unexpected replace arguments: {sorted(unknown)}")
+        fields = {key: changes.get(key, getattr(self, key)) for key in self.__slots__}
+
+        draft = Requirement.__new__(Requirement)
+        for key, value in fields.items():
+            setattr(draft, key, value)
+        result = type(self)(str(draft))
+
+        if (
+            result.name != fields["name"]
+            or result.url != (fields["url"] or None)
+            or result.extras != set(fields["extras"])
+            or result.specifier != fields["specifier"]
+        ):
+            raise InvalidRequirement(f"Replacement values are inconsistent: {draft}")
+
+        source: SpecifierSet = fields["specifier"]
+        result.specifier = SpecifierSet(
+            [Specifier(str(spec), spec._prereleases) for spec in source._specs],
+            source._prereleases,
+        )
+        return result
+
     def __getstate__(self) -> tuple[str, bool | None]:
         # Return the requirement string for compactness and stability, paired
         # with the specifier's explicit prereleases override, which is not
```

</details>

<details><summary>reply</summary>

I added `Requirement.__replace__` in `src/packaging/requirements.py`, plus a changelog entry. It works on any Python version, and `copy.replace()` calls it on 3.13+. The existing `tests/test_requirements.py` passes. I also ran a few checks by hand and they gave the results below. I didn't add tests to the repo, since you didn't ask for them.

- **Keywords:** it accepts only `name`, `url`, `extras`, `specifier` and `marker`. Any other keyword raises `TypeError`.
- **Result:** it returns a new requirement and leaves the original untouched. Calling it with no arguments gives an equal but distinct object.
- **Validation:** it builds the requirement string and parses it, which raises `InvalidRequirement` for invalid values. It then compares the parsed `name`, `url`, `extras` and `specifier` with what you passed. So `name="foo[bar]"`, `extras={"a,b"}` and a URL containing `; marker` raise instead of silently changing other fields.
- **Normalization:** `marker=Marker('extra == "Foo_Bar"')` comes out as `extra == "foo-bar"`.
- **Specifier:** the result gets a new `SpecifierSet` holding new `Specifier` objects. The `prereleases` settings carry over on both the set and each specifier. The specifier objects are not shared with the input. I confirmed this with a set that had `prereleases=False` and a specifier with `prereleases=True`.
- **Subclasses:** the result is built with `type(self)(string)`, so a subclass gets its own class and its `__init__` runs. A subclass whose `__init__` takes anything other than the requirement string would need its own `__replace__`.

Setting a `url` on a requirement that has a specifier, as in your `requests>=2.0` example, raises `InvalidRequirement`. A requirement can't have both a URL and a specifier. To add a URL, clear the specifier in the same call: `specifier=SpecifierSet()`.

The changelog entry and the `versionchanged:: 26.4` note in the class docstring assume the next release is 26.4. I guessed that number, so please check it.

I haven't committed anything.

</details>

### claude, all: pass

Files: [CHANGELOG.rst](../all/claude/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [src/packaging/requirements.py](../all/claude/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..25c7849 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -8,6 +8,10 @@ Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
 
+Features:
+
+* Add ``Requirement.__replace__`` so :func:`copy.replace` works on Python 3.13+.
+
 26.3 - 2026-08-03
 ~~~~~~~~~~~~~~~~~
 
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..ce51d4a 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -3,6 +3,7 @@
 # for complete details.
 from __future__ import annotations
 
+import copy
 from typing import TYPE_CHECKING
 
 from ._parser import parse_requirement as _parse_requirement
@@ -12,7 +13,9 @@ from .specifiers import InvalidSpecifier, SpecifierSet
 from .utils import canonicalize_name
 
 if TYPE_CHECKING:
-    from collections.abc import Iterator
+    from collections.abc import Iterable, Iterator
+
+    from typing_extensions import Self
 
 __all__ = [
     "InvalidRequirement",
@@ -24,6 +27,13 @@ def __dir__() -> list[str]:
     return __all__
 
 
+class _Unset:
+    """Type of the sentinel for fields not passed to ``__replace__``."""
+
+
+_UNSET = _Unset()
+
+
 class InvalidRequirement(ValueError):
     """
     Raised when attempting to create a :class:`Requirement` with a string that
@@ -124,6 +134,55 @@ class Requirement:
         if self.marker:
             yield f"; {self.marker}"
 
+    def __replace__(
+        self,
+        *,
+        name: str | _Unset = _UNSET,
+        url: str | None | _Unset = _UNSET,
+        extras: Iterable[str] | _Unset = _UNSET,
+        specifier: SpecifierSet | _Unset = _UNSET,
+        marker: Marker | None | _Unset = _UNSET,
+    ) -> Self:
+        """Return a copy with the given fields replaced.
+
+        Fields not passed are kept. The result is validated by parsing its
+        string form, and shares no mutable state with ``self`` or the
+        arguments. Also used by :func:`copy.replace` on Python 3.13+.
+
+        :raises InvalidRequirement: If the result is not a valid requirement,
+            or a value would be read back as something different.
+
+        .. versionadded:: 26.4
+        """
+        new_name = self.name if isinstance(name, _Unset) else name
+        new_url = self.url if isinstance(url, _Unset) else url or None
+        new_extras = self.extras if isinstance(extras, _Unset) else set(extras)
+        new_specifier = self.specifier if isinstance(specifier, _Unset) else specifier
+        new_marker = self.marker if isinstance(marker, _Unset) else marker
+
+        candidate = Requirement.__new__(Requirement)
+        candidate.name = new_name
+        candidate.url = new_url
+        candidate.extras = new_extras
+        candidate.specifier = new_specifier
+        candidate.marker = new_marker
+        result = type(self)("".join(candidate._iter_parts(new_name)))
+
+        if (
+            result.name != new_name
+            or result.url != new_url
+            or result.extras != new_extras
+        ):
+            raise InvalidRequirement(
+                f"Cannot represent replaced fields as a requirement: {candidate}"
+            )
+
+        result.specifier = SpecifierSet(
+            [copy.copy(s) for s in new_specifier],
+            prereleases=new_specifier._prereleases,
+        )
+        return result
+
     def __getstate__(self) -> tuple[str, bool | None]:
         # Return the requirement string for compactness and stability, paired
         # with the specifier's explicit prereleases override, which is not
```

</details>

<details><summary>reply</summary>

Earlier runs imported an installed copy, not `src`. I'm rerunning with `PYTHONPATH=src`.

Done. `Requirement.__replace__` is in `src/packaging/requirements.py`, with a `CHANGELOG.rst` entry. It also works through `copy.replace`.

- **Checked by hand:**
  - Your two examples give the output you showed.
  - Invalid and ambiguous values raise `InvalidRequirement`.
  - Marker values are normalized.
  - The result shares no `SpecifierSet` or `Specifier` with the input, and `prereleases` carries over.
  - A subclass with its own `__init__` gets its own class back, with its `__init__` run.
- **Tests:**
  - The requirements, specifiers and markers tests pass, and mypy is clean.
  - The full suite wasn't run because `hypothesis` isn't installed.
  - I added no tests for `__replace__`.
- **Version:** the docstring and changelog say `versionadded:: 26.4`, which is my guess at the next version.
- **Imports:** run with `PYTHONPATH=src`. Otherwise Python imports an installed `packaging`, which has no `__replace__`.

</details>

### codex, base: pass

Files: [CHANGELOG.rst](../base/codex/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [docs/requirements.rst](../base/codex/python-feat-packaging-requirement-replace-1/files/docs/requirements.rst), [src/packaging/requirements.py](../base/codex/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py), [tests/test_requirements.py](../base/codex/python-feat-packaging-requirement-replace-1/files/tests/test_requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..de7e97a 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,11 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add ``Requirement.__replace__`` to copy requirements with selected fields
+  changed, including support for ``copy.replace`` on Python 3.13 and later.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/docs/requirements.rst b/docs/requirements.rst
index fede671..00b4eb6 100644
--- a/docs/requirements.rst
+++ b/docs/requirements.rst
@@ -72,6 +72,26 @@ Usage
 Reference
 ---------
 
+Use ``__replace__`` to create a requirement with selected fields changed:
+
+.. doctest::
+
+    >>> req = Requirement('requests[security]>=2.0; python_version >= "3"')
+    >>> req.__replace__(name="flask")
+    <Requirement('flask[security]>=2.0; python_version >= "3"')>
+    >>> from packaging.specifiers import SpecifierSet
+    >>> req.__replace__(specifier=SpecifierSet(">=3.0"), marker=None)
+    <Requirement('requests[security]>=3.0')>
+
+On Python 3.13 and later, ``copy.replace(req, name="flask")`` is also supported.
+The accepted fields are ``name``, ``url``, ``extras``, ``specifier`` and
+``marker``, using the same types as the corresponding attributes. Omitted
+fields are retained. The original requirement is unchanged, and mutable
+specifiers are copied with their prerelease settings preserved. Replacements
+are validated and normalized by parsing; invalid fields or combinations raise
+:class:`InvalidRequirement`. Unknown field names raise :class:`TypeError`.
+
 .. automodule:: packaging.requirements
     :members:
+    :special-members: __replace__
     :exclude-members: __init__, __new__
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..a09c99e 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -8,12 +8,14 @@ from typing import TYPE_CHECKING
 from ._parser import parse_requirement as _parse_requirement
 from ._tokenizer import ParserSyntaxError
 from .markers import Marker, _normalize_extra_values
-from .specifiers import InvalidSpecifier, SpecifierSet
+from .specifiers import InvalidSpecifier, Specifier, SpecifierSet
 from .utils import canonicalize_name
 
 if TYPE_CHECKING:
     from collections.abc import Iterator
 
+    from typing_extensions import Self
+
 __all__ = [
     "InvalidRequirement",
     "Requirement",
@@ -106,6 +108,66 @@ class Requirement:
             self.marker = Marker.__new__(Marker)
             self.marker._markers = _normalize_extra_values(parsed.marker)
 
+    def __replace__(self, **changes: object) -> Self:
+        """Return a new requirement with the given fields replaced.
+
+        Accepts ``name``, ``url``, ``extras``, ``specifier`` and ``marker``.
+        Values must have the same types as the corresponding attributes.
+        The result is validated and normalized as if parsed from a string.
+        Specifiers are copied, preserving their prerelease overrides.
+
+        This also supports :func:`copy.replace` on Python 3.13 and later.
+
+        :raises TypeError: If an unknown field is supplied.
+        :raises InvalidRequirement: If the resulting requirement is invalid
+            or cannot represent the requested fields faithfully.
+        """
+        unknown = changes.keys() - Requirement.__slots__
+        if unknown:
+            raise TypeError(f"Unexpected field(s): {', '.join(sorted(unknown))}")
+
+        candidate = Requirement.__new__(Requirement)
+        field_types = {
+            "name": (str,),
+            "url": (str, type(None)),
+            "extras": (set,),
+            "specifier": (SpecifierSet,),
+            "marker": (Marker, type(None)),
+        }
+        for field in Requirement.__slots__:
+            value = changes.get(field, getattr(self, field))
+            if not isinstance(value, field_types[field]):
+                raise InvalidRequirement(f"Invalid value for {field!r}")
+            if (
+                field == "extras"
+                and isinstance(value, set)
+                and not all(isinstance(extra, str) for extra in value)
+            ):
+                raise InvalidRequirement("Invalid extras")
+            setattr(candidate, field, value)
+
+        # Neither stringification nor subsequent mutations should affect the
+        # input specifiers. Keep the individual overrides, including None.
+        specs = tuple(
+            Specifier(str(spec), prereleases=spec._prereleases)
+            for spec in candidate.specifier
+        )
+        prereleases = candidate.specifier._prereleases
+        candidate.specifier = SpecifierSet(specs, prereleases=prereleases)
+        result = type(self)(str(candidate))
+        if (
+            result.name != candidate.name
+            or result.url != candidate.url
+            or result.extras != candidate.extras
+            or str(result.specifier) != str(candidate.specifier)
+            or result.marker
+            != (Marker(str(candidate.marker)) if candidate.marker is not None else None)
+        ):
+            raise InvalidRequirement("Replacement fields do not round-trip")
+
+        result.specifier = SpecifierSet(specs, prereleases=prereleases)
+        return result
+
     def _iter_parts(self, name: str) -> Iterator[str]:
         yield name
 
diff --git a/tests/test_requirements.py b/tests/test_requirements.py
index ad78c2b..3520dd5 100644
--- a/tests/test_requirements.py
+++ b/tests/test_requirements.py
@@ -4,6 +4,7 @@
 
 from __future__ import annotations
 
+import copy
 import pickle
 
 import pytest
@@ -1085,3 +1086,108 @@ def test_pickle_requirement_25_0_format_loads() -> None:
     assert str(r.specifier) == ">=2.0"
     assert r.marker is None
     assert r == Requirement("requests>=2.0")
+
+
+@pytest.mark.parametrize(
+    ("changes", "expected"),
+    [
+        ({}, 'requests[security]>=2.0; python_version >= "3"'),
+        ({"name": "flask"}, 'flask[security]>=2.0; python_version >= "3"'),
+        ({"extras": {"tests"}}, 'requests[tests]>=2.0; python_version >= "3"'),
+        (
+            {"specifier": SpecifierSet(">=3")},
+            'requests[security]>=3; python_version >= "3"',
+        ),
+        ({"marker": None}, "requests[security]>=2.0"),
+        (
+            {"marker": Marker('extra == "Foo_Bar"')},
+            'requests[security]>=2.0; extra == "foo-bar"',
+        ),
+        (
+            {"specifier": SpecifierSet(), "url": "https://example.com/pkg"},
+            'requests[security] @ https://example.com/pkg ; python_version >= "3"',
+        ),
+    ],
+)
+def test_replace(changes: dict[str, object], expected: str) -> None:
+    original = Requirement('requests[security]>=2.0; python_version >= "3"')
+    result = original.__replace__(**changes)
+    assert str(result) == expected
+    assert result == Requirement(str(result))
+    assert result is not original
+    assert str(original) == 'requests[security]>=2.0; python_version >= "3"'
+    assert result.extras is not original.extras
+    assert result.marker is None or result.marker is not original.marker
+
+
+@pytest.mark.parametrize(
+    "changes",
+    [
+        {"name": "not a name!"},
+        {"name": "foo[bar]"},
+        {"name": " foo"},
+        {"extras": {"a,b"}},
+        {"extras": {""}},
+        {"url": ""},
+        {"url": "https://example.com ; os_name == 'posix'"},
+        {"url": "https://example.com"},
+        {"name": None},
+        {"extras": "foo"},
+        {"specifier": ">=3"},
+        {"marker": "os_name == 'posix'"},
+    ],
+)
+def test_replace_invalid(changes: dict[str, object]) -> None:
+    with pytest.raises(InvalidRequirement):
+        Requirement("foo>=2").__replace__(**changes)
+
+
+def test_replace_arguments() -> None:
+    with pytest.raises(TypeError):
+        Requirement("foo").__replace__(unknown="bar")
+    with pytest.raises(TypeError):
+        Requirement("foo").__replace__("bar")  # type: ignore[call-arg]
+
+
+@pytest.mark.parametrize("replace_specifier", [False, True])
+@pytest.mark.parametrize("prereleases", [None, False, True])
+def test_replace_specifier_copy(
+    replace_specifier: bool, prereleases: bool | None
+) -> None:
+    original = Requirement("foo>=1a1,!=2,<4")
+    specifier = (
+        SpecifierSet(">=2a1,!=3,<5") if replace_specifier else original.specifier
+    )
+    specifier.prereleases = prereleases
+    for spec, override in zip(specifier, (None, False, True), strict=True):
+        spec.prereleases = override
+    before = {str(spec): spec._prereleases for spec in specifier}
+    changes = {"specifier": specifier} if replace_specifier else {}
+    result = original.__replace__(**changes)
+    assert result.specifier is not specifier
+    assert result.specifier._prereleases is prereleases
+    assert {str(spec): spec._prereleases for spec in result.specifier} == before
+    assert all(a is not b for a in result.specifier for b in specifier)
+    result.specifier.prereleases = not prereleases
+    for spec in result.specifier:
+        spec.prereleases = not spec.prereleases
+    assert specifier._prereleases is prereleases
+    assert {str(spec): spec._prereleases for spec in specifier} == before
+
+
+def test_replace_subclass() -> None:
+    class CustomRequirement(Requirement):
+        def __init__(self, requirement_string: str) -> None:
+            super().__init__(requirement_string)
+            self.initialized_name = self.name
+
+    result = CustomRequirement("foo").__replace__(name="bar")
+    assert isinstance(result, CustomRequirement)
+    assert result.initialized_name == "bar"
+
+
+def test_copy_replace() -> None:
+    if not hasattr(copy, "replace"):
+        pytest.skip("copy.replace requires Python 3.13")
+    result = copy.replace(Requirement("requests>=2"), specifier=SpecifierSet(">=3"))
+    assert result == Requirement("requests>=3")
```

</details>

<details><summary>reply</summary>

I’ll check how `Requirement` is parsed and tested, then add `__replace__` with validation and independent specifier copies.

Parsing the replacement will validate its syntax and normalize markers. I’ll also check that parsing preserves the requested fields, so values such as `name="foo[bar]"` are rejected. Specifiers need a separate copy because their prerelease settings aren’t captured in the requirement string.

The implementation passes 9,734 requirement, specifier, and marker tests, including `copy.replace()` on Python 3.14. The new tests cover invalid field values, subclass initialization, normalization, and mutation isolation. I’m finishing the lint check and documentation.

Added `Requirement.__replace__` with field validation, parsing normalization, independent specifier copies that preserve prerelease settings, and subclass support.

Added tests, documentation, and a changelog entry.

Validation: 9,734 tests passed, including `copy.replace()` integration. Ruff, mypy, and diff checks passed.

</details>

### codex, muffle: pass

Files: [CHANGELOG.rst](../muffle/codex/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [docs/requirements.rst](../muffle/codex/python-feat-packaging-requirement-replace-1/files/docs/requirements.rst), [src/packaging/requirements.py](../muffle/codex/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py), [tests/test_requirements.py](../muffle/codex/python-feat-packaging-requirement-replace-1/files/tests/test_requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..338e6ee 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,12 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add :meth:`Requirement.__replace__ <packaging.requirements.Requirement.__replace__>`
+  to copy requirements with selected fields changed, including support for
+  :func:`copy.replace` on Python 3.13 and later.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/docs/requirements.rst b/docs/requirements.rst
index fede671..b39a33c 100644
--- a/docs/requirements.rst
+++ b/docs/requirements.rst
@@ -69,9 +69,27 @@ Usage
     not have such rules, and the check incorrectly disallows valid requirement
     strings from being parsed.
 
+Requirements can be copied with selected fields changed using
+:meth:`Requirement.__replace__`. On Python 3.13 and later, this also supports
+:func:`copy.replace`. Omitted fields are preserved, and the original requirement
+is left untouched. The result is parsed to validate and normalize its fields;
+invalid values or values that would change field boundaries raise
+:class:`InvalidRequirement`. Specifiers are copied independently, including
+their prerelease settings. Subclasses are constructed using their own initializer.
+
+.. doctest::
+
+    >>> req = Requirement('requests[security]>=2.0; python_version >= "3"')
+    >>> req.__replace__(name="flask")
+    <Requirement('flask[security]>=2.0; python_version >= "3"')>
+    >>> from packaging.specifiers import SpecifierSet
+    >>> req.__replace__(specifier=SpecifierSet(">=3.0"), marker=None)
+    <Requirement('requests[security]>=3.0')>
+
 Reference
 ---------
 
 .. automodule:: packaging.requirements
     :members:
     :exclude-members: __init__, __new__
+    :special-members: __replace__
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..fe8e0f5 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -3,6 +3,7 @@
 # for complete details.
 from __future__ import annotations
 
+from copy import deepcopy
 from typing import TYPE_CHECKING
 
 from ._parser import parse_requirement as _parse_requirement
@@ -124,6 +125,57 @@ class Requirement:
         if self.marker:
             yield f"; {self.marker}"
 
+    def __replace__(self, **changes: object) -> Requirement:
+        """Return a new requirement with the given fields replaced.
+
+        Accepts ``name``, ``url``, ``extras``, ``specifier``, and ``marker``
+        as keyword arguments, using the same types as the corresponding
+        attributes. The result is validated and normalized by parsing it.
+        Invalid or ambiguous field values raise :class:`InvalidRequirement`.
+
+        Supports :func:`copy.replace` on Python 3.13 and later, and can be
+        called directly on earlier Python versions. Specifiers are copied
+        independently, preserving their prerelease overrides.
+        """
+        fields = ("name", "url", "extras", "specifier", "marker")
+        for field in changes:
+            if field not in fields:
+                raise TypeError(f"Unexpected field name: {field!r}")
+
+        # Use a base instance to assemble the string without invoking a
+        # subclass constructor until we have a valid requirement.
+        candidate = Requirement("placeholder")
+        field_types = {
+            "name": (str,),
+            "url": (str, type(None)),
+            "extras": (set,),
+            "specifier": (SpecifierSet,),
+            "marker": (Marker, type(None)),
+        }
+        for field in fields:
+            value = changes.get(field, getattr(self, field))
+            if not isinstance(value, field_types[field]):
+                raise InvalidRequirement(f"Invalid value for {field}: {value!r}")
+            if isinstance(value, set) and not all(isinstance(e, str) for e in value):
+                raise InvalidRequirement(f"Invalid extras: {value!r}")
+            setattr(candidate, field, value)
+
+        parsed = Requirement(str(candidate))
+        # Equality on Requirement canonicalizes names and extras, which would
+        # conceal field boundaries or spelling changed by the round trip.
+        if (
+            parsed.name != candidate.name
+            or parsed.url != candidate.url
+            or parsed.extras != candidate.extras
+            or parsed.specifier != candidate.specifier
+            or parsed.marker != candidate.marker
+        ):
+            raise InvalidRequirement("Requirement fields do not round-trip")
+
+        result = type(self)(str(parsed))
+        result.specifier = deepcopy(candidate.specifier)
+        return result
+
     def __getstate__(self) -> tuple[str, bool | None]:
         # Return the requirement string for compactness and stability, paired
         # with the specifier's explicit prereleases override, which is not
diff --git a/tests/test_requirements.py b/tests/test_requirements.py
index ad78c2b..4791b88 100644
--- a/tests/test_requirements.py
+++ b/tests/test_requirements.py
@@ -4,6 +4,7 @@
 
 from __future__ import annotations
 
+import copy
 import pickle
 
 import pytest
@@ -1085,3 +1086,99 @@ def test_pickle_requirement_25_0_format_loads() -> None:
     assert str(r.specifier) == ">=2.0"
     assert r.marker is None
     assert r == Requirement("requests>=2.0")
+
+
+class TestRequirementReplace:
+    @pytest.mark.parametrize(
+        "changes",
+        [
+            {},
+            {"name": "flask"},
+            {"extras": {"tests"}},
+            {"specifier": SpecifierSet(">=3.0")},
+            {"marker": Marker('extra == "Foo_Bar"')},
+            {"marker": None},
+            {"specifier": SpecifierSet(), "url": "https://example.com/pkg"},
+        ],
+    )
+    def test_replace(self, changes: dict[str, object]) -> None:
+        original = Requirement('requests[security]>=2.0; python_version >= "3"')
+        before = str(original)
+        result = original.__replace__(**changes)
+        assert result is not original
+        assert str(original) == before
+        assert result == Requirement(str(result))
+        for field in ("name", "url", "extras", "specifier", "marker"):
+            assert getattr(result, field) == changes.get(
+                field, getattr(original, field)
+            )
+        assert result.extras is not original.extras
+        assert result.marker is not original.marker
+
+    @pytest.mark.parametrize(
+        "changes",
+        [
+            {"name": "not a name!"},
+            {"name": "foo[bar]"},
+            {"name": "foo>=1"},
+            {"extras": {"a,b"}},
+            {"extras": {""}},
+            {"url": ""},
+            {"url": "https://example.com/ ; os_name == 'posix'"},
+            {"url": "https://example.com/", "specifier": SpecifierSet(">=1")},
+            {"name": None},
+        ],
+    )
+    def test_invalid(self, changes: dict[str, object]) -> None:
+        with pytest.raises(InvalidRequirement):
+            Requirement("demo").__replace__(**changes)
+
+    def test_unknown_field(self) -> None:
+        with pytest.raises(TypeError, match="unknown"):
+            Requirement("demo").__replace__(unknown="value")
+
+    def test_positional_argument(self) -> None:
+        with pytest.raises(TypeError):
+            Requirement("demo").__replace__("other")  # type: ignore[call-arg]
+
+    @pytest.mark.parametrize("override", [None, False, True])
+    @pytest.mark.parametrize("replace_specifier", [False, True])
+    def test_specifier_copy(
+        self, override: bool | None, replace_specifier: bool
+    ) -> None:
+        original = Requirement("demo>=1,<3")
+        specifier = SpecifierSet(">=2,<4") if replace_specifier else original.specifier
+        specifier.prereleases = override
+        for index, spec in enumerate(specifier):
+            spec.prereleases = bool(index)
+        expected = {str(spec): spec._prereleases for spec in specifier}
+        result = (
+            original.__replace__(specifier=specifier)
+            if replace_specifier
+            else original.__replace__()
+        )
+        assert result.specifier is not specifier
+        assert result.specifier._prereleases is override
+        assert {str(spec): spec._prereleases for spec in result.specifier} == expected
+        for copied in result.specifier:
+            assert all(copied is not source for source in specifier)
+            copied.prereleases = None
+        result.specifier.prereleases = not override
+        assert specifier._prereleases is override
+        assert {str(spec): spec._prereleases for spec in specifier} == expected
+
+    def test_subclass(self) -> None:
+        class CustomRequirement(Requirement):
+            def __init__(self, requirement_string: str) -> None:
+                super().__init__(requirement_string)
+                self.initial_name = self.name
+
+        result = CustomRequirement("demo").__replace__(name="other")
+        assert isinstance(result, CustomRequirement)
+        assert result.initial_name == "other"
+
+    @pytest.mark.skipif(not hasattr(copy, "replace"), reason="Python 3.13+")
+    def test_copy_replace(self) -> None:
+        original = Requirement("demo>=1")
+        result = copy.replace(original, specifier=SpecifierSet(">=2"))  # type: ignore[attr-defined]
+        assert str(result) == "demo>=2"
```

</details>

<details><summary>reply</summary>

I’ll check how `Requirement` is parsed and tested, then add `__replace__` with validation and independent specifier copies.

Parsing the assembled string will validate the result, but I’ll also compare the parsed fields with the requested ones to catch values that would silently change another field. I’ll copy specifiers separately to preserve their prerelease settings.

The requirement tests pass against the workspace source, including the new round-trip and copying cases. I’m finishing the documentation and lint/type checks. The first test run used the installed `packaging`; I corrected the import path for the passing run.

Implemented `Requirement.__replace__` with field validation, parsing normalization, independent specifier copies that preserve prerelease settings, and subclass construction.

Added tests, documentation examples, and a changelog entry.

Validation: 7,414 tests passed; doctests, Ruff, and mypy passed.

</details>

### codex, hush: pass

Files: [CHANGELOG.rst](../hush/codex/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [docs/requirements.rst](../hush/codex/python-feat-packaging-requirement-replace-1/files/docs/requirements.rst), [src/packaging/requirements.py](../hush/codex/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py), [tests/test_requirements.py](../hush/codex/python-feat-packaging-requirement-replace-1/files/tests/test_requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..31ed3d9 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,11 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add ``Requirement.__replace__`` for validated copies with selected fields
+  changed, including support for ``copy.replace`` on Python 3.13 and later.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/docs/requirements.rst b/docs/requirements.rst
index fede671..88d695a 100644
--- a/docs/requirements.rst
+++ b/docs/requirements.rst
@@ -72,6 +72,28 @@ Usage
 Reference
 ---------
 
+Use ``Requirement.__replace__`` to copy a requirement with selected fields
+changed. On Python 3.13 and later, ``copy.replace`` also supports requirements.
+Accepted keywords are ``name``, ``url``, ``extras``, ``specifier``, and ``marker``;
+values use the same types as the corresponding attributes. Omitted fields are
+preserved, and the original requirement is unchanged. Mutable fields are copied,
+including specifier sets and their individual specifiers, preserving prerelease
+overrides. Subclasses are constructed through their own initializer.
+
+.. doctest::
+
+    >>> from packaging.specifiers import SpecifierSet
+    >>> req = Requirement('requests[security]>=2; python_version >= "3"')
+    >>> req.__replace__(name="flask")
+    <Requirement('flask[security]>=2; python_version >= "3"')>
+    >>> req.__replace__(specifier=SpecifierSet(">=3"))
+    <Requirement('requests[security]>=3; python_version >= "3"')>
+
+Unknown keywords raise :class:`TypeError`. Invalid values or combinations,
+including values that would parse back into different fields, raise
+:class:`InvalidRequirement`. Returned fields are normalized by parsing.
+
 .. automodule:: packaging.requirements
     :members:
     :exclude-members: __init__, __new__
+    :special-members: __replace__
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..922d35d 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -3,6 +3,7 @@
 # for complete details.
 from __future__ import annotations
 
+from copy import deepcopy
 from typing import TYPE_CHECKING
 
 from ._parser import parse_requirement as _parse_requirement
@@ -14,6 +15,8 @@ from .utils import canonicalize_name
 if TYPE_CHECKING:
     from collections.abc import Iterator
 
+    from typing_extensions import Self
+
 __all__ = [
     "InvalidRequirement",
     "Requirement",
@@ -106,6 +109,49 @@ class Requirement:
             self.marker = Marker.__new__(Marker)
             self.marker._markers = _normalize_extra_values(parsed.marker)
 
+    def __replace__(self, **changes: object) -> Self:
+        """Return a validated copy with the specified fields replaced.
+
+        Accepted keywords are ``name``, ``url``, ``extras``, ``specifier``, and
+        ``marker``, with the same types as the corresponding attributes.
+        Mutable fields are copied, including specifier prerelease overrides.
+        Invalid fields or combinations raise :class:`InvalidRequirement`.
+        """
+        fields = Requirement.__slots__
+        for key in changes:
+            if key not in fields:
+                raise TypeError(
+                    "Requirement.__replace__() got an unexpected keyword "
+                    f"argument {key!r}"
+                )
+
+        candidate = Requirement.__new__(Requirement)
+        for key in fields:
+            setattr(candidate, key, changes.get(key, getattr(self, key)))
+
+        if not (
+            isinstance(candidate.name, str)
+            and (candidate.url is None or isinstance(candidate.url, str))
+            and isinstance(candidate.extras, (set, frozenset))
+            and all(isinstance(extra, str) for extra in candidate.extras)
+            and isinstance(candidate.specifier, SpecifierSet)
+            and (candidate.marker is None or isinstance(candidate.marker, Marker))
+        ):
+            raise InvalidRequirement("Invalid replacement field type")
+
+        result = type(self)(str(candidate))
+        if (
+            result.name != candidate.name
+            or result.url != candidate.url
+            or result.extras != candidate.extras
+            or str(result.specifier) != str(candidate.specifier)
+            or result.marker != candidate.marker
+        ):
+            raise InvalidRequirement("Replacement fields do not round-trip")
+
+        result.specifier = deepcopy(candidate.specifier)
+        return result
+
     def _iter_parts(self, name: str) -> Iterator[str]:
         yield name
 
diff --git a/tests/test_requirements.py b/tests/test_requirements.py
index ad78c2b..fdd3063 100644
--- a/tests/test_requirements.py
+++ b/tests/test_requirements.py
@@ -4,13 +4,117 @@
 
 from __future__ import annotations
 
+import copy
 import pickle
 
 import pytest
 
 from packaging.markers import Marker
 from packaging.requirements import InvalidRequirement, Requirement
-from packaging.specifiers import SpecifierSet
+from packaging.specifiers import Specifier, SpecifierSet
+
+
+def test_replace() -> None:
+    original = Requirement('requests[security]>=2; python_version >= "3"')
+    result = original.__replace__(name="flask")
+    assert str(result) == 'flask[security]>=2; python_version >= "3"'
+    assert original.name == "requests"
+    clone = original.__replace__()
+    assert clone == original
+    assert clone is not original
+    assert clone.extras is not original.extras
+    assert clone.marker is not original.marker
+
+
+def test_replace_fields() -> None:
+    original = Requirement("requests>=2")
+    result = original.__replace__(
+        url="https://example.com/pkg",
+        extras={"test"},
+        specifier=SpecifierSet(),
+        marker=Marker('extra == "Foo_Bar"'),
+    )
+    assert (
+        str(result) == 'requests[test] @ https://example.com/pkg ; extra == "foo-bar"'
+    )
+    assert result == Requirement(str(result))
+    assert result.__replace__(url=None, extras=set(), marker=None) == Requirement(
+        "requests"
+    )
+    assert original.__replace__(specifier=SpecifierSet(">=3")) == Requirement(
+        "requests>=3"
+    )
+
+
+@pytest.mark.parametrize(
+    "changes",
+    [
+        {"name": "not a name!"},
+        {"name": "foo[bar]"},
+        {"name": "foo "},
+        {"extras": {"a,b"}},
+        {"extras": {""}},
+        {"url": ""},
+        {"url": "https://example.com pkg"},
+        {"url": "https://example.com"},
+        {"name": None},
+        {"specifier": ">=3"},
+        {"marker": "os_name == 'posix'"},
+    ],
+)
+def test_replace_invalid(changes: dict[str, object]) -> None:
+    with pytest.raises(InvalidRequirement):
+        Requirement("foo>=2").__replace__(**changes)
+
+
+def test_replace_arguments() -> None:
+    with pytest.raises(TypeError, match="unexpected keyword"):
+        Requirement("foo").__replace__(unknown="bar")
+    with pytest.raises(TypeError):
+        Requirement("foo").__replace__("bar")  # type: ignore[misc]
+
+
+@pytest.mark.parametrize("supplied", [False, True])
+@pytest.mark.parametrize("override", [None, False, True])
+def test_replace_specifier_copy(supplied: bool, override: bool | None) -> None:
+    original = Requirement("foo>=2")
+    specs = SpecifierSet(
+        [Specifier(">=3", prereleases=True), Specifier("<4", prereleases=False)],
+        prereleases=override,
+    )
+    if supplied:
+        result = original.__replace__(specifier=specs)
+    else:
+        original.specifier = specs
+        result = original.__replace__()
+    assert result.specifier is not specs
+    assert result.specifier._prereleases is override
+    for source, cloned in zip(specs, result.specifier, strict=True):
+        assert source == cloned
+        assert source is not cloned
+        assert source._prereleases is cloned._prereleases
+        cloned.prereleases = not source.prereleases
+        assert source.prereleases != cloned.prereleases
+    result.specifier.prereleases = not override
+    assert specs._prereleases is override
+
+
+def test_replace_subclass() -> None:
+    class CustomRequirement(Requirement):
+        def __init__(self, requirement_string: str) -> None:
+            super().__init__(requirement_string)
+            self.initialized_name = self.name
+
+    result = CustomRequirement("foo").__replace__(name="bar")
+    assert isinstance(result, CustomRequirement)
+    assert result.initialized_name == "bar"
+
+
+@pytest.mark.skipif(not hasattr(copy, "replace"), reason="Requires Python 3.13")
+def test_copy_replace() -> None:
+    result = copy.replace(Requirement("foo>=2"), specifier=SpecifierSet(">=3"))
+    assert result == Requirement("foo>=3")
+
 
 EQUAL_DEPENDENCIES = [
     ("packaging>20.1", "packaging>20.1"),
```

</details>

<details><summary>reply</summary>

Done.
Added validated `Requirement.__replace__`, independent mutable copies, prerelease preservation, subclass support, docs. 7,410 tests passed; lint passed.

</details>

### codex, sloth: pass

Files: [CHANGELOG.rst](../sloth/codex/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [docs/requirements.rst](../sloth/codex/python-feat-packaging-requirement-replace-1/files/docs/requirements.rst), [src/packaging/requirements.py](../sloth/codex/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..338e6ee 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,12 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add :meth:`Requirement.__replace__ <packaging.requirements.Requirement.__replace__>`
+  to copy requirements with selected fields changed, including support for
+  :func:`copy.replace` on Python 3.13 and later.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/docs/requirements.rst b/docs/requirements.rst
index fede671..3dfb969 100644
--- a/docs/requirements.rst
+++ b/docs/requirements.rst
@@ -69,9 +69,37 @@ Usage
     not have such rules, and the check incorrectly disallows valid requirement
     strings from being parsed.
 
+Replacing fields
+----------------
+
+Use :meth:`Requirement.__replace__` to create a new requirement with selected
+fields changed. It accepts only keyword arguments: ``name``, ``url``, ``extras``,
+``specifier``, and ``marker``. Omitted fields are kept, and the original is
+unchanged. With no arguments, it returns an equal but distinct requirement.
+
+.. doctest::
+
+    >>> req = Requirement('requests[security]>=2.0; python_version >= "3"')
+    >>> req.__replace__(name="flask")
+    <Requirement('flask[security]>=2.0; python_version >= "3"')>
+    >>> from packaging.specifiers import SpecifierSet
+    >>> req.__replace__(specifier=SpecifierSet(">=3.0"), marker=None)
+    <Requirement('requests[security]>=3.0')>
+
+On Python 3.13 and later, :func:`copy.replace` also calls this method.
+Replacement fields must form a valid requirement without changing meaning when
+parsed, otherwise :exc:`InvalidRequirement` is raised. For example,
+``name="foo[bar]"`` cannot be used to introduce an extra. To switch from a
+version specifier to a URL, also pass ``specifier=SpecifierSet()``.
+
+Mutable fields are copied, including individual specifiers. Prerelease overrides
+on the specifier set and its members are preserved. Subclasses receive an
+instance of their own class, initialized with the resulting requirement string.
+
 Reference
 ---------
 
 .. automodule:: packaging.requirements
     :members:
+    :special-members: __replace__
     :exclude-members: __init__, __new__
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..da4a3ea 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -3,23 +3,28 @@
 # for complete details.
 from __future__ import annotations
 
-from typing import TYPE_CHECKING
+from typing import TYPE_CHECKING, Any
 
 from ._parser import parse_requirement as _parse_requirement
 from ._tokenizer import ParserSyntaxError
 from .markers import Marker, _normalize_extra_values
-from .specifiers import InvalidSpecifier, SpecifierSet
+from .specifiers import InvalidSpecifier, Specifier, SpecifierSet
 from .utils import canonicalize_name
 
 if TYPE_CHECKING:
     from collections.abc import Iterator
 
+    from typing_extensions import Self
+
 __all__ = [
     "InvalidRequirement",
     "Requirement",
 ]
 
 
+_UNSET: Any = object()
+
+
 def __dir__() -> list[str]:
     return __all__
 
@@ -106,6 +111,54 @@ class Requirement:
             self.marker = Marker.__new__(Marker)
             self.marker._markers = _normalize_extra_values(parsed.marker)
 
+    def __replace__(
+        self,
+        *,
+        name: str = _UNSET,
+        url: str | None = _UNSET,
+        extras: set[str] = _UNSET,
+        specifier: SpecifierSet = _UNSET,
+        marker: Marker | None = _UNSET,
+    ) -> Self:
+        """Return a new requirement with the specified fields replaced.
+
+        Omitted fields are retained. The result is validated and normalized
+        by parsing, and mutable fields are copied. Specifier prerelease
+        overrides are preserved on both the set and its individual specifiers.
+
+        Supports :func:`copy.replace` on Python 3.13 and later, and can be
+        called directly on earlier Python versions.
+
+        :raises InvalidRequirement: If the fields do not form a valid
+            requirement or parsing would change the requested fields.
+
+        .. versionadded:: 26.4
+        """
+        candidate = Requirement.__new__(Requirement)
+        candidate.name = self.name if name is _UNSET else name
+        candidate.url = self.url if url is _UNSET else url
+        candidate.extras = self.extras if extras is _UNSET else extras
+        source_specifier = self.specifier if specifier is _UNSET else specifier
+        candidate.specifier = SpecifierSet(
+            (Specifier(str(s), prereleases=s._prereleases) for s in source_specifier),
+            prereleases=source_specifier._prereleases,
+        )
+        source_marker = self.marker if marker is _UNSET else marker
+        candidate.marker = (
+            Marker(str(source_marker)) if source_marker is not None else None
+        )
+        result = self.__class__(str(candidate))
+        if (
+            result.name != candidate.name
+            or result.url != candidate.url
+            or result.extras != candidate.extras
+            or result.specifier != candidate.specifier
+            or result.marker != candidate.marker
+        ):
+            raise InvalidRequirement("Replacement fields change meaning when parsed")
+        result.specifier = candidate.specifier
+        return result
+
     def _iter_parts(self, name: str) -> Iterator[str]:
         yield name
```

</details>

<details><summary>reply</summary>

I’ll check how `Requirement` is parsed and copied, add `__replace__`, then run the existing tests and build checks.

The change needs to reach `Requirement`, its API documentation, and the changelog; no callers, exports, fixtures, or configuration need changes. I’ll follow the existing `Version.__replace__` keyword-only API, reparse to validate the result, and copy specifiers separately to preserve their prerelease settings. No new options or dependencies are needed.

The implementation, lint, type check, and package build pass. The test suite initially stopped because test dependencies were missing; those are installed and the suite is running again. I’m also checking field-injection rejection, mutable-object isolation, prerelease settings, and subclass initialization directly.

Added `Requirement.__replace__` with keyword-only fields, parsing validation, normalization, independent mutable fields, preserved prerelease settings, and subclass initialization. Updated documentation and changelog.

Validation passed: 62,493 existing tests, direct behavior checks, doctests, lint, type checking, and wheel/source builds.

</details>

### codex, all: pass

Files: [CHANGELOG.rst](../all/codex/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [src/packaging/requirements.py](../all/codex/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..338e6ee 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,12 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add :meth:`Requirement.__replace__ <packaging.requirements.Requirement.__replace__>`
+  to copy requirements with selected fields changed, including support for
+  :func:`copy.replace` on Python 3.13 and later.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..fc30346 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -3,23 +3,28 @@
 # for complete details.
 from __future__ import annotations
 
-from typing import TYPE_CHECKING
+from typing import TYPE_CHECKING, Any
 
 from ._parser import parse_requirement as _parse_requirement
 from ._tokenizer import ParserSyntaxError
 from .markers import Marker, _normalize_extra_values
-from .specifiers import InvalidSpecifier, SpecifierSet
+from .specifiers import InvalidSpecifier, Specifier, SpecifierSet
 from .utils import canonicalize_name
 
 if TYPE_CHECKING:
     from collections.abc import Iterator
 
+    from typing_extensions import Self
+
 __all__ = [
     "InvalidRequirement",
     "Requirement",
 ]
 
 
+_UNSET: Any = object()
+
+
 def __dir__() -> list[str]:
     return __all__
 
@@ -106,6 +111,70 @@ class Requirement:
             self.marker = Marker.__new__(Marker)
             self.marker._markers = _normalize_extra_values(parsed.marker)
 
+    def __replace__(
+        self,
+        *,
+        name: str = _UNSET,
+        url: str | None = _UNSET,
+        extras: set[str] = _UNSET,
+        specifier: SpecifierSet = _UNSET,
+        marker: Marker | None = _UNSET,
+    ) -> Self:
+        """Return a new requirement with the given fields replaced.
+
+        Omitted fields are preserved. Passing ``None`` clears the URL or marker;
+        an empty set clears extras, and an empty :class:`SpecifierSet` clears
+        version constraints. Mutable fields are copied, including explicit
+        prerelease settings on the specifier set and its individual specifiers.
+
+        Supports :func:`copy.replace` on Python 3.13 and later, and can be called
+        directly on earlier versions.
+
+        :raises InvalidRequirement: If the resulting fields cannot be represented
+            by a requirement string without changing their meaning.
+        :raises TypeError: If an unknown keyword argument is supplied.
+
+        .. versionadded:: 26.4
+        """
+        name = self.name if name is _UNSET else name
+        url = self.url if url is _UNSET else url
+        extras = self.extras if extras is _UNSET else extras
+        specifier = self.specifier if specifier is _UNSET else specifier
+        marker = self.marker if marker is _UNSET else marker
+
+        if not all(
+            (
+                isinstance(name, str),
+                url is None or isinstance(url, str),
+                isinstance(extras, set),
+                isinstance(specifier, SpecifierSet),
+                marker is None or isinstance(marker, Marker),
+            )
+        ) or any(not isinstance(extra, str) for extra in extras):
+            raise InvalidRequirement("Invalid requirement field value")
+
+        candidate = Requirement.__new__(Requirement)
+        candidate.name = name
+        candidate.url = url
+        candidate.extras = extras
+        candidate.specifier = specifier
+        candidate.marker = Marker(str(marker)) if marker is not None else None
+        result = type(self)(str(candidate))
+        if (
+            result.name != candidate.name
+            or result.url != candidate.url
+            or result.extras != candidate.extras
+            or str(result.specifier) != str(candidate.specifier)
+            or result.marker != candidate.marker
+        ):
+            raise InvalidRequirement("Requirement fields changed when parsed")
+
+        result.specifier = SpecifierSet(
+            (Specifier(str(s), prereleases=s._prereleases) for s in specifier),
+            prereleases=specifier._prereleases,
+        )
+        return result
+
     def _iter_parts(self, name: str) -> Iterator[str]:
         yield name
```

</details>

<details><summary>reply</summary>

Done. Added validated `Requirement.__replace__`, independent specifier copies, subclass support, docs.
Build, lint, typing, 9,706 tests passed; full suite blocked by missing dependencies.

</details>
