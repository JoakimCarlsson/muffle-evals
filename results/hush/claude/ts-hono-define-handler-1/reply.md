Reading done; writing `define-handler.ts` now, then the factory wiring and tests.

Formatting the new files with Prettier, then rechecking.

Done. `defineHandler`, the types, `defineMiddleware` (with `createMiddleware` as a deprecated alias) and `factory.defineHandler` are in. `tsc` is clean and the 31 factory tests pass; the repo-wide suite was not run.

- **Files:** new `src/helper/factory/define-handler.ts` and its test; `index.ts` re-exports and wires the factory.
- **Dropped Response:** if an earlier target already failed a Standard Schema and a later function validation returns a `Response`, that `Response` is returned and the collected failures are dropped.
- **Errors in middleware:** an error thrown inside the chain propagates as an exception. Middleware after-code does not see a 400 response the way it would in plain Hono.
- **Unchecked:** the existing `index.test.ts` was not reformatted by Prettier. ESLint couldn't run (no `eslint.config.*` file).
- **Extra types:** I also exported `DefineHandler`, `DefineHandlerInput`, `DefineHandlerOptions` and `HandlerBuilder`.
