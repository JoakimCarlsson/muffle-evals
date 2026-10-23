Tests failed to import marshmallow. Retrying with `PYTHONPATH=src`.

Done. `Constant` now pops `required`, sets it after init, and skips the missing-value check in `_validate_missing`. `required=True` is kept for OpenAPI. Added a test in `tests/test_deserialization.py`; the full suite passes (1137 tests).
