Assigning an array of tables over a key that came from a dotted key captures the following keys:

```python
import tomlkit

doc = tomlkit.parse("a.b = 1\nc.d = 2\n")
aot = tomlkit.aot()
t = tomlkit.table()
t["x"] = 9
aot.append(t)
doc["a"] = aot
print(tomlkit.dumps(doc))
```

Result:

```
[[a]]
x = 9
c.d = 2
```

`c.d` has wrongly been captured by the array of tables: parsing the output again gives `{"a": [{"x": 9, "c": {"d": 2}}]}` and the top-level `c` is lost. I expected the document to still mean `{"c": {"d": 2}, "a": [{"x": 9}]}`.

Please fix this.
