Reading is done. I'm now writing `define-handler.ts`, which also reuses `validator()` for request reading, and then wiring up the factory exports.

`defineHandler()` is added in `src/helper/factory/define-handler.ts` and re-exported from `hono/factory`. The new tests, the existing factory and validator tests, `tsc` and lint all pass. I haven't run the full suite or the other runtimes.

- **Exports**: `defineHandler` and the types `StandardSchema`, `ValidationIssue` and `ValidationFailure` (the `DefineHandlerOptions` type is exported too), all marked `@experimental`. `defineMiddleware` is exported from `hono/factory` and added to the factory as `factory.defineMiddleware`. `createMiddleware` stays as a deprecated alias, both standalone and on the factory. `createFactory<Env, Path>()` now has `factory.defineHandler`.
- **Request validation**: each target is read by calling the existing `validator()` once per target, so the reading is identical, including `400` with `Malformed JSON in request body`. I didn't touch `validator.ts`.
- **Failures**: Standard Schema failures throw `HTTPException`: `400` with every failed target and `path` joined with `.` on request, and `500` with no issues on response. `exception.cause` holds the raw issues. The input value never goes into the response body.
- **`handler.validations`**: it is set on both the intermediate `defineHandler(options)` function and the final handler.

Four behaviours are my own reading of the spec:
- **Response from a function validator**: if one returns a `Response`, it is returned as soon as that target is reached. Failures from earlier schema targets are then dropped rather than thrown.
- **Return types**: a string, JSX or `html` result is typed as an `'html'` `TypedResponse` and `null`/`undefined` as `204`. A number or boolean is sent as JSON.
- **Middleware count**: the typed overloads cover up to 3 middleware before the handler. More than that works at runtime but is loosely typed.
- **Explicit type arguments**: with `defineHandler<Env, '/p'>({ ... })`, TypeScript can't also infer the options, so the `input` type falls back to a loose one. Without explicit type arguments the input is fully typed.

The tests are in `src/helper/factory/define-handler.test.tsx`: return-value conversion, middleware order, `hc` type inference, validation order and failure shapes, function validators that return a `Response`, and `.validations`. They use zod, which was already installed.

I did not commit anything.
