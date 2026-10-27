Writing the new file now.

Done. `defineHandler`, `defineMiddleware` (with `createMiddleware` as a deprecated alias), `factory.defineHandler`/`factory.defineMiddleware` and the types are added; tests and `tsc` pass. ESLint wasn't run (no config), and I didn't run the full suite.

- **Response validation:** `response` accepts the same two forms as request validation (Standard Schema or function), not only a schema.
- **Raw issues:** `ValidationIssue` is the raw Standard Schema issue, and `ValidationFailure` is `{ slot, issues }` as found in `exception.cause`.
- **Response slot:** the slot name for a response failure is `'response'`.
- **Type arguments:** explicit `defineHandler<Env, Path>(…)` works only for the no-options form. With options, the Env and path come from the factory, or from `defineHandler(options)<Env, Path>(handler)`.
- **Middleware inputs:** middleware `Input` types are not merged into the handler's RPC type.

Request reading reuses `validator()`, so malformed JSON still gives `400` with `Malformed JSON in request body`.

The code is in `src/helper/factory/define-handler.ts`, re-exported from `src/helper/factory/index.ts`. Tests are in `src/helper/factory/define-handler.test.ts`.
