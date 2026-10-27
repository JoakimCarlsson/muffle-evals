I’ll check the factory and validator APIs, add the helper, and test validation, middleware ordering, and type inference.

The helper now reuses `validator()` for request parsing and composes middleware without changing Hono’s core. I’m checking the types and adding tests for validation failures, response transforms, and middleware ordering.

The factory and validator tests pass, along with the full TypeScript check. The type tests cover middleware context, factory defaults, RPC JSON inference, and response schema input checking. I’m adding a final case for callable schemas and request validation order.

Implemented `defineHandler`, validation types, and experimental `defineMiddleware` in `hono/factory`, including factory methods and deprecated `createMiddleware` aliases. Hono’s core is unchanged.

Verified with the full TypeScript check and 80 passing factory/validator tests.
