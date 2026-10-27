I’ll check how the generated initializer forwards arguments to `__attrs_pre_init__`, fix the shared code, and add regression coverage.

The generator was reusing parameter declarations as call arguments, so default expressions replaced supplied values. I’ve changed it to forward parameter names and added tests for your example, positional arguments, and omitted defaults, including the factory sentinel behavior.

Fixed argument forwarding so `__attrs_pre_init__` receives supplied values for fields with defaults and factories.

Regression tests cover your example, positional arguments, and omitted defaults. Package build succeeded; tests: 363 passed, 1 skipped, 1 expected failure.

No new options added. Full test suite was not run.
