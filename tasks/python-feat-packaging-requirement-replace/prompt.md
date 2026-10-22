I often need a copy of a `packaging.requirements.Requirement` with one part changed, for example the same requirement under another name or with a different version specifier. Today I have to mutate the object's attributes or build a new string by hand. I'd like `Requirement` to support `__replace__`, so that `copy.replace()` works on Python 3.13+ and I can call it directly on older versions:

```python
>>> r = Requirement('requests[security]>=2.0; python_version >= "3"')
>>> r.__replace__(name="flask")
<Requirement('flask[security]>=2.0; python_version >= "3"')>
>>> copy.replace(Requirement("requests>=2.0"), specifier=SpecifierSet(">=3.0"))
<Requirement('requests>=3.0')>
```

What I expect:

- `__replace__` takes only keyword arguments: `name`, `url`, `extras`, `specifier` and `marker`, the same fields a `Requirement` has. Any other keyword raises `TypeError`.
- It returns a new requirement; fields I don't pass are kept, and the original is left untouched. Calling it with no arguments gives an equal but distinct object.
- The result must be a valid requirement, the same as what parsing its string would give. Invalid values, such as `name="not a name!"`, raise `InvalidRequirement`. So does a value that would read back as something different, such as `name="foo[bar]"` or `extras={"a,b"}`, rather than silently changing other fields. Values get normalized like parsing does, so `marker=Marker('extra == "Foo_Bar"')` ends up as `extra == "foo-bar"`.
- A `SpecifierSet` I pass in, or the one carried over, keeps its `prereleases` settings, both on the set and on the individual `Specifier`s in it. The result must not share the `SpecifierSet` or its `Specifier` objects with the input, since those can be mutated.
- Subclasses of `Requirement` get back an instance of their own class, with whatever their `__init__` sets up.

Please add this.
