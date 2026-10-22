I have a schema containing a `fields.Constant` with `required=True` set, because the schema is exported to an OpenAPI spec and the field must be marked as required there. Since the latest release this no longer works; defining the field fails:

```python
from marshmallow import Schema, fields

class MySchema(Schema):
    foo = fields.Constant(42, required=True)
```

```
ValueError: 'load_default' must not be set for required fields.
```

This used to work. I expect a required `Constant` to be accepted, and loading to always give the constant, whether the field is missing from the input or set to something else (`MySchema().load({})` and `MySchema().load({"foo": 99})` should both give `{"foo": 42}`). `Constant(None)` should keep working too.

Please fix this.
