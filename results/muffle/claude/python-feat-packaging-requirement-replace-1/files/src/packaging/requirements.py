# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ._parser import parse_requirement as _parse_requirement
from ._tokenizer import ParserSyntaxError
from .markers import Marker, _normalize_extra_values
from .specifiers import InvalidSpecifier, Specifier, SpecifierSet
from .utils import canonicalize_name

if TYPE_CHECKING:
    from collections.abc import Iterable, Iterator

__all__ = [
    "InvalidRequirement",
    "Requirement",
]


def __dir__() -> list[str]:
    return __all__


_MISSING: Any = object()


def _copy_specifier_set(specifier: SpecifierSet) -> SpecifierSet:
    """Copy a specifier set and its specifiers, keeping ``prereleases``."""
    specs = [
        Specifier(str(s), prereleases=getattr(s, "_prereleases", None))
        for s in specifier._specs
    ]
    return SpecifierSet(specs, prereleases=specifier._prereleases)


def _iter_parts(
    name: str,
    extras: Iterable[str],
    specifier: SpecifierSet,
    url: str | None,
    marker: Marker | None,
) -> Iterator[str]:
    yield name

    if extras:
        formatted_extras = ",".join(sorted(extras))
        yield f"[{formatted_extras}]"

    if specifier:
        yield str(specifier)

    if url:
        yield f" @ {url}"
        if marker:
            yield " "

    if marker:
        yield f"; {marker}"


class InvalidRequirement(ValueError):
    """
    Raised when attempting to create a :class:`Requirement` with a string that
    does not conform to the specification. Users should refer to PEP 508.

    .. versionadded:: 16.1
    """


class Requirement:
    """Represent a requirement for a project.

    Parse a given requirement string into its parts, such as name, specifier,
    URL, and extras, according to the specification.

    .. versionadded:: 16.1

    .. versionchanged:: 22.0
        Added equality (``__eq__``) and hashing (``__hash__``) so requirements
        can be compared and stored in sets / dicts.

    .. versionchanged:: 23.2
        Equality and hashing began canonicalizing requirement names, so
        requirements whose names differ only by normalization (e.g.
        ``Requirement("Foo")`` vs ``Requirement("foo")``) now compare and hash
        equal.

    Instances are safe to serialize with :mod:`pickle`. They use a stable
    format so the same pickle can be loaded in future packaging releases.

    .. versionchanged:: 26.2

        Added a stable pickle format. Pickles created with packaging 26.2+ can
        be unpickled with future releases.  Backward compatibility with pickles
        from packaging < 26.2 is supported but may be removed in a future
        release.

    .. versionchanged:: 26.3

        The dedicated pickle support introduced in 26.2 did not preserve the
        specifier's explicit :attr:`~packaging.specifiers.SpecifierSet.prereleases`
        override; it is now included again.

        Equality and hashing normalize requirement names, extras, and
        equivalent specifiers. The string representation still preserves the
        parsed name and extras spelling.

    :param str requirement_string: The string representation of a requirement.
    :raises InvalidRequirement: If the given ``requirement_string`` is not
        parseable, then this exception will be raised.
    """

    # TODO: Can we test whether something is contained within a requirement?
    #       If so how do we do that? Do we need to test against the _name_ of
    #       the thing as well as the version? What about the markers?
    # TODO: Can we normalize the name and extra name?

    __slots__ = ("extras", "marker", "name", "specifier", "url")

    def __init__(self, requirement_string: str) -> None:
        try:
            parsed = _parse_requirement(requirement_string)
        except ParserSyntaxError as e:
            raise InvalidRequirement(str(e)) from e

        self.name: str = parsed.name
        """The name of the requirement."""
        self.url: str | None = parsed.url or None
        """The URL to download the requirement from, or ``None``."""
        self.extras: set[str] = set(parsed.extras)
        """A set of extras that the requirement specifies."""
        try:
            self.specifier: SpecifierSet = SpecifierSet(parsed.specifier)
            """A :class:`~.SpecifierSet` of the version specified by the requirement."""
        except InvalidSpecifier as e:
            raise InvalidRequirement(str(e)) from e
        self.marker: Marker | None = None
        """A :class:`~.Marker` for the requirement, or ``None``."""
        if parsed.marker is not None:
            self.marker = Marker.__new__(Marker)
            self.marker._markers = _normalize_extra_values(parsed.marker)

    def __replace__(
        self,
        *,
        name: str = _MISSING,
        url: str | None = _MISSING,
        extras: Iterable[str] = _MISSING,
        specifier: SpecifierSet = _MISSING,
        marker: Marker | None = _MISSING,
    ) -> Requirement:
        """Return a copy with the given fields replaced.

        Supports :func:`copy.replace` on Python 3.13+. Fields that are not
        given are kept. The result does not share mutable state with ``self``
        or the arguments, and is validated and normalized as if its string
        form had been parsed.

        :raises InvalidRequirement: If the result is not a valid requirement,
            or would parse back differently than the values given.
        """
        if name is _MISSING:
            name = self.name
        if url is _MISSING:
            url = self.url
        if extras is _MISSING:
            extras = self.extras
        elif isinstance(extras, str):
            raise TypeError("extras must be an iterable of strings, not a string")
        extras = set(extras)
        if specifier is _MISSING:
            specifier = self.specifier
        elif isinstance(specifier, str):
            specifier = SpecifierSet(specifier)
        if marker is _MISSING:
            marker = self.marker

        if not isinstance(name, str):
            raise InvalidRequirement(f"Invalid name: {name!r}")
        if url is not None and not isinstance(url, str):
            raise InvalidRequirement(f"Invalid url: {url!r}")
        if not all(isinstance(e, str) for e in extras):
            raise InvalidRequirement(f"Invalid extras: {extras!r}")

        try:
            new_specifier = _copy_specifier_set(specifier)
        except InvalidSpecifier as e:
            raise InvalidRequirement(str(e)) from e

        # Round-trip through the string form, so the result is exactly what
        # parsing would give, then reject anything that parsed differently.
        text = "".join(_iter_parts(name, extras, new_specifier, url, marker))
        new = type(self)(text)
        if (
            new.name != name
            or new.url != url
            or new.extras != extras
            or (new.marker is None) != (marker is None)
        ):
            raise InvalidRequirement(
                f"Replacement values do not form a valid requirement: {text!r}"
            )
        new.specifier = new_specifier
        return new

    def _iter_parts(self, name: str) -> Iterator[str]:
        return _iter_parts(name, self.extras, self.specifier, self.url, self.marker)

    def __getstate__(self) -> tuple[str, bool | None]:
        # Return the requirement string for compactness and stability, paired
        # with the specifier's explicit prereleases override, which is not
        # captured by the string form. Re-parsed on load to reconstruct all
        # other fields.
        return (str(self), self.specifier._prereleases)

    def __setstate__(self, state: object) -> None:
        if isinstance(state, str):
            # Format (26.2): just the requirement string.
            requirement_string: str = state
            prereleases: bool | None = None
        elif (
            isinstance(state, tuple)
            and len(state) == 2
            and isinstance(state[0], str)
            and (state[1] is None or isinstance(state[1], bool))
        ):
            # New format (26.3+): (requirement string, specifier prereleases).
            requirement_string, prereleases = state
        elif isinstance(state, dict) and state.keys() >= set(self.__slots__):
            # Old format (packaging <= 26.1, no __slots__): plain __dict__.
            for key in self.__slots__:
                setattr(self, key, state[key])
            return
        else:
            raise TypeError(f"Cannot restore Requirement from {state!r}")

        try:
            tmp = Requirement(requirement_string)
        except InvalidRequirement as exc:
            raise TypeError(f"Cannot restore Requirement from {state!r}") from exc
        self.name = tmp.name
        self.url = tmp.url
        self.extras = tmp.extras
        self.specifier = tmp.specifier
        self.specifier._prereleases = prereleases
        self.marker = tmp.marker

    def __str__(self) -> str:
        return "".join(self._iter_parts(self.name))

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}({str(self)!r})>"

    def __hash__(self) -> int:
        # Mirror __eq__ by hashing the canonical specifier object rather than
        # its raw string. ``_iter_parts`` yields ``str(self.specifier)``, which
        # is non-canonical, so trailing-zero-equivalent requirements such as
        # ``foo==1.0.0`` and ``foo==1.0.0.0`` (which compare equal) would
        # otherwise hash differently, breaking the hash/__eq__ invariant.
        return hash(
            (
                canonicalize_name(self.name),
                frozenset(canonicalize_name(e) for e in self.extras),
                self.specifier,
                self.url,
                self.marker,
            )
        )

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Requirement):
            return NotImplemented

        # Extras must be normalized before comparison as per PEP 685.
        self_extras = frozenset(canonicalize_name(e) for e in self.extras)
        other_extras = frozenset(canonicalize_name(e) for e in other.extras)
        return (
            canonicalize_name(self.name) == canonicalize_name(other.name)
            and self_extras == other_extras
            and self.specifier == other.specifier
            and self.url == other.url
            and self.marker == other.marker
        )
