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
| claude | muffle | pass | +93/-3 | 62 | 9,892 | $0.234 |
| claude | hush | pass | +88/-3 | 86 | 8,248 | $0.223 |
| claude | sloth | **FAIL** | +80/-2 | 71 | 7,196 | $0.211 |
| claude | all | pass | +59/-3 | 80 | 8,901 | $0.217 |
| codex | base | pass | +88/-1 | 106 | 4,297 | - |
| codex | muffle | pass | +88/-1 | 113 | 4,075 | - |
| codex | hush | pass | +75/-2 | 90 | 3,284 | - |
| codex | sloth | pass | +68/-1 | 118 | 7,111 | - |
| codex | all | pass | +55/-0 | 84 | 3,966 | - |

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

Files: [CHANGELOG.rst](../muffle/claude/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [src/packaging/requirements.py](../muffle/claude/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py), [tests/test_requirements.py](../muffle/claude/python-feat-packaging-requirement-replace-1/files/tests/test_requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..eaedcd0 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,11 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add ``Requirement.__replace__()``, so :func:`copy.replace` works on
+  :class:`~packaging.requirements.Requirement` on Python 3.13+.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..829b735 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -3,16 +3,18 @@
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
+
+    from typing_extensions import Self
 
 __all__ = [
     "InvalidRequirement",
@@ -24,6 +26,9 @@ def __dir__() -> list[str]:
     return __all__
 
 
+_UNSET: Any = object()
+
+
 class InvalidRequirement(ValueError):
     """
     Raised when attempting to create a :class:`Requirement` with a string that
@@ -124,6 +129,86 @@ class Requirement:
         if self.marker:
             yield f"; {self.marker}"
 
+    def __replace__(
+        self,
+        /,
+        *,
+        name: str = _UNSET,
+        url: str | None = _UNSET,
+        extras: Iterable[str] = _UNSET,
+        specifier: SpecifierSet = _UNSET,
+        marker: Marker | None = _UNSET,
+    ) -> Self:
+        """Return a copy of this requirement with the given fields replaced.
+
+        Fields that are not passed are kept. The result is validated like a
+        parsed requirement string and the original is left untouched. This is
+        what :func:`copy.replace` calls on Python 3.13+.
+
+        :raises InvalidRequirement: If the resulting requirement is not valid,
+            or a value would not read back unchanged from the requirement
+            string (for example ``name="foo[bar]"``).
+        :raises TypeError: If an unknown keyword is given.
+
+        .. versionadded:: 26.4
+        """
+        new_name = self.name if name is _UNSET else name
+        new_url = self.url if url is _UNSET else url
+        new_specifier = self.specifier if specifier is _UNSET else specifier
+        new_marker = self.marker if marker is _UNSET else marker
+        if extras is _UNSET:
+            new_extras = set(self.extras)
+        elif isinstance(extras, str):
+            raise TypeError("extras must be an iterable of strings, not a string")
+        else:
+            new_extras = set(extras)
+
+        if not isinstance(new_name, str):
+            raise InvalidRequirement(f"Invalid name: {new_name!r}")
+        if new_url is not None and not isinstance(new_url, str):
+            raise InvalidRequirement(f"Invalid url: {new_url!r}")
+        if not all(isinstance(e, str) for e in new_extras):
+            raise InvalidRequirement(f"Invalid extras: {extras!r}")
+        if new_marker is not None and not isinstance(new_marker, Marker):
+            raise InvalidRequirement(f"Invalid marker: {new_marker!r}")
+        try:
+            if isinstance(new_specifier, str):
+                new_specifier = SpecifierSet(new_specifier)
+            elif not isinstance(new_specifier, SpecifierSet):
+                raise InvalidRequirement(f"Invalid specifier: {new_specifier!r}")
+            # Copy the specifiers, so nothing mutable is shared with the input.
+            specs = [
+                Specifier(str(s), prereleases=getattr(s, "_prereleases", None))
+                for s in new_specifier
+            ]
+        except InvalidSpecifier as e:
+            raise InvalidRequirement(str(e)) from e
+        spec_set = SpecifierSet(specs, prereleases=new_specifier._prereleases)
+
+        # Build the string and parse it, so the result is exactly what parsing
+        # would give (and subclass ``__init__`` runs).
+        template = Requirement.__new__(Requirement)
+        template.name = new_name
+        template.url = new_url
+        template.extras = new_extras
+        template.specifier = spec_set
+        template.marker = new_marker
+        result = type(self)(str(template))
+
+        # Anything that did not survive the round trip would silently change
+        # other fields (e.g. a name containing "[").
+        if (
+            result.name != new_name
+            or result.url != (new_url or None)
+            or new_url == ""
+            or result.extras != new_extras
+        ):
+            raise InvalidRequirement(
+                f"Cannot represent {str(template)!r} as a requirement"
+            )
+        result.specifier = spec_set
+        return result
+
     def __getstate__(self) -> tuple[str, bool | None]:
         # Return the requirement string for compactness and stability, paired
         # with the specifier's explicit prereleases override, which is not
diff --git a/tests/test_requirements.py b/tests/test_requirements.py
index ad78c2b..ef3f2d8 100644
--- a/tests/test_requirements.py
+++ b/tests/test_requirements.py
@@ -10,7 +10,7 @@ import pytest
 
 from packaging.markers import Marker
 from packaging.requirements import InvalidRequirement, Requirement
-from packaging.specifiers import SpecifierSet
+from packaging.specifiers import Specifier, SpecifierSet
 
 EQUAL_DEPENDENCIES = [
     ("packaging>20.1", "packaging>20.1"),
@@ -1085,3 +1085,64 @@ def test_pickle_requirement_25_0_format_loads() -> None:
     assert str(r.specifier) == ">=2.0"
     assert r.marker is None
     assert r == Requirement("requests>=2.0")
+
+
+class TestRequirementReplace:
+    def test_replace_name_keeps_rest(self) -> None:
+        r = Requirement('requests[security]>=2.0; python_version >= "3"')
+        assert str(r.__replace__(name="flask")) == (
+            'flask[security]>=2.0; python_version >= "3"'
+        )
+        assert r.name == "requests"
+
+    def test_no_args_equal_but_distinct(self) -> None:
+        r = Requirement("a[x]>=1; os_name == 'a'")
+        new = r.__replace__()
+        assert new == r
+        assert new is not r
+        assert new.specifier is not r.specifier
+
+    def test_unknown_keyword(self) -> None:
+        with pytest.raises(TypeError):
+            Requirement("a").__replace__(foo=1)  # type: ignore[call-arg]
+
+    @pytest.mark.parametrize(
+        "kwargs",
+        [
+            {"name": "not a name!"},
+            {"name": "foo[bar]"},
+            {"extras": {"a,b"}},
+            {"url": "http://x ; y"},
+            {"url": ""},
+            {"specifier": SpecifierSet(">=1"), "url": "http://x"},
+        ],
+    )
+    def test_invalid(self, kwargs: dict[str, object]) -> None:
+        with pytest.raises(InvalidRequirement):
+            Requirement("a").__replace__(**kwargs)  # type: ignore[arg-type]
+
+    def test_marker_normalized(self) -> None:
+        new = Requirement("a").__replace__(marker=Marker('extra == "Foo_Bar"'))
+        assert str(new.marker) == 'extra == "foo-bar"'
+
+    def test_specifier_prereleases_and_no_sharing(self) -> None:
+        spec = SpecifierSet([Specifier(">=1", prereleases=False)], prereleases=True)
+        new = Requirement("a").__replace__(specifier=spec)
+        assert new.specifier is not spec
+        assert new.specifier._prereleases is True
+        (old_s,), (new_s,) = list(spec), list(new.specifier)
+        assert new_s is not old_s
+        assert new_s._prereleases is False
+        kept = new.__replace__(name="b")
+        assert kept.specifier._prereleases is True
+        assert kept.specifier is not new.specifier
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

Adding `__replace__` to `Requirement` now. I'm editing `requirements.py`, then I'll test it and add docs.

`Requirement.__replace__` is added in `src/packaging/requirements.py`, and `copy.replace()` works on it. Your two examples give the output you showed. The full `tests/test_requirements.py` run passes, including new tests for it. I didn't run the rest of the suite, mypy or the linters.

- **Arguments:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`, and any other keyword raises `TypeError`. Fields you leave out are kept. Passing `url=None` or `marker=None` clears that field.
- **Validation:** it builds the requirement string and parses it again through `type(self)(...)`. It then checks that the name, URL and extras read back unchanged. So `name="foo[bar]"`, `extras={"a,b"}`, `url=""` and a URL containing `; ` all raise `InvalidRequirement`. A specifier together with a URL raises it too, as parsing does. Passing extras as a bare string raises `TypeError`.
- **Normalization:** markers are normalized by the parse, so `extra == "Foo_Bar"` becomes `extra == "foo-bar"`.
- **Specifiers:** the result gets a fresh `SpecifierSet` built from fresh `Specifier` copies. `prereleases` is kept on the set and on each specifier, and nothing is shared with the input. I also made it accept a plain string for `specifier`, which you didn't ask for.
- **Subclasses:** you get an instance of the subclass back, and its `__init__` runs. This assumes the subclass's `__init__` accepts a single requirement string.

I added a CHANGELOG entry. The docstring says `versionadded:: 26.4`, which is my guess at the next version, so please check it.

The tests are in `tests/test_requirements.py` as `TestRequirementReplace`.

I left the changes uncommitted.

</details>

### claude, hush: pass

Files: [CHANGELOG.rst](../hush/claude/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [src/packaging/requirements.py](../hush/claude/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py), [tests/test_requirements.py](../hush/claude/python-feat-packaging-requirement-replace-1/files/tests/test_requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..d57952c 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,11 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add :meth:`Requirement.__replace__() <packaging.requirements.Requirement.__replace__>`,
+  so :func:`copy.replace` works on Python 3.13+.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..3834456 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -3,16 +3,22 @@
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
+    import sys
+    from collections.abc import Iterable, Iterator
+
+    if sys.version_info >= (3, 11):
+        from typing import Self
+    else:
+        from typing_extensions import Self
 
 __all__ = [
     "InvalidRequirement",
@@ -24,6 +30,9 @@ def __dir__() -> list[str]:
     return __all__
 
 
+_UNSET: Any = object()
+
+
 class InvalidRequirement(ValueError):
     """
     Raised when attempting to create a :class:`Requirement` with a string that
@@ -124,6 +133,77 @@ class Requirement:
         if self.marker:
             yield f"; {self.marker}"
 
+    def __replace__(
+        self,
+        *,
+        name: str = _UNSET,
+        url: str | None = _UNSET,
+        extras: Iterable[str] = _UNSET,
+        specifier: SpecifierSet | str = _UNSET,
+        marker: Marker | None = _UNSET,
+    ) -> Self:
+        """Return a copy with the given fields replaced.
+
+        Fields that are not given are kept. The result is validated and
+        normalized as if its string form had been parsed; values that would not
+        read back unchanged raise :class:`InvalidRequirement`. The result does
+        not share its :class:`~.SpecifierSet` or :class:`~.Specifier` objects
+        with ``self`` or the arguments, and keeps their ``prereleases`` settings.
+        Subclasses get an instance of their own class.
+
+        Supported by :func:`copy.replace` on Python 3.13+.
+
+        .. versionadded:: 26.4
+        """
+        if name is _UNSET:
+            name = self.name
+        if url is _UNSET:
+            url = self.url
+        extras_set = set(self.extras if extras is _UNSET else extras)
+        if specifier is _UNSET:
+            specifier = self.specifier
+        elif isinstance(specifier, str):
+            try:
+                specifier = SpecifierSet(specifier)
+            except InvalidSpecifier as e:
+                raise InvalidRequirement(str(e)) from e
+        if marker is _UNSET:
+            marker = self.marker
+
+        # Render the requested fields, then parse the result so it is exactly
+        # what parsing its string gives.
+        draft = Requirement.__new__(Requirement)
+        draft.name = name
+        draft.url = url
+        draft.extras = extras_set
+        draft.specifier = specifier
+        draft.marker = marker
+        new = self.__class__(str(draft))
+
+        # Reject values that parsed as something other than what was asked for.
+        if (
+            new.name != name
+            or new.url != url
+            or new.extras != extras_set
+            or str(new.specifier) != str(specifier)
+            or (None if new.marker is None else str(new.marker))
+            != (None if marker is None else str(marker))
+        ):
+            raise InvalidRequirement(
+                f"Replacement values do not round-trip: {str(draft)!r}"
+            )
+
+        # The string form drops ``prereleases``; restore it on independent
+        # copies of the set and its specifiers.
+        new.specifier = SpecifierSet(
+            [
+                Specifier(str(s), getattr(s, "_prereleases", None))
+                for s in specifier._specs
+            ],
+            prereleases=specifier._prereleases,
+        )
+        return new
+
     def __getstate__(self) -> tuple[str, bool | None]:
         # Return the requirement string for compactness and stability, paired
         # with the specifier's explicit prereleases override, which is not
diff --git a/tests/test_requirements.py b/tests/test_requirements.py
index ad78c2b..3afd445 100644
--- a/tests/test_requirements.py
+++ b/tests/test_requirements.py
@@ -4,13 +4,14 @@
 
 from __future__ import annotations
 
+import copy
 import pickle
 
 import pytest
 
 from packaging.markers import Marker
 from packaging.requirements import InvalidRequirement, Requirement
-from packaging.specifiers import SpecifierSet
+from packaging.specifiers import Specifier, SpecifierSet
 
 EQUAL_DEPENDENCIES = [
     ("packaging>20.1", "packaging>20.1"),
@@ -1085,3 +1086,87 @@ def test_pickle_requirement_25_0_format_loads() -> None:
     assert str(r.specifier) == ">=2.0"
     assert r.marker is None
     assert r == Requirement("requests>=2.0")
+
+
+class TestReplace:
+    def test_examples(self) -> None:
+        r = Requirement('requests[security]>=2.0; python_version >= "3"')
+        assert str(r.__replace__(name="flask")) == (
+            'flask[security]>=2.0; python_version >= "3"'
+        )
+        assert str(r) == 'requests[security]>=2.0; python_version >= "3"'
+        assert str(r.__replace__(specifier=SpecifierSet(">=3.0"))).startswith(
+            "requests[security]>=3.0"
+        )
+
+    def test_no_args(self) -> None:
+        r = Requirement("requests>=2.0")
+        new = r.__replace__()
+        assert new == r
+        assert new is not r
+        assert new.specifier is not r.specifier
+        assert new.extras is not r.extras
+
+    @pytest.mark.skipif(not hasattr(copy, "replace"), reason="needs Python 3.13+")
+    def test_copy_replace(self) -> None:
+        new = copy.replace(  # type: ignore[attr-defined]
+            Requirement("requests>=2.0"), specifier=SpecifierSet(">=3.0")
+        )
+        assert str(new) == "requests>=3.0"
+
+    def test_unknown_keyword(self) -> None:
+        with pytest.raises(TypeError):
+            Requirement("a").__replace__(foo=1)  # type: ignore[call-arg]
+        with pytest.raises(TypeError):
+            Requirement("a").__replace__("b")  # type: ignore[misc]
+
+    @pytest.mark.parametrize(
+        "changes",
+        [
+            {"name": "not a name!"},
+            {"name": "foo[bar]"},
+            {"name": "foo "},
+            {"extras": {"a,b"}},
+            {"extras": {"a b"}},
+            {"url": "http://x/y ; python_version > '3'"},
+            {"url": ""},
+        ],
+    )
+    def test_invalid(self, changes: dict[str, object]) -> None:
+        with pytest.raises(InvalidRequirement):
+            Requirement("a").__replace__(**changes)  # type: ignore[arg-type]
+
+    def test_url_with_specifier(self) -> None:
+        with pytest.raises(InvalidRequirement):
+            Requirement("a>=1").__replace__(url="http://x/y")
+
+    def test_marker_normalized(self) -> None:
+        new = Requirement("a").__replace__(marker=Marker('extra == "Foo_Bar"'))
+        assert str(new.marker) == 'extra == "foo-bar"'
+        assert new.marker is not None
+
+    def test_prereleases_kept_without_sharing(self) -> None:
+        spec = SpecifierSet(
+            [Specifier(">=1", prereleases=True), Specifier("<3", prereleases=False)],
+            prereleases=True,
+        )
+        expected = {">=1": True, "<3": False}
+        new = Requirement("a").__replace__(specifier=spec)
+        assert new.specifier is not spec
+        assert new.specifier._prereleases is True
+        assert {str(s): s._prereleases for s in new.specifier} == expected
+        assert not set(map(id, new.specifier)) & set(map(id, spec))
+        again = new.__replace__(name="b")
+        assert again.specifier._prereleases is True
+        assert {str(s): s._prereleases for s in again.specifier} == expected
+        assert again.specifier is not new.specifier
+
+    def test_subclass(self) -> None:
+        class Sub(Requirement):
+            def __init__(self, s: str) -> None:
+                super().__init__(s)
+                self.extra_state = 1
+
+        new = Sub("a").__replace__(name="b")
+        assert type(new) is Sub
+        assert new.extra_state == 1
```

</details>

<details><summary>reply</summary>

Done. `Requirement.__replace__` added in `src/packaging/requirements.py`, with a changelog entry and tests. `tests/test_requirements.py` passes (5365) when run with `PYTHONPATH=src`, and mypy is clean. I didn't run the rest of the suite.

- **Test environment:** the venv has an installed `packaging` that shadows `src`, so plain `pytest` fails on the new tests. Without my changes, 15 other tests in that file already fail under the same setup.
- **Not covered:** `copy.replace` itself is tested only on 3.13+. The venv is 3.14, so it ran there.
- **Extra:** `specifier` also accepts a plain string, which I added beyond your spec.

</details>

### claude, sloth: FAIL

Files: [CHANGELOG.rst](../sloth/claude/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [src/packaging/requirements.py](../sloth/claude/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py), [tests/test_requirements.py](../sloth/claude/python-feat-packaging-requirement-replace-1/files/tests/test_requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..8475b1f 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,12 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add :meth:`Requirement.__replace__() <packaging.requirements.Requirement.__replace__>`
+  to copy a requirement with some parts changed; it also works with
+  ``copy.replace()`` on Python 3.13+.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..fbc034c 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -8,11 +8,14 @@ from typing import TYPE_CHECKING
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
+
+    from typing_extensions import Self
 
 __all__ = [
     "InvalidRequirement",
@@ -106,6 +109,75 @@ class Requirement:
             self.marker = Marker.__new__(Marker)
             self.marker._markers = _normalize_extra_values(parsed.marker)
 
+    def __replace__(
+        self,
+        *,
+        name: str = _UNSET,
+        url: str | None = _UNSET,
+        extras: Iterable[str] = _UNSET,
+        specifier: SpecifierSet = _UNSET,
+        marker: Marker | None = _UNSET,
+    ) -> Self:
+        """
+        __replace__(*, name=..., url=..., extras=..., specifier=..., marker=...)
+
+        Return a new requirement with parts replaced.
+
+        The result is validated by parsing its string form; values that are
+        invalid, or that would parse back as something different (such as
+        ``name="foo[bar]"``), raise :exc:`InvalidRequirement`. Markers are
+        normalized. The specifier set and its specifiers are copied, keeping
+        their ``prereleases`` settings. Subclasses get an instance of their
+        own class.
+
+        >>> Requirement("requests[security]>=2.0").__replace__(name="flask")
+        <Requirement('flask[security]>=2.0')>
+
+        :param str name:
+        :param str | None url:
+        :param Iterable[str] extras:
+        :param SpecifierSet specifier:
+        :param Marker | None marker:
+        :raises InvalidRequirement: If the resulting requirement is not valid.
+
+        .. versionadded:: 26.4
+        """
+        new = self.__class__(str(self))
+        if name is not _UNSET:
+            new.name = name
+        if url is not _UNSET:
+            new.url = url or None
+        if extras is not _UNSET:
+            new.extras = set(extras)
+        if specifier is not _UNSET:
+            new.specifier = specifier
+        if marker is not _UNSET:
+            new.marker = marker
+
+        try:
+            parsed = Requirement(str(new))
+        except ParserSyntaxError as e:  # pragma: no cover
+            raise InvalidRequirement(str(e)) from e
+        if (
+            parsed.name != new.name
+            or parsed.url != new.url
+            or parsed.extras != new.extras
+        ):
+            raise InvalidRequirement(f"Invalid requirement parts: {str(new)!r}")
+
+        new.name, new.url, new.extras, new.marker = (
+            parsed.name,
+            parsed.url,
+            parsed.extras,
+            parsed.marker,
+        )
+        source = self.specifier if specifier is _UNSET else specifier
+        new.specifier = SpecifierSet(
+            [Specifier(str(s), s._prereleases) for s in source._specs],
+            source._prereleases,
+        )
+        return new
+
     def _iter_parts(self, name: str) -> Iterator[str]:
         yield name
 
diff --git a/tests/test_requirements.py b/tests/test_requirements.py
index ad78c2b..8ce9074 100644
--- a/tests/test_requirements.py
+++ b/tests/test_requirements.py
@@ -1085,3 +1085,74 @@ def test_pickle_requirement_25_0_format_loads() -> None:
     assert str(r.specifier) == ">=2.0"
     assert r.marker is None
     assert r == Requirement("requests>=2.0")
+
+
+class TestRequirementReplace:
+    def test_replace_parts(self) -> None:
+        req = Requirement('requests[security]>=2.0; python_version >= "3"')
+        assert str(req.__replace__(name="flask")) == (
+            'flask[security]>=2.0; python_version >= "3"'
+        )
+        new = req.__replace__(
+            url="https://x.org/a.whl",
+            extras={"b"},
+            specifier=SpecifierSet(),
+            marker=Marker('extra == "Foo_Bar"'),
+        )
+        assert str(new) == 'requests[b] @ https://x.org/a.whl ; extra == "foo-bar"'
+        assert str(req) == 'requests[security]>=2.0; python_version >= "3"'
+
+    def test_replace_nothing_is_equal_copy(self) -> None:
+        req = Requirement("requests>=2.0")
+        new = req.__replace__()
+        assert new == req
+        assert new is not req
+        assert new.specifier is not req.specifier
+
+    def test_copy_replace(self) -> None:
+        copy = pytest.importorskip("copy")
+        if not hasattr(copy, "replace"):
+            pytest.skip("copy.replace needs Python 3.13+")
+        new = copy.replace(Requirement("a>=2.0"), specifier=SpecifierSet(">=3.0"))
+        assert str(new) == "a>=3.0"
+
+    def test_unknown_keyword(self) -> None:
+        with pytest.raises(TypeError):
+            Requirement("a").__replace__(foo=1)  # type: ignore[call-arg]
+
+    @pytest.mark.parametrize(
+        "kwargs",
+        [
+            {"name": "not a name!"},
+            {"name": "foo[bar]"},
+            {"extras": {"a,b"}},
+            {"url": "https://x.org/a b"},
+        ],
+    )
+    def test_invalid(self, kwargs: dict[str, object]) -> None:
+        with pytest.raises(InvalidRequirement):
+            Requirement("a").__replace__(**kwargs)  # type: ignore[arg-type]
+
+    def test_prereleases_kept_and_not_shared(self) -> None:
+        specifier = SpecifierSet(">=1,<3", prereleases=True)
+        specifier._specs[0]._prereleases = False
+        for new in (
+            Requirement("a").__replace__(specifier=specifier),
+            Requirement("a").__replace__(specifier=specifier).__replace__(name="b"),
+        ):
+            assert new.specifier._prereleases is True
+            assert new.specifier is not specifier
+            assert [s._prereleases for s in new.specifier._specs] == [None, False]
+            assert not set(map(id, new.specifier._specs)) & set(
+                map(id, specifier._specs)
+            )
+
+    def test_subclass(self) -> None:
+        class Sub(Requirement):
+            def __init__(self, requirement_string: str) -> None:
+                super().__init__(requirement_string)
+                self.extra_state = 1
+
+        new = Sub("a").__replace__(name="b")
+        assert type(new) is Sub
+        assert new.extra_state == 1
```

</details>

<details><summary>reply</summary>

Adding `Requirement.__replace__` now, then a test and a changelog entry.

Tests are importing an installed copy, not `src`. Running against `src`.

Only my test's assumption about spec order was wrong (the set sorts them). Fixing the test and tidying a stray `, )`.

`Requirement.__replace__` is added in `src/packaging/requirements.py`. The requirement tests pass, and ruff and mypy are clean. I haven't run the rest of the suite.

- **How it works:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`, and an unknown keyword raises `TypeError`. It builds the new object with `self.__class__(str(self))`, so subclasses get their own class with their `__init__` run. It then sets the replaced fields and re-parses the resulting string.
- **Validation:** if the re-parse fails, or `name`, `url` or `extras` don't come back as given, it raises `InvalidRequirement`. That catches `name="not a name!"`, `name="foo[bar]"` and `extras={"a,b"}`. The marker comes from the re-parse, so `extra == "Foo_Bar"` ends up as `extra == "foo-bar"`.
- **Specifier:** the result gets a fresh `SpecifierSet` built from fresh `Specifier`s. The `prereleases` setting is kept on the set and on each specifier, and nothing is shared with the input.
- **Added alongside:**
  - tests in `TestRequirementReplace` in `tests/test_requirements.py`
  - an "unreleased" entry in `CHANGELOG.rst`. I put `versionadded:: 26.4` in the docstring to match the other docs, but I guessed that version number.
- **Test setup:** the venv has an installed `packaging` that shadows `src`, so run the tests with `PYTHONPATH=src`. Without it they import the installed copy and fail. Even then, the `copy.replace` test only runs on 3.13+; on 3.14 here it ran and passed.
- **Not covered:** `url=""` is treated as `None`, and a `specifier` that isn't a `SpecifierSet` isn't checked.

</details>

### claude, all: pass

Files: [CHANGELOG.rst](../all/claude/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [src/packaging/requirements.py](../all/claude/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py), [tests/test_requirements.py](../all/claude/python-feat-packaging-requirement-replace-1/files/tests/test_requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..7c6d6fd 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,11 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add ``Requirement.__replace__()``, supporting :func:`copy.replace` on Python
+  3.13+.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..8834ced 100644
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
@@ -124,6 +124,57 @@ class Requirement:
         if self.marker:
             yield f"; {self.marker}"
 
+    def __replace__(
+        self,
+        *,
+        name: str = ...,  # type: ignore[assignment]
+        url: str | None = ...,  # type: ignore[assignment]
+        extras: Iterable[str] = ...,  # type: ignore[assignment]
+        specifier: SpecifierSet = ...,  # type: ignore[assignment]
+        marker: Marker | None = ...,  # type: ignore[assignment]
+    ) -> Requirement:
+        """Return a copy of this requirement with the given fields replaced.
+
+        Fields that are not given are kept. The result is validated and
+        normalized as if its string form had been parsed, and does not share
+        the :class:`~.SpecifierSet` or its specifiers with the inputs. Also
+        used by :func:`copy.replace` on Python 3.13+.
+
+        :raises InvalidRequirement: If the result is not a valid requirement,
+            or would parse back with different fields than those given.
+
+        .. versionadded:: 26.3
+        """
+        fields: dict[str, Any] = {
+            "name": self.name if name is ... else name,
+            "url": self.url if url is ... else url,
+            "extras": set(self.extras if extras is ... else extras),
+            "specifier": self.specifier if specifier is ... else specifier,
+            "marker": self.marker if marker is ... else marker,
+        }
+        candidate = object.__new__(Requirement)
+        for key, value in fields.items():
+            setattr(candidate, key, value)
+        try:
+            result = type(self)(str(candidate))
+        except InvalidSpecifier as e:
+            raise InvalidRequirement(str(e)) from e
+        if (
+            result.name != fields["name"]
+            or result.url != (fields["url"] or None)
+            or result.extras != fields["extras"]
+            or (result.marker is None) != (fields["marker"] is None)
+        ):
+            raise InvalidRequirement(
+                f"Replacement values do not round-trip: {str(candidate)!r}"
+            )
+        source: SpecifierSet = fields["specifier"]
+        result.specifier = SpecifierSet(
+            [Specifier(str(s), prereleases=s._prereleases) for s in source._specs],
+            prereleases=source._prereleases,
+        )
+        return result
+
     def __getstate__(self) -> tuple[str, bool | None]:
         # Return the requirement string for compactness and stability, paired
         # with the specifier's explicit prereleases override, which is not
diff --git a/tests/test_requirements.py b/tests/test_requirements.py
index ad78c2b..e09faab 100644
--- a/tests/test_requirements.py
+++ b/tests/test_requirements.py
@@ -4,13 +4,14 @@
 
 from __future__ import annotations
 
+import copy
 import pickle
 
 import pytest
 
 from packaging.markers import Marker
 from packaging.requirements import InvalidRequirement, Requirement
-from packaging.specifiers import SpecifierSet
+from packaging.specifiers import Specifier, SpecifierSet
 
 EQUAL_DEPENDENCIES = [
     ("packaging>20.1", "packaging>20.1"),
@@ -1085,3 +1086,81 @@ def test_pickle_requirement_25_0_format_loads() -> None:
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
+        assert r.name == "requests"
+        new = r.__replace__(specifier=SpecifierSet(">=3.0"), extras=set(), marker=None)
+        assert str(new) == "requests>=3.0"
+        assert str(
+            r.__replace__(url="https://x/y.whl", specifier=SpecifierSet(), marker=None)
+        ) == ("requests[security] @ https://x/y.whl")
+        with pytest.raises(InvalidRequirement):
+            r.__replace__(url="https://x/y.whl")
+
+    def test_replace_no_args(self) -> None:
+        r = Requirement("requests[a]>=2.0")
+        new = r.__replace__()
+        assert new == r
+        assert new is not r
+        assert new.extras is not r.extras
+
+    def test_copy_replace(self) -> None:
+        copy_replace = getattr(copy, "replace", None)
+        if copy_replace is None:
+            pytest.skip("copy.replace needs Python 3.13+")
+        assert str(copy_replace(Requirement("a>=2"), name="b")) == "b>=2"
+
+    def test_replace_unknown_keyword(self) -> None:
+        with pytest.raises(TypeError):
+            Requirement("a").__replace__(foo=1)  # type: ignore[call-arg]
+        with pytest.raises(TypeError):
+            Requirement("a").__replace__("b")  # type: ignore[misc]
+
+    @pytest.mark.parametrize(
+        "kwargs",
+        [
+            {"name": "not a name!"},
+            {"name": ""},
+            {"name": "foo[bar]"},
+            {"extras": {"a,b"}},
+            {"extras": {"a b"}},
+            {"url": "http://x; python_version>'3'"},
+            {"url": "a b"},
+        ],
+    )
+    def test_replace_invalid(self, kwargs: dict[str, object]) -> None:
+        with pytest.raises(InvalidRequirement):
+            Requirement("a").__replace__(**kwargs)  # type: ignore[arg-type]
+
+    def test_replace_normalizes_marker(self) -> None:
+        r = Requirement("a").__replace__(marker=Marker('extra == "Foo_Bar"'))
+        assert str(r.marker) == 'extra == "foo-bar"'
+
+    def test_replace_specifier_prereleases_and_no_sharing(self) -> None:
+        spec = SpecifierSet(
+            [Specifier(">=1", prereleases=True), Specifier("<3", prereleases=False)],
+            prereleases=False,
+        )
+        r = Requirement("a").__replace__(specifier=spec)
+        for result in (r, r.__replace__(name="b")):
+            assert result.specifier is not spec
+            assert result.specifier._prereleases is False
+            assert {str(s): s._prereleases for s in result.specifier} == {">=1": True, "<3": False}
+            assert not set(map(id, result.specifier)) & set(map(id, spec))
+        assert r.__replace__(name="b").specifier is not r.specifier
+
+    def test_replace_subclass(self) -> None:
+        class Sub(Requirement):
+            def __init__(self, requirement_string: str) -> None:
+                super().__init__(requirement_string)
+                self.extra_state = 1
+
+        new = Sub("a").__replace__(name="b")
+        assert type(new) is Sub
+        assert new.extra_state == 1
```

</details>

<details><summary>reply</summary>

Fixing test imports, then checking whether the other failures predate my change.

Test bug (URL with specifier is invalid PEP 508). Fix test to drop the specifier.

Done. `Requirement.__replace__` added in `src/packaging/requirements.py`, with tests and a changelog entry. All 5364 tests in `tests/test_requirements.py` pass when run against `src` via `PYTHONPATH=src`. The installed `packaging` shadows `src` otherwise. Under that setup 15 other tests in the file failed before my change. mypy and ruff not run.

It builds the result by re-parsing the candidate string through `type(self)`. It raises `InvalidRequirement` if the parsed fields differ from what you passed.

A `url` replacement on a requirement that has a specifier raises `InvalidRequirement`, since PEP 508 doesn't allow both. You have to pass `specifier=SpecifierSet()` as well.

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
index e9bb15a..6bc2f23 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,11 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add ``Requirement.__replace__`` for validated copies with selected fields
+  changed, including support for ``copy.replace()`` on Python 3.13+.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/docs/requirements.rst b/docs/requirements.rst
index fede671..8ab9f37 100644
--- a/docs/requirements.rst
+++ b/docs/requirements.rst
@@ -69,6 +69,32 @@ Usage
     not have such rules, and the check incorrectly disallows valid requirement
     strings from being parsed.
 
+Copying with changes
+--------------------
+
+Use ``Requirement.__replace__`` to create a validated copy with selected fields
+changed. It accepts keyword arguments ``name`` (a string), ``url`` (a string or
+``None``), ``extras`` (a set of strings), ``specifier`` (a
+:class:`~packaging.specifiers.SpecifierSet`), and ``marker`` (a
+:class:`~packaging.markers.Marker` or ``None``). Unspecified fields are retained.
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
+On Python 3.13 and later, ``copy.replace(req, name="flask")`` also works.
+Calling ``req.__replace__()`` creates an equal but distinct object. Mutable
+fields are copied, including individual specifiers, and explicit prerelease
+settings are preserved. Subclasses are constructed using their own initializer.
+Invalid fields or combinations raise :class:`InvalidRequirement`, including
+values that would be interpreted as different fields when parsed. Unknown
+keywords raise :class:`TypeError`.
+
 Reference
 ---------
 
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..c458d51 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -8,7 +8,7 @@ from typing import TYPE_CHECKING
 from ._parser import parse_requirement as _parse_requirement
 from ._tokenizer import ParserSyntaxError
 from .markers import Marker, _normalize_extra_values
-from .specifiers import InvalidSpecifier, SpecifierSet
+from .specifiers import InvalidSpecifier, Specifier, SpecifierSet
 from .utils import canonicalize_name
 
 if TYPE_CHECKING:
@@ -166,6 +166,62 @@ class Requirement:
     def __str__(self) -> str:
         return "".join(self._iter_parts(self.name))
 
+    def __replace__(self, **changes: object) -> Requirement:
+        """Return a new requirement with the given fields replaced.
+
+        Accepts ``name``, ``url``, ``extras``, ``specifier``, and ``marker``
+        with the same types as the corresponding attributes. The result is
+        validated and normalized by parsing, and mutable fields are copied.
+        Specifier prerelease overrides are preserved.
+
+        :raises TypeError: If an unknown field is supplied.
+        :raises InvalidRequirement: If the resulting fields cannot be represented
+            faithfully as a requirement.
+        """
+        unknown = changes.keys() - Requirement.__slots__
+        if unknown:
+            raise TypeError(f"Unexpected field(s): {', '.join(sorted(unknown))}")
+
+        fields = {
+            field: changes.get(field, getattr(self, field))
+            for field in Requirement.__slots__
+        }
+        if not (
+            isinstance(fields["name"], str)
+            and (fields["url"] is None or isinstance(fields["url"], str))
+            and isinstance(fields["extras"], set)
+            and all(isinstance(extra, str) for extra in fields["extras"])
+            and isinstance(fields["specifier"], SpecifierSet)
+            and (fields["marker"] is None or isinstance(fields["marker"], Marker))
+        ):
+            raise InvalidRequirement("Invalid requirement field types")
+
+        candidate = Requirement.__new__(Requirement)
+        for field, value in fields.items():
+            setattr(candidate, field, value)
+
+        parsed = Requirement(str(candidate))
+        if (
+            parsed.name != candidate.name
+            or parsed.url != candidate.url
+            or parsed.extras != candidate.extras
+            or str(parsed.specifier) != str(candidate.specifier)
+            or parsed.marker != candidate.marker
+        ):
+            raise InvalidRequirement("Requirement fields changed during parsing")
+
+        result = type(self)(str(parsed))
+        # Parsing cannot retain explicit overrides. Reconstruct every specifier
+        # so neither the set nor its mutable members are shared with the input.
+        result.specifier = SpecifierSet(
+            (
+                Specifier(str(spec), prereleases=spec._prereleases)
+                for spec in candidate.specifier._specs
+            ),
+            prereleases=candidate.specifier._prereleases,
+        )
+        return result
+
     def __repr__(self) -> str:
         return f"<{self.__class__.__name__}({str(self)!r})>"
 
diff --git a/tests/test_requirements.py b/tests/test_requirements.py
index ad78c2b..e53cf5b 100644
--- a/tests/test_requirements.py
+++ b/tests/test_requirements.py
@@ -4,6 +4,7 @@
 
 from __future__ import annotations
 
+import copy
 import pickle
 
 import pytest
@@ -1085,3 +1086,115 @@ def test_pickle_requirement_25_0_format_loads() -> None:
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
+        (
+            {"extras": {"Other_Extra"}},
+            'requests[Other_Extra]>=2.0; python_version >= "3"',
+        ),
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
+            {"url": "https://example.org/pkg", "specifier": SpecifierSet()},
+            'requests[security] @ https://example.org/pkg ; python_version >= "3"',
+        ),
+    ],
+)
+def test_replace(changes: dict[str, object], expected: str) -> None:
+    original = Requirement('requests[security]>=2.0; python_version >= "3"')
+    result = original.__replace__(**changes)
+    assert result == Requirement(expected)
+    assert str(result) == expected
+    assert result is not original
+    assert result.extras is not original.extras
+    assert result.marker is None or result.marker is not original.marker
+    assert str(original) == 'requests[security]>=2.0; python_version >= "3"'
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
+        {"url": "https://example.org ; os_name == 'posix'"},
+        {"url": ""},
+        {"url": "https://example.org"},
+        {"name": None},
+        {"extras": {1}},
+        {"specifier": ">=3"},
+        {"marker": "os_name == 'posix'"},
+    ],
+)
+def test_replace_invalid(changes: dict[str, object]) -> None:
+    with pytest.raises(InvalidRequirement):
+        Requirement("requests>=2").__replace__(**changes)
+
+
+def test_replace_unknown_field() -> None:
+    with pytest.raises(TypeError):
+        Requirement("requests").__replace__(unknown="foo")
+    with pytest.raises(TypeError):
+        Requirement("requests").__replace__("foo")  # type: ignore[call-arg]
+
+
+@pytest.mark.parametrize("override", [None, False, True])
+@pytest.mark.parametrize("individual", [None, False, True])
+@pytest.mark.parametrize("replace_specifier", [False, True])
+def test_replace_prereleases(
+    override: bool | None, individual: bool | None, replace_specifier: bool
+) -> None:
+    original = Requirement("requests>=2,<4")
+    source = SpecifierSet(">=3,<5") if replace_specifier else original.specifier
+    source.prereleases = override
+    for spec in source:
+        spec.prereleases = individual
+    result = (
+        original.__replace__(specifier=source)
+        if replace_specifier
+        else original.__replace__()
+    )
+    assert result.specifier is not source
+    assert result.specifier._prereleases is override
+    for copied, spec in zip(
+        sorted(result.specifier, key=str), sorted(source, key=str), strict=True
+    ):
+        assert copied is not spec
+        assert copied._prereleases is individual
+        copied.prereleases = not individual
+        assert spec._prereleases is individual
+    result.specifier.prereleases = not override
+    assert source._prereleases is override
+
+
+def test_replace_subclass() -> None:
+    class CustomRequirement(Requirement):
+        def __init__(self, requirement_string: str) -> None:
+            super().__init__(requirement_string)
+            self.initialized_name = self.name
+
+    result = CustomRequirement("requests").__replace__(name="flask")
+    assert isinstance(result, CustomRequirement)
+    assert result.initialized_name == "flask"
+
+
+def test_copy_replace() -> None:
+    if not hasattr(copy, "replace"):
+        pytest.skip("copy.replace requires Python 3.13+")
+    assert copy.replace(
+        Requirement("requests>=2"), specifier=SpecifierSet(">=3")
+    ) == Requirement("requests>=3")
```

</details>

<details><summary>reply</summary>

I’ll check how `Requirement` is parsed and tested, then add `__replace__` with validation and independent specifier copies.

Parsing the assembled requirement will validate its syntax, but it can also silently reinterpret a field—for example, `name="foo[bar]"` becomes a name plus an extra. I’ll check that fields survive parsing unchanged, then copy the specifiers separately to preserve their prerelease settings.

The requirement tests pass, including `copy.replace()`, subclass initialization, field validation, and independent prerelease settings. I’m finishing the documentation and style checks, then running the related marker and specifier tests.

Added `Requirement.__replace__` with field validation, independent mutable copies, preserved prerelease settings, and subclass initialization support. It works directly and through `copy.replace()`.

Added tests, documentation, and a changelog entry.

Validation: 9,746 tests passed; Ruff and mypy checks passed.

</details>

### codex, hush: pass

Files: [CHANGELOG.rst](../hush/codex/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [docs/requirements.rst](../hush/codex/python-feat-packaging-requirement-replace-1/files/docs/requirements.rst), [src/packaging/requirements.py](../hush/codex/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py), [tests/test_requirements.py](../hush/codex/python-feat-packaging-requirement-replace-1/files/tests/test_requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..47ca6d5 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,11 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add ``Requirement.__replace__`` to copy requirements with selected fields
+  changed, including support for ``copy.replace`` on Python 3.13+.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/docs/requirements.rst b/docs/requirements.rst
index fede671..15148eb 100644
--- a/docs/requirements.rst
+++ b/docs/requirements.rst
@@ -72,6 +72,16 @@ Usage
 Reference
 ---------
 
+Use ``req.__replace__(name="other")`` to create an independent requirement
+with selected fields changed. On Python 3.13+, ``copy.replace(req, name="other")``
+also works. Supported fields are ``name``, ``url``, ``extras``, ``specifier``, and
+``marker``, using the same types as the attributes. Pass ``None`` to remove a URL
+or marker, an empty set to remove extras, or an empty ``SpecifierSet`` to remove
+version constraints. Invalid values raise :class:`InvalidRequirement`, and
+unknown fields raise :class:`TypeError`. Specifier prerelease settings are
+preserved without sharing mutable specifiers. Subclasses retain their type and
+run their initializer.
+
 .. automodule:: packaging.requirements
     :members:
     :exclude-members: __init__, __new__
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..b2c44a3 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -3,12 +3,12 @@
 # for complete details.
 from __future__ import annotations
 
-from typing import TYPE_CHECKING
+from typing import TYPE_CHECKING, TypeVar
 
 from ._parser import parse_requirement as _parse_requirement
 from ._tokenizer import ParserSyntaxError
 from .markers import Marker, _normalize_extra_values
-from .specifiers import InvalidSpecifier, SpecifierSet
+from .specifiers import InvalidSpecifier, Specifier, SpecifierSet
 from .utils import canonicalize_name
 
 if TYPE_CHECKING:
@@ -19,6 +19,8 @@ __all__ = [
     "Requirement",
 ]
 
+_RequirementT = TypeVar("_RequirementT", bound="Requirement")
+
 
 def __dir__() -> list[str]:
     return __all__
@@ -106,6 +108,62 @@ class Requirement:
             self.marker = Marker.__new__(Marker)
             self.marker._markers = _normalize_extra_values(parsed.marker)
 
+    def __replace__(  # noqa: PYI019 - Self is unavailable on Python 3.10
+        self: _RequirementT, **changes: object
+    ) -> _RequirementT:
+        """Return a new requirement with the specified fields replaced.
+
+        Accepts ``name``, ``url``, ``extras``, ``specifier``, and ``marker``.
+        Values must have the same types as the corresponding attributes.
+        Invalid requirements, including values that change another field when
+        parsed, raise :class:`InvalidRequirement`. Specifier prerelease overrides
+        are preserved, with independent copies of the set and its specifiers.
+        """
+        fields = Requirement.__slots__
+        unknown = changes.keys() - set(fields)
+        if unknown:
+            raise TypeError(f"Unexpected field(s): {', '.join(sorted(unknown))}")
+
+        values = {field: changes.get(field, getattr(self, field)) for field in fields}
+        name: object = values["name"]
+        url: object = values["url"]
+        extras: object = values["extras"]
+        specifier: object = values["specifier"]
+        marker: object = values["marker"]
+        if not (
+            isinstance(name, str)
+            and (url is None or isinstance(url, str))
+            and isinstance(extras, set)
+            and all(isinstance(extra, str) for extra in extras)
+            and isinstance(specifier, SpecifierSet)
+            and (marker is None or isinstance(marker, Marker))
+        ):
+            raise InvalidRequirement("Invalid requirement field type")
+
+        candidate = Requirement.__new__(Requirement)
+        for field, value in values.items():
+            setattr(candidate, field, value)
+
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
+        result.specifier = SpecifierSet(
+            (
+                Specifier(str(spec), prereleases=spec._prereleases)
+                for spec in candidate.specifier
+            ),
+            prereleases=candidate.specifier._prereleases,
+        )
+        return result
+
     def _iter_parts(self, name: str) -> Iterator[str]:
         yield name
 
diff --git a/tests/test_requirements.py b/tests/test_requirements.py
index ad78c2b..dd80e12 100644
--- a/tests/test_requirements.py
+++ b/tests/test_requirements.py
@@ -4,6 +4,7 @@
 
 from __future__ import annotations
 
+import copy
 import pickle
 
 import pytest
@@ -1085,3 +1086,92 @@ def test_pickle_requirement_25_0_format_loads() -> None:
     assert str(r.specifier) == ">=2.0"
     assert r.marker is None
     assert r == Requirement("requests>=2.0")
+
+
+class TestRequirementReplace:
+    def test_copy_and_fields(self) -> None:
+        original = Requirement('requests[security]>=2; python_version >= "3"')
+        clone = original.__replace__()
+        assert clone == original
+        assert clone is not original
+        assert clone.extras is not original.extras
+        assert clone.marker is not original.marker
+        assert original.__replace__(name="flask").name == "flask"
+        changed = original.__replace__(
+            name="flask",
+            extras={"test"},
+            specifier=SpecifierSet(),
+            url="https://example.com/flask.whl",
+            marker=None,
+        )
+        assert str(changed) == "flask[test] @ https://example.com/flask.whl"
+        assert str(original) == 'requests[security]>=2; python_version >= "3"'
+        assert changed.__replace__(url=None).url is None
+
+    @pytest.mark.parametrize(
+        "changes",
+        [
+            {"name": "not a name!"},
+            {"name": "foo[bar]"},
+            {"extras": {"a,b"}},
+            {"extras": {""}},
+            {"url": ""},
+            {"url": "https://example.com ; os_name == 'posix'"},
+            {"url": "https://example.com"},
+            {"name": None},
+        ],
+    )
+    def test_invalid(self, changes: dict[str, object]) -> None:
+        with pytest.raises(InvalidRequirement):
+            Requirement("requests>=2").__replace__(**changes)
+
+    def test_arguments(self) -> None:
+        with pytest.raises(TypeError):
+            Requirement("foo").__replace__(unknown="bar")
+        with pytest.raises(TypeError):
+            Requirement("foo").__replace__("bar")  # type: ignore[call-arg]
+
+    @pytest.mark.parametrize("replace_specifier", [False, True])
+    @pytest.mark.parametrize("override", [None, False, True])
+    def test_prereleases(self, replace_specifier: bool, override: bool | None) -> None:
+        original = Requirement("foo>=1a1,<3,!=2")
+        specs = SpecifierSet(">=1a1,<3,!=2", prereleases=override)
+        for spec, setting in zip(specs, [None, False, True], strict=True):
+            spec.prereleases = setting
+        original.specifier = specs
+        result = (
+            original.__replace__(specifier=specs)
+            if replace_specifier
+            else original.__replace__()
+        )
+        assert result.specifier is not specs
+        assert result.specifier._prereleases is override
+        for before, after in zip(specs, result.specifier, strict=True):
+            assert before == after
+            assert before is not after
+            assert before._prereleases is after._prereleases
+        result.specifier.prereleases = not override
+        assert specs._prereleases is override
+
+    def test_marker_normalization(self) -> None:
+        result = Requirement("foo").__replace__(marker=Marker('extra == "Foo_Bar"'))
+        assert str(result.marker) == 'extra == "foo-bar"'
+        assert result == Requirement(str(result))
+
+    def test_subclass(self) -> None:
+        class Child(Requirement):
+            def __init__(self, requirement_string: str) -> None:
+                super().__init__(requirement_string)
+                self.initialized = True
+
+        result = Child("foo").__replace__(name="bar")
+        assert isinstance(result, Child)
+        assert result.initialized
+        assert result.name == "bar"
+
+    def test_copy_replace(self) -> None:
+        if not hasattr(copy, "replace"):
+            pytest.skip("copy.replace requires Python 3.13")
+        assert copy.replace(
+            Requirement("foo>=2"), specifier=SpecifierSet(">=3")
+        ) == Requirement("foo>=3")
```

</details>

<details><summary>reply</summary>

Done.
Added `Requirement.__replace__`, validation, independent specifiers, subclass support, docs. All 5,369 requirement tests, Ruff, and mypy passed.

</details>

### codex, sloth: pass

Files: [CHANGELOG.rst](../sloth/codex/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [docs/requirements.rst](../sloth/codex/python-feat-packaging-requirement-replace-1/files/docs/requirements.rst), [src/packaging/requirements.py](../sloth/codex/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py), [tests/test_requirements.py](../sloth/codex/python-feat-packaging-requirement-replace-1/files/tests/test_requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..be21199 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,11 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add :meth:`Requirement.__replace__ <packaging.requirements.Requirement.__replace__>`
+  to copy requirements with changed fields, including through :func:`copy.replace`.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/docs/requirements.rst b/docs/requirements.rst
index fede671..036c4ae 100644
--- a/docs/requirements.rst
+++ b/docs/requirements.rst
@@ -69,9 +69,34 @@ Usage
     not have such rules, and the check incorrectly disallows valid requirement
     strings from being parsed.
 
+Copying with changes
+--------------------
+
+Use :meth:`Requirement.__replace__` to create a new requirement with different
+fields. On Python 3.13 and later, :func:`copy.replace` also calls this method.
+
+.. doctest::
+
+    >>> req = Requirement('requests[security]>=2.0; python_version >= "3"')
+    >>> req.__replace__(name="flask")
+    <Requirement('flask[security]>=2.0; python_version >= "3"')>
+    >>> from packaging.specifiers import SpecifierSet
+    >>> Requirement("requests>=2.0").__replace__(specifier=SpecifierSet(">=3.0"))
+    <Requirement('requests>=3.0')>
+
+The keyword arguments are ``name``, ``url``, ``extras``, ``specifier``, and
+``marker``, with the same types as the corresponding attributes. Omitted fields
+are kept; calling without arguments returns an equal but distinct requirement.
+Unknown keywords raise :class:`TypeError`. Invalid fields, including values that
+would be parsed as different fields, raise :class:`InvalidRequirement`.
+The result is normalized by parsing, preserves specifier prerelease overrides,
+and shares no mutable fields with the original or supplied values. Subclasses
+are constructed through their own initializer.
+
 Reference
 ---------
 
 .. automodule:: packaging.requirements
     :members:
+    :special-members: __replace__
     :exclude-members: __init__, __new__
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..563c500 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -8,7 +8,7 @@ from typing import TYPE_CHECKING
 from ._parser import parse_requirement as _parse_requirement
 from ._tokenizer import ParserSyntaxError
 from .markers import Marker, _normalize_extra_values
-from .specifiers import InvalidSpecifier, SpecifierSet
+from .specifiers import InvalidSpecifier, Specifier, SpecifierSet
 from .utils import canonicalize_name
 
 if TYPE_CHECKING:
@@ -106,6 +106,43 @@ class Requirement:
             self.marker = Marker.__new__(Marker)
             self.marker._markers = _normalize_extra_values(parsed.marker)
 
+    def __replace__(self, **changes: object) -> Requirement:
+        """Return a validated copy with the given requirement fields replaced.
+
+        Only ``name``, ``url``, ``extras``, ``specifier``, and ``marker`` may
+        be supplied. Invalid or reinterpreted fields raise InvalidRequirement.
+        Specifier prerelease overrides are preserved without sharing objects.
+        """
+        fields = {
+            "name": (str,),
+            "url": (str, type(None)),
+            "extras": (set,),
+            "specifier": (SpecifierSet,),
+            "marker": (Marker, type(None)),
+        }
+        for field in changes:
+            if field not in fields:
+                raise TypeError(f"Unexpected field name: {field!r}")
+
+        candidate = Requirement.__new__(Requirement)
+        for field, types in fields.items():
+            value = changes.get(field, getattr(self, field))
+            if not isinstance(value, types):
+                raise InvalidRequirement(f"Invalid {field}: {value!r}")
+            setattr(candidate, field, value)
+        if any(not isinstance(extra, str) for extra in candidate.extras):
+            raise InvalidRequirement(f"Invalid extras: {candidate.extras!r}")
+        specifier = candidate.specifier
+        specs = [Specifier(str(s), prereleases=s._prereleases) for s in specifier]
+        candidate.specifier = SpecifierSet(specs, prereleases=specifier._prereleases)
+        result = type(self)(str(candidate))
+        for field in ("name", "url", "extras", "specifier"):
+            value = getattr(candidate, field)
+            if getattr(result, field) != value:
+                raise InvalidRequirement(f"Invalid {field}: {value!r}")
+        result.specifier = SpecifierSet(specs, prereleases=specifier._prereleases)
+        return result
+
     def _iter_parts(self, name: str) -> Iterator[str]:
         yield name
 
diff --git a/tests/test_requirements.py b/tests/test_requirements.py
index ad78c2b..bea1d73 100644
--- a/tests/test_requirements.py
+++ b/tests/test_requirements.py
@@ -4,13 +4,130 @@
 
 from __future__ import annotations
 
+import copy
 import pickle
+from typing import TYPE_CHECKING
 
 import pytest
 
 from packaging.markers import Marker
 from packaging.requirements import InvalidRequirement, Requirement
-from packaging.specifiers import SpecifierSet
+from packaging.specifiers import Specifier, SpecifierSet
+
+if TYPE_CHECKING:
+    from collections.abc import Callable
+
+
+@pytest.mark.parametrize(
+    "replace",
+    [
+        Requirement.__replace__,
+        pytest.param(
+            getattr(copy, "replace", None),
+            marks=pytest.mark.skipif(
+                not hasattr(copy, "replace"), reason="Requires Python 3.13+"
+            ),
+        ),
+    ],
+)
+def test_replace(replace: Callable[..., Requirement]) -> None:
+    """Replacing fields validates, preserves defaults, and copies mutable state."""
+    requirement = Requirement('requests[security]>=2.0; python_version >= "3"')
+    replacement = replace(requirement, name="flask")
+    assert str(replacement) == 'flask[security]>=2.0; python_version >= "3"'
+    assert str(requirement) == 'requests[security]>=2.0; python_version >= "3"'
+    duplicate = replace(requirement)
+    assert duplicate == requirement
+    assert duplicate is not requirement
+    assert duplicate.extras is not requirement.extras
+    assert duplicate.marker is not requirement.marker
+    replacement = replace(
+        requirement,
+        url="https://example.com/flask.whl",
+        extras=set(),
+        specifier=SpecifierSet(),
+        marker=None,
+    )
+    assert str(replacement) == "requests @ https://example.com/flask.whl"
+    assert replace(replacement, url=None) == Requirement("requests")
+    assert str(replace(requirement, marker=Marker('extra == "Foo_Bar"')).marker) == (
+        'extra == "foo-bar"'
+    )
+    with pytest.raises(TypeError):
+        replace(requirement, unknown="foo")
+    with pytest.raises(TypeError):
+        requirement.__replace__("foo")  # type: ignore[call-arg]
+
+
+@pytest.mark.parametrize(
+    "changes",
+    [
+        {"name": None},
+        {"specifier": ">=1"},
+        {"marker": ""},
+        {"extras": "security"},
+        {"extras": {1, "security"}},
+        {"name": "not a name!"},
+        {"name": "foo[bar]"},
+        {"name": "foo>=1"},
+        {"extras": {"a,b"}},
+        {"extras": {""}},
+        {"url": ""},
+        {"url": 'https://example.com ; python_version >= "3"'},
+        {"url": "https://example.com", "specifier": SpecifierSet(">=1")},
+    ],
+)
+def test_replace_invalid(changes: dict[str, object]) -> None:
+    """Reject invalid fields and values that would change another field."""
+    with pytest.raises(InvalidRequirement):
+        Requirement("requests").__replace__(**changes)
+
+
+@pytest.mark.parametrize("prereleases", [None, False, True])
+@pytest.mark.parametrize("explicit", [False, True])
+def test_replace_specifier_copy(prereleases: bool | None, explicit: bool) -> None:
+    """Copy set and individual overrides for supplied and inherited specifiers."""
+    specifier = SpecifierSet(
+        [
+            Specifier(">=2.0", prereleases=True),
+            Specifier("<4", prereleases=False),
+            Specifier("<4", prereleases=True),
+        ],
+        prereleases=prereleases,
+    )
+    requirement = Requirement("requests")
+    requirement.specifier = specifier
+    result = (
+        requirement.__replace__(specifier=specifier)
+        if explicit
+        else requirement.__replace__()
+    )
+    assert result.specifier is not specifier
+    assert result.specifier._prereleases is prereleases
+    assert len(result.specifier) == len(specifier)
+    for original, cloned in zip(specifier, result.specifier, strict=True):
+        assert cloned is not original
+        assert cloned._prereleases is original._prereleases
+        cloned.prereleases = not original.prereleases
+        assert cloned.prereleases is not original.prereleases
+    assert str(result) == "requests<4,>=2.0"
+    result.specifier.prereleases = not prereleases
+    assert specifier._prereleases is prereleases
+
+
+def test_replace_subclass() -> None:
+    """Replacement invokes the subclass constructor."""
+
+    class SubRequirement(Requirement):
+        def __init__(self, requirement_string: str) -> None:
+            """Record the name parsed by the constructor."""
+            super().__init__(requirement_string)
+            self.initial_name = self.name
+
+    result = SubRequirement("requests").__replace__(name="flask")
+    assert isinstance(result, SubRequirement)
+    assert result.initial_name == "flask"
+
 
 EQUAL_DEPENDENCIES = [
     ("packaging>20.1", "packaging>20.1"),
```

</details>

<details><summary>reply</summary>

I’ll check how requirements are parsed and tested, then add `__replace__` with validation and independent specifier copies.

The change needs to reach `Requirement`, its existing tests, and the requirements documentation; no caller, export, fixture, or configuration changes are needed. I’ll reuse parsing for validation, check that fields don’t get reinterpreted, and copy specifiers separately to preserve prerelease settings. No new dependency or option is needed.

The requirement tests pass, including `copy.replace()` on Python 3.14. I’m checking two remaining edge cases: field values with the wrong type, and duplicate specifiers with different prerelease overrides. Then I’ll run the full suite and build the package.

The specifier copy now preserves duplicate entries and each entry’s prerelease override. Lint, type checks, documentation examples, and the package build pass. The full test suite is still running.

Added `Requirement.__replace__` with validation, normalization, independent specifier copies, preserved prerelease settings, and subclass initialization. It also works through `copy.replace()` on Python 3.13+.

Added tests, documentation, and a changelog entry.

Validation passed: 62,515 tests, lint, type checks, documentation examples, and package build.

</details>

### codex, all: pass

Files: [CHANGELOG.rst](../all/codex/python-feat-packaging-requirement-replace-1/files/CHANGELOG.rst), [docs/requirements.rst](../all/codex/python-feat-packaging-requirement-replace-1/files/docs/requirements.rst), [src/packaging/requirements.py](../all/codex/python-feat-packaging-requirement-replace-1/files/src/packaging/requirements.py), [tests/test_requirements.py](../all/codex/python-feat-packaging-requirement-replace-1/files/tests/test_requirements.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index e9bb15a..19b1860 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -4,6 +4,11 @@ Changelog
 *unreleased*
 ~~~~~~~~~~~~
 
+Features:
+
+* Add ``Requirement.__replace__`` for validated copies with changed fields and
+  support for ``copy.replace()`` on Python 3.13 and later.
+
 Removals:
 
 * Drop support for EOL Python 3.9. (:pull:`1263`)
diff --git a/docs/requirements.rst b/docs/requirements.rst
index fede671..44ab713 100644
--- a/docs/requirements.rst
+++ b/docs/requirements.rst
@@ -69,6 +69,15 @@ Usage
     not have such rules, and the check incorrectly disallows valid requirement
     strings from being parsed.
 
+Requirements can be copied with individual fields changed using
+``req.__replace__(name="other")``, or ``copy.replace(req, name="other")`` on
+Python 3.13 and later. Supported keyword arguments are ``name``, ``url``,
+``extras``, ``specifier``, and ``marker``, with the same types as the attributes.
+Omitted fields are preserved. The result is a new instance of the same class,
+validated and normalized by parsing; invalid or ambiguous values raise
+:class:`InvalidRequirement`. Specifier prerelease overrides are preserved,
+and mutable fields are independent of the original and supplied values.
+
 Reference
 ---------
 
diff --git a/src/packaging/requirements.py b/src/packaging/requirements.py
index 124de66..601b4f7 100644
--- a/src/packaging/requirements.py
+++ b/src/packaging/requirements.py
@@ -3,6 +3,7 @@
 # for complete details.
 from __future__ import annotations
 
+from copy import deepcopy
 from typing import TYPE_CHECKING
 
 from ._parser import parse_requirement as _parse_requirement
@@ -124,6 +125,46 @@ class Requirement:
         if self.marker:
             yield f"; {self.marker}"
 
+    def __replace__(self, **changes: object) -> Requirement:
+        """Return a validated copy with the given fields replaced.
+
+        Accept only ``name``, ``url``, ``extras``, ``specifier``, and ``marker``.
+        Values have the same types as the corresponding attributes. Unspecified
+        fields are preserved, including specifier prerelease overrides. Mutable
+        fields are copied. Invalid or ambiguous values raise InvalidRequirement.
+        """
+        fields = {
+            "name": (str,),
+            "url": (str, type(None)),
+            "extras": (set,),
+            "specifier": (SpecifierSet,),
+            "marker": (Marker, type(None)),
+        }
+        for key, value in changes.items():
+            if key not in fields:
+                raise TypeError(
+                    "Requirement.__replace__() got an unexpected "
+                    f"keyword argument {key!r}"
+                )
+            if not isinstance(value, fields[key]):
+                raise InvalidRequirement(f"Invalid replacement field type: {key}")
+        candidate = Requirement.__new__(Requirement)
+        for key in fields:
+            setattr(candidate, key, changes.get(key, getattr(self, key)))
+        if not all(isinstance(extra, str) for extra in candidate.extras):
+            raise InvalidRequirement("Invalid replacement extra type")
+        result = type(self)(str(candidate))
+        if (
+            result.name != candidate.name
+            or result.url != candidate.url
+            or result.extras != candidate.extras
+            or str(result.specifier) != str(candidate.specifier)
+            or result.marker != candidate.marker
+        ):
+            raise InvalidRequirement("Replacement fields do not round-trip")
+        result.specifier = deepcopy(candidate.specifier)
+        return result
+
     def __getstate__(self) -> tuple[str, bool | None]:
         # Return the requirement string for compactness and stability, paired
         # with the specifier's explicit prereleases override, which is not
diff --git a/tests/test_requirements.py b/tests/test_requirements.py
index ad78c2b..0ec2221 100644
--- a/tests/test_requirements.py
+++ b/tests/test_requirements.py
@@ -4,6 +4,7 @@
 
 from __future__ import annotations
 
+import copy
 import pickle
 
 import pytest
@@ -1085,3 +1086,86 @@ def test_pickle_requirement_25_0_format_loads() -> None:
     assert str(r.specifier) == ">=2.0"
     assert r.marker is None
     assert r == Requirement("requests>=2.0")
+
+
+@pytest.mark.parametrize("prereleases", [None, True, False])
+@pytest.mark.parametrize("replace_specifier", [False, True])
+def test_replace(prereleases: bool | None, replace_specifier: bool) -> None:
+    """Replacement validates fields and preserves independent specifier state."""
+    original = Requirement('requests[security]>=2.0; python_version >= "3"')
+    specifier = SpecifierSet(">=3.0") if replace_specifier else original.specifier
+    specifier.prereleases = prereleases
+    for spec in specifier:
+        spec.prereleases = prereleases
+    result = original.__replace__(name="flask", specifier=specifier)
+    assert result.name == "flask"
+    assert result.extras == original.extras
+    assert result.extras is not original.extras
+    assert result.marker == original.marker
+    assert result.marker is not original.marker
+    assert result.specifier == specifier
+    assert result.specifier is not specifier
+    assert result.specifier._prereleases is prereleases
+    for cloned, source in zip(result.specifier, specifier, strict=True):
+        assert cloned is not source
+        assert cloned._prereleases is prereleases
+        cloned.prereleases = not prereleases
+        assert source._prereleases is prereleases
+    assert original.name == "requests"
+    duplicate = original.__replace__()
+    assert duplicate == original
+    assert duplicate is not original
+    assert result == Requirement(str(result))
+    assert original.__replace__(extras=set(), marker=None).extras == set()
+    assert original.__replace__(marker=None).marker is None
+    assert str(original.__replace__(marker=Marker('extra == "Foo_Bar"')).marker) == (
+        'extra == "foo-bar"'
+    )
+    assert Requirement("foo").__replace__(url="https://example.com").url == (
+        "https://example.com"
+    )
+    assert Requirement("foo @ https://example.com").__replace__(url=None).url is None
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
+        {"url": "https://example.com", "specifier": SpecifierSet(">=1")},
+        {"name": None},
+        {"specifier": ">=1"},
+    ],
+)
+def test_replace_invalid(changes: dict[str, object]) -> None:
+    """Invalid and ambiguous replacements must not silently change fields."""
+    with pytest.raises(InvalidRequirement):
+        Requirement("foo").__replace__(**changes)
+
+
+def test_replace_arguments_and_subclass() -> None:
+    """Replacement honors the copy protocol and initializes subclasses."""
+
+    class CustomRequirement(Requirement):
+        def __init__(self, requirement_string: str) -> None:
+            """Initialize additional subclass state."""
+            super().__init__(requirement_string)
+            self.initialized = True
+
+    original = CustomRequirement("requests>=2.0")
+    result = original.__replace__(name="flask")
+    assert isinstance(result, CustomRequirement)
+    assert result.initialized
+    with pytest.raises(TypeError):
+        original.__replace__(unknown="foo")
+    with pytest.raises(TypeError):
+        original.__replace__("foo")  # type: ignore[call-arg]
+    if hasattr(copy, "replace"):
+        assert copy.replace(original, specifier=SpecifierSet(">=3.0")) == Requirement(
+            "requests>=3.0"
+        )
```

</details>

<details><summary>reply</summary>

Done.
Added validated `Requirement.__replace__`, independent specifiers, prerelease preservation, subclass support, docs. All 62,510 tests passed; build, lint, types passed.

</details>
