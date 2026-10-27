I’ll check the factory, validator, and handler types, then add the helper and tests without changing Hono’s core.

The helper now reuses `validator()` to read requests and composes middleware locally, with no core changes. I’m checking type inference and adding tests for validation failures, response conversion, and middleware order.

The type check and initial tests pass. Coverage includes RPC output types, middleware Env inference, schema input constraints, aggregated failures, and status/header preservation. I’m finishing the ordered request-target tests and running the existing factory and validator suites.

Implemented `defineHandler()` with request and response validation, middleware composition, response conversion, typed inputs, RPC inference, and `handler.validations`.

Added the requested exports and factory methods, marked the new APIs experimental, and retained `createMiddleware` as a deprecated alias. Hono’s core is unchanged.

Validation passed: TypeScript, lint, and all 94 factory/validator tests.
