I'd like a `defineHandler()` helper in `hono/factory` (a new file `src/helper/factory/define-handler.ts`, re-exported from `src/helper/factory/index.ts`) that defines a handler together with its request and response validation in one place, so nobody forgets to validate. It's a helper only: no change to Hono's core.

Exports: `defineHandler`, and the types `StandardSchema`, `ValidationIssue` and `ValidationFailure` (also exported from `hono/factory`). Also add `defineMiddleware` to `hono/factory` (and to `createFactory()`'s result as `factory.defineMiddleware`) as the new name of `createMiddleware`, which stays as a deprecated alias. `createFactory<Env, Path>()` gets a `factory.defineHandler` that is `defineHandler` with that Env and path as defaults. Mark the new API `@experimental`.

Without options, `defineHandler(handler)` or `defineHandler(mw1, mw2, handler)` returns a Hono handler. The value the handler returns (sync or async) is converted to a Response: an object is returned as JSON, a string or JSX or an `html` template as HTML, `null`/`undefined` as `204` with no body, and a `Response` as is. Middleware passed before the handler runs around it, so code after `await next()` runs after the handler, and a middleware that returns a response ends the chain. The handler's context is typed with the middleware's Env (`c.get()` works), with the Env and path given as type arguments (`defineHandler<Env, '/me/:id'>(...)`), or with the factory's. The returned value is typed so `hc` infers the JSON body.

With options, `defineHandler({ param, query, header, cookie, form, json, response })(handler)` or `(...middleware, handler)`: each given request target is validated before the handler runs, in the order `param, query, header, cookie, form, json`, using the same reading of the request as `validator()` (so malformed JSON still gives `400` with `Malformed JSON in request body`). The handler gets `(c, input)` where `input` holds the validated value per target (typed), and `c.req.valid(target)` returns it too. Each validation is either a Standard Schema (an object or callable with `~standard.validate`, sync or async, so zod and similar work with no dependency) or a function `(value, c) => newValue` (sync or async; if it returns a `Response`, that response is returned and the handler is skipped). If `response` is given, the handler's returned value is validated with it, transformed by it, and returned as JSON, keeping the status from `c.status()` and the headers from `c.header()`; a `Response` returned from the handler is returned as is. When response validation is given, the handler's return type is checked against the schema's input type, and the RPC type is the schema's output.

Order: middleware before, request validation, handler, response validation, middleware after.

Failures from a Standard Schema throw an `HTTPException` so `onError` can handle it:
- Request: status `400`, `res` is JSON `{ error: 'Validation failed', issues: [{ slot: 'query', issues: [{ message, path }] }, ...] }` with one entry per failed target (all targets are checked, in order), where `path` is the issue path joined with `.` (path items may be `{ key }` objects) and is left out when there is none. The input value must never appear in the response.
- Response: status `500`, `res` is `{ error: 'Response validation failed' }` without issues.
- In both cases `exception.cause` is `{ issues: [{ slot, issues: <the raw Standard Schema issues> }] }`.

The `defineHandler(options)(...)` result also exposes the options as `handler.validations`.

Please add this.
