I’ll check the factory and validator code, add the helper without changing Hono’s core, then run the build and focused tests.

The helper now uses `validator()` to read requests, preserving its body parsing and malformed JSON behavior. The middleware chain lives entirely in the helper. I’m checking runtime behavior and type inference next.

The type checks and runtime tests cover response conversion, validation failures, middleware order, factory defaults, and JSON RPC inference. One test failed because it registered routes after the router had been built; I’ve corrected the test setup. I’m adding coverage for the remaining request targets and HTML values before the final checks.

Added experimental `defineHandler`, validation types, factory defaults, and `defineMiddleware` with deprecated `createMiddleware` aliases. Hono’s core is unchanged.

TypeScript build and type checks passed; all 80 factory and validator tests passed.

Not run: full repository suite or runtime-specific tests. No dependencies added.
