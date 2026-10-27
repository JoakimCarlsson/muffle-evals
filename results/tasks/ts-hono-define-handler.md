# ts-hono-define-handler

Source: https://github.com/honojs/hono/pull/5531

## Prompt

> I'd like a `defineHandler()` helper in `hono/factory` (a new file `src/helper/factory/define-handler.ts`, re-exported from `src/helper/factory/index.ts`) that defines a handler together with its request and response validation in one place, so nobody forgets to validate. It's a helper only: no change to Hono's core.
> 
> Exports: `defineHandler`, and the types `StandardSchema`, `ValidationIssue` and `ValidationFailure` (also exported from `hono/factory`). Also add `defineMiddleware` to `hono/factory` (and to `createFactory()`'s result as `factory.defineMiddleware`) as the new name of `createMiddleware`, which stays as a deprecated alias. `createFactory<Env, Path>()` gets a `factory.defineHandler` that is `defineHandler` with that Env and path as defaults. Mark the new API `@experimental`.
> 
> Without options, `defineHandler(handler)` or `defineHandler(mw1, mw2, handler)` returns a Hono handler. The value the handler returns (sync or async) is converted to a Response: an object is returned as JSON, a string or JSX or an `html` template as HTML, `null`/`undefined` as `204` with no body, and a `Response` as is. Middleware passed before the handler runs around it, so code after `await next()` runs after the handler, and a middleware that returns a response ends the chain. The handler's context is typed with the middleware's Env (`c.get()` works), with the Env and path given as type arguments (`defineHandler<Env, '/me/:id'>(...)`), or with the factory's. The returned value is typed so `hc` infers the JSON body.
> 
> With options, `defineHandler({ param, query, header, cookie, form, json, response })(handler)` or `(...middleware, handler)`: each given request target is validated before the handler runs, in the order `param, query, header, cookie, form, json`, using the same reading of the request as `validator()` (so malformed JSON still gives `400` with `Malformed JSON in request body`). The handler gets `(c, input)` where `input` holds the validated value per target (typed), and `c.req.valid(target)` returns it too. Each validation is either a Standard Schema (an object or callable with `~standard.validate`, sync or async, so zod and similar work with no dependency) or a function `(value, c) => newValue` (sync or async; if it returns a `Response`, that response is returned and the handler is skipped). If `response` is given, the handler's returned value is validated with it, transformed by it, and returned as JSON, keeping the status from `c.status()` and the headers from `c.header()`; a `Response` returned from the handler is returned as is. When response validation is given, the handler's return type is checked against the schema's input type, and the RPC type is the schema's output.
> 
> Order: middleware before, request validation, handler, response validation, middleware after.
> 
> Failures from a Standard Schema throw an `HTTPException` so `onError` can handle it:
> - Request: status `400`, `res` is JSON `{ error: 'Validation failed', issues: [{ slot: 'query', issues: [{ message, path }] }, ...] }` with one entry per failed target (all targets are checked, in order), where `path` is the issue path joined with `.` (path items may be `{ key }` objects) and is left out when there is none. The input value must never appear in the response.
> - Response: status `500`, `res` is `{ error: 'Response validation failed' }` without issues.
> - In both cases `exception.cause` is `{ issues: [{ slot, issues: <the raw Standard Schema issues> }] }`.
> 
> The `defineHandler(options)(...)` result also exposes the options as `handler.validations`.
> 
> Please add this.

## Upstream change (tests left out)

Files: 

```diff
diff --git a/src/helper/factory/define-handler.ts b/src/helper/factory/define-handler.ts
new file mode 100644
index 00000000..a78bd67c
--- /dev/null
+++ b/src/helper/factory/define-handler.ts
@@ -0,0 +1,409 @@
+import type { Context } from '../../context'
+import { HTTPException } from '../../http-exception'
+import type {
+  Env,
+  FormValue,
+  Handler,
+  IntersectNonAnyTypes,
+  MiddlewareHandler,
+  TypedResponse,
+  ValidationTargets,
+} from '../../types'
+import type { HtmlEscaped } from '../../utils/html'
+import type { ContentfulStatusCode } from '../../utils/http-status'
+import type { JSONParsed } from '../../utils/types'
+import type { InferInput } from '../../validator/utils'
+import { getValidationTarget } from '../../validator/validator'
+
+type StandardSchemaIssue = {
+  readonly message: string
+  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined
+}
+
+type StandardSchemaResult<Output> =
+  | { readonly value: Output; readonly issues?: undefined }
+  | { readonly issues: ReadonlyArray<StandardSchemaIssue> }
+
+/**
+ * The part of the Standard Schema interface used by `defineHandler()`.
+ * @see {@link https://standardschema.dev/}
+ */
+export type StandardSchema<Input = unknown, Output = Input> = {
+  readonly '~standard': {
+    readonly validate: (
+      value: unknown
+    ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>
+    readonly types?: { readonly input: Input; readonly output: Output } | undefined
+  }
+}
+
+// eslint-disable-next-line @typescript-eslint/no-explicit-any
+type AnyStandardSchema = StandardSchema<any, any>
+
+// eslint-disable-next-line @typescript-eslint/no-explicit-any
+type AnyResponse = Response | TypedResponse<any, any, any>
+
+/**
+ * A Standard Schema or a validation function for `Value`.
+ * `T` is the schema itself, or the output of the function. It is `never` when not specified.
+ */
+type Validation<Value, T> =
+  | (T & AnyStandardSchema)
+  // A callable schema (e.g. ArkType) is typed by this branch
+  // eslint-disable-next-line @typescript-eslint/no-explicit-any
+  | ((value: Value, c: Context<any, any, any>) => T | Promise<T>)
+
+type ResponseValidation<In, Out> =
+  // eslint-disable-next-line @typescript-eslint/no-explicit-any
+  | (Out & StandardSchema<In, any>)
+  // eslint-disable-next-line @typescript-eslint/no-explicit-any
+  | ((value: In, c: Context<any, any, any>) => Out | Promise<Out>)
+
+/**
+ * A Response the handler can return. A JSON Response by `c.json()` is not accepted,
+ * because it bypasses the response validation. Return the value instead.
+ */
+type NonJSONResponse = Response & { readonly _format?: 'text' | 'redirect' | 'body' }
+
+// eslint-disable-next-line @typescript-eslint/no-explicit-any
+type InputOf<T> = T extends StandardSchema<infer I, any> ? I : Exclude<T, AnyResponse>
+// eslint-disable-next-line @typescript-eslint/no-explicit-any
+type OutputOf<T> = T extends StandardSchema<any, infer O> ? O : Exclude<T, AnyResponse>
+
+type RequestTarget = keyof ValidationTargets
+
+type Targets = { [K in RequestTarget]: unknown }
+
+type ValidatedTarget<T extends Targets> = {
+  [K in RequestTarget]: [T[K]] extends [never] ? never : K
+}[RequestTarget]
+
+type ValidatedInput<T extends Targets> = {
+  in: {
+    [K in ValidatedTarget<T>]: K extends 'json'
+      ? InputOf<T[K]>
+      : InferInput<InputOf<T[K]>, K, FormValue>
+  }
+  out: { [K in ValidatedTarget<T>]: OutputOf<T[K]> }
+}
+
+/** The validated values, passed to the handler as the second argument */
+type HandlerInput<T extends Targets> = { [K in ValidatedTarget<T>]: OutputOf<T[K]> }
+
+type JSONResponseOf<T> = Response & TypedResponse<JSONParsed<T>, ContentfulStatusCode, 'json'>
+
+/** The Response that `toResponse()` converts a returned value to */
+type ConvertedResponse<R> = [unknown] extends [R]
+  ? Response
+  : R extends AnyResponse
+    ? R
+    : R extends null | undefined | void
+      ? Response & TypedResponse<null, 204, 'body'>
+      : R extends string | HtmlEscaped
+        ? Response
+        : JSONResponseOf<R>
+
+// eslint-disable-next-line @typescript-eslint/no-explicit-any
+type AnyMiddleware = MiddlewareHandler<any, any, any>
+
+// The Env of each middleware, e.g. `Variables` set by `c.set()`
+type MiddlewareEnvs<M extends AnyMiddleware[]> = {
+  // eslint-disable-next-line @typescript-eslint/no-explicit-any
+  [K in keyof M]: M[K] extends MiddlewareHandler<infer ME, any, any> ? ME : never
+}
+
+/**
+ * An issue in the failure response. `path` is dot-joined, e.g. `user.email`.
+ * The input value is not included.
+ */
+export type ValidationIssue = { message: string; path?: string }
+
+/** The issues of one validation target in the failure response */
+export type ValidationFailure = { slot: RequestTarget | 'response'; issues: ValidationIssue[] }
+
+type ValidatedHandlerOptions<Param, Query, Header, Cookie, Form, Json, ResponseIn, ResponseOut> = {
+  param?: Validation<ValidationTargets['param'], Param>
+  query?: Validation<ValidationTargets['query'], Query>
+  header?: Validation<ValidationTargets['header'], Header>
+  cookie?: Validation<ValidationTargets['cookie'], Cookie>
+  form?: Validation<ValidationTargets['form'], Form>
+  json?: Validation<ValidationTargets['json'], Json>
+  response?: ResponseValidation<ResponseIn, ResponseOut>
+}
+
+const requestTargets: RequestTarget[] = ['param', 'query', 'header', 'cookie', 'form', 'json']
+
+const isStandardSchema = (v: unknown): v is AnyStandardSchema =>
+  (typeof v === 'object' || typeof v === 'function') && v !== null && '~standard' in v
+
+const toValidationIssues = (issues: ReadonlyArray<StandardSchemaIssue>): ValidationIssue[] =>
+  issues.map(({ message, path }) =>
+    path
+      ? { message, path: path.map((p) => String(typeof p === 'object' ? p.key : p)).join('.') }
+      : { message }
+  )
+
+type Validator = {
+  target: RequestTarget
+  schema?: AnyStandardSchema['~standard']['validate']
+  fn?: (value: unknown, c: Context) => unknown
+}
+
+const toValidator = (target: RequestTarget, v: Validation<unknown, unknown>): Validator =>
+  isStandardSchema(v) ? { target, schema: v['~standard'].validate } : { target, fn: v }
+
+type ValidatedHandler<E extends Env, P extends string, T extends Targets, ResponseOut, R> = Handler<
+  E,
+  P,
+  ValidatedInput<T>,
+  Promise<
+    [ResponseOut] extends [never]
+      ? ConvertedResponse<Awaited<R>>
+      : JSONResponseOf<OutputOf<ResponseOut>>
+  >
+>
+
+export interface DefineHandler<E extends Env, P extends string> {
+  /**
+   * Defines a handler, with middleware before it. The returned value is converted to a Response.
+   */
+  <E2 extends Env = E, P2 extends string = P, M extends AnyMiddleware[] = [], R = unknown>(
+    ...args: [
+      ...middleware: M,
+      handler: (c: Context<IntersectNonAnyTypes<[E2, ...MiddlewareEnvs<M>]>, P2>) => R,
+    ]
+  ): Handler<E2, P2, {}, Promise<ConvertedResponse<Awaited<R>>>>
+  /**
+   * Defines a handler with request and response validation, with middleware before it.
+   */
+  <
+    Param = never,
+    Query = never,
+    Header = never,
+    Cookie = never,
+    Form = never,
+    Json = never,
+    // Not inferred without `response`, so the handler can return anything
+    ResponseIn = unknown,
+    ResponseOut = never,
+    T extends Targets = {
+      param: Param
+      query: Query
+      header: Header
+      cookie: Cookie
+      form: Form
+      json: Json
+    },
+  >(
+    options: ValidatedHandlerOptions<
+      Param,
+      Query,
+      Header,
+      Cookie,
+      Form,
+      Json,
+      ResponseIn,
+      ResponseOut
+    >
+  ): <
+    E2 extends Env = E,
+    P2 extends string = P,
+    M extends AnyMiddleware[] = [],
+    R extends ResponseIn | NonJSONResponse | Promise<ResponseIn | NonJSONResponse> = ResponseIn,
+  >(
+    ...args: [
+      ...middleware: M,
+      handler: (
+        c: Context<IntersectNonAnyTypes<[E2, ...MiddlewareEnvs<M>]>, P2, ValidatedInput<T>>,
+        input: HandlerInput<T>
+      ) => R,
+    ]
+  ) => ValidatedHandler<E2, P2, T, ResponseOut, R>
+}
+
+const toResponse = (c: Context, result: unknown): Response | Promise<Response> => {
+  if (result instanceof Response) {
+    return result
+  }
+  if (result === null || result === undefined) {
+    return c.body(null, 204)
+  }
+  // JSX and `html` tagged templates are HtmlEscaped objects
+  return typeof result === 'string' || (result as HtmlEscaped).isEscaped
+    ? c.html(result as string)
+    : c.json(result as never)
+}
+
+/**
+ * `defineHandler()` defines a handler. A value returned from the handler is converted to a
+ * Response: an object is returned as JSON, a string or JSX as HTML, and `null` or `undefined`
+ * as `204 No Content`. A `Response` is returned as is. The status is set with `c.status()`, and
+ * it is not in the types. Return `c.json()` to have the status in the types.
+ *
+ * With options, each request target (`param`, `query`, `json`, `form`, `header`, `cookie`)
+ * is validated before the handler runs. The validated values are passed to the handler as
+ * the second argument, and are also available through `c.req.valid()`.
+ * A value returned from the handler is validated with `response` and returned as JSON.
+ *
+ * Each validation accepts a Standard Schema or a validation function.
+ * When a Standard Schema fails, an `HTTPException` is thrown with status 400 for the request
+ * and 500 for the response, so `onError` can handle it. Its `res` is a JSON response of
+ * `{ error, issues }`, and its `cause` is `{ issues }` with the raw Standard Schema issues.
+ *
+ * Middleware passed before the handler runs first, around the validation. Its Env flows into
+ * the handler, so `c.get()` is typed. Otherwise, use `createFactory<Env>().defineHandler`, or
+ * pass the Env and the path as type arguments.
+ *
+ * @see {@link https://hono.dev/docs/helpers/factory#definehandler}
+ *
+ * @experimental
+ * `defineHandler()` is an experimental feature.
+ * The API might be changed.
+ *
+ * @example
+ * ```ts
+ * app.get('/ping', defineHandler(() => ({ pong: true })))
+ * app.get('/me', defineHandler(auth, (c) => c.get('user')))
+ *
+ * app.post(
+ *   '/users/:id',
+ *   defineHandler({
+ *     param: ParamSchema,
+ *     json: BodySchema,
+ *     response: UserSchema,
+ *   })(async (c, { param, json }) => {
+ *     c.status(201)
+ *     return { id: param.id, ...json }
+ *   })
+ * )
+ * ```
+ */
+// eslint-disable-next-line @typescript-eslint/no-explicit-any
+export const defineHandler: DefineHandler<any, any> = ((
+  // eslint-disable-next-line @typescript-eslint/no-explicit-any
+  ...args: any[]
+  // eslint-disable-next-line @typescript-eslint/no-explicit-any
+): any => {
+  if (typeof args[0] === 'function') {
+    return compose(args, async (c) => toResponse(c, await args[args.length - 1](c)))
+  }
+  const options = args[0]
+  const validators = requestTargets
+    .filter((target) => options[target])
+    .map((target) => toValidator(target, options[target]))
+  const response = options.response && toValidator('json', options.response)
+
+  // eslint-disable-next-line @typescript-eslint/no-explicit-any
+  return (...args: any[]) => {
+    const handler: (c: Context, input: unknown) => unknown = args[args.length - 1]
+    const run = async (c: Context): Promise<Response> => {
+      const input: Record<string, unknown> = {}
+      const failures: ValidationFailure[] = []
+      const issues: { slot: string; issues: ReadonlyArray<StandardSchemaIssue> }[] = []
+
+      for (const { target, schema, fn } of validators) {
+        let value = getValidationTarget(c, target)
+        if (value instanceof Promise) {
+          value = await value
+        }
+        if (schema) {
+          let result = schema(value)
+          if (result instanceof Promise) {
+            result = await result
+          }
+          if (result.issues) {
+            failures.push({ slot: target, issues: toValidationIssues(result.issues) })
+            issues.push({ slot: target, issues: result.issues })
+            continue
+          }
+          value = result.value
+        } else {
+          value = fn!(value, c)
+          if (value instanceof Promise) {
+            value = await value
+          }
+          if (value instanceof Response) {
+            return value
+          }
+        }
+        c.req.addValidatedData(target, value as never)
+        input[target] = value
+      }
+
+      if (failures.length) {
+        throw new HTTPException(400, {
+          res: c.json({ error: 'Validation failed', issues: failures }, 400),
+          cause: { issues },
+        })
+      }
+
+      let result: unknown = handler(c, input)
+      if (result instanceof Promise) {
+        result = await result
+      }
+      if (result instanceof Response) {
+        return result
+      }
+
+      if (response) {
+        if (response.schema) {
+          let validated = response.schema(result)
+          if (validated instanceof Promise) {
+            validated = await validated
+          }
+          if (validated.issues) {
+            throw new HTTPException(500, {
+              res: c.json({ error: 'Response validation failed' }, 500),
+              cause: { issues: [{ slot: 'response', issues: validated.issues }] },
+            })
+          }
+          result = validated.value
+        } else {
+          result = response.fn!(result, c)
+          if (result instanceof Promise) {
+            result = await result
+          }
+          if (result instanceof Response) {
+            return result
+          }
+        }
+        return c.json(result as never)
+      }
+
+      return toResponse(c, result)
+    }
+
+    // Readable from `app.routes`, e.g. by an OpenAPI generator
+    return Object.assign(compose(args, run), { validations: options })
+  }
+  // eslint-disable-next-line @typescript-eslint/no-explicit-any
+}) as DefineHandler<any, any>
+
+/**
+ * Runs the middleware (all but the last argument) around `run`,
+ * so code after `await next()` runs after the handler.
+ */
+const compose = (
+  // eslint-disable-next-line @typescript-eslint/no-explicit-any
+  args: any[],
+  run: (c: Context) => Promise<Response>
+): ((c: Context) => Promise<Response>) => {
+  const middleware: MiddlewareHandler[] = args.slice(0, -1)
+  if (!middleware.length) {
+    return run
+  }
+  return async (c) => {
+    const dispatch = async (i: number): Promise<void> => {
+      if (i === middleware.length) {
+        c.res = await run(c)
+        return
+      }
+      const res = await middleware[i](c, () => dispatch(i + 1))
+      if (res) {
+        c.res = res
+      }
+    }
+    await dispatch(0)
+    return c.res
+  }
+}
diff --git a/src/helper/factory/index.ts b/src/helper/factory/index.ts
index 8f887772..f6034d6d 100644
--- a/src/helper/factory/index.ts
+++ b/src/helper/factory/index.ts
@@ -14,6 +14,11 @@ import type {
   IntersectNonAnyTypes,
   MiddlewareHandler,
 } from '../../types'
+import { defineHandler } from './define-handler'
+import type { DefineHandler } from './define-handler'
+
+export { defineHandler }
+export type { StandardSchema, ValidationIssue, ValidationFailure } from './define-handler'
 
 type InitApp<E extends Env = Env> = (app: Hono<E>) => void
 
@@ -350,10 +355,22 @@ export class Factory<E extends Env = Env, P extends string = string> {
     return app
   }
 
-  createMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
+  defineMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
     middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
   ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
 
+  defineHandler: DefineHandler<E, P> = defineHandler
+
+  /**
+   * @deprecated Use `defineMiddleware()` instead. It will be removed in the next major version.
+   */
+  createMiddleware = this.defineMiddleware
+
+  /**
+   * @deprecated Use `defineHandler()` instead. It will be removed in the next major version.
+   * Pass the middleware before the handler:
+   * `defineHandler(auth, (c) => ...)`.
+   */
   createHandlers: CreateHandlersInterface<E, P> = (...handlers: any) => {
     // @ts-expect-error this should not be typed
     return handlers.filter((handler) => handler !== undefined)
@@ -365,7 +382,20 @@ export const createFactory = <E extends Env = Env, P extends string = string>(in
   defaultAppOptions?: HonoOptions<E>
 }): Factory<E, P> => new Factory<E, P>(init)
 
-export const createMiddleware = <
+/**
+ * `defineMiddleware()` defines a middleware with the types.
+ *
+ * @see {@link https://hono.dev/docs/helpers/factory#definemiddleware}
+ *
+ * @example
+ * ```ts
+ * const auth = defineMiddleware<{ Variables: { user: User } }>(async (c, next) => {
+ *   c.set('user', await getUser(c))
+ *   await next()
+ * })
+ * ```
+ */
+export const defineMiddleware = <
   E extends Env = any,
   P extends string = string,
   I extends Input = {},
@@ -373,3 +403,8 @@ export const createMiddleware = <
 >(
   middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
 ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
+
+/**
+ * @deprecated Use `defineMiddleware()` instead. It will be removed in the next major version.
+ */
+export const createMiddleware = defineMiddleware
diff --git a/src/validator/validator.ts b/src/validator/validator.ts
index 5263b1d9..6659d7ff 100644
--- a/src/validator/validator.ts
+++ b/src/validator/validator.ts
@@ -43,6 +43,80 @@ export type ExtractValidationResponse<VF> = VF extends (value: any, c: any) => i
           : never // anything else → never
   : never // Can't extract → never
 
+/**
+ * Get the value of the validation target from the request.
+ * Returns a Promise only for `json` and `form`.
+ */
+export const getValidationTarget = (
+  c: Context,
+  target: keyof ValidationTargets
+): unknown | Promise<unknown> => {
+  const contentType = c.req.header('Content-Type')
+
+  switch (target) {
+    case 'json':
+      if (!contentType || !jsonRegex.test(contentType)) {
+        return {}
+      }
+      return c.req.json().catch(() => {
+        throw new HTTPException(400, { message: 'Malformed JSON in request body' })
+      })
+    case 'form': {
+      if (
+        !contentType ||
+        !(multipartRegex.test(contentType) || urlencodedRegex.test(contentType))
+      ) {
+        return {}
+      }
+      return getForm(c, contentType)
+    }
+    case 'query':
+      return Object.fromEntries(
+        Object.entries(c.req.queries()).map(([k, v]) => {
+          return v?.length === 1 ? [k, v[0]] : [k, v]
+        })
+      )
+    case 'param':
+      return c.req.param() as Record<string, string>
+    case 'header':
+      return c.req.header()
+    case 'cookie':
+      return getCookie(c)
+  }
+}
+
+const getForm = async (c: Context, contentType: string): Promise<BodyData<{ all: true }>> => {
+  let formData: FormData
+
+  if (c.req.bodyCache.formData) {
+    formData = await c.req.bodyCache.formData
+  } else {
+    try {
+      const arrayBuffer = await c.req.arrayBuffer()
+      formData = await bufferToFormData(arrayBuffer, contentType)
+      c.req.bodyCache.formData = formData
+    } catch (e) {
+      let message = 'Malformed FormData request.'
+      message += e instanceof Error ? ` ${e.message}` : ` ${String(e)}`
+      throw new HTTPException(400, { message })
+    }
+  }
+
+  const form: BodyData<{ all: true }> = Object.create(null)
+  formData.forEach((value, key) => {
+    if (key.endsWith('[]')) {
+      ;((form[key] ??= []) as unknown[]).push(value)
+    } else if (Array.isArray(form[key])) {
+      ;(form[key] as unknown[]).push(value)
+    } else if (Object.hasOwn(form, key)) {
+      form[key] = [form[key] as string | File, value]
+    } else {
+      form[key] = value
+    }
+  })
+  return form
+}
+
 export const validator = <
   InputType,
   P extends string,
@@ -87,77 +161,7 @@ export const validator = <
   validationFunc: VF
 ): MiddlewareHandler<E, P, V, ExtractValidationResponse<VF>> => {
   return async (c, next) => {
-    let value = {}
-    const contentType = c.req.header('Content-Type')
-
-    switch (target) {
-      case 'json':
-        if (!contentType || !jsonRegex.test(contentType)) {
-          break
-        }
-        try {
-          value = await c.req.json()
-        } catch {
-          const message = 'Malformed JSON in request body'
-          throw new HTTPException(400, { message })
-        }
-        break
-      case 'form': {
-        if (
-          !contentType ||
-          !(multipartRegex.test(contentType) || urlencodedRegex.test(contentType))
-        ) {
-          break
-        }
-
-        let formData: FormData
-
-        if (c.req.bodyCache.formData) {
-          formData = await c.req.bodyCache.formData
-        } else {
-          try {
-            const arrayBuffer = await c.req.arrayBuffer()
-            formData = await bufferToFormData(arrayBuffer, contentType)
-            c.req.bodyCache.formData = formData
-          } catch (e) {
-            let message = 'Malformed FormData request.'
-            message += e instanceof Error ? ` ${e.message}` : ` ${String(e)}`
-            throw new HTTPException(400, { message })
-          }
-        }
-
-        const form: BodyData<{ all: true }> = Object.create(null)
-        formData.forEach((value, key) => {
-          if (key.endsWith('[]')) {
-            ;((form[key] ??= []) as unknown[]).push(value)
-          } else if (Array.isArray(form[key])) {
-            ;(form[key] as unknown[]).push(value)
-          } else if (Object.hasOwn(form, key)) {
-            form[key] = [form[key] as string | File, value]
-          } else {
-            form[key] = value
-          }
-        })
-        value = form
-        break
-      }
-      case 'query':
-        value = Object.fromEntries(
-          Object.entries(c.req.queries()).map(([k, v]) => {
-            return v?.length === 1 ? [k, v[0]] : [k, v]
-          })
-        )
-        break
-      case 'param':
-        value = c.req.param() as Record<string, string>
-        break
-      case 'header':
-        value = c.req.header()
-        break
-      case 'cookie':
-        value = getCookie(c)
-        break
-    }
+    const value = await getValidationTarget(c, target)
 
     const res = await validationFunc(value as never, c as never)
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +781/-73 | 380 | 38,255 | $0.850 |
| claude | muffle | **FAIL** | +569/-1 | 262 | 29,635 | $0.612 |
| claude | hush | pass | +519/-2 | 295 | 26,919 | $0.573 |
| claude | all | pass | +371/-2 | 189 | 21,114 | $0.434 |
| codex | base | pass | +331/-2 | 253 | 8,072 | - |
| codex | muffle | pass | +475/-2 | 252 | 7,704 | - |
| codex | hush | pass | +386/-2 | 268 | 7,256 | - |
| codex | sloth | pass | +251/-2 | 227 | 7,068 | - |
| codex | all | pass | +303/-2 | 279 | 9,371 | - |

### claude, base: pass

Files: [src/helper/factory/define-handler.test.ts](../base/claude/ts-hono-define-handler-1/files/src/helper/factory/define-handler.test.ts), [src/helper/factory/define-handler.ts](../base/claude/ts-hono-define-handler-1/files/src/helper/factory/define-handler.ts), [src/helper/factory/index.ts](../base/claude/ts-hono-define-handler-1/files/src/helper/factory/index.ts), [src/validator/validator.ts](../base/claude/ts-hono-define-handler-1/files/src/validator/validator.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/helper/factory/define-handler.test.ts b/src/helper/factory/define-handler.test.ts
new file mode 100644
index 0000000..3f7dec7
--- /dev/null
+++ b/src/helper/factory/define-handler.test.ts
@@ -0,0 +1,380 @@
+/* eslint-disable @typescript-eslint/no-unused-vars */
+import { expectTypeOf } from 'vitest'
+import { z } from 'zod'
+import { hc } from '../../client'
+import { HTTPException } from '../../http-exception'
+import { Hono } from '../../index'
+import { jsx } from '../../jsx'
+import type { Equal, Expect } from '../../utils/types'
+import { html } from '../html'
+import { createFactory, createMiddleware, defineHandler, defineMiddleware } from './index'
+import type { StandardSchema } from './index'
+
+type Env = { Variables: { user: string } }
+
+const json = (body: unknown) => ({
+  method: 'POST',
+  headers: { 'Content-Type': 'application/json' },
+  body: JSON.stringify(body),
+})
+
+describe('defineHandler without options', () => {
+  it('Should convert the returned value to a response', async () => {
+    const app = new Hono()
+    app.get(
+      '/object',
+      defineHandler(() => ({ ok: true }))
+    )
+    app.get(
+      '/async',
+      defineHandler(async () => ({ ok: 1 }))
+    )
+    app.get(
+      '/string',
+      defineHandler(() => 'hello')
+    )
+    app.get(
+      '/jsx',
+      defineHandler(() => jsx('h1', {}, 'hi'))
+    )
+    app.get(
+      '/html',
+      defineHandler(() => html`<p>${'<b>'}</p>`)
+    )
+    app.get(
+      '/null',
+      defineHandler(() => null)
+    )
+    app.get(
+      '/undefined',
+      defineHandler(async () => undefined)
+    )
+    app.get(
+      '/response',
+      defineHandler((c) => c.text('raw', 201))
+    )
+
+    let res = await app.request('/object')
+    expect(res.headers.get('content-type')).toMatch(/application\/json/)
+    expect(await res.json()).toEqual({ ok: true })
+    expect(await (await app.request('/async')).json()).toEqual({ ok: 1 })
+    res = await app.request('/string')
+    expect(res.headers.get('content-type')).toMatch(/text\/html/)
+    expect(await res.text()).toBe('hello')
+    res = await app.request('/jsx')
+    expect(res.headers.get('content-type')).toMatch(/text\/html/)
+    expect(await res.text()).toBe('<h1>hi</h1>')
+    res = await app.request('/html')
+    expect(res.headers.get('content-type')).toMatch(/text\/html/)
+    expect(await res.text()).toBe('<p>&lt;b&gt;</p>')
+    for (const path of ['/null', '/undefined']) {
+      res = await app.request(path)
+      expect(res.status).toBe(204)
+      expect(await res.text()).toBe('')
+    }
+    res = await app.request('/response')
+    expect(res.status).toBe(201)
+    expect(await res.text()).toBe('raw')
+  })
+
+  it('Should run the middleware around the handler', async () => {
+    const calls: string[] = []
+    const mw1 = defineMiddleware<Env>(async (c, next) => {
+      calls.push('mw1 before')
+      c.set('user', 'bob')
+      await next()
+      calls.push('mw1 after')
+      c.header('X-After', 'yes')
+    })
+    const mw2 = createMiddleware(async (_c, next) => {
+      calls.push('mw2 before')
+      await next()
+      calls.push('mw2 after')
+    })
+    const app = new Hono()
+    app.get(
+      '/:id',
+      defineHandler(mw1, mw2, (c) => {
+        calls.push('handler')
+        expectTypeOf(c.get('user')).toEqualTypeOf<string>()
+        return { user: c.get('user'), id: c.req.param('id') }
+      })
+    )
+    const res = await app.request('/1')
+    expect(await res.json()).toEqual({ user: 'bob', id: '1' })
+    expect(res.headers.get('x-after')).toBe('yes')
+    expect(calls).toEqual(['mw1 before', 'mw2 before', 'handler', 'mw2 after', 'mw1 after'])
+  })
+
+  it('Should end the chain when a middleware returns a response', async () => {
+    const handler = vi.fn(() => 'never')
+    const app = new Hono()
+    app.get(
+      '/',
+      defineHandler(async (c) => c.text('stop', 401), handler)
+    )
+    const res = await app.request('/')
+    expect(res.status).toBe(401)
+    expect(handler).not.toHaveBeenCalled()
+  })
+
+  it('Should type the context with the Env and the path', () => {
+    defineHandler<Env, '/me/:id'>((c) => {
+      expectTypeOf(c.get('user')).toEqualTypeOf<string>()
+      expectTypeOf(c.req.param('id')).toEqualTypeOf<string>()
+      return null
+    })
+    const factory = createFactory<Env, '/me/:id'>()
+    factory.defineHandler((c) => {
+      expectTypeOf(c.get('user')).toEqualTypeOf<string>()
+      expectTypeOf(c.req.param('id')).toEqualTypeOf<string>()
+      return null
+    })
+    expect(factory.defineMiddleware).toBeTypeOf('function')
+    expect(factory.createMiddleware).toBeTypeOf('function')
+  })
+
+  it('Should let hc infer the JSON body', async () => {
+    const app = new Hono().get(
+      '/me',
+      defineHandler(() => ({ name: 'a', age: 1 }))
+    )
+    const client = hc<typeof app>('http://localhost')
+    // type-only check, the request is never sent
+    const check = async () => {
+      const res = await client.me.$get()
+      type Body = Awaited<ReturnType<typeof res.json>>
+      type verify = Expect<Equal<Body, { name: string; age: number }>>
+    }
+    expect(check).toBeTypeOf('function')
+  })
+})
+
+describe('defineHandler with options', () => {
+  const schema = z.object({ page: z.coerce.number() })
+
+  it('Should validate the targets in order and pass the input', async () => {
+    const order: string[] = []
+    const track =
+      <T>(name: string) =>
+      (value: T) => {
+        order.push(name)
+        return value
+      }
+    const app = new Hono()
+    app.post(
+      '/:id',
+      defineHandler({
+        json: track('json'),
+        form: track('form'),
+        cookie: track('cookie'),
+        header: track('header'),
+        query: z.object({ page: z.coerce.number() }),
+        param: async (v: { id: string }) => {
+          order.push('param')
+          return { id: Number(v.id) }
+        },
+      })((c, input) => {
+        expectTypeOf(input.query.page).toEqualTypeOf<number>()
+        expectTypeOf(input.param.id).toEqualTypeOf<number>()
+        expect(c.req.valid('query')).toEqual({ page: 2 })
+        return {
+          input: input.query,
+          id: input.param.id,
+          json: c.req.valid('json'),
+        }
+      })
+    )
+    const res = await app.request('/5?page=2', json({ a: 1 }))
+    expect(await res.json()).toEqual({
+      input: { page: 2 },
+      id: 5,
+      json: { a: 1 },
+    })
+    expect(order).toEqual(['param', 'header', 'cookie', 'form', 'json'])
+  })
+
+  it('Should expose the options as validations', () => {
+    const options = { query: schema }
+    expect(defineHandler(options)(() => null).validations).toBe(options)
+  })
+
+  it('Should return the response of a validation function', async () => {
+    const handler = vi.fn(() => 'x')
+    const app = new Hono()
+    app.get('/', defineHandler({ query: (_v, c) => c.text('nope', 403) })(handler))
+    const res = await app.request('/')
+    expect(res.status).toBe(403)
+    expect(handler).not.toHaveBeenCalled()
+  })
+
+  it('Should give 400 for malformed JSON', async () => {
+    const app = new Hono()
+    app.post(
+      '/',
+      defineHandler({ json: z.object({}) })(() => null)
+    )
+    const res = await app.request('/', {
+      method: 'POST',
+      headers: { 'Content-Type': 'application/json' },
+      body: '{',
+    })
+    expect(res.status).toBe(400)
+    expect(await res.text()).toBe('Malformed JSON in request body')
+  })
+
+  it('Should throw HTTPException with all the failed targets', async () => {
+    let caught: HTTPException | undefined
+    const app = new Hono()
+    app.onError((e, c) => {
+      caught = e as HTTPException
+      return (e as HTTPException).getResponse()
+    })
+    app.post(
+      '/',
+      defineHandler({
+        query: schema,
+        json: z.object({ user: z.object({ name: z.string() }) }),
+        header: z.object({ 'x-ok': z.string().optional() }),
+      })(() => null)
+    )
+    const res = await app.request('/?page=secret-value', json({ user: { name: 1 } }))
+    expect(res.status).toBe(400)
+    const body = (await res.json()) as any
+    expect(body.error).toBe('Validation failed')
+    expect(body.issues.map((i: any) => i.slot)).toEqual(['query', 'json'])
+    expect(body.issues[1].issues[0].path).toBe('user.name')
+    expect(JSON.stringify(body)).not.toContain('secret-value')
+    expect(caught).toBeInstanceOf(HTTPException)
+    expect((caught!.cause as any).issues.map((i: any) => i.slot)).toEqual(['query', 'json'])
+    expect((caught!.cause as any).issues[0].issues[0].path).toEqual(['page'])
+  })
+
+  it('Should support object path items and omit empty paths', async () => {
+    const custom: StandardSchema<unknown, unknown> = {
+      '~standard': {
+        version: 1,
+        vendor: 'test',
+        validate: async () => ({
+          issues: [{ message: 'a', path: ['x', { key: 'y' }, 1] }, { message: 'b' }],
+        }),
+      },
+    }
+    const app = new Hono()
+    app.get(
+      '/',
+      defineHandler({ query: custom })(() => null)
+    )
+    const res = await app.request('/')
+    expect(await res.json()).toEqual({
+      error: 'Validation failed',
+      issues: [
+        {
+          slot: 'query',
+          issues: [{ message: 'a', path: 'x.y.1' }, { message: 'b' }],
+        },
+      ],
+    })
+  })
+
+  it('Should accept a callable Standard Schema', async () => {
+    const callable = Object.assign(() => 1, schema as any as StandardSchema) as any
+    Object.defineProperty(callable, '~standard', {
+      value: schema['~standard'],
+    })
+    const app = new Hono()
+    app.get(
+      '/',
+      defineHandler({ query: callable as typeof schema })((_c, { query }) => query)
+    )
+    expect(await (await app.request('/?page=3')).json()).toEqual({ page: 3 })
+  })
+
+  describe('response', () => {
+    const response = z.object({ name: z.string(), n: z.coerce.number() })
+
+    it('Should validate, transform and keep status and headers', async () => {
+      const app = new Hono()
+      app.get(
+        '/',
+        defineHandler({ response })((c) => {
+          c.status(201)
+          c.header('X-Foo', 'bar')
+          return { name: 'a', n: '5', extra: 1 } as any
+        })
+      )
+      const res = await app.request('/')
+      expect(res.status).toBe(201)
+      expect(res.headers.get('x-foo')).toBe('bar')
+      expect(await res.json()).toEqual({ name: 'a', n: 5 })
+    })
+
+    it('Should return a Response as is', async () => {
+      const app = new Hono()
+      app.get(
+        '/',
+        defineHandler({ response })((c) => c.text('plain'))
+      )
+      expect(await (await app.request('/')).text()).toBe('plain')
+    })
+
+    it('Should throw 500 without issues', async () => {
+      let caught: HTTPException | undefined
+      const app = new Hono()
+      app.onError((e) => {
+        caught = e as HTTPException
+        return (e as HTTPException).getResponse()
+      })
+      app.get(
+        '/',
+        defineHandler({ response })(() => ({ name: 1, n: 'x' }) as any)
+      )
+      const res = await app.request('/')
+      expect(res.status).toBe(500)
+      expect(await res.json()).toEqual({ error: 'Response validation failed' })
+      expect((caught!.cause as any).issues[0].slot).toBe('response')
+      expect((caught!.cause as any).issues[0].issues.length).toBeGreaterThan(0)
+    })
+
+    it('Should check the types', async () => {
+      const app = new Hono().get(
+        '/',
+        defineHandler({ response })(() => ({ name: 'a', n: 1 }))
+      )
+      // @ts-expect-error name must be a string
+      defineHandler({ response })(() => ({ name: 1, n: 1 }))
+      const client = hc<typeof app>('http://localhost')
+      const check = async () => {
+        const res = await client.index.$get()
+        type Body = Awaited<ReturnType<typeof res.json>>
+        type verify = Expect<Equal<Body, { name: string; n: number }>>
+      }
+      expect(check).toBeTypeOf('function')
+    })
+  })
+
+  it('Should run middleware before and after the validation', async () => {
+    const calls: string[] = []
+    const app = new Hono()
+    app.get(
+      '/',
+      defineHandler({ query: z.object({ a: z.string() }) })(
+        async (_c, next) => {
+          calls.push('before')
+          await next()
+          calls.push('after')
+        },
+        (c, { query }) => {
+          calls.push('handler')
+          return { a: query.a }
+        }
+      )
+    )
+    expect((await app.request('/')).status).toBe(400)
+    // the HTTPException propagates through the middleware
+    expect(calls).toEqual(['before'])
+    calls.length = 0
+    expect(await (await app.request('/?a=1')).json()).toEqual({ a: '1' })
+    expect(calls).toEqual(['before', 'handler', 'after'])
+  })
+})
diff --git a/src/helper/factory/define-handler.ts b/src/helper/factory/define-handler.ts
new file mode 100644
index 0000000..09cd3de
--- /dev/null
+++ b/src/helper/factory/define-handler.ts
@@ -0,0 +1,657 @@
+/**
+ * @module
+ * `defineHandler()` helper for Hono. It defines a handler together with its
+ * request and response validation in one place.
+ */
+
+/* eslint-disable @typescript-eslint/no-explicit-any */
+import type { Context } from '../../context'
+import { HTTPException } from '../../http-exception'
+import type {
+  Env,
+  H,
+  Input,
+  IntersectNonAnyTypes,
+  MiddlewareHandler,
+  ParsedFormValue,
+  TypedResponse,
+  ValidationTargets,
+} from '../../types'
+import type { ContentfulStatusCode } from '../../utils/http-status'
+import type { JSONParsed } from '../../utils/types'
+import type { ExtractValidatorOutput } from '../../validator/validator'
+import { getValidationTargetValue } from '../../validator/validator'
+
+type RequestTarget = 'param' | 'query' | 'header' | 'cookie' | 'form' | 'json'
+
+// The order in which the request targets are validated.
+const REQUEST_TARGETS: readonly RequestTarget[] = [
+  'param',
+  'query',
+  'header',
+  'cookie',
+  'form',
+  'json',
+]
+
+/**
+ * An issue reported by a Standard Schema.
+ *
+ * @experimental `defineHandler` is an experimental feature.
+ * The API might be changed.
+ */
+export interface ValidationIssue {
+  readonly message: string
+  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined
+}
+
+/**
+ * The issues of one slot (`query`, `json`, `response`, ...) that failed validation.
+ * `exception.cause` of the thrown `HTTPException` is `{ issues: ValidationFailure[] }`.
+ *
+ * @experimental `defineHandler` is an experimental feature.
+ * The API might be changed.
+ */
+export interface ValidationFailure {
+  slot: RequestTarget | 'response'
+  issues: ReadonlyArray<ValidationIssue>
+}
+
+/**
+ * The Standard Schema interface (https://standardschema.dev). Schemas of zod, valibot,
+ * ArkType and others implement it, so no dependency is needed.
+ *
+ * @experimental `defineHandler` is an experimental feature.
+ * The API might be changed.
+ */
+export interface StandardSchema<Input = unknown, Output = Input> {
+  readonly '~standard': {
+    readonly version: 1
+    readonly vendor: string
+    readonly validate: (
+      value: unknown
+    ) =>
+      | { readonly value: Output; readonly issues?: undefined }
+      | { readonly issues: ReadonlyArray<ValidationIssue> }
+      | Promise<
+          | { readonly value: Output; readonly issues?: undefined }
+          | { readonly issues: ReadonlyArray<ValidationIssue> }
+        >
+    readonly types?: { readonly input: Input; readonly output: Output } | undefined
+  }
+}
+
+// Method syntax makes the parameters bivariant, so that a function can annotate a narrower value.
+type ValidationFunction<In> = {
+  bivarianceHack(value: In, c: Context<any, any, any>): any
+}['bivarianceHack']
+
+type Validation<In> = StandardSchema<any, any> | ValidationFunction<In>
+
+/**
+ * Options of `defineHandler()`. Every request target is validated, if given,
+ * before the handler runs. `response` validates the value the handler returns.
+ *
+ * @experimental `defineHandler` is an experimental feature.
+ * The API might be changed.
+ */
+export interface DefineHandlerOptions<P extends string = string> {
+  param?: Validation<ValidationTargets<ParsedFormValue, P>['param']>
+  query?: Validation<ValidationTargets['query']>
+  header?: Validation<ValidationTargets['header']>
+  cookie?: Validation<ValidationTargets['cookie']>
+  form?: Validation<ValidationTargets['form']>
+  json?: Validation<ValidationTargets['json']>
+  response?: Validation<any>
+}
+
+type TargetsOf<O> = Extract<keyof O, RequestTarget>
+
+type ValidationInput<V> = V extends { '~standard': { types?: infer T } }
+  ? NonNullable<T> extends { input: infer I }
+    ? I
+    : unknown
+  : ExtractValidatorOutput<V>
+
+type ValidationOutput<V> = V extends { '~standard': { types?: infer T } }
+  ? NonNullable<T> extends { output: infer O }
+    ? O
+    : unknown
+  : ExtractValidatorOutput<V>
+
+// What the handler has to return for the `response` validation.
+type ResponseValueOf<V> = V extends { '~standard': any }
+  ? ValidationInput<V>
+  : V extends (value: infer In, ...args: any[]) => any
+    ? In
+    : never
+
+type ToInput<O> = {
+  in: { [K in TargetsOf<O>]: ValidationInput<O[K]> }
+  out: { [K in TargetsOf<O>]: ValidationOutput<O[K]> }
+}
+
+type ToValidated<O> = { [K in TargetsOf<O>]: ValidationOutput<O[K]> }
+
+type HandlerReturn<O> = O extends { response: infer V } ? ResponseValueOf<V> | Response : any
+
+type JSONResponse<T> = Response & TypedResponse<JSONParsed<T>, ContentfulStatusCode, 'json'>
+
+type ToTypedResponse<T> = T extends Response
+  ? T
+  : T extends null | undefined | void
+    ? Response & TypedResponse<undefined, 204, 'body'>
+    : T extends string | { isEscaped: true }
+      ? Response
+      : JSONResponse<T>
+
+type HandlerResult<R, O> = O extends { response: infer V }
+  ? JSONResponse<ValidationOutput<V>> | Extract<R, Response>
+  : ToTypedResponse<R>
+
+/**
+ * `defineHandler` with the options, waiting for the handler and the middleware.
+ *
+ * @experimental `defineHandler` is an experimental feature.
+ * The API might be changed.
+ */
+export interface DefineHandlerWithOptions<E extends Env, P extends string, O> {
+  // with options, handler only
+  <
+    R extends HandlerReturn<O> = HandlerReturn<O>,
+    EH extends Env = IntersectNonAnyTypes<[E]>,
+    IH extends Input = ToInput<O>,
+  >(
+    handler: (c: Context<EH, P, IH>, input: ToValidated<O>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<HandlerResult<R, O>>> & { validations: O }
+
+  // with options, 1 middleware
+  <
+    I1 extends Input = {},
+    E1 extends Env = E,
+    R extends HandlerReturn<O> = HandlerReturn<O>,
+    EH extends Env = IntersectNonAnyTypes<[E, E1]>,
+    IH extends Input = I1 & ToInput<O>,
+  >(
+    middleware1: MiddlewareHandler<E1, P, I1, any>,
+    handler: (c: Context<EH, P, IH>, input: ToValidated<O>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<HandlerResult<R, O>>> & { validations: O }
+
+  // with options, 2 middleware
+  <
+    I1 extends Input = {},
+    I2 extends Input = {},
+    E1 extends Env = E,
+    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
+    R extends HandlerReturn<O> = HandlerReturn<O>,
+    EH extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
+    IH extends Input = I1 & I2 & ToInput<O>,
+  >(
+    middleware1: MiddlewareHandler<E1, P, I1, any>,
+    middleware2: MiddlewareHandler<E2, P, I2, any>,
+    handler: (c: Context<EH, P, IH>, input: ToValidated<O>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<HandlerResult<R, O>>> & { validations: O }
+
+  // with options, 3 middleware
+  <
+    I1 extends Input = {},
+    I2 extends Input = {},
+    I3 extends Input = {},
+    E1 extends Env = E,
+    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
+    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
+    R extends HandlerReturn<O> = HandlerReturn<O>,
+    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
+    IH extends Input = I1 & I2 & I3 & ToInput<O>,
+  >(
+    middleware1: MiddlewareHandler<E1, P, I1, any>,
+    middleware2: MiddlewareHandler<E2, P, I2, any>,
+    middleware3: MiddlewareHandler<E3, P, I3, any>,
+    handler: (c: Context<EH, P, IH>, input: ToValidated<O>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<HandlerResult<R, O>>> & { validations: O }
+
+  // with options, 4 middleware
+  <
+    I1 extends Input = {},
+    I2 extends Input = {},
+    I3 extends Input = {},
+    I4 extends Input = {},
+    E1 extends Env = E,
+    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
+    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
+    E4 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
+    R extends HandlerReturn<O> = HandlerReturn<O>,
+    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4]>,
+    IH extends Input = I1 & I2 & I3 & I4 & ToInput<O>,
+  >(
+    middleware1: MiddlewareHandler<E1, P, I1, any>,
+    middleware2: MiddlewareHandler<E2, P, I2, any>,
+    middleware3: MiddlewareHandler<E3, P, I3, any>,
+    middleware4: MiddlewareHandler<E4, P, I4, any>,
+    handler: (c: Context<EH, P, IH>, input: ToValidated<O>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<HandlerResult<R, O>>> & { validations: O }
+
+  // with options, 5 middleware
+  <
+    I1 extends Input = {},
+    I2 extends Input = {},
+    I3 extends Input = {},
+    I4 extends Input = {},
+    I5 extends Input = {},
+    E1 extends Env = E,
+    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
+    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
+    E4 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
+    E5 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4]>,
+    R extends HandlerReturn<O> = HandlerReturn<O>,
+    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4, E5]>,
+    IH extends Input = I1 & I2 & I3 & I4 & I5 & ToInput<O>,
+  >(
+    middleware1: MiddlewareHandler<E1, P, I1, any>,
+    middleware2: MiddlewareHandler<E2, P, I2, any>,
+    middleware3: MiddlewareHandler<E3, P, I3, any>,
+    middleware4: MiddlewareHandler<E4, P, I4, any>,
+    middleware5: MiddlewareHandler<E5, P, I5, any>,
+    handler: (c: Context<EH, P, IH>, input: ToValidated<O>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<HandlerResult<R, O>>> & { validations: O }
+}
+
+/**
+ * The type of `defineHandler()` and `factory.defineHandler()`.
+ *
+ * @experimental `defineHandler` is an experimental feature.
+ * The API might be changed.
+ */
+export interface DefineHandlerInterface<E extends Env, P extends string> {
+  // handler only
+  <R = any, EH extends Env = IntersectNonAnyTypes<[E]>, IH extends Input = {}>(
+    handler: (c: Context<EH, P, IH>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>
+
+  // 1 middleware
+  <
+    I1 extends Input = {},
+    E1 extends Env = E,
+    R = any,
+    EH extends Env = IntersectNonAnyTypes<[E, E1]>,
+    IH extends Input = I1,
+  >(
+    middleware1: MiddlewareHandler<E1, P, I1, any>,
+    handler: (c: Context<EH, P, IH>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>
+
+  // 2 middleware
+  <
+    I1 extends Input = {},
+    I2 extends Input = {},
+    E1 extends Env = E,
+    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
+    R = any,
+    EH extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
+    IH extends Input = I1 & I2,
+  >(
+    middleware1: MiddlewareHandler<E1, P, I1, any>,
+    middleware2: MiddlewareHandler<E2, P, I2, any>,
+    handler: (c: Context<EH, P, IH>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>
+
+  // 3 middleware
+  <
+    I1 extends Input = {},
+    I2 extends Input = {},
+    I3 extends Input = {},
+    E1 extends Env = E,
+    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
+    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
+    R = any,
+    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
+    IH extends Input = I1 & I2 & I3,
+  >(
+    middleware1: MiddlewareHandler<E1, P, I1, any>,
+    middleware2: MiddlewareHandler<E2, P, I2, any>,
+    middleware3: MiddlewareHandler<E3, P, I3, any>,
+    handler: (c: Context<EH, P, IH>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>
+
+  // 4 middleware
+  <
+    I1 extends Input = {},
+    I2 extends Input = {},
+    I3 extends Input = {},
+    I4 extends Input = {},
+    E1 extends Env = E,
+    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
+    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
+    E4 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
+    R = any,
+    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4]>,
+    IH extends Input = I1 & I2 & I3 & I4,
+  >(
+    middleware1: MiddlewareHandler<E1, P, I1, any>,
+    middleware2: MiddlewareHandler<E2, P, I2, any>,
+    middleware3: MiddlewareHandler<E3, P, I3, any>,
+    middleware4: MiddlewareHandler<E4, P, I4, any>,
+    handler: (c: Context<EH, P, IH>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>
+
+  // 5 middleware
+  <
+    I1 extends Input = {},
+    I2 extends Input = {},
+    I3 extends Input = {},
+    I4 extends Input = {},
+    I5 extends Input = {},
+    E1 extends Env = E,
+    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
+    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
+    E4 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
+    E5 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4]>,
+    R = any,
+    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4, E5]>,
+    IH extends Input = I1 & I2 & I3 & I4 & I5,
+  >(
+    middleware1: MiddlewareHandler<E1, P, I1, any>,
+    middleware2: MiddlewareHandler<E2, P, I2, any>,
+    middleware3: MiddlewareHandler<E3, P, I3, any>,
+    middleware4: MiddlewareHandler<E4, P, I4, any>,
+    middleware5: MiddlewareHandler<E5, P, I5, any>,
+    handler: (c: Context<EH, P, IH>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>
+
+  // with options
+  <O extends DefineHandlerOptions<P>>(options: O): DefineHandlerWithOptions<E, P, O>
+}
+
+interface DefineHandler {
+  // handler only
+  <
+    E extends Env = any,
+    P extends string = string,
+    R = any,
+    EH extends Env = IntersectNonAnyTypes<[E]>,
+    IH extends Input = {},
+  >(
+    handler: (c: Context<EH, P, IH>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>
+
+  // 1 middleware
+  <
+    E extends Env = any,
+    P extends string = string,
+    I1 extends Input = {},
+    E1 extends Env = E,
+    R = any,
+    EH extends Env = IntersectNonAnyTypes<[E, E1]>,
+    IH extends Input = I1,
+  >(
+    middleware1: MiddlewareHandler<E1, P, I1, any>,
+    handler: (c: Context<EH, P, IH>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>
+
+  // 2 middleware
+  <
+    E extends Env = any,
+    P extends string = string,
+    I1 extends Input = {},
+    I2 extends Input = {},
+    E1 extends Env = E,
+    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
+    R = any,
+    EH extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
+    IH extends Input = I1 & I2,
+  >(
+    middleware1: MiddlewareHandler<E1, P, I1, any>,
+    middleware2: MiddlewareHandler<E2, P, I2, any>,
+    handler: (c: Context<EH, P, IH>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>
+
+  // 3 middleware
+  <
+    E extends Env = any,
+    P extends string = string,
+    I1 extends Input = {},
+    I2 extends Input = {},
+    I3 extends Input = {},
+    E1 extends Env = E,
+    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
+    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
+    R = any,
+    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
+    IH extends Input = I1 & I2 & I3,
+  >(
+    middleware1: MiddlewareHandler<E1, P, I1, any>,
+    middleware2: MiddlewareHandler<E2, P, I2, any>,
+    middleware3: MiddlewareHandler<E3, P, I3, any>,
+    handler: (c: Context<EH, P, IH>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>
+
+  // 4 middleware
+  <
+    E extends Env = any,
+    P extends string = string,
+    I1 extends Input = {},
+    I2 extends Input = {},
+    I3 extends Input = {},
+    I4 extends Input = {},
+    E1 extends Env = E,
+    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
+    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
+    E4 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
+    R = any,
+    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4]>,
+    IH extends Input = I1 & I2 & I3 & I4,
+  >(
+    middleware1: MiddlewareHandler<E1, P, I1, any>,
+    middleware2: MiddlewareHandler<E2, P, I2, any>,
+    middleware3: MiddlewareHandler<E3, P, I3, any>,
+    middleware4: MiddlewareHandler<E4, P, I4, any>,
+    handler: (c: Context<EH, P, IH>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>
+
+  // 5 middleware
+  <
+    E extends Env = any,
+    P extends string = string,
+    I1 extends Input = {},
+    I2 extends Input = {},
+    I3 extends Input = {},
+    I4 extends Input = {},
+    I5 extends Input = {},
+    E1 extends Env = E,
+    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
+    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
+    E4 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
+    E5 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4]>,
+    R = any,
+    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4, E5]>,
+    IH extends Input = I1 & I2 & I3 & I4 & I5,
+  >(
+    middleware1: MiddlewareHandler<E1, P, I1, any>,
+    middleware2: MiddlewareHandler<E2, P, I2, any>,
+    middleware3: MiddlewareHandler<E3, P, I3, any>,
+    middleware4: MiddlewareHandler<E4, P, I4, any>,
+    middleware5: MiddlewareHandler<E5, P, I5, any>,
+    handler: (c: Context<EH, P, IH>) => R | Promise<R>
+  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>
+
+  // with options
+  <O extends DefineHandlerOptions>(options: O): DefineHandlerWithOptions<any, string, O>
+}
+
+const isStandardSchema = (value: unknown): value is StandardSchema =>
+  (typeof value === 'object' || typeof value === 'function') &&
+  value !== null &&
+  '~standard' in value
+
+const toIssue = ({ message, path }: ValidationIssue): { message: string; path?: string } => {
+  const joined = path?.map((item) => String(typeof item === 'object' ? item.key : item)).join('.')
+  return joined ? { message, path: joined } : { message }
+}
+
+const validationError = (
+  status: 400 | 500,
+  failures: ValidationFailure[],
+  error: string
+): HTTPException => {
+  // The input value is never part of the response.
+  const body =
+    status === 400
+      ? {
+          error,
+          issues: failures.map(({ slot, issues }) => ({
+            slot,
+            issues: issues.map(toIssue),
+          })),
+        }
+      : { error }
+  return new HTTPException(status, {
+    message: error,
+    res: new Response(JSON.stringify(body), {
+      status,
+      headers: { 'Content-Type': 'application/json' },
+    }),
+    cause: { issues: failures },
+  })
+}
+
+type Outcome = { value: unknown } | { issues: ReadonlyArray<ValidationIssue> } | { res: Response }
+
+const validate = async (
+  validation: Validation<any>,
+  value: unknown,
+  c: Context
+): Promise<Outcome> => {
+  if (isStandardSchema(validation)) {
+    const result = await validation['~standard'].validate(value)
+    return result.issues ? { issues: result.issues } : { value: result.value }
+  }
+  const result = await (validation as ValidationFunction<unknown>)(value, c)
+  return result instanceof Response ? { res: result } : { value: result }
+}
+
+const toResponse = async (c: Context, value: unknown): Promise<Response> => {
+  if (value instanceof Response) {
+    return value
+  }
+  if (value === null || value === undefined) {
+    return c.body(null, 204)
+  }
+  if (
+    typeof value === 'string' ||
+    (typeof value === 'object' && (value as { isEscaped?: unknown }).isEscaped === true)
+  ) {
+    // string, `html` template and JSX
+    return c.html(value as string)
+  }
+  return c.json(value)
+}
+
+const build = (
+  options: DefineHandlerOptions | undefined,
+  functions: Function[]
+): ((c: Context) => Promise<Response | undefined>) => {
+  const handler = functions[functions.length - 1]
+  const middleware = functions.slice(0, -1)
+
+  const core = async (c: Context): Promise<Response> => {
+    const input: Record<string, unknown> = {}
+
+    if (options) {
+      const failures: ValidationFailure[] = []
+      for (const target of REQUEST_TARGETS) {
+        const validation = options[target]
+        if (validation === undefined) {
+          continue
+        }
+        const outcome = await validate(validation, await getValidationTargetValue(c, target), c)
+        if ('res' in outcome) {
+          return outcome.res
+        }
+        if ('issues' in outcome) {
+          failures.push({ slot: target, issues: outcome.issues })
+        } else if (!failures.length) {
+          input[target] = outcome.value
+          c.req.addValidatedData(target, outcome.value as {})
+        }
+      }
+      if (failures.length) {
+        throw validationError(400, failures, 'Validation failed')
+      }
+    }
+
+    const value = await handler(c, input)
+
+    if (options?.response !== undefined && !(value instanceof Response)) {
+      const outcome = await validate(options.response, value, c)
+      if ('res' in outcome) {
+        return outcome.res
+      }
+      if ('issues' in outcome) {
+        throw validationError(
+          500,
+          [{ slot: 'response', issues: outcome.issues }],
+          'Response validation failed'
+        )
+      }
+      return c.json(outcome.value as {})
+    }
+
+    return toResponse(c, value)
+  }
+
+  if (!middleware.length) {
+    return core
+  }
+
+  const chain = [...middleware, core]
+  return async (c) => {
+    let index = -1
+    const dispatch = async (i: number): Promise<void> => {
+      if (i <= index) {
+        throw new Error('next() called multiple times')
+      }
+      index = i
+      const res = await chain[i](c, () => dispatch(i + 1))
+      if (res && !c.finalized) {
+        c.res = res
+      }
+    }
+    await dispatch(0)
+    return c.finalized ? c.res : undefined
+  }
+}
+
+/**
+ * Defines a handler together with its request and response validation in one place.
+ *
+ * Without options, the value the handler returns is converted to a `Response`:
+ * an object as JSON, a string, JSX or an `html` template as HTML, `null` or `undefined` as `204`,
+ * and a `Response` as is. Middleware can be passed before the handler.
+ *
+ * With options, the request targets are validated in the order `param`, `query`, `header`,
+ * `cookie`, `form`, `json` before the handler runs, and the returned value is validated with
+ * `response`. A validation is a Standard Schema, or a function `(value, c) => newValue`.
+ * A failing Standard Schema throws an `HTTPException`: `400` for the request and `500` for the response.
+ *
+ * @experimental `defineHandler` is an experimental feature.
+ * The API might be changed.
+ *
+ * @example
+ * ```ts
+ * app.get(
+ *   '/posts',
+ *   defineHandler({ query: z.object({ page: z.coerce.number() }) })((c, { query }) => {
+ *     return { page: query.page }
+ *   })
+ * )
+ * ```
+ */
+export const defineHandler: DefineHandler = ((...args: unknown[]) => {
+  const [first] = args
+  if (typeof first === 'function') {
+    return build(undefined, args as Function[])
+  }
+  const options = first as DefineHandlerOptions
+  return (...functions: Function[]) =>
+    Object.assign(build(options, functions), { validations: options })
+}) as DefineHandler
diff --git a/src/helper/factory/index.ts b/src/helper/factory/index.ts
index 8f88777..ad41369 100644
--- a/src/helper/factory/index.ts
+++ b/src/helper/factory/index.ts
@@ -14,6 +14,16 @@ import type {
   IntersectNonAnyTypes,
   MiddlewareHandler,
 } from '../../types'
+import { defineHandler } from './define-handler'
+import type { DefineHandlerInterface } from './define-handler'
+
+export { defineHandler } from './define-handler'
+export type {
+  DefineHandlerOptions,
+  StandardSchema,
+  ValidationFailure,
+  ValidationIssue,
+} from './define-handler'
 
 type InitApp<E extends Env = Env> = (app: Hono<E>) => void
 
@@ -350,10 +360,27 @@ export class Factory<E extends Env = Env, P extends string = string> {
     return app
   }
 
-  createMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
+  /**
+   * @experimental `defineMiddleware` is an experimental feature.
+   * The API might be changed.
+   */
+  defineMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
     middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
   ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
 
+  /**
+   * @deprecated Use `defineMiddleware` instead.
+   */
+  createMiddleware = this.defineMiddleware
+
+  /**
+   * `defineHandler` with the Env and the path of this factory as defaults.
+   *
+   * @experimental `defineHandler` is an experimental feature.
+   * The API might be changed.
+   */
+  defineHandler: DefineHandlerInterface<E, P> = defineHandler as DefineHandlerInterface<E, P>
+
   createHandlers: CreateHandlersInterface<E, P> = (...handlers: any) => {
     // @ts-expect-error this should not be typed
     return handlers.filter((handler) => handler !== undefined)
@@ -365,7 +392,11 @@ export const createFactory = <E extends Env = Env, P extends string = string>(in
   defaultAppOptions?: HonoOptions<E>
 }): Factory<E, P> => new Factory<E, P>(init)
 
-export const createMiddleware = <
+/**
+ * @experimental `defineMiddleware` is an experimental feature.
+ * The API might be changed.
+ */
+export const defineMiddleware = <
   E extends Env = any,
   P extends string = string,
   I extends Input = {},
@@ -373,3 +404,8 @@ export const createMiddleware = <
 >(
   middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
 ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
+
+/**
+ * @deprecated Use `defineMiddleware` instead.
+ */
+export const createMiddleware = defineMiddleware
diff --git a/src/validator/validator.ts b/src/validator/validator.ts
index 5263b1d..07384af 100644
--- a/src/validator/validator.ts
+++ b/src/validator/validator.ts
@@ -43,6 +43,91 @@ export type ExtractValidationResponse<VF> = VF extends (value: any, c: any) => i
           : never // anything else → never
   : never // Can't extract → never
 
+/**
+ * Reads the request according to the validation target, the same way `validator()` does.
+ * Throws `HTTPException` with status 400 when the JSON or form body is malformed.
+ *
+ * @internal
+ */
+export const getValidationTargetValue = async (
+  c: Context,
+  target: keyof ValidationTargets
+): Promise<unknown> => {
+  let value: unknown = {}
+  const contentType = c.req.header('Content-Type')
+
+  switch (target) {
+    case 'json':
+      if (!contentType || !jsonRegex.test(contentType)) {
+        break
+      }
+      try {
+        value = await c.req.json()
+      } catch {
+        const message = 'Malformed JSON in request body'
+        throw new HTTPException(400, { message })
+      }
+      break
+    case 'form': {
+      if (
+        !contentType ||
+        !(multipartRegex.test(contentType) || urlencodedRegex.test(contentType))
+      ) {
+        break
+      }
+
+      let formData: FormData
+
+      if (c.req.bodyCache.formData) {
+        formData = await c.req.bodyCache.formData
+      } else {
+        try {
+          const arrayBuffer = await c.req.arrayBuffer()
+          formData = await bufferToFormData(arrayBuffer, contentType)
+          c.req.bodyCache.formData = formData
+        } catch (e) {
+          let message = 'Malformed FormData request.'
+          message += e instanceof Error ? ` ${e.message}` : ` ${String(e)}`
+          throw new HTTPException(400, { message })
+        }
+      }
+
+      const form: BodyData<{ all: true }> = Object.create(null)
+      formData.forEach((value, key) => {
+        if (key.endsWith('[]')) {
+          ;((form[key] ??= []) as unknown[]).push(value)
+        } else if (Array.isArray(form[key])) {
+          ;(form[key] as unknown[]).push(value)
+        } else if (Object.hasOwn(form, key)) {
+          form[key] = [form[key] as string | File, value]
+        } else {
+          form[key] = value
+        }
+      })
+      value = form
+      break
+    }
+    case 'query':
+      value = Object.fromEntries(
+        Object.entries(c.req.queries()).map(([k, v]) => {
+          return v?.length === 1 ? [k, v[0]] : [k, v]
+        })
+      )
+      break
+    case 'param':
+      value = c.req.param() as Record<string, string>
+      break
+    case 'header':
+      value = c.req.header()
+      break
+    case 'cookie':
+      value = getCookie(c)
+      break
+  }
+
+  return value
+}
+
 export const validator = <
   InputType,
   P extends string,
@@ -87,77 +172,7 @@ export const validator = <
   validationFunc: VF
 ): MiddlewareHandler<E, P, V, ExtractValidationResponse<VF>> => {
   return async (c, next) => {
-    let value = {}
-    const contentType = c.req.header('Content-Type')
-
-    switch (target) {
-      case 'json':
-        if (!contentType || !jsonRegex.test(contentType)) {
-          break
-        }
-        try {
-          value = await c.req.json()
-        } catch {
-          const message = 'Malformed JSON in request body'
-          throw new HTTPException(400, { message })
-        }
-        break
-      case 'form': {
-        if (
-          !contentType ||
-          !(multipartRegex.test(contentType) || urlencodedRegex.test(contentType))
-        ) {
-          break
-        }
-
-        let formData: FormData
-
-        if (c.req.bodyCache.formData) {
-          formData = await c.req.bodyCache.formData
-        } else {
-          try {
-            const arrayBuffer = await c.req.arrayBuffer()
-            formData = await bufferToFormData(arrayBuffer, contentType)
-            c.req.bodyCache.formData = formData
-          } catch (e) {
-            let message = 'Malformed FormData request.'
-            message += e instanceof Error ? ` ${e.message}` : ` ${String(e)}`
-            throw new HTTPException(400, { message })
-          }
-        }
-
-        const form: BodyData<{ all: true }> = Object.create(null)
-        formData.forEach((value, key) => {
-          if (key.endsWith('[]')) {
-            ;((form[key] ??= []) as unknown[]).push(value)
-          } else if (Array.isArray(form[key])) {
-            ;(form[key] as unknown[]).push(value)
-          } else if (Object.hasOwn(form, key)) {
-            form[key] = [form[key] as string | File, value]
-          } else {
-            form[key] = value
-          }
-        })
-        value = form
-        break
-      }
-      case 'query':
-        value = Object.fromEntries(
-          Object.entries(c.req.queries()).map(([k, v]) => {
-            return v?.length === 1 ? [k, v[0]] : [k, v]
-          })
-        )
-        break
-      case 'param':
-        value = c.req.param() as Record<string, string>
-        break
-      case 'header':
-        value = c.req.header()
-        break
-      case 'cookie':
-        value = getCookie(c)
-        break
-    }
+    const value = await getValidationTargetValue(c, target)
 
     const res = await validationFunc(value as never, c as never)
```

</details>

<details><summary>reply</summary>

Checking the existing validator and compose code is done. I'm now writing the helper and a refactor of `validator.ts` that exposes the request-reading step.

Most of this is in place. I'm fixing two mistakes in my own tests and checking the other failures.

Formatting is now fixed with the repo's formatter. Now I'll fix the two type-only tests.

`defineHandler()` and `defineMiddleware` are in and work as you described. The type check (including the spec tsconfig), lint, format check and the helper and validator tests all pass; I didn't run the full test suite.

- **New file:** `src/helper/factory/define-handler.ts` holds `defineHandler` and the types `StandardSchema`, `ValidationIssue`, `ValidationFailure` and `DefineHandlerOptions`. Everything new is marked `@experimental`.
- **`src/helper/factory/index.ts`:**
  - It re-exports the above, adds `defineMiddleware`, and keeps `createMiddleware` as a `@deprecated` alias.
  - `createFactory()` results now have `factory.defineMiddleware` and `factory.defineHandler`, with the factory's Env and path as defaults.
- **`src/validator/validator.ts`:** I moved the code that reads each target from the request into an exported `getValidationTargetValue()`, so `defineHandler` reads the request exactly as `validator()` does. `validator()` behaves the same and Hono's core is untouched.
- **Tests:** `src/helper/factory/define-handler.test.ts` covers the response conversions, middleware order, validation order, `400`/`500` failures and the type checks, including `hc` inferring the JSON body.

Three behaviours you didn't specify:
- **Middleware count:** the typed overloads allow up to 5 middleware before the handler, and a sixth is a type error.
- **Explicit type arguments:** `defineHandler<Env, '/me/:id'>(...)` works without options. With options, `defineHandler<Env, P>({...})` is not supported, so use `createFactory<Env, P>().defineHandler({...})`, or get the Env from the middleware.
- **`response` as a function:** `response` can also be a `(value, c) => newValue` function, like the request targets.

I didn't commit anything.

</details>

### claude, muffle: FAIL

Files: [src/helper/factory/define-handler.test.tsx](../muffle/claude/ts-hono-define-handler-1/files/src/helper/factory/define-handler.test.tsx), [src/helper/factory/define-handler.ts](../muffle/claude/ts-hono-define-handler-1/files/src/helper/factory/define-handler.ts), [src/helper/factory/index.ts](../muffle/claude/ts-hono-define-handler-1/files/src/helper/factory/index.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/helper/factory/define-handler.test.tsx b/src/helper/factory/define-handler.test.tsx
new file mode 100644
index 0000000..768e45c
--- /dev/null
+++ b/src/helper/factory/define-handler.test.tsx
@@ -0,0 +1,262 @@
+/* eslint-disable @typescript-eslint/no-explicit-any */
+import { expectTypeOf } from 'vitest'
+import { z } from 'zod'
+import { hc } from '../../client'
+import type { HTTPException } from '../../http-exception'
+import { Hono } from '../../index'
+import { html } from '../html'
+import { createFactory, createMiddleware, defineHandler, defineMiddleware } from './index'
+
+type Env = { Variables: { foo: string } }
+
+describe('defineHandler without options', () => {
+  const app = new Hono()
+  app.get(
+    '/obj',
+    defineHandler(() => ({ a: 1 }))
+  )
+  app.get(
+    '/str',
+    defineHandler(async () => 'hi')
+  )
+  app.get(
+    '/jsx',
+    defineHandler(() => <p>x</p>)
+  )
+  app.get(
+    '/html',
+    defineHandler(() => html`<b>${'<'}</b>`)
+  )
+  app.get(
+    '/none',
+    defineHandler(() => undefined)
+  )
+  app.get(
+    '/res',
+    defineHandler((c) => c.text('t', 201))
+  )
+
+  it('converts return values', async () => {
+    expect(await (await app.request('/obj')).json()).toEqual({ a: 1 })
+    const str = await app.request('/str')
+    expect(str.headers.get('Content-Type')).toMatch(/text\/html/)
+    expect(await str.text()).toBe('hi')
+    expect(await (await app.request('/jsx')).text()).toBe('<p>x</p>')
+    expect(await (await app.request('/html')).text()).toBe('<b>&lt;</b>')
+    const none = await app.request('/none')
+    expect(none.status).toBe(204)
+    expect(await none.text()).toBe('')
+    const res = await app.request('/res')
+    expect(res.status).toBe(201)
+  })
+
+  it('runs middleware around the handler', async () => {
+    const order: string[] = []
+    const mw = createMiddleware<Env>(async (c, next) => {
+      c.set('foo', 'bar')
+      order.push('before')
+      await next()
+      order.push('after')
+      c.header('X-After', '1')
+    })
+    const stop = defineMiddleware(async (c) => c.text('stopped', 401))
+    const app = new Hono()
+    const route = app.get(
+      '/a',
+      defineHandler(mw, (c) => {
+        expectTypeOf(c.get('foo')).toEqualTypeOf<string>()
+        order.push('handler')
+        return { foo: c.get('foo') }
+      })
+    )
+    app.get(
+      '/b',
+      defineHandler(stop, () => ({ never: true }))
+    )
+    const res = await app.request('/a')
+    expect(order).toEqual(['before', 'handler', 'after'])
+    expect(res.headers.get('X-After')).toBe('1')
+    expect(await res.json()).toEqual({ foo: 'bar' })
+    const res2 = await app.request('/b')
+    expect(res2.status).toBe(401)
+    expectTypeOf<ReturnType<typeof hc<typeof route>>>().not.toBeAny()
+  })
+
+  it('types Env and path', async () => {
+    const app = new Hono<Env>()
+    app.get(
+      '/me/:id',
+      defineHandler<Env, '/me/:id'>((c) => {
+        expectTypeOf(c.req.param('id')).toEqualTypeOf<string>()
+        return { id: c.req.param('id') }
+      })
+    )
+    expect(await (await app.request('/me/1')).json()).toEqual({ id: '1' })
+  })
+
+  it('infers the json body for hc', async () => {
+    const app = new Hono()
+    const route = app.get(
+      '/x',
+      defineHandler(() => ({ a: 1 }))
+    )
+    const client = hc<typeof route>('http://localhost', {
+      fetch: (i: any, init: any) => app.request(i, init),
+    })
+    const res = await client.x.$get()
+    expectTypeOf(await res.json()).toEqualTypeOf<{ a: number }>()
+  })
+
+  it('factory', async () => {
+    const factory = createFactory<Env>()
+    const mw = factory.defineMiddleware(async (c, next) => {
+      c.set('foo', 'f')
+      await next()
+    })
+    const h = factory.defineHandler((c) => {
+      expectTypeOf(c.get('foo')).toEqualTypeOf<string>()
+      return c.var.foo ?? null
+    })
+    const app = factory.createApp()
+    app.get('/', mw, h)
+    expect(await (await app.request('/')).text()).toBe('f')
+  })
+})
+
+describe('defineHandler with options', () => {
+  it('validates all targets in order and gives input', async () => {
+    const app = new Hono()
+    const route = app.post(
+      '/p/:id',
+      defineHandler({
+        param: z.object({ id: z.string() }),
+        query: z.object({ page: z.coerce.number() }),
+        header: (v: Record<string, string>) => ({ ua: v['x-a'] }),
+        cookie: async (v) => v,
+        json: z.object({ name: z.string() }),
+        response: z.object({ n: z.number() }).transform((v) => ({ ...v, t: 1 })),
+      })((c, input) => {
+        expectTypeOf(input.query.page).toEqualTypeOf<number>()
+        expectTypeOf(input.json.name).toEqualTypeOf<string>()
+        expectTypeOf(input.header.ua).toEqualTypeOf<string>()
+        expect(c.req.valid('json')).toBe(input.json)
+        c.status(201)
+        c.header('X-H', 'h')
+        return { n: input.query.page }
+      })
+    )
+    const res = await app.request('/p/7?page=3', {
+      method: 'POST',
+      headers: { 'Content-Type': 'application/json', 'x-a': 'u' },
+      body: JSON.stringify({ name: 'n' }),
+    })
+    expect(res.status).toBe(201)
+    expect(res.headers.get('X-H')).toBe('h')
+    expect(await res.json()).toEqual({ n: 3, t: 1 })
+    const client = hc<typeof route>('http://localhost', {
+      fetch: (i: any, init: any) => app.request(i, init),
+    })
+    const r = await client.p[':id'].$post({
+      param: { id: '1' },
+      query: { page: '1' as any },
+      json: { name: 'x' },
+      cookie: {},
+      header: { ua: 'x' } as any,
+    })
+    expectTypeOf(await r.json()).toEqualTypeOf<{ n: number; t: number }>()
+  })
+
+  it('throws HTTPException with issues of every failed target', async () => {
+    const app = new Hono()
+    let cause: unknown
+    app.onError((e) => {
+      cause = (e as HTTPException).cause
+      return (e as HTTPException).getResponse()
+    })
+    app.post(
+      '/',
+      defineHandler({
+        query: z.object({ a: z.string() }),
+        json: z.object({ b: z.object({ c: z.number() }) }),
+      })(() => ({}))
+    )
+    const res = await app.request('/?x=secret', {
+      method: 'POST',
+      headers: { 'Content-Type': 'application/json' },
+      body: JSON.stringify({ b: { c: 'secret' } }),
+    })
+    expect(res.status).toBe(400)
+    const body: any = await res.json()
+    expect(body.error).toBe('Validation failed')
+    expect(body.issues.map((i: any) => i.slot)).toEqual(['query', 'json'])
+    expect(body.issues[1].issues[0].path).toBe('b.c')
+    expect(JSON.stringify(body)).not.toContain('secret')
+    expect((cause as any).issues[1].slot).toBe('json')
+    expect(Array.isArray((cause as any).issues[1].issues)).toBe(true)
+  })
+
+  it('keeps malformed JSON as 400', async () => {
+    const app = new Hono()
+    app.post(
+      '/',
+      defineHandler({ json: z.any() })(() => ({}))
+    )
+    const res = await app.request('/', {
+      method: 'POST',
+      headers: { 'Content-Type': 'application/json' },
+      body: '{',
+    })
+    expect(res.status).toBe(400)
+    expect(await res.text()).toBe('Malformed JSON in request body')
+  })
+
+  it('function validator may return a Response; middleware order', async () => {
+    const order: string[] = []
+    const mw = defineMiddleware(async (_c, next) => {
+      order.push('mw-before')
+      await next()
+      order.push('mw-after')
+    })
+    const app = new Hono()
+    app.get(
+      '/',
+      defineHandler({
+        query: (v, c) => {
+          order.push('validate')
+          return v.stop ? c.text('halt', 418) : v
+        },
+        response: z.object({ ok: z.boolean() }),
+      })(mw, () => {
+        order.push('handler')
+        return { ok: true }
+      })
+    )
+    expect((await app.request('/?stop=1')).status).toBe(418)
+    order.length = 0
+    expect(await (await app.request('/')).json()).toEqual({ ok: true })
+    expect(order).toEqual(['mw-before', 'validate', 'handler', 'mw-after'])
+  })
+
+  it('response validation failure is a 500 without issues', async () => {
+    const app = new Hono()
+    let cause: any
+    app.onError((e) => {
+      cause = e.cause
+      return (e as HTTPException).getResponse()
+    })
+    app.get(
+      '/',
+      defineHandler({ response: z.object({ n: z.number() }) })(() => ({ n: 'x' }) as any)
+    )
+    const res = await app.request('/')
+    expect(res.status).toBe(500)
+    expect(await res.json()).toEqual({ error: 'Response validation failed' })
+    expect(cause.issues[0].slot).toBe('response')
+  })
+
+  it('exposes validations', () => {
+    const options = { query: z.object({}) }
+    expect(defineHandler(options).validations).toBe(options)
+    expect(defineHandler(options)(() => 1).validations).toBe(options)
+  })
+})
diff --git a/src/helper/factory/define-handler.ts b/src/helper/factory/define-handler.ts
new file mode 100644
index 0000000..f1fc8da
--- /dev/null
+++ b/src/helper/factory/define-handler.ts
@@ -0,0 +1,526 @@
+/**
+ * @module
+ * `defineHandler()` for Hono: defines a handler together with its request and response validation.
+ */
+
+/* eslint-disable @typescript-eslint/no-explicit-any */
+import type { Context } from '../../context'
+import { HTTPException } from '../../http-exception'
+import type {
+  Env,
+  Handler,
+  Input,
+  IntersectNonAnyTypes,
+  MiddlewareHandler,
+  TypedResponse,
+  ValidationTargets,
+} from '../../types'
+import type { ContentfulStatusCode } from '../../utils/http-status'
+import type { JSONParsed } from '../../utils/types'
+import { validator } from '../../validator'
+
+////////////////////////////////////////
+//////                            //////
+//////      Standard Schema       //////
+//////                            //////
+////////////////////////////////////////
+
+type PathSegment = PropertyKey | { readonly key: PropertyKey }
+
+type StandardResult<Output> =
+  | { readonly value: Output; readonly issues?: undefined }
+  | { readonly issues: ReadonlyArray<ValidationIssue> }
+
+/**
+ * A [Standard Schema](https://standardschema.dev). Objects and callables that carry `~standard`
+ * are accepted, so zod, valibot, ArkType and similar libraries work without a dependency.
+ *
+ * @experimental
+ */
+export type StandardSchema<Input = unknown, Output = Input> = {
+  readonly '~standard': {
+    readonly version: 1
+    readonly vendor: string
+    readonly validate: (
+      value: unknown,
+      ...rest: any[]
+    ) => StandardResult<Output> | Promise<StandardResult<Output>>
+    readonly types?: { readonly input: Input; readonly output: Output } | undefined
+  }
+}
+
+/**
+ * An issue reported by a Standard Schema.
+ *
+ * @experimental
+ */
+export type ValidationIssue = {
+  readonly message: string
+  readonly path?: ReadonlyArray<PathSegment> | undefined
+}
+
+/**
+ * The issues of one failed validation. `slot` is the request target, or `'response'`.
+ * Available as `exception.cause.issues` of the `HTTPException` thrown on failure.
+ *
+ * @experimental
+ */
+export type ValidationFailure = {
+  slot: string
+  issues: ReadonlyArray<ValidationIssue>
+}
+
+////////////////////////////////////////
+//////                            //////
+//////           Types            //////
+//////                            //////
+////////////////////////////////////////
+
+type Target = 'param' | 'query' | 'header' | 'cookie' | 'form' | 'json'
+const TARGETS: readonly Target[] = ['param', 'query', 'header', 'cookie', 'form', 'json']
+
+type MaybePromise<T> = T | Promise<T>
+
+type ValidationFunction<T extends Target, E extends Env, P extends string> = (
+  value: ValidationTargets[T],
+  c: Context<E, P>
+) => unknown
+
+/**
+ * Options of `defineHandler()`. A request target is validated by a Standard Schema or by a
+ * function `(value, c) => newValue`; a function may return a `Response` to skip the handler.
+ *
+ * @experimental
+ */
+export type DefineHandlerOptions<E extends Env = any, P extends string = string> = {
+  [T in Target]?: StandardSchema<any, any> | ValidationFunction<T, E, P>
+} & {
+  response?: StandardSchema<any, any>
+}
+
+type ValidatedValue<T> =
+  T extends StandardSchema<any, infer O>
+    ? O
+    : T extends (...args: any[]) => infer R
+      ? Exclude<Awaited<R>, Response | TypedResponse<any, any, any>>
+      : never
+
+type SchemaInput<T> =
+  T extends StandardSchema<infer I, any>
+    ? I
+    : T extends (...args: any[]) => any
+      ? ValidatedValue<T>
+      : never
+
+type PresentTargets<V> = {
+  [T in Target]: T extends keyof V ? (undefined extends V[T] ? never : T) : never
+}[Target]
+
+/** The validated value per request target. */
+export type ValidatedInput<V> = { [T in PresentTargets<V>]: ValidatedValue<V[T & keyof V]> }
+
+type OptionsInput<V> = {
+  in: { [T in PresentTargets<V>]: SchemaInput<V[T & keyof V]> }
+  out: { [T in PresentTargets<V>]: ValidatedValue<V[T & keyof V]> }
+}
+
+type ResponseInputOf<V> = V extends { response: StandardSchema<infer I, any> } ? I : never
+type ResponseOutputOf<V> = V extends { response: StandardSchema<any, infer O> } ? O : never
+type HasResponse<V> = V extends { response: StandardSchema<any, any> } ? true : false
+
+type HtmlLike = string | { isEscaped: true }
+
+type ToResponse<R> =
+  Awaited<R> extends infer X
+    ? X extends TypedResponse<any, any, any>
+      ? X
+      : X extends Response
+        ? X
+        : X extends null | undefined | void
+          ? TypedResponse<null, 204, 'body'>
+          : X extends HtmlLike
+            ? TypedResponse<string, ContentfulStatusCode, 'html'>
+            : TypedResponse<JSONParsed<X>, ContentfulStatusCode, 'json'>
+    : never
+
+type ToValidatedResponse<V, R> =
+  | TypedResponse<JSONParsed<ResponseOutputOf<V>>, ContentfulStatusCode, 'json'>
+  | Extract<Awaited<R>, Response>
+
+type ResultOf<V, R> = HasResponse<V> extends true ? ToValidatedResponse<V, R> : ToResponse<R>
+
+type ReturnConstraint<V> =
+  HasResponse<V> extends true ? MaybePromise<ResponseInputOf<V> | Response> : unknown
+
+/** The handler of `defineHandler(options)(handler)`. */
+type OptionsHandler<E extends Env, P extends string, I extends Input, V, R> = (
+  c: Context<E, P, I>,
+  input: ValidatedInput<V>
+) => R
+
+type Validated<H, V> = H & { validations: V }
+
+/**
+ * `defineHandler(...)(...)` with validation options, returned by `defineHandler(options)`.
+ *
+ * @experimental
+ */
+export interface DefineHandlerWithOptions<
+  V extends DefineHandlerOptions<any, any>,
+  E extends Env = any,
+  P extends string = string,
+> {
+  validations: V
+
+  <R extends ReturnConstraint<V>, E2 extends Env = E>(
+    handler: OptionsHandler<E2, P, OptionsInput<V>, V, R>
+  ): Validated<Handler<E2, P, OptionsInput<V>, Promise<ResultOf<V, R>>>, V>
+
+  <
+    I extends Input,
+    R extends ReturnConstraint<V>,
+    E2 extends Env = E,
+    E3 extends Env = IntersectNonAnyTypes<[E, E2]>,
+  >(
+    middleware1: MiddlewareHandler<E2, P, I, any>,
+    handler: OptionsHandler<E3, P, I & OptionsInput<V>, V, R>
+  ): Validated<Handler<E3, P, I & OptionsInput<V>, Promise<ResultOf<V, R>>>, V>
+
+  <
+    I extends Input,
+    R extends ReturnConstraint<V>,
+    E2 extends Env = E,
+    E3 extends Env = E,
+    E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>,
+  >(
+    middleware1: MiddlewareHandler<E2, P, I, any>,
+    middleware2: MiddlewareHandler<E3, P, I, any>,
+    handler: OptionsHandler<E4, P, I & OptionsInput<V>, V, R>
+  ): Validated<Handler<E4, P, I & OptionsInput<V>, Promise<ResultOf<V, R>>>, V>
+
+  <
+    I extends Input,
+    R extends ReturnConstraint<V>,
+    E2 extends Env = E,
+    E3 extends Env = E,
+    E4 extends Env = E,
+    E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>,
+  >(
+    middleware1: MiddlewareHandler<E2, P, I, any>,
+    middleware2: MiddlewareHandler<E3, P, I, any>,
+    middleware3: MiddlewareHandler<E4, P, I, any>,
+    handler: OptionsHandler<E5, P, I & OptionsInput<V>, V, R>
+  ): Validated<Handler<E5, P, I & OptionsInput<V>, Promise<ResultOf<V, R>>>, V>
+}
+
+/**
+ * Overloads of `defineHandler` for a given default Env and path (used by `factory.defineHandler`).
+ *
+ * @experimental
+ */
+export interface DefineHandlerInterface<E extends Env = any, P extends string = string> {
+  // with validation options
+  <V extends DefineHandlerOptions<E, P>>(options: V): DefineHandlerWithOptions<V, E, P>
+
+  // handler
+  <I extends Input = {}, R = unknown, E2 extends Env = E>(
+    handler: (c: Context<E2, P, I>) => R
+  ): Handler<E2, P, I, Promise<ToResponse<R>>>
+
+  // middleware x1 + handler
+  <
+    I extends Input = {},
+    R = unknown,
+    E2 extends Env = E,
+    E3 extends Env = IntersectNonAnyTypes<[E, E2]>,
+  >(
+    middleware1: MiddlewareHandler<E2, P, I, any>,
+    handler: (c: Context<E3, P, I>) => R
+  ): Handler<E3, P, I, Promise<ToResponse<R>>>
+
+  // middleware x2 + handler
+  <
+    I extends Input = {},
+    R = unknown,
+    E2 extends Env = E,
+    E3 extends Env = E,
+    E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>,
+  >(
+    middleware1: MiddlewareHandler<E2, P, I, any>,
+    middleware2: MiddlewareHandler<E3, P, I, any>,
+    handler: (c: Context<E4, P, I>) => R
+  ): Handler<E4, P, I, Promise<ToResponse<R>>>
+
+  // middleware x3 + handler
+  <
+    I extends Input = {},
+    R = unknown,
+    E2 extends Env = E,
+    E3 extends Env = E,
+    E4 extends Env = E,
+    E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>,
+  >(
+    middleware1: MiddlewareHandler<E2, P, I, any>,
+    middleware2: MiddlewareHandler<E3, P, I, any>,
+    middleware3: MiddlewareHandler<E4, P, I, any>,
+    handler: (c: Context<E5, P, I>) => R
+  ): Handler<E5, P, I, Promise<ToResponse<R>>>
+}
+
+////////////////////////////////////////
+//////                            //////
+//////          Runtime           //////
+//////                            //////
+////////////////////////////////////////
+
+const isStandardSchema = (value: unknown): value is StandardSchema<any, any> =>
+  (typeof value === 'object' || typeof value === 'function') &&
+  value !== null &&
+  typeof (value as any)['~standard']?.validate === 'function'
+
+const formatPath = (path: ReadonlyArray<PathSegment>): string =>
+  path.map((p) => String(typeof p === 'object' && p !== null ? p.key : p)).join('.')
+
+const throwFailures = (
+  status: 400 | 500,
+  error: string,
+  failures: ValidationFailure[],
+  expose: boolean
+): never => {
+  const body: { error: string; issues?: unknown } = { error }
+  if (expose) {
+    // Only the message and the path are exposed, never the input value.
+    body.issues = failures.map(({ slot, issues }) => ({
+      slot,
+      issues: issues.map(({ message, path }) =>
+        path && path.length > 0 ? { message, path: formatPath(path) } : { message }
+      ),
+    }))
+  }
+  throw new HTTPException(status, {
+    message: error,
+    res: new Response(JSON.stringify(body), {
+      status,
+      headers: { 'Content-Type': 'application/json' },
+    }),
+    cause: { issues: failures },
+  })
+}
+
+const toResponse = (c: Context, value: unknown): Response | Promise<Response> => {
+  if (value instanceof Response) {
+    return value
+  }
+  if (value === null || value === undefined) {
+    return c.body(null, 204)
+  }
+  if (typeof value === 'string' || (typeof value === 'object' && (value as any).isEscaped)) {
+    return c.html(value as string)
+  }
+  return c.json(value as any)
+}
+
+const validateRequest = async (
+  c: Context,
+  options: DefineHandlerOptions
+): Promise<Response | undefined> => {
+  const failures: ValidationFailure[] = []
+  for (const slot of TARGETS) {
+    const validation = options[slot]
+    if (validation === undefined) {
+      continue
+    }
+    let passed = false
+    // `validator()` reads the request, so every target is read exactly like it does.
+    const res = await validator(slot, async (value: unknown, ctx: Context) => {
+      if (isStandardSchema(validation)) {
+        const result = await validation['~standard'].validate(value)
+        if (result.issues) {
+          failures.push({ slot, issues: result.issues })
+          return value
+        }
+        return (result as { value: unknown }).value
+      }
+      return (validation as ValidationFunction<Target, any, any>)(value as never, ctx)
+    })(c, async () => {
+      passed = true
+    })
+    if (!passed) {
+      return res as unknown as Response
+    }
+  }
+  if (failures.length > 0) {
+    throwFailures(400, 'Validation failed', failures, true)
+  }
+  return undefined
+}
+
+const compose = async (
+  c: Context,
+  middleware: MiddlewareHandler[],
+  last: () => Promise<Response>
+): Promise<Response | undefined> => {
+  if (middleware.length === 0) {
+    return last()
+  }
+  let index = -1
+  const dispatch = async (i: number): Promise<void> => {
+    if (i <= index) {
+      throw new Error('next() called multiple times')
+    }
+    index = i
+    if (i === middleware.length) {
+      c.res = await last()
+      return
+    }
+    const res = await middleware[i](c, () => dispatch(i + 1))
+    if (res && !c.finalized) {
+      c.res = res
+    }
+  }
+  await dispatch(0)
+  return c.finalized ? c.res : undefined
+}
+
+const build = (
+  options: DefineHandlerOptions | undefined,
+  middleware: MiddlewareHandler[],
+  handler: (c: Context, input: any) => unknown
+) => {
+  const core = async (c: Context): Promise<Response> => {
+    if (options) {
+      const res = await validateRequest(c, options)
+      if (res) {
+        return res
+      }
+    }
+    const input: Record<string, unknown> = {}
+    if (options) {
+      for (const slot of TARGETS) {
+        if (options[slot] !== undefined) {
+          input[slot] = c.req.valid(slot as never)
+        }
+      }
+    }
+    const result = await handler(c, input)
+    if (result instanceof Response) {
+      return result
+    }
+    if (options?.response) {
+      const checked = await options.response['~standard'].validate(result)
+      if (checked.issues) {
+        throwFailures(
+          500,
+          'Response validation failed',
+          [{ slot: 'response', issues: checked.issues }],
+          false
+        )
+      }
+      return c.json((checked as { value: unknown }).value as any)
+    }
+    return toResponse(c, result)
+  }
+  const defined = (c: Context) => compose(c, middleware, () => core(c))
+  return options ? Object.assign(defined, { validations: options }) : defined
+}
+
+/**
+ * Defines a handler together with its request and response validation in one place.
+ *
+ * Without options it converts the returned value to a `Response`: an object becomes JSON, a string,
+ * JSX or an `html` template becomes HTML, `null`/`undefined` becomes `204`, and a `Response` is
+ * returned as is. Middleware passed before the handler runs around it.
+ *
+ * With options, each given request target (`param`, `query`, `header`, `cookie`, `form`, `json`) is
+ * validated in that order before the handler runs, and the handler receives `(c, input)`. Standard
+ * Schema failures throw an `HTTPException` (`400`, or `500` for `response`) that `onError` can handle.
+ * The order is: middleware before, request validation, handler, response validation, middleware after.
+ *
+ * @experimental
+ *
+ * @example
+ * ```ts
+ * app.get(
+ *   '/posts',
+ *   defineHandler({ query: z.object({ page: z.coerce.number() }) })((c, { query }) => {
+ *     return { page: query.page }
+ *   })
+ * )
+ * ```
+ */
+export const defineHandler: {
+  // with validation options
+  <V extends DefineHandlerOptions<any, string>>(
+    options: V
+  ): DefineHandlerWithOptions<V, any, string>
+  <
+    E extends Env,
+    P extends string = string,
+    V extends DefineHandlerOptions<E, P> = DefineHandlerOptions<E, P>,
+  >(
+    options: V
+  ): DefineHandlerWithOptions<V, E, P>
+
+  // handler
+  <
+    E extends Env = any,
+    P extends string = string,
+    I extends Input = {},
+    R = unknown,
+    E2 extends Env = E,
+  >(
+    handler: (c: Context<E2, P, I>) => R
+  ): Handler<E2, P, I, Promise<ToResponse<R>>>
+
+  // middleware x1 + handler
+  <
+    E extends Env = any,
+    P extends string = string,
+    I extends Input = {},
+    R = unknown,
+    E2 extends Env = E,
+    E3 extends Env = IntersectNonAnyTypes<[E, E2]>,
+  >(
+    middleware1: MiddlewareHandler<E2, P, I, any>,
+    handler: (c: Context<E3, P, I>) => R
+  ): Handler<E3, P, I, Promise<ToResponse<R>>>
+
+  // middleware x2 + handler
+  <
+    E extends Env = any,
+    P extends string = string,
+    I extends Input = {},
+    R = unknown,
+    E2 extends Env = E,
+    E3 extends Env = E,
+    E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>,
+  >(
+    middleware1: MiddlewareHandler<E2, P, I, any>,
+    middleware2: MiddlewareHandler<E3, P, I, any>,
+    handler: (c: Context<E4, P, I>) => R
+  ): Handler<E4, P, I, Promise<ToResponse<R>>>
+
+  // middleware x3 + handler
+  <
+    E extends Env = any,
+    P extends string = string,
+    I extends Input = {},
+    R = unknown,
+    E2 extends Env = E,
+    E3 extends Env = E,
+    E4 extends Env = E,
+    E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>,
+  >(
+    middleware1: MiddlewareHandler<E2, P, I, any>,
+    middleware2: MiddlewareHandler<E3, P, I, any>,
+    middleware3: MiddlewareHandler<E4, P, I, any>,
+    handler: (c: Context<E5, P, I>) => R
+  ): Handler<E5, P, I, Promise<ToResponse<R>>>
+} = (...args: any[]): any => {
+  if (typeof args[0] === 'function') {
+    return build(undefined, args.slice(0, -1), args[args.length - 1])
+  }
+  const options = args[0] as DefineHandlerOptions
+  const define = (...fns: any[]) => build(options, fns.slice(0, -1), fns[fns.length - 1])
+  return Object.assign(define, { validations: options })
+}
diff --git a/src/helper/factory/index.ts b/src/helper/factory/index.ts
index 8f88777..3129044 100644
--- a/src/helper/factory/index.ts
+++ b/src/helper/factory/index.ts
@@ -14,6 +14,16 @@ import type {
   IntersectNonAnyTypes,
   MiddlewareHandler,
 } from '../../types'
+import type { DefineHandlerInterface } from './define-handler'
+import { defineHandler } from './define-handler'
+
+export { defineHandler }
+export type {
+  DefineHandlerOptions,
+  StandardSchema,
+  ValidationFailure,
+  ValidationIssue,
+} from './define-handler'
 
 type InitApp<E extends Env = Env> = (app: Hono<E>) => void
 
@@ -350,10 +360,25 @@ export class Factory<E extends Env = Env, P extends string = string> {
     return app
   }
 
-  createMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
+  /**
+   * @experimental
+   */
+  defineMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
     middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
   ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
 
+  /**
+   * @deprecated Use `defineMiddleware` instead.
+   */
+  createMiddleware = this.defineMiddleware
+
+  /**
+   * `defineHandler` with this factory's Env and path as defaults.
+   *
+   * @experimental
+   */
+  defineHandler: DefineHandlerInterface<E, P> = defineHandler as DefineHandlerInterface<E, P>
+
   createHandlers: CreateHandlersInterface<E, P> = (...handlers: any) => {
     // @ts-expect-error this should not be typed
     return handlers.filter((handler) => handler !== undefined)
@@ -365,6 +390,23 @@ export const createFactory = <E extends Env = Env, P extends string = string>(in
   defaultAppOptions?: HonoOptions<E>
 }): Factory<E, P> => new Factory<E, P>(init)
 
+/**
+ * Defines a middleware. The new name of `createMiddleware`.
+ *
+ * @experimental
+ */
+export const defineMiddleware = <
+  E extends Env = any,
+  P extends string = string,
+  I extends Input = {},
+  R extends HandlerResponse<any> | void = void,
+>(
+  middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
+): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
+
+/**
+ * @deprecated Use `defineMiddleware` instead.
+ */
 export const createMiddleware = <
   E extends Env = any,
   P extends string = string,
```

</details>

<details><summary>reply</summary>

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

</details>

### claude, hush: pass

Files: [src/helper/factory/define-handler.test.ts](../hush/claude/ts-hono-define-handler-1/files/src/helper/factory/define-handler.test.ts), [src/helper/factory/define-handler.ts](../hush/claude/ts-hono-define-handler-1/files/src/helper/factory/define-handler.ts), [src/helper/factory/index.ts](../hush/claude/ts-hono-define-handler-1/files/src/helper/factory/index.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/helper/factory/define-handler.test.ts b/src/helper/factory/define-handler.test.ts
new file mode 100644
index 0000000..3288043
--- /dev/null
+++ b/src/helper/factory/define-handler.test.ts
@@ -0,0 +1,295 @@
+/* eslint-disable @typescript-eslint/no-unused-vars */
+import { expectTypeOf } from "vitest";
+import { z } from "zod";
+import { hc } from "../../client";
+import { HTTPException } from "../../http-exception";
+import { Hono } from "../../index";
+import { html } from "../html";
+import {
+  createFactory,
+  createMiddleware,
+  defineHandler,
+  defineMiddleware,
+} from "./index";
+
+type Env = { Variables: { user: string } };
+
+describe("defineHandler without options", () => {
+  const app = new Hono();
+  app.get(
+    "/obj",
+    defineHandler(() => ({ ok: true })),
+  );
+  app.get(
+    "/async",
+    defineHandler(async () => [1, 2]),
+  );
+  app.get(
+    "/str",
+    defineHandler(() => "hi"),
+  );
+  app.get(
+    "/html",
+    defineHandler(() => html`<b>x</b>`),
+  );
+  app.get(
+    "/none",
+    defineHandler(() => null),
+  );
+  app.get(
+    "/undef",
+    defineHandler(async () => undefined),
+  );
+  app.get(
+    "/res",
+    defineHandler((c) => c.text("t", 201)),
+  );
+
+  it("converts return values", async () => {
+    let res = await app.request("/obj");
+    expect(await res.json()).toEqual({ ok: true });
+    expect(res.headers.get("content-type")).toMatch(/json/);
+    expect(await (await app.request("/async")).json()).toEqual([1, 2]);
+    res = await app.request("/str");
+    expect(res.headers.get("content-type")).toMatch(/html/);
+    expect(await res.text()).toBe("hi");
+    res = await app.request("/html");
+    expect(res.headers.get("content-type")).toMatch(/html/);
+    expect(await res.text()).toBe("<b>x</b>");
+    for (const path of ["/none", "/undef"]) {
+      res = await app.request(path);
+      expect(res.status).toBe(204);
+      expect(await res.text()).toBe("");
+    }
+    res = await app.request("/res");
+    expect(res.status).toBe(201);
+  });
+
+  it("runs middleware around the handler", async () => {
+    const order: string[] = [];
+    const mw = (n: string) =>
+      defineMiddleware<Env>(async (c, next) => {
+        order.push(`${n}-before`);
+        c.set("user", "bob");
+        await next();
+        order.push(`${n}-after`);
+      });
+    const app = new Hono();
+    app.get(
+      "/",
+      defineHandler(mw("a"), mw("b"), (c) => {
+        expectTypeOf(c.get("user")).toEqualTypeOf<string>();
+        order.push("handler");
+        return { user: c.get("user") };
+      }),
+    );
+    const res = await app.request("/");
+    expect(await res.json()).toEqual({ user: "bob" });
+    expect(order).toEqual([
+      "a-before",
+      "b-before",
+      "handler",
+      "b-after",
+      "a-after",
+    ]);
+  });
+
+  it("stops the chain when middleware returns a response", async () => {
+    const handler = vi.fn(() => "x");
+    const app = new Hono();
+    app.get(
+      "/",
+      defineHandler(async (c) => c.text("denied", 401), handler),
+    );
+    const res = await app.request("/");
+    expect(res.status).toBe(401);
+    expect(handler).not.toHaveBeenCalled();
+  });
+
+  it("types with explicit Env and path", async () => {
+    const app = new Hono<Env>();
+    app.get(
+      "/me/:id",
+      defineHandler<Env, "/me/:id">((c) => {
+        expectTypeOf(c.get("user")).toEqualTypeOf<string>();
+        return { id: c.req.param("id") };
+      }),
+    );
+    app.use(async (c, next) => {
+      c.set("user", "u");
+      await next();
+    });
+    expect(await (await app.request("/me/7")).json()).toEqual({ id: "7" });
+  });
+
+  it("infers the RPC type", async () => {
+    const route = new Hono().get(
+      "/x",
+      defineHandler(() => ({ a: 1 })),
+    );
+    const client = hc<typeof route>("http://localhost", {
+      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
+        route.request(input, init),
+    });
+    const res = await client.x.$get();
+    expectTypeOf(await res.json()).toEqualTypeOf<{ a: number }>();
+  });
+
+  it("keeps createMiddleware as an alias", () => {
+    expect(createMiddleware).toBe(defineMiddleware);
+    const f = createFactory();
+    expect(typeof f.defineMiddleware).toBe("function");
+    expect(typeof f.defineHandler).toBe("function");
+  });
+});
+
+describe("defineHandler with options", () => {
+  const calls: string[] = [];
+  const query = z.object({ page: z.coerce.number() });
+  const json = z.object({ name: z.string().min(3) });
+
+  const app = new Hono();
+  const route = app.post(
+    "/items/:id",
+    defineHandler({
+      param: (v) => {
+        calls.push("param");
+        return { id: Number(v.id) };
+      },
+      query,
+      json,
+      response: z.object({
+        id: z.number(),
+        name: z.string().transform((s) => s.toUpperCase()),
+      }),
+    })(async (c, input) => {
+      expectTypeOf(input.query.page).toEqualTypeOf<number>();
+      expectTypeOf(input.param.id).toEqualTypeOf<number>();
+      expect(c.req.valid("json")).toBe(input.json);
+      c.status(201);
+      c.header("X-A", "b");
+      return { id: input.param.id, name: input.json.name };
+    }),
+  );
+
+  it("validates and transforms", async () => {
+    const res = await app.request("/items/5?page=2", {
+      method: "POST",
+      headers: { "content-type": "application/json" },
+      body: JSON.stringify({ name: "abc" }),
+    });
+    expect(res.status).toBe(201);
+    expect(res.headers.get("x-a")).toBe("b");
+    expect(await res.json()).toEqual({ id: 5, name: "ABC" });
+  });
+
+  it("reports all failed targets without the input", async () => {
+    let exception: HTTPException | undefined;
+    app.onError((e) => {
+      exception = e as HTTPException;
+      return e instanceof HTTPException
+        ? e.getResponse()
+        : new Response("x", { status: 500 });
+    });
+    const res = await app.request("/items/5?page=abc", {
+      method: "POST",
+      headers: { "content-type": "application/json" },
+      body: JSON.stringify({ name: "secret-ab" === "" ? "" : "a" }),
+    });
+    expect(res.status).toBe(400);
+    const body = (await res.json()) as any;
+    expect(body.error).toBe("Validation failed");
+    expect(body.issues.map((i: any) => i.slot)).toEqual(["query", "json"]);
+    expect(body.issues[0].issues[0].path).toBe("page");
+    expect(JSON.stringify(body)).not.toContain("abc");
+    expect((exception!.cause as any).issues[0].issues[0].message).toBeTypeOf(
+      "string",
+    );
+  });
+
+  it("keeps malformed JSON as 400", async () => {
+    const res = await app.request("/items/5?page=1", {
+      method: "POST",
+      headers: { "content-type": "application/json" },
+      body: "{",
+    });
+    expect(res.status).toBe(400);
+    expect(await res.text()).toBe("Malformed JSON in request body");
+  });
+
+  it("returns a Response from a validation function", async () => {
+    const handler = vi.fn(() => ({}));
+    const app = new Hono();
+    app.get(
+      "/",
+      defineHandler({ query: (_v, c) => c.text("no", 403) })(handler),
+    );
+    expect((await app.request("/")).status).toBe(403);
+    expect(handler).not.toHaveBeenCalled();
+  });
+
+  it("fails response validation with 500 and no issues", async () => {
+    const app = new Hono();
+    let cause: unknown;
+    app.onError((e) => {
+      cause = e.cause;
+      return (e as HTTPException).getResponse();
+    });
+    // @ts-expect-error wrong return type
+    app.get(
+      "/",
+      defineHandler({ response: z.object({ a: z.string() }) })(() => ({
+        a: 1,
+      })),
+    );
+    const res = await app.request("/");
+    expect(res.status).toBe(500);
+    expect(await res.json()).toEqual({ error: "Response validation failed" });
+    expect((cause as any).issues[0].slot).toBe("response");
+  });
+
+  it("passes through a returned Response and exposes validations", async () => {
+    const options = { response: z.object({ a: z.string() }) };
+    const h = defineHandler(options)((c) => c.json({ other: 1 }, 202));
+    expect(h.validations).toBe(options);
+    const app = new Hono();
+    app.get("/", h);
+    const res = await app.request("/");
+    expect(res.status).toBe(202);
+  });
+
+  it("infers the RPC types", async () => {
+    const client = hc<typeof route>("http://localhost", {
+      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
+        app.request(input, init),
+    });
+    const res = await client.items[":id"].$post({
+      param: { id: "1" },
+      query: { page: "1" },
+      json: { name: "abc" },
+    });
+    expectTypeOf(await res.json()).toEqualTypeOf<{
+      id: number;
+      name: string;
+    }>();
+  });
+
+  it("works with factory and middleware", async () => {
+    const factory = createFactory<Env>();
+    const app = new Hono<Env>();
+    app.get(
+      "/",
+      factory.defineHandler({ query: z.object({ q: z.string() }) })(
+        factory.defineMiddleware(async (c, next) => {
+          c.set("user", "z");
+          await next();
+        }),
+        (c, { query }) => ({ q: query.q, u: c.get("user") }),
+      ),
+    );
+    expect(await (await app.request("/?q=1")).json()).toEqual({
+      q: "1",
+      u: "z",
+    });
+  });
+});
diff --git a/src/helper/factory/define-handler.ts b/src/helper/factory/define-handler.ts
new file mode 100644
index 0000000..473e431
--- /dev/null
+++ b/src/helper/factory/define-handler.ts
@@ -0,0 +1,481 @@
+/**
+ * @module
+ * `defineHandler()` for Hono: a handler together with its request and response validation.
+ */
+
+/* eslint-disable @typescript-eslint/no-explicit-any */
+import type { Context } from "../../context";
+import { HTTPException } from "../../http-exception";
+import type {
+  Env,
+  FormValue,
+  Handler,
+  Input,
+  IntersectNonAnyTypes,
+  MiddlewareHandler,
+  TypedResponse,
+  ValidationTargets,
+} from "../../types";
+import type { ContentfulStatusCode } from "../../utils/http-status";
+import type { JSONParsed } from "../../utils/types";
+import { validator } from "../../validator";
+import type { InferInput } from "../../validator/utils";
+
+/**
+ * Standard Schema (https://standardschema.dev) v1 interface.
+ * Implemented by zod, valibot, arktype and others.
+ *
+ * @experimental
+ */
+export interface StandardSchema<Input = unknown, Output = Input> {
+  readonly "~standard": {
+    readonly version: 1;
+    readonly vendor: string;
+    readonly validate: (
+      value: unknown,
+    ) =>
+      | { readonly value: Output; readonly issues?: undefined }
+      | { readonly issues: ReadonlyArray<ValidationIssue> }
+      | Promise<
+          | { readonly value: Output; readonly issues?: undefined }
+          | { readonly issues: ReadonlyArray<ValidationIssue> }
+        >;
+    readonly types?:
+      { readonly input: Input; readonly output: Output } | undefined;
+  };
+}
+
+/**
+ * An issue reported by a Standard Schema.
+ *
+ * @experimental
+ */
+export interface ValidationIssue {
+  readonly message: string;
+  readonly path?:
+    ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined;
+}
+
+/**
+ * The `cause` of the `HTTPException` thrown when a Standard Schema fails.
+ *
+ * @experimental
+ */
+export interface ValidationFailure {
+  issues: {
+    slot: RequestTarget | "response";
+    issues: ReadonlyArray<ValidationIssue>;
+  }[];
+}
+
+type RequestTarget = "param" | "query" | "header" | "cookie" | "form" | "json";
+
+const REQUEST_TARGETS: readonly RequestTarget[] = [
+  "param",
+  "query",
+  "header",
+  "cookie",
+  "form",
+  "json",
+];
+
+type Validation<In, E extends Env, P extends string> =
+  StandardSchema<any, any> | ((value: In, c: Context<E, P>) => any);
+
+/**
+ * Options of `defineHandler()`.
+ *
+ * @experimental
+ */
+export type DefineHandlerOptions<
+  E extends Env = any,
+  P extends string = string,
+> = {
+  [K in RequestTarget]?: Validation<ValidationTargets[K], E, P>;
+} & {
+  response?: Validation<any, E, P>;
+};
+
+type ValidationOutput<V> =
+  V extends StandardSchema<any, infer Out>
+    ? Out
+    : V extends (...args: any[]) => infer R
+      ? Exclude<Awaited<R>, Response | TypedResponse<any, any, any>>
+      : never;
+
+type ValidationInput<V, K extends RequestTarget> =
+  V extends StandardSchema<infer In, any>
+    ? In
+    : K extends "json"
+      ? ValidationOutput<V>
+      : InferInput<ValidationOutput<V>, K, FormValue>;
+
+type OptionTargets<O> = Extract<keyof O, RequestTarget>;
+
+/** The validated values given to the handler as its second argument. */
+export type DefineHandlerInput<O> = {
+  [K in OptionTargets<O>]: ValidationOutput<O[K]>;
+};
+
+type OptionsToInput<O> = [OptionTargets<O>] extends [never]
+  ? {}
+  : {
+      in: { [K in OptionTargets<O>]: ValidationInput<O[K], K> };
+      out: { [K in OptionTargets<O>]: ValidationOutput<O[K]> };
+    };
+
+type ResponseInput<O> = O extends { response: infer S }
+  ? S extends StandardSchema<infer In, any>
+    ? In
+    : any
+  : unknown;
+
+type ValueToResponse<T> = T extends Response
+  ? T
+  : T extends null | undefined | void
+    ? Response & TypedResponse<undefined, 204, "body">
+    : T extends string
+      ? Response & TypedResponse<string, ContentfulStatusCode, "text">
+      : Response & TypedResponse<JSONParsed<T>, ContentfulStatusCode, "json">;
+
+type DefinedResponse<O, R> = O extends { response: infer S }
+  ? | Extract<Awaited<R>, Response>
+    | ([Exclude<Awaited<R>, Response>] extends [never]
+        ? never
+        : Response &
+            TypedResponse<
+              JSONParsed<ValidationOutput<S>>,
+              ContentfulStatusCode,
+              "json"
+            >)
+  : ValueToResponse<Awaited<R>>;
+
+type DefinedHandlerFn<
+  E extends Env,
+  P extends string,
+  I extends Input,
+  O,
+  R,
+> = (
+  c: Context<E, P, I & OptionsToInput<O>>,
+  input: DefineHandlerInput<O>,
+) => R;
+
+type Defined<
+  E extends Env,
+  P extends string,
+  I extends Input,
+  O,
+  R,
+  X,
+> = Handler<E, P, I & OptionsToInput<O>, Promise<DefinedResponse<O, R>>> & X;
+
+type ReturnOf<O> =
+  ResponseInput<O> | Response | Promise<ResponseInput<O> | Response>;
+
+/**
+ * Call signatures shared by `defineHandler(...)` and `defineHandler(options)(...)`.
+ *
+ * @experimental
+ */
+export interface HandlerBuilder<
+  O extends DefineHandlerOptions,
+  E0 extends Env,
+  P0 extends string,
+  X,
+> {
+  <
+    E extends Env = E0,
+    P extends string = P0,
+    I extends Input = {},
+    R extends ReturnOf<O> = ReturnOf<O>,
+  >(
+    handler: DefinedHandlerFn<E, P, I, O, R>,
+  ): Defined<E, P, I, O, R, X>;
+
+  <
+    E1 extends Env = any,
+    P extends string = P0,
+    I1 extends Input = {},
+    R extends ReturnOf<O> = ReturnOf<O>,
+  >(
+    mw1: MiddlewareHandler<E1, P, I1, any>,
+    handler: DefinedHandlerFn<IntersectNonAnyTypes<[E0, E1]>, P, I1, O, R>,
+  ): Defined<IntersectNonAnyTypes<[E0, E1]>, P, I1, O, R, X>;
+
+  <
+    E1 extends Env = any,
+    E2 extends Env = any,
+    P extends string = P0,
+    I1 extends Input = {},
+    I2 extends Input = {},
+    R extends ReturnOf<O> = ReturnOf<O>,
+  >(
+    mw1: MiddlewareHandler<E1, P, I1, any>,
+    mw2: MiddlewareHandler<E2, P, I2, any>,
+    handler: DefinedHandlerFn<
+      IntersectNonAnyTypes<[E0, E1, E2]>,
+      P,
+      I1 & I2,
+      O,
+      R
+    >,
+  ): Defined<IntersectNonAnyTypes<[E0, E1, E2]>, P, I1 & I2, O, R, X>;
+
+  <
+    E1 extends Env = any,
+    E2 extends Env = any,
+    E3 extends Env = any,
+    P extends string = P0,
+    I1 extends Input = {},
+    I2 extends Input = {},
+    I3 extends Input = {},
+    R extends ReturnOf<O> = ReturnOf<O>,
+  >(
+    mw1: MiddlewareHandler<E1, P, I1, any>,
+    mw2: MiddlewareHandler<E2, P, I2, any>,
+    mw3: MiddlewareHandler<E3, P, I3, any>,
+    handler: DefinedHandlerFn<
+      IntersectNonAnyTypes<[E0, E1, E2, E3]>,
+      P,
+      I1 & I2 & I3,
+      O,
+      R
+    >,
+  ): Defined<IntersectNonAnyTypes<[E0, E1, E2, E3]>, P, I1 & I2 & I3, O, R, X>;
+
+  <
+    E1 extends Env = any,
+    E2 extends Env = any,
+    E3 extends Env = any,
+    E4 extends Env = any,
+    P extends string = P0,
+    I1 extends Input = {},
+    I2 extends Input = {},
+    I3 extends Input = {},
+    I4 extends Input = {},
+    R extends ReturnOf<O> = ReturnOf<O>,
+  >(
+    mw1: MiddlewareHandler<E1, P, I1, any>,
+    mw2: MiddlewareHandler<E2, P, I2, any>,
+    mw3: MiddlewareHandler<E3, P, I3, any>,
+    mw4: MiddlewareHandler<E4, P, I4, any>,
+    handler: DefinedHandlerFn<
+      IntersectNonAnyTypes<[E0, E1, E2, E3, E4]>,
+      P,
+      I1 & I2 & I3 & I4,
+      O,
+      R
+    >,
+  ): Defined<
+    IntersectNonAnyTypes<[E0, E1, E2, E3, E4]>,
+    P,
+    I1 & I2 & I3 & I4,
+    O,
+    R,
+    X
+  >;
+}
+
+/**
+ * The type of `defineHandler`.
+ *
+ * @experimental
+ */
+export type DefineHandler<
+  E0 extends Env = any,
+  P0 extends string = string,
+> = HandlerBuilder<{}, E0, P0, {}> & {
+  <const O extends DefineHandlerOptions<E0, P0>>(
+    options: O,
+  ): HandlerBuilder<O, E0, P0, { validations: O }>;
+};
+
+const isStandardSchema = (value: unknown): value is StandardSchema<any, any> =>
+  (typeof value === "object" || typeof value === "function") &&
+  value !== null &&
+  typeof (value as any)["~standard"]?.validate === "function";
+
+const failureResponse = (
+  status: ContentfulStatusCode,
+  body: object,
+): Response =>
+  new Response(JSON.stringify(body), {
+    status,
+    headers: { "Content-Type": "application/json" },
+  });
+
+const issuePath = (path: ValidationIssue["path"]): string | undefined =>
+  path?.length
+    ? path
+        .map((p) => String(typeof p === "object" && p !== null ? p.key : p))
+        .join(".")
+    : undefined;
+
+const toResponse = async (c: Context, value: unknown): Promise<Response> => {
+  if (value instanceof Response) {
+    return value;
+  }
+  if (value === null || value === undefined) {
+    return c.body(null, 204);
+  }
+  if (
+    typeof value === "string" ||
+    (typeof value === "object" &&
+      (value as { isEscaped?: unknown }).isEscaped === true)
+  ) {
+    return c.html(value as string);
+  }
+  return c.json(value as object);
+};
+
+const throwFailure = (
+  status: ContentfulStatusCode,
+  failures: ValidationFailure["issues"],
+  body: object,
+): never => {
+  throw new HTTPException(status, {
+    res: failureResponse(status, body),
+    message: (body as { error: string }).error,
+    cause: { issues: failures } satisfies ValidationFailure,
+  });
+};
+
+const createCore = (
+  options: DefineHandlerOptions | undefined,
+  handler: Function,
+) => {
+  const targets = options
+    ? REQUEST_TARGETS.filter((t) => options[t] !== undefined)
+    : [];
+  const responseValidation = options?.response;
+
+  return async (c: Context): Promise<Response> => {
+    const failures: ValidationFailure["issues"] = [];
+
+    for (const target of targets) {
+      const validation = options![target]!;
+      const res: unknown = await (validator as any)(
+        target,
+        async (value: unknown, ctx: Context) => {
+          if (isStandardSchema(validation)) {
+            const result = await validation["~standard"].validate(value);
+            if (result.issues) {
+              failures.push({ slot: target, issues: result.issues });
+              return value;
+            }
+            return result.value;
+          }
+          return (validation as Function)(value, ctx);
+        },
+      )(c, async () => {});
+      if (res instanceof Response) {
+        return res;
+      }
+    }
+
+    if (failures.length) {
+      throwFailure(400, failures, {
+        error: "Validation failed",
+        issues: failures.map(({ slot, issues }) => ({
+          slot,
+          issues: issues.map(({ message, path }) => {
+            const p = issuePath(path);
+            return p === undefined ? { message } : { message, path: p };
+          }),
+        })),
+      });
+    }
+
+    const input: Record<string, unknown> = {};
+    for (const target of targets) {
+      input[target] = (c.req as any).valid(target);
+    }
+
+    let value = await handler(c, input);
+    if (value instanceof Response) {
+      return value;
+    }
+
+    if (responseValidation !== undefined) {
+      if (isStandardSchema(responseValidation)) {
+        const result = await responseValidation["~standard"].validate(value);
+        if (result.issues) {
+          throwFailure(500, [{ slot: "response", issues: result.issues }], {
+            error: "Response validation failed",
+          });
+        } else {
+          value = result.value;
+        }
+      } else {
+        value = await (responseValidation as Function)(value, c);
+        if (value instanceof Response) {
+          return value;
+        }
+      }
+      return value === undefined ? c.body(null, 204) : c.json(value as object);
+    }
+
+    return toResponse(c, value);
+  };
+};
+
+const createHandler = (
+  options: DefineHandlerOptions | undefined,
+  fns: Function[],
+) => {
+  const middleware = fns.slice(0, -1) as MiddlewareHandler[];
+  const core = createCore(options, fns[fns.length - 1]);
+
+  const run = async (c: Context, i: number): Promise<Response | void> => {
+    if (i === middleware.length) {
+      return core(c);
+    }
+    let called = false;
+    return middleware[i](c, async () => {
+      if (called) {
+        throw new Error("next() called multiple times");
+      }
+      called = true;
+      const res = await run(c, i + 1);
+      if (res instanceof Response && !c.finalized) {
+        c.res = res;
+      }
+    });
+  };
+
+  const handler = (c: Context) => run(c, 0);
+  return options ? Object.assign(handler, { validations: options }) : handler;
+};
+
+/**
+ * Defines a handler together with its request and response validation.
+ *
+ * Without options the handler's return value is converted to a `Response`: an object becomes JSON,
+ * a string, JSX or `html` template becomes HTML, `null` / `undefined` becomes `204`, and a
+ * `Response` is returned as is. Middleware can be given before the handler.
+ *
+ * With options, each request target is validated in the order `param`, `query`, `header`,
+ * `cookie`, `form`, `json` before the handler runs, and `response` validates the returned value.
+ * Validations are Standard Schemas or functions `(value, c) => newValue`.
+ * A failed Standard Schema throws an `HTTPException` (`400` for the request, `500` for the response).
+ *
+ * @experimental
+ *
+ * @example
+ * ```ts
+ * app.get(
+ *   '/posts',
+ *   defineHandler({ query: z.object({ page: z.string() }), response: PostsSchema })((c, { query }) =>
+ *     getPosts(query.page)
+ *   )
+ * )
+ * ```
+ */
+export const defineHandler: DefineHandler = ((...args: unknown[]) => {
+  if (typeof args[0] === "function") {
+    return createHandler(undefined, args as Function[]);
+  }
+  const options = args[0] as DefineHandlerOptions;
+  return (...fns: Function[]) => createHandler(options, fns);
+}) as any;
diff --git a/src/helper/factory/index.ts b/src/helper/factory/index.ts
index 8f88777..5b7fa0b 100644
--- a/src/helper/factory/index.ts
+++ b/src/helper/factory/index.ts
@@ -6,6 +6,8 @@
 /* eslint-disable @typescript-eslint/no-explicit-any */
 import { Hono } from '../../hono'
 import type { HonoOptions } from '../../hono-base'
+import { defineHandler } from './define-handler'
+import type { DefineHandler } from './define-handler'
 import type {
   Env,
   H,
@@ -15,6 +17,17 @@ import type {
   MiddlewareHandler,
 } from '../../types'
 
+export { defineHandler } from './define-handler'
+export type {
+  DefineHandler,
+  DefineHandlerInput,
+  DefineHandlerOptions,
+  HandlerBuilder,
+  StandardSchema,
+  ValidationFailure,
+  ValidationIssue,
+} from './define-handler'
+
 type InitApp<E extends Env = Env> = (app: Hono<E>) => void
 
 export interface CreateHandlersInterface<E extends Env, P extends string> {
@@ -350,10 +363,25 @@ export class Factory<E extends Env = Env, P extends string = string> {
     return app
   }
 
-  createMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
+  /**
+   * @experimental
+   */
+  defineMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
     middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
   ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
 
+  /**
+   * @deprecated Use `defineMiddleware` instead.
+   */
+  createMiddleware = this.defineMiddleware
+
+  /**
+   * `defineHandler` with this factory's Env and path as defaults.
+   *
+   * @experimental
+   */
+  defineHandler: DefineHandler<E, P> = defineHandler as DefineHandler<any, string>
+
   createHandlers: CreateHandlersInterface<E, P> = (...handlers: any) => {
     // @ts-expect-error this should not be typed
     return handlers.filter((handler) => handler !== undefined)
@@ -365,7 +393,10 @@ export const createFactory = <E extends Env = Env, P extends string = string>(in
   defaultAppOptions?: HonoOptions<E>
 }): Factory<E, P> => new Factory<E, P>(init)
 
-export const createMiddleware = <
+/**
+ * @experimental
+ */
+export const defineMiddleware = <
   E extends Env = any,
   P extends string = string,
   I extends Input = {},
@@ -373,3 +404,8 @@ export const createMiddleware = <
 >(
   middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
 ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
+
+/**
+ * @deprecated Use `defineMiddleware` instead.
+ */
+export const createMiddleware = defineMiddleware
```

</details>

<details><summary>reply</summary>

Reading done; writing `define-handler.ts` now, then the factory wiring and tests.

Formatting the new files with Prettier, then rechecking.

Done. `defineHandler`, the types, `defineMiddleware` (with `createMiddleware` as a deprecated alias) and `factory.defineHandler` are in. `tsc` is clean and the 31 factory tests pass; the repo-wide suite was not run.

- **Files:** new `src/helper/factory/define-handler.ts` and its test; `index.ts` re-exports and wires the factory.
- **Dropped Response:** if an earlier target already failed a Standard Schema and a later function validation returns a `Response`, that `Response` is returned and the collected failures are dropped.
- **Errors in middleware:** an error thrown inside the chain propagates as an exception. Middleware after-code does not see a 400 response the way it would in plain Hono.
- **Unchecked:** the existing `index.test.ts` was not reformatted by Prettier. ESLint couldn't run (no `eslint.config.*` file).
- **Extra types:** I also exported `DefineHandler`, `DefineHandlerInput`, `DefineHandlerOptions` and `HandlerBuilder`.

</details>

### claude, all: pass

Files: [src/helper/factory/define-handler.test.ts](../all/claude/ts-hono-define-handler-1/files/src/helper/factory/define-handler.test.ts), [src/helper/factory/define-handler.ts](../all/claude/ts-hono-define-handler-1/files/src/helper/factory/define-handler.ts), [src/helper/factory/index.ts](../all/claude/ts-hono-define-handler-1/files/src/helper/factory/index.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/helper/factory/define-handler.test.ts b/src/helper/factory/define-handler.test.ts
new file mode 100644
index 0000000..39723db
--- /dev/null
+++ b/src/helper/factory/define-handler.test.ts
@@ -0,0 +1,189 @@
+import { expectTypeOf } from 'vitest'
+import { hc } from '../../client'
+import { Hono } from '../../index'
+import { html } from '../html'
+import { createFactory, defineHandler, defineMiddleware } from './index'
+import type { StandardSchema } from './index'
+
+const schema = <T>(check: (v: any) => T | undefined, vendor = 't'): StandardSchema<any, T> => ({
+  '~standard': {
+    version: 1,
+    vendor,
+    validate: (v) => {
+      const out = check(v)
+      return out === undefined
+        ? { issues: [{ message: `bad ${vendor}`, path: [{ key: 'a' }, 'b', 0] }] }
+        : { value: out }
+    },
+  },
+})
+const name = schema((v) => (typeof v?.name === 'string' ? (v as { name: string }) : undefined), 'q')
+
+describe('defineHandler', () => {
+  it('converts return values', async () => {
+    const app = new Hono()
+    app.get('/o', defineHandler(() => ({ a: 1 })))
+    app.get('/s', defineHandler(async () => 'hi'))
+    app.get('/h', defineHandler(() => html`<p>x</p>`))
+    app.get('/n', defineHandler(() => undefined))
+    app.get('/r', defineHandler((c) => c.text('r', 201)))
+    expect(await (await app.request('/o')).json()).toEqual({ a: 1 })
+    const s = await app.request('/s')
+    expect(s.headers.get('content-type')).toMatch(/html/)
+    expect(await s.text()).toBe('hi')
+    expect(await (await app.request('/h')).text()).toBe('<p>x</p>')
+    const n = await app.request('/n')
+    expect(n.status).toBe(204)
+    expect(await n.text()).toBe('')
+    expect((await app.request('/r')).status).toBe(201)
+  })
+
+  it('runs middleware around the handler', async () => {
+    const order: string[] = []
+    const mw = defineMiddleware<{ Variables: { v: string } }>(async (c, next) => {
+      c.set('v', 'x')
+      order.push('before')
+      await next()
+      order.push('after')
+      c.header('X-A', c.res.headers.get('X-H') ?? '')
+    })
+    const stop = defineMiddleware(async (c) => c.text('stopped'))
+    const app = new Hono()
+    app.get(
+      '/a/:id',
+      defineHandler(mw, (c) => {
+        expectTypeOf(c.get('v')).toEqualTypeOf<string>()
+        order.push('handler')
+        c.header('X-H', 'h')
+        return { v: c.get('v'), id: c.req.param('id') }
+      })
+    )
+    app.get('/s', defineHandler(stop, () => ({ no: 1 })))
+    const res = await app.request('/a/7')
+    expect(await res.json()).toEqual({ v: 'x', id: '7' })
+    expect(res.headers.get('X-A')).toBe('h')
+    expect(order).toEqual(['before', 'handler', 'after'])
+    expect(await (await app.request('/s')).text()).toBe('stopped')
+  })
+
+  it('validates request, in order, and exposes input', async () => {
+    const q = schema((v) => (v.page ? { page: Number(v.page) } : undefined), 'query')
+    const j = schema((v) => (v.name ? { name: String(v.name) } : undefined), 'json')
+    const h = defineHandler({
+      query: q,
+      json: j,
+      header: (v: Record<string, string>) => ({ h: v['x-h'] }),
+    })((c, input) => {
+      expectTypeOf(input.query).toEqualTypeOf<{ page: number }>()
+      expect(c.req.valid('json')).toEqual(input.json)
+      return { ...input.query, ...input.json, ...input.header }
+    })
+    expect(Object.keys(h.validations)).toEqual(['query', 'json', 'header'])
+    const app = new Hono()
+    app.post('/', h)
+    const ok = await app.request('/?page=2', {
+      method: 'POST',
+      headers: { 'content-type': 'application/json', 'x-h': 'z' },
+      body: JSON.stringify({ name: 'n', secret: 'S3CRET' }),
+    })
+    expect(await ok.json()).toEqual({ page: 2, name: 'n', h: 'z' })
+  })
+
+  it('throws 400 HTTPException with all failures and no input value', async () => {
+    const q = schema(() => undefined, 'query')
+    const j = schema(() => undefined, 'json')
+    const app = new Hono()
+    let cause: unknown
+    app.onError((e: any, c) => {
+      cause = e.cause
+      return e.getResponse()
+    })
+    app.post('/', defineHandler({ json: j, query: q })(() => 'x'))
+    const res = await app.request('/?s=SECRET', {
+      method: 'POST',
+      headers: { 'content-type': 'application/json' },
+      body: JSON.stringify({ s: 'SECRET' }),
+    })
+    expect(res.status).toBe(400)
+    const body = await res.json()
+    expect(body).toEqual({
+      error: 'Validation failed',
+      issues: [
+        { slot: 'query', issues: [{ message: 'bad query', path: 'a.b.0' }] },
+        { slot: 'json', issues: [{ message: 'bad json', path: 'a.b.0' }] },
+      ],
+    })
+    expect(JSON.stringify(body)).not.toContain('SECRET')
+    expect((cause as any).issues[0].issues[0].path).toEqual([{ key: 'a' }, 'b', 0])
+    const bad = await app.request('/', {
+      method: 'POST',
+      headers: { 'content-type': 'application/json' },
+      body: '{',
+    })
+    expect(bad.status).toBe(400)
+    expect(await bad.text()).toBe('Malformed JSON in request body')
+  })
+
+  it('omits path when there is none; function returning Response skips handler', async () => {
+    const s: StandardSchema = {
+      '~standard': { version: 1, vendor: 'x', validate: async () => ({ issues: [{ message: 'm' }] }) },
+    }
+    const handler = vi.fn(() => 'x')
+    const app = new Hono()
+    app.get('/a', defineHandler({ query: s })(handler))
+    app.get('/b', defineHandler({ query: (_v, c) => c.text('early', 418) })(handler))
+    expect(await (await app.request('/a')).json()).toEqual({
+      error: 'Validation failed',
+      issues: [{ slot: 'query', issues: [{ message: 'm' }] }],
+    })
+    expect((await app.request('/b')).status).toBe(418)
+    expect(handler).not.toHaveBeenCalled()
+  })
+
+  it('validates and transforms the response', async () => {
+    const res = schema((v: any) => (typeof v?.n === 'number' ? { n: String(v.n) } : undefined), 'res')
+    const app = new Hono()
+    app.onError((e: any) => {
+      expect(e.cause.issues[0].slot).toBe('response')
+      return e.getResponse()
+    })
+    const route = app.get(
+      '/ok',
+      defineHandler({ response: res })((c) => {
+        c.status(201)
+        c.header('X-T', 't')
+        return { n: 1 }
+      })
+    )
+    app.get('/raw', defineHandler({ response: res })((c) => c.text('raw')))
+    app.get('/bad', defineHandler({ response: res })(() => ({ n: 'x' }) as any))
+    const ok = await app.request('/ok')
+    expect(ok.status).toBe(201)
+    expect(ok.headers.get('X-T')).toBe('t')
+    expect(await ok.json()).toEqual({ n: '1' })
+    expect(await (await app.request('/raw')).text()).toBe('raw')
+    const bad = await app.request('/bad')
+    expect(bad.status).toBe(500)
+    expect(await bad.json()).toEqual({ error: 'Response validation failed' })
+    const client = hc<typeof route>('http://x')
+    expectTypeOf(client.ok.$get).returns.resolves.toHaveProperty('json')
+  })
+
+  it('factory defaults', async () => {
+    type E = { Variables: { u: string } }
+    const f = createFactory<E>()
+    const app = new Hono<E>()
+    app.use((c, next) => (c.set('u', 'me'), next()))
+    app.get(
+      '/',
+      f.defineHandler((c) => ({ u: c.get('u') }))
+    )
+    expect(await (await app.request('/')).json()).toEqual({ u: 'me' })
+    const h = defineHandler<E, '/me/:id'>((c) => {
+      expectTypeOf(c.get('u')).toEqualTypeOf<string>()
+      return c.req.param('id')
+    })
+    expect(h).toBeTypeOf('function')
+    expect(f.defineMiddleware).toBeTypeOf('function')
+  })
+})
diff --git a/src/helper/factory/define-handler.ts b/src/helper/factory/define-handler.ts
new file mode 100644
index 0000000..63eeeff
--- /dev/null
+++ b/src/helper/factory/define-handler.ts
@@ -0,0 +1,335 @@
+/**
+ * @module
+ * `defineHandler()` for Hono: a handler together with its request and response validation.
+ */
+
+/* eslint-disable @typescript-eslint/no-explicit-any */
+import type { Context } from '../../context'
+import { HTTPException } from '../../http-exception'
+import type {
+  Env,
+  Handler,
+  IntersectNonAnyTypes,
+  MiddlewareHandler,
+  TypedResponse,
+  ValidationTargets,
+} from '../../types'
+import type { ContentfulStatusCode } from '../../utils/http-status'
+import type { JSONParsed } from '../../utils/types'
+import { validator } from '../../validator'
+
+/**
+ * Standard Schema (https://standardschema.dev) v1 interface. Zod, Valibot, ArkType and others
+ * implement it, so no dependency is needed.
+ *
+ * @experimental
+ */
+export interface StandardSchema<Input = unknown, Output = Input> {
+  readonly '~standard': {
+    readonly version: 1
+    readonly vendor: string
+    readonly validate: (
+      value: unknown
+    ) => StandardResult<Output> | Promise<StandardResult<Output>>
+    readonly types?: { readonly input: Input; readonly output: Output } | undefined
+  }
+}
+
+type StandardResult<Output> =
+  | { readonly value: Output; readonly issues?: undefined }
+  | { readonly issues: ReadonlyArray<ValidationIssue> }
+
+/**
+ * A raw issue reported by a Standard Schema.
+ *
+ * @experimental
+ */
+export interface ValidationIssue {
+  readonly message: string
+  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined
+}
+
+/**
+ * The raw issues of one failed slot, as found in `HTTPException#cause.issues`.
+ * `slot` is a request target or `'response'`.
+ *
+ * @experimental
+ */
+export interface ValidationFailure {
+  slot: Slot | 'response'
+  issues: ReadonlyArray<ValidationIssue>
+}
+
+type Slot = 'param' | 'query' | 'header' | 'cookie' | 'form' | 'json'
+
+const slots: Slot[] = ['param', 'query', 'header', 'cookie', 'form', 'json']
+
+type Validation<In, E extends Env, P extends string> =
+  | StandardSchema<any, any>
+  | ((value: In, c: Context<E, P>) => any)
+
+type ResponseValidation<E extends Env, P extends string> =
+  | StandardSchema<any, any>
+  | ((value: any, c: Context<E, P>) => any)
+
+/**
+ * Validations given to `defineHandler()`.
+ *
+ * @experimental
+ */
+export type DefineHandlerOptions<E extends Env = any, P extends string = any> = {
+  [K in Slot]?: Validation<ValidationTargets<any, P>[K], E, P>
+} & { response?: ResponseValidation<E, P> }
+
+type OutputOf<V> = V extends StandardSchema<any, infer O>
+  ? O
+  : V extends (...args: any) => infer R
+    ? Exclude<Awaited<R>, Response | TypedResponse<any, any, any>>
+    : never
+
+type InputOf<V> = V extends StandardSchema<infer I, any> ? I : OutputOf<V>
+
+type SlotKeys<O> = keyof O & Slot
+
+type HandlerInput<O> = {
+  in: { [K in SlotKeys<O>]: InputOf<O[K]> }
+  out: { [K in SlotKeys<O>]: OutputOf<O[K]> }
+}
+
+type ValidatedInput<O> = { [K in SlotKeys<O>]: OutputOf<O[K]> }
+
+type Allowed<O> = O extends { response: infer S }
+  ? S extends StandardSchema<infer I, any>
+    ? unknown extends I
+      ? unknown
+      : I | Response | null | undefined
+    : unknown
+  : unknown
+
+type Wire<R> = R extends Response
+  ? R
+  : R extends null | undefined | void
+    ? TypedResponse<null, 204, 'body'>
+    : R extends string | { isEscaped: true }
+      ? TypedResponse<string, ContentfulStatusCode, 'html'>
+      : TypedResponse<JSONParsed<R>, ContentfulStatusCode, 'json'>
+
+type Wired<O, R> = O extends { response: infer S }
+  ? Extract<Awaited<R>, Response> | TypedResponse<JSONParsed<OutputOf<S>>, ContentfulStatusCode, 'json'>
+  : Wire<Awaited<R>>
+
+type HandlerFn<E extends Env, P extends string, O, R> = (
+  c: Context<E, P, HandlerInput<O>>,
+  input: ValidatedInput<O>
+) => R
+
+type MiddlewareList = MiddlewareHandler<any, any, any, any>[]
+
+type MiddlewareEnvs<MW extends MiddlewareList> = {
+  [K in keyof MW]: MW[K] extends MiddlewareHandler<infer E, any, any, any> ? E : never
+}
+
+type Result<E extends Env, P extends string, O, R> = Handler<
+  E,
+  P,
+  HandlerInput<O>,
+  Promise<Wired<O, R>>
+>
+
+/**
+ * Handler without validation options.
+ *
+ * @experimental
+ */
+export interface DefineHandler<E0 extends Env, P0 extends string> {
+  <E extends Env = E0, P extends string = P0, R = unknown>(
+    handler: HandlerFn<E, P, {}, R>
+  ): Result<E, P, {}, R>
+  <MW extends MiddlewareList, P extends string = P0, R = unknown>(
+    ...args: [
+      ...MW,
+      HandlerFn<IntersectNonAnyTypes<[E0, ...MiddlewareEnvs<MW>]>, P, {}, R>,
+    ]
+  ): Result<IntersectNonAnyTypes<[E0, ...MiddlewareEnvs<MW>]>, P, {}, R>
+  <O extends DefineHandlerOptions<E0, P0>>(options: O): DefineHandlerWithOptions<E0, P0, O>
+}
+
+/**
+ * The function returned by `defineHandler(options)`.
+ *
+ * @experimental
+ */
+export interface DefineHandlerWithOptions<E0 extends Env, P0 extends string, O> {
+  <E extends Env = E0, P extends string = P0, R extends Allowed<O> | Promise<Allowed<O>> = any>(
+    handler: HandlerFn<E, P, O, R>
+  ): Result<E, P, O, R> & { validations: O }
+  <
+    MW extends MiddlewareList,
+    P extends string = P0,
+    R extends Allowed<O> | Promise<Allowed<O>> = any,
+  >(
+    ...args: [
+      ...MW,
+      HandlerFn<IntersectNonAnyTypes<[E0, ...MiddlewareEnvs<MW>]>, P, O, R>,
+    ]
+  ): Result<IntersectNonAnyTypes<[E0, ...MiddlewareEnvs<MW>]>, P, O, R> & { validations: O }
+}
+
+const isStandardSchema = (v: unknown): v is StandardSchema =>
+  (typeof v === 'object' || typeof v === 'function') && v !== null && '~standard' in v
+
+const pathOf = (path: ValidationIssue['path']): string | undefined =>
+  path?.length
+    ? path.map((p) => String(typeof p === 'object' && p !== null ? p.key : p)).join('.')
+    : undefined
+
+const failure = (
+  status: 400 | 500,
+  body: Record<string, unknown>,
+  failures: ValidationFailure[]
+) =>
+  new HTTPException(status, {
+    message: String(body.error),
+    res: Response.json(body, { status }),
+    cause: { issues: failures },
+  })
+
+/**
+ * Runs one validation. A Standard Schema failure is pushed to `failures` and `undefined` returned;
+ * a function result (possibly a `Response`) is returned as is.
+ */
+const run = async (
+  slot: ValidationFailure['slot'],
+  validation: unknown,
+  value: unknown,
+  c: Context,
+  failures: ValidationFailure[]
+): Promise<unknown> => {
+  if (!isStandardSchema(validation)) {
+    return (validation as (v: unknown, c: Context) => unknown)(value, c)
+  }
+  const result = await validation['~standard'].validate(value)
+  if (result.issues) {
+    failures.push({ slot, issues: result.issues })
+    return undefined
+  }
+  return result.value
+}
+
+const toResponse = (c: Context, value: unknown): Response | Promise<Response> => {
+  if (value instanceof Response) {
+    return value
+  }
+  if (value === null || value === undefined) {
+    return c.body(null, 204)
+  }
+  if (
+    typeof value === 'string' ||
+    value instanceof String ||
+    (value as { isEscaped?: boolean }).isEscaped
+  ) {
+    return c.html(value as string)
+  }
+  return c.json(value as object)
+}
+
+const noop = async () => {}
+
+const build = (options: DefineHandlerOptions | undefined, fns: Function[]) => {
+  const handler = fns[fns.length - 1] as Function
+  const middleware = fns.slice(0, -1) as MiddlewareHandler[]
+
+  const final = async (c: Context): Promise<Response> => {
+    const input: Record<string, unknown> = {}
+    if (options) {
+      const failures: ValidationFailure[] = []
+      for (const slot of slots) {
+        const validation = options[slot]
+        if (!validation) {
+          continue
+        }
+        const res = await validator(slot, (value: unknown, c: Context) =>
+          run(slot, validation, value, c, failures).then((out) => (input[slot] = out ?? {}))
+        )(c, noop)
+        if ((res as unknown) instanceof Response) {
+          return res
+        }
+      }
+      if (failures.length) {
+        throw failure(
+          400,
+          {
+            error: 'Validation failed',
+            issues: failures.map(({ slot, issues }) => ({
+              slot,
+              issues: issues.map(({ message, path }) => {
+                const p = pathOf(path)
+                return p === undefined ? { message } : { message, path: p }
+              }),
+            })),
+          },
+          failures
+        )
+      }
+    }
+
+    const returned = await handler(c, input)
+    if (!options?.response || returned instanceof Response) {
+      return toResponse(c, returned)
+    }
+
+    const failures: ValidationFailure[] = []
+    const out = await run('response', options.response, returned, c, failures)
+    if (failures.length) {
+      throw failure(500, { error: 'Response validation failed' }, failures)
+    }
+    return out instanceof Response ? out : c.json(out as object)
+  }
+
+  const dispatch = async (c: Context, i: number): Promise<Response | void> => {
+    if (i === middleware.length) {
+      return final(c)
+    }
+    return middleware[i](c, async () => {
+      const res = await dispatch(c, i + 1)
+      if (res) {
+        c.res = res
+      }
+    })
+  }
+
+  const composed = async (c: Context): Promise<Response | void> => {
+    const res = await dispatch(c, 0)
+    return res ?? (c.finalized ? c.res : undefined)
+  }
+  return composed
+}
+
+/**
+ * Defines a handler together with its request and response validation.
+ *
+ * Order: middleware, request validation (`param`, `query`, `header`, `cookie`, `form`, `json`),
+ * handler, response validation, then the code of the middleware after `await next()`.
+ *
+ * The handler's return value is converted to a `Response`: an object becomes JSON, a string, JSX or
+ * `html` template becomes HTML, `null`/`undefined` becomes `204`, a `Response` is kept.
+ *
+ * @experimental
+ *
+ * @example
+ * ```ts
+ * app.get(
+ *   '/posts',
+ *   defineHandler({ query: z.object({ page: z.coerce.number() }) })((c, { query }) => ({
+ *     page: query.page,
+ *   }))
+ * )
+ * ```
+ */
+export const defineHandler: DefineHandler<any, any> = ((...args: unknown[]) => {
+  if (typeof args[0] === 'function') {
+    return build(undefined, args as Function[])
+  }
+  const options = args[0] as DefineHandlerOptions
+  return (...fns: Function[]) => Object.assign(build(options, fns), { validations: options })
+}) as any
diff --git a/src/helper/factory/index.ts b/src/helper/factory/index.ts
index 8f88777..cc894ea 100644
--- a/src/helper/factory/index.ts
+++ b/src/helper/factory/index.ts
@@ -6,6 +6,8 @@
 /* eslint-disable @typescript-eslint/no-explicit-any */
 import { Hono } from '../../hono'
 import type { HonoOptions } from '../../hono-base'
+import type { DefineHandler } from './define-handler'
+import { defineHandler } from './define-handler'
 import type {
   Env,
   H,
@@ -350,10 +352,25 @@ export class Factory<E extends Env = Env, P extends string = string> {
     return app
   }
 
-  createMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
+  /**
+   * @experimental
+   */
+  defineMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
     middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
   ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
 
+  /**
+   * @deprecated Use `defineMiddleware` instead.
+   */
+  createMiddleware = this.defineMiddleware
+
+  /**
+   * `defineHandler()` with this factory's Env and path as defaults.
+   *
+   * @experimental
+   */
+  defineHandler: DefineHandler<E, P> = defineHandler as unknown as DefineHandler<E, P>
+
   createHandlers: CreateHandlersInterface<E, P> = (...handlers: any) => {
     // @ts-expect-error this should not be typed
     return handlers.filter((handler) => handler !== undefined)
@@ -365,7 +382,10 @@ export const createFactory = <E extends Env = Env, P extends string = string>(in
   defaultAppOptions?: HonoOptions<E>
 }): Factory<E, P> => new Factory<E, P>(init)
 
-export const createMiddleware = <
+/**
+ * @experimental
+ */
+export const defineMiddleware = <
   E extends Env = any,
   P extends string = string,
   I extends Input = {},
@@ -373,3 +393,17 @@ export const createMiddleware = <
 >(
   middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
 ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
+
+/**
+ * @deprecated Use `defineMiddleware` instead.
+ */
+export const createMiddleware = defineMiddleware
+
+export { defineHandler }
+export type {
+  DefineHandler,
+  DefineHandlerOptions,
+  StandardSchema,
+  ValidationFailure,
+  ValidationIssue,
+} from './define-handler'
```

</details>

<details><summary>reply</summary>

Writing the new file now.

Done. `defineHandler`, `defineMiddleware` (with `createMiddleware` as a deprecated alias), `factory.defineHandler`/`factory.defineMiddleware` and the types are added; tests and `tsc` pass. ESLint wasn't run (no config), and I didn't run the full suite.

- **Response validation:** `response` accepts the same two forms as request validation (Standard Schema or function), not only a schema.
- **Raw issues:** `ValidationIssue` is the raw Standard Schema issue, and `ValidationFailure` is `{ slot, issues }` as found in `exception.cause`.
- **Response slot:** the slot name for a response failure is `'response'`.
- **Type arguments:** explicit `defineHandler<Env, Path>(…)` works only for the no-options form. With options, the Env and path come from the factory, or from `defineHandler(options)<Env, Path>(handler)`.
- **Middleware inputs:** middleware `Input` types are not merged into the handler's RPC type.

Request reading reuses `validator()`, so malformed JSON still gives `400` with `Malformed JSON in request body`.

The code is in `src/helper/factory/define-handler.ts`, re-exported from `src/helper/factory/index.ts`. Tests are in `src/helper/factory/define-handler.test.ts`.

</details>

### codex, base: pass

Files: [src/helper/factory/define-handler.test.ts](../base/codex/ts-hono-define-handler-1/files/src/helper/factory/define-handler.test.ts), [src/helper/factory/define-handler.ts](../base/codex/ts-hono-define-handler-1/files/src/helper/factory/define-handler.ts), [src/helper/factory/index.ts](../base/codex/ts-hono-define-handler-1/files/src/helper/factory/index.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/helper/factory/define-handler.test.ts b/src/helper/factory/define-handler.test.ts
new file mode 100644
index 0000000..5faaa16
--- /dev/null
+++ b/src/helper/factory/define-handler.test.ts
@@ -0,0 +1,253 @@
+import { describe, expect, expectTypeOf, it } from 'vitest'
+import { hc } from '../../client'
+import { Hono } from '../../hono'
+import { HTTPException } from '../../http-exception'
+import { jsx } from '../../jsx/jsx-runtime'
+import { html } from '../html'
+import { createFactory, defineHandler, defineMiddleware } from './index'
+import type { StandardSchema } from './index'
+
+const number: StandardSchema<string, number> = {
+  '~standard': {
+    version: 1,
+    vendor: 'test',
+    validate: (value) =>
+      typeof value === 'string'
+        ? { value: Number(value) }
+        : { issues: [{ message: 'Expected string', path: [{ key: 'secret' }, 0] }] },
+  },
+}
+
+describe('defineHandler', () => {
+  it('converts values and preserves responses', async () => {
+    const response = new Response('raw', { status: 201 })
+    const app = new Hono()
+      .get(
+        '/json',
+        defineHandler(() => ({ hello: 'world' }))
+      )
+      .get(
+        '/html',
+        defineHandler(() => '<p>Hello</p>')
+      )
+      .get(
+        '/template',
+        defineHandler(() => html`<p>Hello</p>`)
+      )
+      .get(
+        '/jsx',
+        defineHandler(() => jsx('p', { children: 'Hello' }))
+      )
+      .get(
+        '/undefined',
+        defineHandler(async () => undefined)
+      )
+      .get(
+        '/empty',
+        defineHandler(() => null)
+      )
+      .get(
+        '/raw',
+        defineHandler(() => response)
+      )
+    expect(await (await app.request('/json')).json()).toEqual({ hello: 'world' })
+    expect((await app.request('/html')).headers.get('content-type')).toContain('text/html')
+    expect(await (await app.request('/template')).text()).toBe('<p>Hello</p>')
+    expect((await app.request('/empty')).status).toBe(204)
+    expect((await app.request('/undefined')).status).toBe(204)
+    expect(await (await app.request('/jsx')).text()).toBe('<p>Hello</p>')
+    expect(await app.request('/raw')).toBe(response)
+    const client = hc<typeof app>('http://localhost', { fetch: app.request })
+    expectTypeOf(await (await client.json.$get()).json()).toEqualTypeOf<{ hello: string }>()
+  })
+
+  it('runs middleware around validation and the handler', async () => {
+    const order: string[] = []
+    const mw = defineMiddleware<{ Variables: { name: string } }>(async (c, next) => {
+      order.push('before')
+      c.set('name', 'Ada')
+      await next()
+      order.push('after')
+      c.header('after', 'yes')
+    })
+    const options = {
+      query: (value: Record<string, string | string[]>) => {
+        order.push('request')
+        return { name: String(value.name) }
+      },
+      response: (value: { name: string }) => {
+        order.push('response')
+        return { greeting: value.name }
+      },
+    }
+    const handler = defineHandler(options)(mw, (c, input) => {
+      order.push('handler')
+      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
+      expectTypeOf(input.query).toEqualTypeOf<{ name: string }>()
+      expect(c.req.valid('query')).toEqual(input.query)
+      c.status(201)
+      c.header('test', 'yes')
+      return { name: c.get('name') }
+    })
+    expect(handler.validations).toBe(options)
+    const res = await new Hono().get('/', handler).request('/?name=Ada')
+    expect(order).toEqual(['before', 'request', 'handler', 'response', 'after'])
+    expect(res.status).toBe(201)
+    expect(res.headers.get('test')).toBe('yes')
+    expect(res.headers.get('after')).toBe('yes')
+    expect(await res.json()).toEqual({ greeting: 'Ada' })
+  })
+
+  it('aggregates schema failures and preserves raw causes', async () => {
+    const app = new Hono()
+    app.onError((err) => {
+      expect(err).toBeInstanceOf(HTTPException)
+      expect(err.cause).toEqual({
+        issues: [
+          { slot: 'query', issues: [{ message: 'Expected string', path: [{ key: 'secret' }, 0] }] },
+          { slot: 'json', issues: [{ message: 'Expected string', path: [{ key: 'secret' }, 0] }] },
+        ],
+      })
+      return (err as HTTPException).getResponse()
+    })
+    app.post(
+      '/',
+      defineHandler({ json: number, query: number })(() => {
+        throw Error('unreachable')
+      })
+    )
+    const res = await app.request('/', {
+      method: 'POST',
+      headers: { 'content-type': 'application/json' },
+      body: '{"password":"private"}',
+    })
+    expect(res.status).toBe(400)
+    expect(await res.json()).toEqual({
+      error: 'Validation failed',
+      issues: [
+        { slot: 'query', issues: [{ message: 'Expected string', path: 'secret.0' }] },
+        { slot: 'json', issues: [{ message: 'Expected string', path: 'secret.0' }] },
+      ],
+    })
+  })
+
+  it('transforms schema responses and rejects invalid output', async () => {
+    const app = new Hono().get(
+      '/',
+      defineHandler({ response: number })(() => '42')
+    )
+    expect(await (await app.request('/')).json()).toBe(42)
+    const client = hc<typeof app>('http://localhost', { fetch: app.request })
+    expectTypeOf(await (await client.index.$get()).json()).toEqualTypeOf<number>()
+    // @ts-expect-error Response schema requires a string
+    defineHandler({ response: number })(() => 42)
+    const bad: StandardSchema<unknown> = {
+      '~standard': {
+        version: 1,
+        vendor: 'test',
+        validate: () => ({ issues: [{ message: 'private' }] }),
+      },
+    }
+    const res = await new Hono()
+      .get(
+        '/',
+        defineHandler({ response: bad })(() => ({}))
+      )
+      .request('/')
+    expect(res.status).toBe(500)
+    expect(await res.json()).toEqual({ error: 'Response validation failed' })
+  })
+
+  it('validates all request targets in order and accepts callable async schemas', async () => {
+    const order: string[] = []
+    const rule = (slot: string) => (value: unknown) => {
+      order.push(slot)
+      return value
+    }
+    const callable = Object.assign(() => {}, {
+      '~standard': {
+        version: 1 as const,
+        vendor: 'test',
+        validate: async (value: unknown) => {
+          order.push('query')
+          return { value: value as { n: string } }
+        },
+      },
+    })
+    const app = new Hono().post(
+      '/:id',
+      defineHandler({
+        json: rule('json'),
+        form: rule('form'),
+        cookie: rule('cookie'),
+        header: rule('header'),
+        query: callable,
+        param: rule('param'),
+      })((_c, input) => {
+        expectTypeOf(input.query).toEqualTypeOf<{ n: string }>()
+        expect(input.form).toEqual({ a: ['one', 'two'] })
+        expect(input.cookie).toEqual({ session: 'test' })
+        return { n: input.query.n }
+      })
+    )
+    const res = await app.request('/123?n=1', {
+      method: 'POST',
+      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: 'session=test' },
+      body: 'a=one&a=two',
+    })
+    expect(res.status).toBe(200)
+    expect(order).toEqual(['param', 'query', 'header', 'cookie', 'form', 'json'])
+  })
+
+  it('supports factory and explicit context defaults', () => {
+    type E = { Variables: { name: string } }
+    const factory = createFactory<E, '/me/:id'>()
+    factory.defineHandler((c) => {
+      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
+      expectTypeOf(c.req.param('id')).toEqualTypeOf<string>()
+      return { name: c.get('name') }
+    })
+    defineHandler<E, '/me/:id'>((c) => ({ name: c.get('name'), id: c.req.param('id') }))
+    expect(factory.createMiddleware).toBe(factory.defineMiddleware)
+    const mw = defineMiddleware<E>(async (c, next) => {
+      c.set('name', 'Ada')
+      await next()
+    })
+    defineHandler(mw, (c) => {
+      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
+      return { name: c.get('name') }
+    })
+  })
+
+  it('short circuits and preserves malformed JSON errors', async () => {
+    const app = new Hono()
+      .get(
+        '/mw',
+        defineHandler(
+          defineMiddleware(async (c) => c.text('stop', 401)),
+          () => {
+            throw Error('unreachable')
+          }
+        )
+      )
+      .post(
+        '/json',
+        defineHandler({ json: (value) => value })(() => ({}))
+      )
+      .get(
+        '/rule',
+        defineHandler({ query: (_, c) => c.text('stop', 403) })(() => {
+          throw Error('unreachable')
+        })
+      )
+    expect((await app.request('/mw')).status).toBe(401)
+    expect((await app.request('/rule')).status).toBe(403)
+    const res = await app.request('/json', {
+      method: 'POST',
+      headers: { 'content-type': 'application/json' },
+      body: '{',
+    })
+    expect(res.status).toBe(400)
+    expect(await res.text()).toBe('Malformed JSON in request body')
+  })
+})
diff --git a/src/helper/factory/define-handler.ts b/src/helper/factory/define-handler.ts
new file mode 100644
index 0000000..2e536bc
--- /dev/null
+++ b/src/helper/factory/define-handler.ts
@@ -0,0 +1,313 @@
+/** @module Factory handler helpers. */
+/* eslint-disable @typescript-eslint/no-explicit-any */
+import type { Context } from '../../context'
+import { HTTPException } from '../../http-exception'
+import type { Env, Handler, MiddlewareHandler, TypedResponse, ValidationTargets } from '../../types'
+import type { HtmlEscaped } from '../../utils/html'
+import type { JSONParsed } from '../../utils/types'
+import { validator } from '../../validator'
+
+/** A dependency-free Standard Schema v1 contract. @experimental */
+export interface StandardSchema<Input = unknown, Output = Input> {
+  readonly '~standard': {
+    readonly version: 1
+    readonly vendor: string
+    readonly validate: (
+      value: unknown
+    ) =>
+      | { readonly value: Output; readonly issues?: undefined }
+      | { readonly issues: readonly ValidationIssue[] }
+      | Promise<
+          | { readonly value: Output; readonly issues?: undefined }
+          | { readonly issues: readonly ValidationIssue[] }
+        >
+    readonly types?: { readonly input: Input; readonly output: Output }
+  }
+}
+
+/** @experimental */
+export interface ValidationIssue {
+  readonly message: string
+  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
+}
+
+/** Raw validation issues, available as HTTPException.cause. @experimental */
+export interface ValidationFailure {
+  issues: { slot: keyof ValidationTargets | 'response'; issues: readonly ValidationIssue[] }[]
+}
+
+type Rule<E extends Env = any, P extends string = string> =
+  | StandardSchema<any, any>
+  | ((value: any, c: Context<E, P>) => any)
+type Options<E extends Env = any, P extends string = string> = Partial<
+  Record<keyof ValidationTargets | 'response', Rule<E, P>>
+>
+type Output<T> =
+  T extends StandardSchema<any, infer O>
+    ? O
+    : T extends (...args: any[]) => infer R
+      ? Exclude<Awaited<R>, Response>
+      : never
+type SchemaInput<T> =
+  T extends StandardSchema<infer I, any>
+    ? I
+    : T extends (...args: any[]) => any
+      ? Parameters<T>[0]
+      : unknown
+type Inputs<S> = { [K in keyof S as K extends keyof ValidationTargets ? K : never]: Output<S[K]> }
+type RequestInput<S> = {
+  in: { [K in keyof S as K extends keyof ValidationTargets ? K : never]: SchemaInput<S[K]> }
+  out: Inputs<S>
+}
+type ConvertedResult<R> = R extends TypedResponse
+  ? R
+  : R extends Response
+    ? Response
+    : R extends null | undefined | void
+      ? TypedResponse<null, 204, 'body'>
+      : R extends string | HtmlEscaped
+        ? TypedResponse<string, 200, 'html'>
+        : TypedResponse<JSONParsed<R>, 200, 'json'>
+type Result<R> = ConvertedResult<Awaited<R>>
+type CheckedReturn<S> = S extends { response: infer V }
+  ? SchemaInput<V> | Response | Promise<SchemaInput<V> | Response>
+  : any
+type CheckedResult<S, R> = S extends { response: infer V }
+  ? TypedResponse<JSONParsed<Output<V>>, 200, 'json'>
+  : Result<R>
+
+type Builder<E extends Env, P extends string, S extends Options> = {
+  <R extends CheckedReturn<S> = CheckedReturn<S>>(
+    handler: (c: Context<E, P, RequestInput<S>>, input: Inputs<S>) => R
+  ): Handler<E, P, RequestInput<S>, CheckedResult<S, R>> & { validations: S }
+  <E1 extends Env = E, R extends CheckedReturn<S> = CheckedReturn<S>>(
+    mw1: MiddlewareHandler<E1, P>,
+    handler: (c: Context<E & E1, P, RequestInput<S>>, input: Inputs<S>) => R
+  ): Handler<E & E1, P, RequestInput<S>, CheckedResult<S, R>> & { validations: S }
+  <E1 extends Env = E, E2 extends Env = E, R extends CheckedReturn<S> = CheckedReturn<S>>(
+    mw1: MiddlewareHandler<E1, P>,
+    mw2: MiddlewareHandler<E2, P>,
+    handler: (c: Context<E & E1 & E2, P, RequestInput<S>>, input: Inputs<S>) => R
+  ): Handler<E & E1 & E2, P, RequestInput<S>, CheckedResult<S, R>> & { validations: S }
+  <
+    E1 extends Env = E,
+    E2 extends Env = E,
+    E3 extends Env = E,
+    R extends CheckedReturn<S> = CheckedReturn<S>,
+  >(
+    mw1: MiddlewareHandler<E1, P>,
+    mw2: MiddlewareHandler<E2, P>,
+    mw3: MiddlewareHandler<E3, P>,
+    handler: (c: Context<E & E1 & E2 & E3, P, RequestInput<S>>, input: Inputs<S>) => R
+  ): Handler<E & E1 & E2 & E3, P, RequestInput<S>, CheckedResult<S, R>> & { validations: S }
+  <
+    E1 extends Env = E,
+    E2 extends Env = E,
+    E3 extends Env = E,
+    E4 extends Env = E,
+    R extends CheckedReturn<S> = CheckedReturn<S>,
+  >(
+    mw1: MiddlewareHandler<E1, P>,
+    mw2: MiddlewareHandler<E2, P>,
+    mw3: MiddlewareHandler<E3, P>,
+    mw4: MiddlewareHandler<E4, P>,
+    handler: (c: Context<E & E1 & E2 & E3 & E4, P, RequestInput<S>>, input: Inputs<S>) => R
+  ): Handler<E & E1 & E2 & E3 & E4, P, RequestInput<S>, CheckedResult<S, R>> & { validations: S }
+  <
+    E1 extends Env = E,
+    E2 extends Env = E,
+    E3 extends Env = E,
+    E4 extends Env = E,
+    E5 extends Env = E,
+    R extends CheckedReturn<S> = CheckedReturn<S>,
+  >(
+    mw1: MiddlewareHandler<E1, P>,
+    mw2: MiddlewareHandler<E2, P>,
+    mw3: MiddlewareHandler<E3, P>,
+    mw4: MiddlewareHandler<E4, P>,
+    mw5: MiddlewareHandler<E5, P>,
+    handler: (c: Context<E & E1 & E2 & E3 & E4 & E5, P, RequestInput<S>>, input: Inputs<S>) => R
+  ): Handler<E & E1 & E2 & E3 & E4 & E5, P, RequestInput<S>, CheckedResult<S, R>> & {
+    validations: S
+  }
+}
+
+/** Define a handler and its validation together. @experimental */
+export interface DefineHandler<E extends Env = Env, P extends string = string> {
+  <E2 extends Env = E, P2 extends string = P, S extends Options<E2, P2> = Options<E2, P2>>(
+    options: S
+  ): Builder<E2, P2, S>
+  <E2 extends Env = E, P2 extends string = P, R = any>(
+    handler: (c: Context<E2, P2>) => R
+  ): Handler<E2, P2, {}, Result<R>>
+  <E2 extends Env = E, P2 extends string = P, M1 extends Env = E2, R = any>(
+    mw1: MiddlewareHandler<M1, P2>,
+    handler: (c: Context<E2 & M1, P2>) => R
+  ): Handler<E2 & M1, P2, {}, Result<R>>
+  <E2 extends Env = E, P2 extends string = P, M1 extends Env = E2, M2 extends Env = E2, R = any>(
+    mw1: MiddlewareHandler<M1, P2>,
+    mw2: MiddlewareHandler<M2, P2>,
+    handler: (c: Context<E2 & M1 & M2, P2>) => R
+  ): Handler<E2 & M1 & M2, P2, {}, Result<R>>
+  <
+    E2 extends Env = E,
+    P2 extends string = P,
+    M1 extends Env = E2,
+    M2 extends Env = E2,
+    M3 extends Env = E2,
+    R = any,
+  >(
+    mw1: MiddlewareHandler<M1, P2>,
+    mw2: MiddlewareHandler<M2, P2>,
+    mw3: MiddlewareHandler<M3, P2>,
+    handler: (c: Context<E2 & M1 & M2 & M3, P2>) => R
+  ): Handler<E2 & M1 & M2 & M3, P2, {}, Result<R>>
+  <
+    E2 extends Env = E,
+    P2 extends string = P,
+    M1 extends Env = E2,
+    M2 extends Env = E2,
+    M3 extends Env = E2,
+    M4 extends Env = E2,
+    R = any,
+  >(
+    mw1: MiddlewareHandler<M1, P2>,
+    mw2: MiddlewareHandler<M2, P2>,
+    mw3: MiddlewareHandler<M3, P2>,
+    mw4: MiddlewareHandler<M4, P2>,
+    handler: (c: Context<E2 & M1 & M2 & M3 & M4, P2>) => R
+  ): Handler<E2 & M1 & M2 & M3 & M4, P2, {}, Result<R>>
+  <
+    E2 extends Env = E,
+    P2 extends string = P,
+    M1 extends Env = E2,
+    M2 extends Env = E2,
+    M3 extends Env = E2,
+    M4 extends Env = E2,
+    M5 extends Env = E2,
+    R = any,
+  >(
+    mw1: MiddlewareHandler<M1, P2>,
+    mw2: MiddlewareHandler<M2, P2>,
+    mw3: MiddlewareHandler<M3, P2>,
+    mw4: MiddlewareHandler<M4, P2>,
+    mw5: MiddlewareHandler<M5, P2>,
+    handler: (c: Context<E2 & M1 & M2 & M3 & M4 & M5, P2>) => R
+  ): Handler<E2 & M1 & M2 & M3 & M4 & M5, P2, {}, Result<R>>
+}
+
+const slots = ['param', 'query', 'header', 'cookie', 'form', 'json'] as const
+const isSchema = (rule: Rule): rule is StandardSchema<any, any> => '~standard' in rule
+
+const build = (options: Options, functions: Function[]) => {
+  const handler = functions[functions.length - 1]
+  const middleware = functions.slice(0, -1)
+  return Object.assign(
+    async (c: Context) => {
+      let index = -1
+      const dispatch = async (i: number): Promise<void> => {
+        if (i <= index) {
+          throw new Error('next() called multiple times')
+        }
+        index = i
+        if (i < middleware.length) {
+          const response = await middleware[i](c, () => dispatch(i + 1))
+          if (response instanceof Response) {
+            c.res = response
+          }
+          return
+        }
+        const input: Record<string, unknown> = {}
+        const failures: ValidationFailure = { issues: [] }
+        for (const slot of slots) {
+          const rule = options[slot]
+          if (!rule) {
+            continue
+          }
+          const response = await validator(slot, async (value, context) => {
+            if (isSchema(rule)) {
+              const result = await rule['~standard'].validate(value)
+              if (result.issues) {
+                failures.issues.push({ slot, issues: result.issues })
+                return undefined
+              }
+              input[slot] = result.value
+              return result.value
+            }
+            const result = await rule(value, context)
+            input[slot] = result
+            return result
+          })(c, async () => {})
+          if (response instanceof Response) {
+            c.res = response
+            return
+          }
+        }
+        if (failures.issues.length) {
+          throw new HTTPException(400, {
+            cause: failures,
+            res: Response.json(
+              {
+                error: 'Validation failed',
+                issues: failures.issues.map(({ slot, issues }) => ({
+                  slot,
+                  issues: issues.map(({ message, path }) => ({
+                    message,
+                    ...(path?.length
+                      ? {
+                          path: path
+                            .map((part) =>
+                              typeof part === 'object' ? String(part.key) : String(part)
+                            )
+                            .join('.'),
+                        }
+                      : {}),
+                  })),
+                })),
+              },
+              { status: 400 }
+            ),
+          })
+        }
+        let value = await handler(c, input)
+        if (value instanceof Response) {
+          c.res = value
+          return
+        }
+        if (options.response) {
+          const rule = options.response
+          if (isSchema(rule)) {
+            const result = await rule['~standard'].validate(value)
+            if (result.issues) {
+              throw new HTTPException(500, {
+                cause: {
+                  issues: [{ slot: 'response', issues: result.issues }],
+                } satisfies ValidationFailure,
+                res: Response.json({ error: 'Response validation failed' }, { status: 500 }),
+              })
+            }
+            value = result.value
+          } else {
+            value = await rule(value, c)
+          }
+          c.res = value instanceof Response ? value : c.json(value)
+        } else if (value == null) {
+          c.res = c.body(null, 204)
+        } else if (typeof value === 'string' || (typeof value === 'object' && value.isEscaped)) {
+          c.res = await c.html(value)
+        } else {
+          c.res = c.json(value)
+        }
+      }
+      await dispatch(0)
+      return c.res
+    },
+    { validations: options }
+  )
+}
+
+/** @experimental */
+export const defineHandler: DefineHandler = ((...args: any[]) =>
+  typeof args[0] === 'function'
+    ? build({}, args)
+    : (...handlers: Function[]) => build(args[0], handlers)) as DefineHandler
diff --git a/src/helper/factory/index.ts b/src/helper/factory/index.ts
index 8f88777..8447adf 100644
--- a/src/helper/factory/index.ts
+++ b/src/helper/factory/index.ts
@@ -4,6 +4,11 @@
  */
 
 /* eslint-disable @typescript-eslint/no-explicit-any */
+import { defineHandler } from './define-handler'
+import type { DefineHandler } from './define-handler'
+export { defineHandler } from './define-handler'
+export type { StandardSchema, ValidationIssue, ValidationFailure } from './define-handler'
+
 import { Hono } from '../../hono'
 import type { HonoOptions } from '../../hono-base'
 import type {
@@ -350,10 +355,17 @@ export class Factory<E extends Env = Env, P extends string = string> {
     return app
   }
 
-  createMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
+  /** @experimental */
+  defineHandler: DefineHandler<E, P> = defineHandler
+
+  /** @experimental */
+  defineMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
     middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
   ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
 
+  /** @deprecated Use defineMiddleware instead. */
+  createMiddleware = this.defineMiddleware
+
   createHandlers: CreateHandlersInterface<E, P> = (...handlers: any) => {
     // @ts-expect-error this should not be typed
     return handlers.filter((handler) => handler !== undefined)
@@ -365,7 +377,8 @@ export const createFactory = <E extends Env = Env, P extends string = string>(in
   defaultAppOptions?: HonoOptions<E>
 }): Factory<E, P> => new Factory<E, P>(init)
 
-export const createMiddleware = <
+/** @experimental */
+export const defineMiddleware = <
   E extends Env = any,
   P extends string = string,
   I extends Input = {},
@@ -373,3 +386,6 @@ export const createMiddleware = <
 >(
   middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
 ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
+
+/** @deprecated Use defineMiddleware instead. */
+export const createMiddleware = defineMiddleware
```

</details>

<details><summary>reply</summary>

I’ll check the factory, validator, and handler types, then add the helper and tests without changing Hono’s core.

The helper now reuses `validator()` to read requests and composes middleware locally, with no core changes. I’m checking type inference and adding tests for validation failures, response conversion, and middleware order.

The type check and initial tests pass. Coverage includes RPC output types, middleware Env inference, schema input constraints, aggregated failures, and status/header preservation. I’m finishing the ordered request-target tests and running the existing factory and validator suites.

Implemented `defineHandler()` with request and response validation, middleware composition, response conversion, typed inputs, RPC inference, and `handler.validations`.

Added the requested exports and factory methods, marked the new APIs experimental, and retained `createMiddleware` as a deprecated alias. Hono’s core is unchanged.

Validation passed: TypeScript, lint, and all 94 factory/validator tests.

</details>

### codex, muffle: pass

Files: [src/helper/factory/define-handler.test.ts](../muffle/codex/ts-hono-define-handler-1/files/src/helper/factory/define-handler.test.ts), [src/helper/factory/define-handler.ts](../muffle/codex/ts-hono-define-handler-1/files/src/helper/factory/define-handler.ts), [src/helper/factory/index.ts](../muffle/codex/ts-hono-define-handler-1/files/src/helper/factory/index.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/helper/factory/define-handler.test.ts b/src/helper/factory/define-handler.test.ts
new file mode 100644
index 0000000..cb8a89e
--- /dev/null
+++ b/src/helper/factory/define-handler.test.ts
@@ -0,0 +1,252 @@
+import { describe, expect, expectTypeOf, it } from 'vitest'
+import { createFactory, defineHandler, defineMiddleware } from '.'
+import type { StandardSchema } from '.'
+import { hc } from '../../client'
+import { Hono } from '../../hono'
+import { HTTPException } from '../../http-exception'
+import { html } from '../html'
+
+const schema: StandardSchema<{ name: string }, { length: number }> = {
+  '~standard': {
+    version: 1,
+    vendor: 'test',
+    validate: (value) => ({ value: { length: (value as { name: string }).name.length } }),
+  },
+}
+
+describe('defineHandler', () => {
+  it('converts values and preserves responses', async () => {
+    const response = new Response('raw', { status: 201 })
+    const app = new Hono()
+      .get(
+        '/json',
+        defineHandler(() => ({ hello: 'world' }))
+      )
+      .get(
+        '/html',
+        defineHandler(() => html`<b>hello</b>`)
+      )
+      .get(
+        '/string',
+        defineHandler(() => '<b>hello</b>')
+      )
+      .get(
+        '/empty',
+        defineHandler(() => undefined)
+      )
+      .get(
+        '/response',
+        defineHandler(() => response)
+      )
+    expect(await (await app.request('/json')).json()).toEqual({ hello: 'world' })
+    expect(await (await app.request('/html')).text()).toBe('<b>hello</b>')
+    expect((await app.request('/string')).headers.get('content-type')).toContain('text/html')
+    expect((await app.request('/empty')).status).toBe(204)
+    expect(await app.request('/response')).toBe(response)
+    const client = hc<typeof app>('http://localhost', { fetch: app.request })
+    expectTypeOf(await (await client.json.$get()).json()).toEqualTypeOf<{ hello: string }>()
+  })
+
+  it('validates between middleware before and after, preserving context status and headers', async () => {
+    const order: string[] = []
+    const middleware = defineMiddleware<{ Variables: { user: string } }>(async (c, next) => {
+      order.push('before')
+      c.set('user', 'Ada')
+      await next()
+      order.push('after')
+    })
+    const handler = defineHandler({
+      query: (value) => {
+        order.push('query')
+        return { name: String(value.name) }
+      },
+      response: schema,
+    })(middleware, (c, input) => {
+      expectTypeOf(c.get('user')).toEqualTypeOf<string>()
+      expectTypeOf(input.query).toEqualTypeOf<{ name: string }>()
+      expectTypeOf(c.req.valid('query')).toEqualTypeOf<{ name: string }>()
+      order.push('handler')
+      c.status(201)
+      c.header('x-test', c.get('user'))
+      return input.query
+    })
+    const app = new Hono().get('/', handler)
+    const res = await app.request('/?name=Ada')
+    expect(res.status).toBe(201)
+    expect(res.headers.get('x-test')).toBe('Ada')
+    expect(await res.json()).toEqual({ length: 3 })
+    expect(order).toEqual(['before', 'query', 'handler', 'after'])
+    expect(handler.validations.response).toBe(schema)
+    const client = hc<typeof app>('http://localhost', { fetch: app.request })
+    expectTypeOf(await (await client.index.$get({ query: { name: 'Ada' } })).json()).toEqualTypeOf<{
+      length: number
+    }>()
+  })
+
+  it('aggregates schema issues without leaking values and retains raw causes', async () => {
+    const issues = [{ message: 'Invalid', path: [{ key: 'name' }, 0], input: 'secret' }]
+    const bad: StandardSchema = {
+      '~standard': { version: 1, vendor: 'test', validate: async () => ({ issues }) },
+    }
+    let caught: unknown
+    const app = new Hono()
+      .onError((error) => {
+        caught = error
+        return (error as HTTPException).getResponse()
+      })
+      .get(
+        '/',
+        defineHandler({ query: bad, header: bad })(() => {
+          throw new Error('unreachable')
+        })
+      )
+    const res = await app.request('/?name=secret')
+    expect(res.status).toBe(400)
+    expect(await res.json()).toEqual({
+      error: 'Validation failed',
+      issues: ['query', 'header'].map((slot) => ({
+        slot,
+        issues: [{ message: 'Invalid', path: 'name.0' }],
+      })),
+    })
+    expect(caught).toBeInstanceOf(HTTPException)
+    expect((caught as Error).cause).toEqual({
+      issues: [
+        { slot: 'query', issues },
+        { slot: 'header', issues },
+      ],
+    })
+  })
+
+  it('handles malformed JSON and early responses', async () => {
+    const app = new Hono()
+      .post(
+        '/',
+        defineHandler({ json: (v) => v })(() => ({ ok: true }))
+      )
+      .get(
+        '/early',
+        defineHandler({ query: () => new Response('stop', { status: 403 }) })(() => {
+          throw new Error('unreachable')
+        })
+      )
+      .get(
+        '/middleware',
+        defineHandler(
+          defineMiddleware(async () => new Response('stop')),
+          () => {
+            throw new Error('unreachable')
+          }
+        )
+      )
+    const res = await app.request('/', {
+      method: 'POST',
+      headers: { 'content-type': 'application/json' },
+      body: '{',
+    })
+    expect(res.status).toBe(400)
+    expect(await res.text()).toBe('Malformed JSON in request body')
+    expect((await app.request('/early')).status).toBe(403)
+    expect(await (await app.request('/middleware')).text()).toBe('stop')
+  })
+
+  it('hides response issues', async () => {
+    const bad: StandardSchema<string> = {
+      '~standard': {
+        version: 1,
+        vendor: 'test',
+        validate: () => ({ issues: [{ message: 'secret' }] }),
+      },
+    }
+    const app = new Hono().get(
+      '/',
+      defineHandler({ response: bad })(() => 'hello')
+    )
+    const res = await app.request('/')
+    expect(res.status).toBe(500)
+    expect(await res.json()).toEqual({ error: 'Response validation failed' })
+    // @ts-expect-error response must match the schema input
+    defineHandler({ response: schema })(() => ({ length: 3 }))
+  })
+
+  it('supports callable schemas and validates all request slots in order', async () => {
+    const order: string[] = []
+    const callable = Object.assign(() => {}, {
+      '~standard': {
+        version: 1 as const,
+        vendor: 'test',
+        validate: async (value: unknown) => {
+          order.push('param')
+          return { value: value as { id: string } }
+        },
+      },
+    })
+    const app = new Hono().post(
+      '/:id',
+      defineHandler({
+        param: callable,
+        query: (v) => {
+          order.push('query')
+          return v
+        },
+        header: (v) => {
+          order.push('header')
+          return v
+        },
+        cookie: (v) => {
+          order.push('cookie')
+          return v
+        },
+        form: (v) => {
+          order.push('form')
+          return v
+        },
+        json: (v) => {
+          order.push('json')
+          return v
+        },
+        response: async (v: { id: string }) => {
+          order.push('response')
+          return { id: Number(v.id) }
+        },
+      })((c, input) => {
+        order.push('handler')
+        expect(c.req.valid('param')).toEqual({ id: '42' })
+        expect(input.query).toEqual({ name: ['a', 'b'] })
+        expect(input.cookie).toEqual({ token: 'abc' })
+        expect(input.form).toEqual({ tags: ['a', 'b'] })
+        expect(input.json).toEqual({})
+        return input.param
+      })
+    )
+    const res = await app.request('/42?name=a&name=b', {
+      method: 'POST',
+      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: 'token=abc' },
+      body: 'tags=a&tags=b',
+    })
+    expect(await res.json()).toEqual({ id: 42 })
+    expect(order).toEqual([
+      'param',
+      'query',
+      'header',
+      'cookie',
+      'form',
+      'json',
+      'handler',
+      'response',
+    ])
+  })
+
+  it('uses explicit and factory context defaults', () => {
+    type E = { Variables: { user: string } }
+    defineHandler<E, '/me/:id'>((c) => {
+      expectTypeOf(c.get('user')).toEqualTypeOf<string>()
+      expectTypeOf(c.req.param('id')).toEqualTypeOf<string>()
+      return {}
+    })
+    createFactory<E, '/me/:id'>().defineHandler((c) => {
+      expectTypeOf(c.get('user')).toEqualTypeOf<string>()
+      return c.req.param('id')
+    })
+  })
+})
diff --git a/src/helper/factory/define-handler.ts b/src/helper/factory/define-handler.ts
new file mode 100644
index 0000000..ed88c93
--- /dev/null
+++ b/src/helper/factory/define-handler.ts
@@ -0,0 +1,457 @@
+/** @module Handler definitions with request and response validation. */
+/* eslint-disable @typescript-eslint/no-explicit-any */
+import type { Context } from '../../context'
+import { HTTPException } from '../../http-exception'
+import type { Env, Handler, MiddlewareHandler, TypedResponse, ValidationTargets } from '../../types'
+import type { HtmlEscaped } from '../../utils/html'
+import type { JSONParsed } from '../../utils/types'
+import { validator } from '../../validator'
+import type { InferInput } from '../../validator/utils'
+
+/** @experimental */
+export interface ValidationIssue {
+  readonly message: string
+  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
+}
+
+/** @experimental */
+export interface StandardSchema<Input = unknown, Output = Input> {
+  readonly '~standard': {
+    readonly version: 1
+    readonly vendor: string
+    readonly validate: (
+      value: unknown
+    ) =>
+      | { readonly value: Output; readonly issues?: undefined }
+      | { readonly issues: readonly ValidationIssue[] }
+      | Promise<
+          | { readonly value: Output; readonly issues?: undefined }
+          | { readonly issues: readonly ValidationIssue[] }
+        >
+    readonly types?: { readonly input: Input; readonly output: Output }
+  }
+}
+
+/** @experimental */
+export interface ValidationFailure {
+  issues: { slot: keyof ValidationTargets | 'response'; issues: readonly ValidationIssue[] }[]
+}
+
+type Rule = StandardSchema<any, any> | ((value: any, c: Context<any>) => any)
+type Options<E extends Env = any, P extends string = string> = {
+  [K in keyof ValidationTargets]?:
+    | StandardSchema<any, any>
+    | ((value: ValidationTargets[K], c: Context<E, P>) => any)
+} & { response?: Rule }
+type Output<S> =
+  S extends StandardSchema<any, infer O>
+    ? O
+    : S extends (...args: any[]) => infer R
+      ? Exclude<Awaited<R>, Response>
+      : never
+type SchemaInput<S> =
+  S extends StandardSchema<infer I, any>
+    ? I
+    : S extends (value: infer I, ...args: any[]) => any
+      ? I
+      : never
+type Validated<O> = { [K in Exclude<keyof O, 'response'>]: Output<O[K]> }
+type RequestInput<O> = {
+  in: {
+    [K in Extract<keyof O, keyof ValidationTargets>]: K extends 'json'
+      ? SchemaInput<O[K]>
+      : InferInput<SchemaInput<O[K]>, K>
+  }
+  out: Validated<O>
+}
+type Result<R> = R extends Response
+  ? R
+  : R extends TypedResponse
+    ? R
+    : R extends string | HtmlEscaped
+      ? TypedResponse<R, 200, 'html'>
+      : R extends null | undefined | void
+        ? TypedResponse<null, 204, 'body'>
+        : TypedResponse<JSONParsed<R>, 200, 'json'>
+type Returned<O, R> = O extends { response: Rule }
+  ? TypedResponse<JSONParsed<Output<O['response']>>, 200, 'json'>
+  : Result<Awaited<R>>
+type Value<O> = O extends { response: Rule } ? SchemaInput<O['response']> | Response : unknown
+type Callback<E extends Env, P extends string, O, R> = (
+  c: Context<E, P, RequestInput<O>>,
+  input: Validated<O>
+) => R
+
+type Built<E extends Env, P extends string, O, R> = Handler<
+  E,
+  P,
+  RequestInput<O>,
+  Promise<Returned<O, R>>
+> & { validations: O }
+
+/** @experimental */
+export interface HandlerBuilder<E extends Env, P extends string, O> {
+  <R extends Value<O> | Promise<Value<O>>>(handler: Callback<E, P, O, R>): Built<E, P, O, R>
+  <E2 extends Env, R extends Value<O> | Promise<Value<O>>>(
+    mw: MiddlewareHandler<E2, P>,
+    handler: Callback<E & E2, P, O, R>
+  ): Built<E & E2, P, O, R>
+  <E2 extends Env, E3 extends Env, R extends Value<O> | Promise<Value<O>>>(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    handler: Callback<E & E2 & E3, P, O, R>
+  ): Built<E & E2 & E3, P, O, R>
+  <E2 extends Env, E3 extends Env, E4 extends Env, R extends Value<O> | Promise<Value<O>>>(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    mw3: MiddlewareHandler<E4, P>,
+    handler: Callback<E & E2 & E3 & E4, P, O, R>
+  ): Built<E & E2 & E3 & E4, P, O, R>
+  <
+    E2 extends Env,
+    E3 extends Env,
+    E4 extends Env,
+    E5 extends Env,
+    R extends Value<O> | Promise<Value<O>>,
+  >(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    mw3: MiddlewareHandler<E4, P>,
+    mw4: MiddlewareHandler<E5, P>,
+    handler: Callback<E & E2 & E3 & E4 & E5, P, O, R>
+  ): Built<E & E2 & E3 & E4 & E5, P, O, R>
+  <
+    E2 extends Env,
+    E3 extends Env,
+    E4 extends Env,
+    E5 extends Env,
+    E6 extends Env,
+    R extends Value<O> | Promise<Value<O>>,
+  >(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    mw3: MiddlewareHandler<E4, P>,
+    mw4: MiddlewareHandler<E5, P>,
+    mw5: MiddlewareHandler<E6, P>,
+    handler: Callback<E & E2 & E3 & E4 & E5 & E6, P, O, R>
+  ): Built<E & E2 & E3 & E4 & E5 & E6, P, O, R>
+  <
+    E2 extends Env,
+    E3 extends Env,
+    E4 extends Env,
+    E5 extends Env,
+    E6 extends Env,
+    E7 extends Env,
+    R extends Value<O> | Promise<Value<O>>,
+  >(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    mw3: MiddlewareHandler<E4, P>,
+    mw4: MiddlewareHandler<E5, P>,
+    mw5: MiddlewareHandler<E6, P>,
+    mw6: MiddlewareHandler<E7, P>,
+    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7, P, O, R>
+  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7, P, O, R>
+  <
+    E2 extends Env,
+    E3 extends Env,
+    E4 extends Env,
+    E5 extends Env,
+    E6 extends Env,
+    E7 extends Env,
+    E8 extends Env,
+    R extends Value<O> | Promise<Value<O>>,
+  >(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    mw3: MiddlewareHandler<E4, P>,
+    mw4: MiddlewareHandler<E5, P>,
+    mw5: MiddlewareHandler<E6, P>,
+    mw6: MiddlewareHandler<E7, P>,
+    mw7: MiddlewareHandler<E8, P>,
+    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7 & E8, P, O, R>
+  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7 & E8, P, O, R>
+  <
+    E2 extends Env,
+    E3 extends Env,
+    E4 extends Env,
+    E5 extends Env,
+    E6 extends Env,
+    E7 extends Env,
+    E8 extends Env,
+    E9 extends Env,
+    R extends Value<O> | Promise<Value<O>>,
+  >(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    mw3: MiddlewareHandler<E4, P>,
+    mw4: MiddlewareHandler<E5, P>,
+    mw5: MiddlewareHandler<E6, P>,
+    mw6: MiddlewareHandler<E7, P>,
+    mw7: MiddlewareHandler<E8, P>,
+    mw8: MiddlewareHandler<E9, P>,
+    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9, P, O, R>
+  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9, P, O, R>
+  <
+    E2 extends Env,
+    E3 extends Env,
+    E4 extends Env,
+    E5 extends Env,
+    E6 extends Env,
+    E7 extends Env,
+    E8 extends Env,
+    E9 extends Env,
+    E10 extends Env,
+    R extends Value<O> | Promise<Value<O>>,
+  >(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    mw3: MiddlewareHandler<E4, P>,
+    mw4: MiddlewareHandler<E5, P>,
+    mw5: MiddlewareHandler<E6, P>,
+    mw6: MiddlewareHandler<E7, P>,
+    mw7: MiddlewareHandler<E8, P>,
+    mw8: MiddlewareHandler<E9, P>,
+    mw9: MiddlewareHandler<E10, P>,
+    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9 & E10, P, O, R>
+  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9 & E10, P, O, R>
+}
+
+/** @experimental */
+export interface DefineHandler<E extends Env = Env, P extends string = string> {
+  <O extends Options<E, P>>(options: O): HandlerBuilder<E, P, O>
+  <E2 extends Env = E, P2 extends string = P, R = any>(
+    handler: Callback<E2, P2, {}, R>
+  ): Built<E2, P2, {}, R>
+  <E2 extends Env, R>(
+    mw: MiddlewareHandler<E2, P>,
+    handler: Callback<E & E2, P, {}, R>
+  ): Built<E & E2, P, {}, R>
+  <E2 extends Env, E3 extends Env, R>(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    handler: Callback<E & E2 & E3, P, {}, R>
+  ): Built<E & E2 & E3, P, {}, R>
+  <E2 extends Env, E3 extends Env, E4 extends Env, R>(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    mw3: MiddlewareHandler<E4, P>,
+    handler: Callback<E & E2 & E3 & E4, P, {}, R>
+  ): Built<E & E2 & E3 & E4, P, {}, R>
+  <E2 extends Env, E3 extends Env, E4 extends Env, E5 extends Env, R>(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    mw3: MiddlewareHandler<E4, P>,
+    mw4: MiddlewareHandler<E5, P>,
+    handler: Callback<E & E2 & E3 & E4 & E5, P, {}, R>
+  ): Built<E & E2 & E3 & E4 & E5, P, {}, R>
+  <E2 extends Env, E3 extends Env, E4 extends Env, E5 extends Env, E6 extends Env, R>(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    mw3: MiddlewareHandler<E4, P>,
+    mw4: MiddlewareHandler<E5, P>,
+    mw5: MiddlewareHandler<E6, P>,
+    handler: Callback<E & E2 & E3 & E4 & E5 & E6, P, {}, R>
+  ): Built<E & E2 & E3 & E4 & E5 & E6, P, {}, R>
+  <
+    E2 extends Env,
+    E3 extends Env,
+    E4 extends Env,
+    E5 extends Env,
+    E6 extends Env,
+    E7 extends Env,
+    R,
+  >(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    mw3: MiddlewareHandler<E4, P>,
+    mw4: MiddlewareHandler<E5, P>,
+    mw5: MiddlewareHandler<E6, P>,
+    mw6: MiddlewareHandler<E7, P>,
+    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7, P, {}, R>
+  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7, P, {}, R>
+  <
+    E2 extends Env,
+    E3 extends Env,
+    E4 extends Env,
+    E5 extends Env,
+    E6 extends Env,
+    E7 extends Env,
+    E8 extends Env,
+    R,
+  >(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    mw3: MiddlewareHandler<E4, P>,
+    mw4: MiddlewareHandler<E5, P>,
+    mw5: MiddlewareHandler<E6, P>,
+    mw6: MiddlewareHandler<E7, P>,
+    mw7: MiddlewareHandler<E8, P>,
+    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7 & E8, P, {}, R>
+  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7 & E8, P, {}, R>
+  <
+    E2 extends Env,
+    E3 extends Env,
+    E4 extends Env,
+    E5 extends Env,
+    E6 extends Env,
+    E7 extends Env,
+    E8 extends Env,
+    E9 extends Env,
+    R,
+  >(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    mw3: MiddlewareHandler<E4, P>,
+    mw4: MiddlewareHandler<E5, P>,
+    mw5: MiddlewareHandler<E6, P>,
+    mw6: MiddlewareHandler<E7, P>,
+    mw7: MiddlewareHandler<E8, P>,
+    mw8: MiddlewareHandler<E9, P>,
+    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9, P, {}, R>
+  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9, P, {}, R>
+  <
+    E2 extends Env,
+    E3 extends Env,
+    E4 extends Env,
+    E5 extends Env,
+    E6 extends Env,
+    E7 extends Env,
+    E8 extends Env,
+    E9 extends Env,
+    E10 extends Env,
+    R,
+  >(
+    mw1: MiddlewareHandler<E2, P>,
+    mw2: MiddlewareHandler<E3, P>,
+    mw3: MiddlewareHandler<E4, P>,
+    mw4: MiddlewareHandler<E5, P>,
+    mw5: MiddlewareHandler<E6, P>,
+    mw6: MiddlewareHandler<E7, P>,
+    mw7: MiddlewareHandler<E8, P>,
+    mw8: MiddlewareHandler<E9, P>,
+    mw9: MiddlewareHandler<E10, P>,
+    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9 & E10, P, {}, R>
+  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9 & E10, P, {}, R>
+  <E2 extends Env = E, P2 extends string = P, O extends Options<E2, P2> = Options<E2, P2>>(
+    options: O
+  ): HandlerBuilder<E2, P2, O>
+  <E2 extends Env = E, P2 extends string = P, R = any>(
+    ...handlers: [...MiddlewareHandler<E2, P2>[], Callback<E2, P2, {}, R>]
+  ): Built<E2, P2, {}, R>
+}
+
+const slots = ['param', 'query', 'header', 'cookie', 'form', 'json'] as const
+const isSchema = (rule: Rule): rule is StandardSchema<any, any> => '~standard' in rule
+
+const build = (options: Options, handlers: Function[]) => {
+  const handler = handlers[handlers.length - 1]
+  const middleware = handlers.slice(0, -1)
+  return Object.assign(
+    async (c: Context) => {
+      const run = async () => {
+        const input: Record<string, unknown> = {}
+        const failures: ValidationFailure['issues'] = []
+        for (const slot of slots) {
+          const rule = options[slot]
+          if (!rule) {
+            continue
+          }
+          const response = await validator(slot, async (value, context) => {
+            if (isSchema(rule)) {
+              const result = await rule['~standard'].validate(value)
+              if (result.issues) {
+                failures.push({ slot, issues: result.issues })
+                return undefined
+              }
+              input[slot] = result.value
+              return result.value
+            }
+            const result = await rule(value, context)
+            input[slot] = result
+            return result
+          })(c, async () => {})
+          if (response instanceof Response) {
+            return response
+          }
+        }
+        if (failures.length) {
+          throw new HTTPException(400, {
+            res: Response.json({
+              error: 'Validation failed',
+              issues: failures.map(({ slot, issues }) => ({
+                slot,
+                issues: issues.map(({ message, path }) => ({
+                  message,
+                  ...(path?.length
+                    ? {
+                        path: path
+                          .map((item) => String(typeof item === 'object' ? item.key : item))
+                          .join('.'),
+                      }
+                    : {}),
+                })),
+              })),
+            }),
+            cause: { issues: failures } satisfies ValidationFailure,
+          })
+        }
+        let value = await handler(c, input)
+        if (value instanceof Response) {
+          return value
+        }
+        if (options.response) {
+          const rule = options.response
+          if (isSchema(rule)) {
+            const result = await rule['~standard'].validate(value)
+            if (result.issues) {
+              throw new HTTPException(500, {
+                res: Response.json({ error: 'Response validation failed' }),
+                cause: {
+                  issues: [{ slot: 'response', issues: result.issues }],
+                } satisfies ValidationFailure,
+              })
+            }
+            value = result.value
+          } else {
+            value = await rule(value, c)
+            if (value instanceof Response) {
+              return value
+            }
+          }
+          return c.json(value)
+        }
+        if (value == null) {
+          return c.body(null, 204)
+        }
+        if (typeof value === 'string' || value.isEscaped) {
+          return c.html(value)
+        }
+        return c.json(value)
+      }
+      let index = -1
+      const dispatch = async (i: number): Promise<void> => {
+        if (i <= index) {
+          throw new Error('next() called multiple times')
+        }
+        index = i
+        const response =
+          i === middleware.length ? await run() : await middleware[i](c, () => dispatch(i + 1))
+        if (response instanceof Response) {
+          c.res = response
+        }
+      }
+      await dispatch(0)
+      return c.res
+    },
+    { validations: options }
+  )
+}
+
+/** Define a handler and its validation in one place. @experimental */
+export const defineHandler: DefineHandler = ((...args: any[]) => {
+  if (typeof args[0] === 'object') {
+    return (...handlers: Function[]) => build(args[0], handlers)
+  }
+  return build({}, args)
+}) as DefineHandler
diff --git a/src/helper/factory/index.ts b/src/helper/factory/index.ts
index 8f88777..582ab1e 100644
--- a/src/helper/factory/index.ts
+++ b/src/helper/factory/index.ts
@@ -4,6 +4,11 @@
  */
 
 /* eslint-disable @typescript-eslint/no-explicit-any */
+import { defineHandler } from './define-handler'
+import type { DefineHandler } from './define-handler'
+export { defineHandler } from './define-handler'
+export type { StandardSchema, ValidationIssue, ValidationFailure } from './define-handler'
+
 import { Hono } from '../../hono'
 import type { HonoOptions } from '../../hono-base'
 import type {
@@ -350,10 +355,17 @@ export class Factory<E extends Env = Env, P extends string = string> {
     return app
   }
 
-  createMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
+  /** @experimental */
+  defineHandler: DefineHandler<E, P> = defineHandler as unknown as DefineHandler<E, P>
+
+  /** @experimental */
+  defineMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
     middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
   ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
 
+  /** @deprecated Use defineMiddleware instead. */
+  createMiddleware = this.defineMiddleware
+
   createHandlers: CreateHandlersInterface<E, P> = (...handlers: any) => {
     // @ts-expect-error this should not be typed
     return handlers.filter((handler) => handler !== undefined)
@@ -365,7 +377,8 @@ export const createFactory = <E extends Env = Env, P extends string = string>(in
   defaultAppOptions?: HonoOptions<E>
 }): Factory<E, P> => new Factory<E, P>(init)
 
-export const createMiddleware = <
+/** @experimental */
+export const defineMiddleware = <
   E extends Env = any,
   P extends string = string,
   I extends Input = {},
@@ -373,3 +386,6 @@ export const createMiddleware = <
 >(
   middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
 ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
+
+/** @deprecated Use defineMiddleware instead. */
+export const createMiddleware = defineMiddleware
```

</details>

<details><summary>reply</summary>

I’ll check the factory and validator APIs, add the helper, and test validation, middleware ordering, and type inference.

The helper now reuses `validator()` for request parsing and composes middleware without changing Hono’s core. I’m checking the types and adding tests for validation failures, response transforms, and middleware ordering.

The factory and validator tests pass, along with the full TypeScript check. The type tests cover middleware context, factory defaults, RPC JSON inference, and response schema input checking. I’m adding a final case for callable schemas and request validation order.

Implemented `defineHandler`, validation types, and experimental `defineMiddleware` in `hono/factory`, including factory methods and deprecated `createMiddleware` aliases. Hono’s core is unchanged.

Verified with the full TypeScript check and 80 passing factory/validator tests.

</details>

### codex, hush: pass

Files: [src/helper/factory/define-handler.test.ts](../hush/codex/ts-hono-define-handler-1/files/src/helper/factory/define-handler.test.ts), [src/helper/factory/define-handler.ts](../hush/codex/ts-hono-define-handler-1/files/src/helper/factory/define-handler.ts), [src/helper/factory/index.ts](../hush/codex/ts-hono-define-handler-1/files/src/helper/factory/index.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/helper/factory/define-handler.test.ts b/src/helper/factory/define-handler.test.ts
new file mode 100644
index 0000000..1760b69
--- /dev/null
+++ b/src/helper/factory/define-handler.test.ts
@@ -0,0 +1,268 @@
+import { describe, expect, expectTypeOf, it } from 'vitest'
+import { createFactory, defineHandler, defineMiddleware } from '.'
+import type { StandardSchema } from '.'
+import { hc } from '../../client'
+import { Hono } from '../../hono'
+import { HTTPException } from '../../http-exception'
+import { jsx } from '../../jsx'
+import { html } from '../html'
+
+const schema: StandardSchema<string, number> = {
+  '~standard': {
+    validate: (value) =>
+      typeof value === 'string'
+        ? { value: value.length }
+        : { issues: [{ message: 'Expected string', path: [{ key: 'name' }, 0] }] },
+  },
+}
+
+describe('defineHandler', () => {
+  it('converts results and preserves responses', async () => {
+    const response = new Response('raw', { status: 202 })
+    const app = new Hono()
+      .get(
+        '/json',
+        defineHandler(() => ({ ok: true }))
+      )
+      .get(
+        '/string',
+        defineHandler(() => 'hello')
+      )
+      .get(
+        '/html',
+        defineHandler(() => html`<b>hello</b>`)
+      )
+      .get(
+        '/jsx',
+        defineHandler(() => jsx('b', null, 'hello'))
+      )
+      .get(
+        '/empty',
+        defineHandler(() => undefined)
+      )
+      .get(
+        '/null',
+        defineHandler(() => null)
+      )
+      .get(
+        '/response',
+        defineHandler(() => response)
+      )
+    expect(await (await app.request('/json')).json()).toEqual({ ok: true })
+    for (const path of ['/html', '/jsx']) {
+      expect(await (await app.request(path)).text()).toBe('<b>hello</b>')
+    }
+    expect((await app.request('/string')).headers.get('content-type')).toContain('text/html')
+    for (const path of ['/empty', '/null']) {
+      const res = await app.request(path)
+      expect(res.status).toBe(204)
+      expect(await res.text()).toBe('')
+    }
+    expect(await app.request('/response')).toBe(response)
+    const client = hc<typeof app>('http://localhost', { fetch: app.request })
+    expectTypeOf(await (await client.json.$get()).json()).toEqualTypeOf<{ ok: boolean }>()
+  })
+
+  it('runs middleware around validation and retains status and headers', async () => {
+    const order: string[] = []
+    const mw = defineMiddleware<{ Variables: { name: string } }>(async (c, next) => {
+      order.push('before')
+      c.set('name', 'Ada')
+      await next()
+      order.push('after')
+      c.header('after', 'yes')
+    })
+    const options = {
+      query: (value: Record<string, string | string[]>) => {
+        order.push('request')
+        return { name: String(value.name) }
+      },
+      response: (value: string) => {
+        order.push('response')
+        return { length: value.length }
+      },
+    }
+    const handler = defineHandler(options)(mw, (c, input) => {
+      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
+      expectTypeOf(c.req.valid('query')).toEqualTypeOf<{ name: string }>()
+      order.push('handler')
+      c.status(201)
+      c.header('before', 'yes')
+      return input.query.name
+    })
+    expect(handler.validations).toBe(options)
+    const res = await new Hono().get('/', handler).request('/?name=Ada')
+    expect(res.status).toBe(201)
+    expect(res.headers.get('before')).toBe('yes')
+    expect(res.headers.get('after')).toBe('yes')
+    expect(await res.json()).toEqual({ length: 3 })
+    expect(order).toEqual(['before', 'request', 'handler', 'response', 'after'])
+  })
+
+  it('aggregates schema failures without leaking input', async () => {
+    let caught: HTTPException | undefined
+    const app = new Hono()
+    app.onError((error) => {
+      caught = error as HTTPException
+      return caught.getResponse()
+    })
+    app.post(
+      '/:id',
+      defineHandler({ param: schema, query: schema, json: schema })(() => 'unused')
+    )
+    const res = await app.request('/secret?password=secret', {
+      method: 'POST',
+      headers: { 'Content-Type': 'application/json' },
+      body: '{"password":"secret"}',
+    })
+    expect(res.status).toBe(400)
+    expect(await res.json()).toEqual({
+      error: 'Validation failed',
+      issues: ['param', 'query', 'json'].map((slot) => ({
+        slot,
+        issues: [{ message: 'Expected string', path: 'name.0' }],
+      })),
+    })
+    expect(caught).toBeInstanceOf(HTTPException)
+    expect(caught?.cause).toEqual({
+      issues: ['param', 'query', 'json'].map((slot) => ({
+        slot,
+        issues: [{ message: 'Expected string', path: [{ key: 'name' }, 0] }],
+      })),
+    })
+  })
+
+  it('transforms response schemas and checks their input types', async () => {
+    const handler = defineHandler({ response: schema })(() => 'hello')
+    // @ts-expect-error schema input is string
+    defineHandler({ response: schema })(() => 42)
+    const app = new Hono().get('/', handler)
+    expect(await (await app.request('/')).json()).toBe(5)
+    const client = hc<typeof app>('http://localhost', { fetch: app.request })
+    expectTypeOf(await (await client.index.$get()).json()).toEqualTypeOf<number>()
+    const bad = new Hono().get(
+      '/',
+      defineHandler({ response: schema })(() => 42 as never)
+    )
+    bad.onError((err) => (err as HTTPException).getResponse())
+    const res = await bad.request('/')
+    expect(res.status).toBe(500)
+    expect(await res.json()).toEqual({ error: 'Response validation failed' })
+  })
+
+  it('supports factory defaults and middleware inference', async () => {
+    type E = { Variables: { name: string } }
+    const factory = createFactory<E, '/:id'>()
+    const mw = factory.defineMiddleware(async (c, next) => {
+      c.set('name', 'Ada')
+      await next()
+    })
+    const handler = factory.defineHandler(mw, (c) => ({
+      name: c.get('name'),
+      id: c.req.param('id'),
+    }))
+    const plain = defineHandler(mw, (c) => {
+      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
+      return { name: c.get('name') }
+    })
+    const explicit = defineHandler<E, '/:id'>((c) => c.req.param('id'))
+    const app = new Hono().get('/:id', handler).get('/plain', plain).get('/explicit/:id', explicit)
+    expect(await (await app.request('/123')).json()).toEqual({ name: 'Ada', id: '123' })
+  })
+
+  it('reads every target in order and supports async callable schemas', async () => {
+    const order: string[] = []
+    const callable = Object.assign(
+      () => {
+        throw new Error('schema must not be called')
+      },
+      {
+        '~standard': {
+          validate: async (value: unknown) => ({ value: { parsed: value } }),
+        },
+      }
+    )
+    const app = new Hono().post(
+      '/:id',
+      defineHandler({
+        param: async (value) => {
+          order.push('param')
+          return value
+        },
+        query: async (value) => {
+          order.push('query')
+          return value
+        },
+        header: async (value) => {
+          order.push('header')
+          return value
+        },
+        cookie: async (value) => {
+          order.push('cookie')
+          return value
+        },
+        form: async (value) => {
+          order.push('form')
+          return value
+        },
+        json: callable,
+      })((c, input) => {
+        expect(c.req.valid('json')).toBe(input.json)
+        return input
+      })
+    )
+    const res = await app.request('/123?q=one&q=two', {
+      method: 'POST',
+      headers: { Cookie: 'session=abc', 'Content-Type': 'application/x-www-form-urlencoded' },
+      body: 'name=Ada&name=Grace&tags%5B%5D=a&tags%5B%5D=b',
+    })
+    const body = await res.json()
+    expect(order).toEqual(['param', 'query', 'header', 'cookie', 'form'])
+    expect(body.param).toEqual({ id: '123' })
+    expect(body.query).toEqual({ q: ['one', 'two'] })
+    expect(body.cookie).toEqual({ session: 'abc' })
+    expect(body.form).toEqual({ name: ['Ada', 'Grace'], 'tags[]': ['a', 'b'] })
+    expect(body.json).toEqual({ parsed: {} })
+  })
+
+  it('bypasses response validation for Response results', async () => {
+    const response = new Response('raw', { status: 202 })
+    const app = new Hono().get(
+      '/',
+      defineHandler({ response: schema })(async () => response)
+    )
+    expect(await app.request('/')).toBe(response)
+  })
+
+  it('short circuits middleware and function validation and reports malformed JSON', async () => {
+    const app = new Hono()
+    app.get(
+      '/mw',
+      defineHandler(
+        async () => new Response('middleware'),
+        () => {
+          throw Error('unreachable')
+        }
+      )
+    )
+    app.get(
+      '/validation',
+      defineHandler({ query: () => new Response('validation') })(() => {
+        throw Error('unreachable')
+      })
+    )
+    app.post(
+      '/json',
+      defineHandler({ json: (value) => value })(() => 'unused')
+    )
+    expect(await (await app.request('/mw')).text()).toBe('middleware')
+    expect(await (await app.request('/validation')).text()).toBe('validation')
+    const res = await app.request('/json', {
+      method: 'POST',
+      headers: { 'Content-Type': 'application/json' },
+      body: '{',
+    })
+    expect(res.status).toBe(400)
+    expect(await res.text()).toBe('Malformed JSON in request body')
+  })
+})
diff --git a/src/helper/factory/define-handler.ts b/src/helper/factory/define-handler.ts
new file mode 100644
index 0000000..ed1381b
--- /dev/null
+++ b/src/helper/factory/define-handler.ts
@@ -0,0 +1,369 @@
+/** @module Experimental handlers with request and response validation. */
+/* eslint-disable @typescript-eslint/no-explicit-any */
+import type { Context } from '../../context'
+import { HTTPException } from '../../http-exception'
+import type { Env, Handler, MiddlewareHandler, TypedResponse, ValidationTargets } from '../../types'
+import type { HtmlEscaped } from '../../utils/html'
+import type { JSONParsed } from '../../utils/types'
+import { validator } from '../../validator'
+
+/** @experimental A Standard Schema issue. */
+export interface ValidationIssue {
+  readonly message: string
+  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
+}
+
+/** @experimental A failed validation target, retaining the original issues. */
+export interface ValidationFailure {
+  readonly slot: keyof ValidationTargets | 'response'
+  readonly issues: ReadonlyArray<ValidationIssue>
+}
+
+/** @experimental The dependency-free Standard Schema validation contract. */
+export interface StandardSchema<Input = unknown, Output = Input> {
+  readonly '~standard': {
+    readonly version?: 1
+    readonly vendor?: string
+    readonly types?: { readonly input: Input; readonly output: Output }
+    readonly validate: (
+      value: unknown
+    ) =>
+      | { readonly value: Output; readonly issues?: undefined }
+      | { readonly issues: ReadonlyArray<ValidationIssue> }
+      | Promise<
+          | { readonly value: Output; readonly issues?: undefined }
+          | { readonly issues: ReadonlyArray<ValidationIssue> }
+        >
+  }
+}
+
+type Validation<E extends Env, P extends string, V = any> =
+  | StandardSchema<any, any>
+  | ((value: V, c: Context<E, P>) => any)
+type Options<E extends Env, P extends string> = {
+  [K in keyof ValidationTargets]?: Validation<E, P, ValidationTargets[K]>
+} & { response?: Validation<E, P> }
+type Output<V> =
+  V extends StandardSchema<any, infer O>
+    ? O
+    : V extends (...args: any[]) => infer R
+      ? Exclude<Awaited<R>, Response>
+      : never
+type SchemaInput<V> = V extends StandardSchema<infer I, any> ? I : unknown
+type RequestInput<O> = {
+  in: {
+    [K in keyof O & keyof ValidationTargets]: O[K] extends StandardSchema<infer I, any>
+      ? I
+      : ValidationTargets[K]
+  }
+  out: { [K in keyof O & keyof ValidationTargets]: Output<O[K]> }
+}
+type Result<R> = R extends Response | TypedResponse
+  ? R
+  : R extends null | undefined | void
+    ? TypedResponse<null, 204, 'text'>
+    : R extends string | HtmlEscaped
+      ? TypedResponse<string, 200, 'html'>
+      : TypedResponse<JSONParsed<R>, 200, 'json'>
+type Returned<E extends Env, P extends string, O, R> = Handler<
+  E,
+  P,
+  RequestInput<O>,
+  Promise<
+    'response' extends keyof O
+      ? TypedResponse<JSONParsed<Output<O['response']>>, 200, 'json'>
+      : Result<Awaited<R>>
+  >
+>
+type Callback<E extends Env, P extends string, O, R> = (
+  c: Context<E, P, RequestInput<O>>,
+  input: RequestInput<O>['out']
+) => R
+
+type Allowed<O> = 'response' extends keyof O ? SchemaInput<O['response']> | Response : unknown
+
+/** @experimental A handler builder with validation options. */
+export interface HandlerBuilder<E extends Env, P extends string, O> {
+  <R extends Allowed<O> | Promise<Allowed<O>>>(
+    handler: Callback<E, P, O, R>
+  ): Returned<E, P, O, R> & { validations: O }
+  <R extends Allowed<O> | Promise<Allowed<O>>, E0 extends Env = E>(
+    mw0: MiddlewareHandler<E0, P, any, any>,
+    handler: Callback<E & E0, P, O, R>
+  ): Returned<E & E0, P, O, R> & { validations: O }
+  <R extends Allowed<O> | Promise<Allowed<O>>, E0 extends Env = E, E1 extends Env = E>(
+    mw0: MiddlewareHandler<E0, P, any, any>,
+    mw1: MiddlewareHandler<E1, P, any, any>,
+    handler: Callback<E & E0 & E1, P, O, R>
+  ): Returned<E & E0 & E1, P, O, R> & { validations: O }
+  <
+    R extends Allowed<O> | Promise<Allowed<O>>,
+    E0 extends Env = E,
+    E1 extends Env = E,
+    E2 extends Env = E,
+  >(
+    mw0: MiddlewareHandler<E0, P, any, any>,
+    mw1: MiddlewareHandler<E1, P, any, any>,
+    mw2: MiddlewareHandler<E2, P, any, any>,
+    handler: Callback<E & E0 & E1 & E2, P, O, R>
+  ): Returned<E & E0 & E1 & E2, P, O, R> & { validations: O }
+  <
+    R extends Allowed<O> | Promise<Allowed<O>>,
+    E0 extends Env = E,
+    E1 extends Env = E,
+    E2 extends Env = E,
+    E3 extends Env = E,
+  >(
+    mw0: MiddlewareHandler<E0, P, any, any>,
+    mw1: MiddlewareHandler<E1, P, any, any>,
+    mw2: MiddlewareHandler<E2, P, any, any>,
+    mw3: MiddlewareHandler<E3, P, any, any>,
+    handler: Callback<E & E0 & E1 & E2 & E3, P, O, R>
+  ): Returned<E & E0 & E1 & E2 & E3, P, O, R> & { validations: O }
+  <
+    R extends Allowed<O> | Promise<Allowed<O>>,
+    E0 extends Env = E,
+    E1 extends Env = E,
+    E2 extends Env = E,
+    E3 extends Env = E,
+    E4 extends Env = E,
+  >(
+    mw0: MiddlewareHandler<E0, P, any, any>,
+    mw1: MiddlewareHandler<E1, P, any, any>,
+    mw2: MiddlewareHandler<E2, P, any, any>,
+    mw3: MiddlewareHandler<E3, P, any, any>,
+    mw4: MiddlewareHandler<E4, P, any, any>,
+    handler: Callback<E & E0 & E1 & E2 & E3 & E4, P, O, R>
+  ): Returned<E & E0 & E1 & E2 & E3 & E4, P, O, R> & { validations: O }
+  <
+    R extends Allowed<O> | Promise<Allowed<O>>,
+    E0 extends Env = E,
+    E1 extends Env = E,
+    E2 extends Env = E,
+    E3 extends Env = E,
+    E4 extends Env = E,
+    E5 extends Env = E,
+  >(
+    mw0: MiddlewareHandler<E0, P, any, any>,
+    mw1: MiddlewareHandler<E1, P, any, any>,
+    mw2: MiddlewareHandler<E2, P, any, any>,
+    mw3: MiddlewareHandler<E3, P, any, any>,
+    mw4: MiddlewareHandler<E4, P, any, any>,
+    mw5: MiddlewareHandler<E5, P, any, any>,
+    handler: Callback<E & E0 & E1 & E2 & E3 & E4 & E5, P, O, R>
+  ): Returned<E & E0 & E1 & E2 & E3 & E4 & E5, P, O, R> & { validations: O }
+}
+
+/** @experimental Define a handler with optional validation and middleware. */
+export interface DefineHandler<E extends Env = Env, P extends string = string> {
+  <Base extends Env = E, P2 extends string = P, O extends Options<Base, P2> = Options<Base, P2>>(
+    options: O
+  ): HandlerBuilder<Base, P2, O>
+  <Base extends Env = E, P2 extends string = P, R = any>(
+    handler: Callback<Base, P2, {}, R>
+  ): Returned<Base, P2, {}, R>
+  <Base extends Env = E, P2 extends string = P, R = any, E0 extends Env = Base>(
+    mw0: MiddlewareHandler<E0, P2, any, any>,
+    handler: Callback<Base & E0, P2, {}, R>
+  ): Returned<Base & E0, P2, {}, R>
+  <
+    Base extends Env = E,
+    P2 extends string = P,
+    R = any,
+    E0 extends Env = Base,
+    E1 extends Env = Base,
+  >(
+    mw0: MiddlewareHandler<E0, P2, any, any>,
+    mw1: MiddlewareHandler<E1, P2, any, any>,
+    handler: Callback<Base & E0 & E1, P2, {}, R>
+  ): Returned<Base & E0 & E1, P2, {}, R>
+  <
+    Base extends Env = E,
+    P2 extends string = P,
+    R = any,
+    E0 extends Env = Base,
+    E1 extends Env = Base,
+    E2 extends Env = Base,
+  >(
+    mw0: MiddlewareHandler<E0, P2, any, any>,
+    mw1: MiddlewareHandler<E1, P2, any, any>,
+    mw2: MiddlewareHandler<E2, P2, any, any>,
+    handler: Callback<Base & E0 & E1 & E2, P2, {}, R>
+  ): Returned<Base & E0 & E1 & E2, P2, {}, R>
+  <
+    Base extends Env = E,
+    P2 extends string = P,
+    R = any,
+    E0 extends Env = Base,
+    E1 extends Env = Base,
+    E2 extends Env = Base,
+    E3 extends Env = Base,
+  >(
+    mw0: MiddlewareHandler<E0, P2, any, any>,
+    mw1: MiddlewareHandler<E1, P2, any, any>,
+    mw2: MiddlewareHandler<E2, P2, any, any>,
+    mw3: MiddlewareHandler<E3, P2, any, any>,
+    handler: Callback<Base & E0 & E1 & E2 & E3, P2, {}, R>
+  ): Returned<Base & E0 & E1 & E2 & E3, P2, {}, R>
+  <
+    Base extends Env = E,
+    P2 extends string = P,
+    R = any,
+    E0 extends Env = Base,
+    E1 extends Env = Base,
+    E2 extends Env = Base,
+    E3 extends Env = Base,
+    E4 extends Env = Base,
+  >(
+    mw0: MiddlewareHandler<E0, P2, any, any>,
+    mw1: MiddlewareHandler<E1, P2, any, any>,
+    mw2: MiddlewareHandler<E2, P2, any, any>,
+    mw3: MiddlewareHandler<E3, P2, any, any>,
+    mw4: MiddlewareHandler<E4, P2, any, any>,
+    handler: Callback<Base & E0 & E1 & E2 & E3 & E4, P2, {}, R>
+  ): Returned<Base & E0 & E1 & E2 & E3 & E4, P2, {}, R>
+  <
+    Base extends Env = E,
+    P2 extends string = P,
+    R = any,
+    E0 extends Env = Base,
+    E1 extends Env = Base,
+    E2 extends Env = Base,
+    E3 extends Env = Base,
+    E4 extends Env = Base,
+    E5 extends Env = Base,
+  >(
+    mw0: MiddlewareHandler<E0, P2, any, any>,
+    mw1: MiddlewareHandler<E1, P2, any, any>,
+    mw2: MiddlewareHandler<E2, P2, any, any>,
+    mw3: MiddlewareHandler<E3, P2, any, any>,
+    mw4: MiddlewareHandler<E4, P2, any, any>,
+    mw5: MiddlewareHandler<E5, P2, any, any>,
+    handler: Callback<Base & E0 & E1 & E2 & E3 & E4 & E5, P2, {}, R>
+  ): Returned<Base & E0 & E1 & E2 & E3 & E4 & E5, P2, {}, R>
+}
+
+const targets = ['param', 'query', 'header', 'cookie', 'form', 'json'] as const
+const isSchema = (value: any): value is StandardSchema<any, any> =>
+  value != null && typeof value['~standard']?.validate === 'function'
+
+const failure = (issues: ValidationFailure[], response = false): never => {
+  const message = response ? 'Response validation failed' : 'Validation failed'
+  throw new HTTPException(response ? 500 : 400, {
+    message,
+    cause: { issues },
+    res: Response.json(
+      response
+        ? { error: message }
+        : {
+            error: message,
+            issues: issues.map(({ slot, issues }) => ({
+              slot,
+              issues: issues.map(({ message, path }) => ({
+                message,
+                ...(path?.length
+                  ? {
+                      path: path
+                        .map((part) => String(typeof part === 'object' ? part.key : part))
+                        .join('.'),
+                    }
+                  : {}),
+              })),
+            })),
+          }
+    ),
+  })
+}
+
+const build = (options: Options<any, any>, handlers: Function[]) => {
+  const handler = handlers[handlers.length - 1]
+  const middleware = handlers.slice(0, -1)
+  return Object.assign(
+    async (c: Context) => {
+      let index = -1
+      const dispatch = async (i: number): Promise<void> => {
+        if (i <= index) {
+          throw new Error('next() called multiple times')
+        }
+        index = i
+        if (i < middleware.length) {
+          const res = await middleware[i](c, () => dispatch(i + 1))
+          if (res instanceof Response) {
+            c.res = res
+          }
+          return
+        }
+        const input: Record<string, unknown> = {}
+        const issues: ValidationFailure[] = []
+        for (const target of targets) {
+          const validation = options[target]
+          if (!validation) {
+            continue
+          }
+          const res = await validator(target, async (value, context) => {
+            if (isSchema(validation)) {
+              const result = await validation['~standard'].validate(value)
+              if (result.issues) {
+                issues.push({ slot: target, issues: result.issues })
+                return undefined
+              }
+              input[target] = result.value
+              return result.value
+            }
+            const result = await validation(value, context)
+            if (!(result instanceof Response)) {
+              input[target] = result
+            }
+            return result
+          })(c, async () => {})
+          if (res instanceof Response) {
+            c.res = res
+            return
+          }
+        }
+        if (issues.length) {
+          failure(issues)
+        }
+        let value = await handler(c, input)
+        if (value instanceof Response) {
+          c.res = value
+          return
+        }
+        if (options.response) {
+          if (isSchema(options.response)) {
+            const result = await options.response['~standard'].validate(value)
+            if (result.issues) {
+              failure([{ slot: 'response', issues: result.issues }], true)
+            }
+            value = 'value' in result ? result.value : undefined
+          } else {
+            value = await options.response(value, c)
+            if (value instanceof Response) {
+              c.res = value
+              return
+            }
+          }
+          c.res = c.json(value)
+        } else if (value == null) {
+          c.res = c.body(null, 204)
+        } else if (typeof value === 'string' || value.isEscaped) {
+          c.res = await c.html(value)
+        } else {
+          c.res = c.json(value)
+        }
+      }
+      await dispatch(0)
+      return c.res
+    },
+    { validations: options }
+  )
+}
+
+/** @experimental Define a handler and its validation without changing Hono's core. */
+export const defineHandler: DefineHandler = ((...args: any[]) => {
+  // Callable Standard Schemas are valid options values, not middleware.
+  if (typeof args[0] !== 'function') {
+    return (...handlers: Function[]) => build(args[0], handlers)
+  }
+  return build({}, args)
+}) as unknown as DefineHandler
diff --git a/src/helper/factory/index.ts b/src/helper/factory/index.ts
index 8f88777..8b781aa 100644
--- a/src/helper/factory/index.ts
+++ b/src/helper/factory/index.ts
@@ -5,6 +5,10 @@
 
 /* eslint-disable @typescript-eslint/no-explicit-any */
 import { Hono } from '../../hono'
+import { defineHandler } from './define-handler'
+import type { DefineHandler } from './define-handler'
+export { defineHandler } from './define-handler'
+export type { StandardSchema, ValidationIssue, ValidationFailure } from './define-handler'
 import type { HonoOptions } from '../../hono-base'
 import type {
   Env,
@@ -350,10 +354,17 @@ export class Factory<E extends Env = Env, P extends string = string> {
     return app
   }
 
-  createMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
+  /** @experimental */
+  defineHandler: DefineHandler<E, P> = defineHandler
+
+  /** @experimental */
+  defineMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
     middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
   ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
 
+  /** @deprecated Use defineMiddleware instead. */
+  createMiddleware = this.defineMiddleware
+
   createHandlers: CreateHandlersInterface<E, P> = (...handlers: any) => {
     // @ts-expect-error this should not be typed
     return handlers.filter((handler) => handler !== undefined)
@@ -365,7 +376,8 @@ export const createFactory = <E extends Env = Env, P extends string = string>(in
   defaultAppOptions?: HonoOptions<E>
 }): Factory<E, P> => new Factory<E, P>(init)
 
-export const createMiddleware = <
+/** @experimental */
+export const defineMiddleware = <
   E extends Env = any,
   P extends string = string,
   I extends Input = {},
@@ -373,3 +385,6 @@ export const createMiddleware = <
 >(
   middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
 ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
+
+/** @deprecated Use defineMiddleware instead. */
+export const createMiddleware = defineMiddleware
```

</details>

<details><summary>reply</summary>

Done.
Added experimental handler validation, factory defaults, middleware naming and deprecated alias. Typechecks, lint and 25 tests pass; full suite not run.

</details>

### codex, sloth: pass

Files: [src/helper/factory/define-handler.ts](../sloth/codex/ts-hono-define-handler-1/files/src/helper/factory/define-handler.ts), [src/helper/factory/index.test.ts](../sloth/codex/ts-hono-define-handler-1/files/src/helper/factory/index.test.ts), [src/helper/factory/index.ts](../sloth/codex/ts-hono-define-handler-1/files/src/helper/factory/index.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/helper/factory/define-handler.ts b/src/helper/factory/define-handler.ts
new file mode 100644
index 0000000..1566707
--- /dev/null
+++ b/src/helper/factory/define-handler.ts
@@ -0,0 +1,233 @@
+/* eslint-disable @typescript-eslint/no-explicit-any */
+import type { Context } from '../../context'
+import { HTTPException } from '../../http-exception'
+import type { Env, Handler, MiddlewareHandler, TypedResponse, ValidationTargets } from '../../types'
+import type { JSONParsed, UnionToIntersection } from '../../utils/types'
+import { validator } from '../../validator'
+
+/** A dependency-free Standard Schema contract. @experimental */
+export interface StandardSchema<Input = unknown, Output = Input> {
+  readonly '~standard': {
+    readonly version: 1
+    readonly vendor: string
+    readonly types?: { readonly input: Input; readonly output: Output }
+    readonly validate: (
+      value: unknown
+    ) =>
+      | { readonly value: Output; readonly issues?: undefined }
+      | { readonly issues: readonly ValidationIssue[] }
+      | Promise<
+          | { readonly value: Output; readonly issues?: undefined }
+          | { readonly issues: readonly ValidationIssue[] }
+        >
+  }
+}
+
+/** A raw Standard Schema issue. @experimental */
+export interface ValidationIssue {
+  readonly message: string
+  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
+}
+
+/** The cause attached to validation exceptions. @experimental */
+export interface ValidationFailure {
+  issues: { slot: keyof ValidationTargets | 'response'; issues: readonly ValidationIssue[] }[]
+}
+
+type Validation<E extends Env, T = any> =
+  | StandardSchema<any, any>
+  | ((value: T, c: Context<E>) => any)
+type Options<E extends Env> = {
+  [K in keyof ValidationTargets]?: Validation<E, ValidationTargets[K]>
+} & {
+  response?: Validation<E>
+}
+type Output<V> =
+  V extends StandardSchema<any, infer O>
+    ? O
+    : V extends (...args: any[]) => infer O
+      ? Exclude<Awaited<O>, Response>
+      : never
+type SchemaInput<V> =
+  V extends StandardSchema<infer I, any>
+    ? I
+    : V extends (value: infer I, ...args: any[]) => any
+      ? I
+      : unknown
+type Inputs<O> = { [K in keyof O as K extends keyof ValidationTargets ? K : never]: Output<O[K]> }
+type RequestInputs<O> = {
+  [K in keyof O as K extends keyof ValidationTargets ? K : never]: SchemaInput<O[K]>
+}
+type Result<R> = R extends Response | TypedResponse<any>
+  ? R
+  : R extends string
+    ? TypedResponse<string, 200, 'html'>
+    : R extends null | undefined | void
+      ? TypedResponse<null, 204, 'body'>
+      : TypedResponse<JSONParsed<R>, 200, 'json'>
+type Return<O, R> = O extends { response: unknown }
+  ? TypedResponse<JSONParsed<Output<O['response']>>, 200, 'json'> | Extract<Awaited<R>, Response>
+  : Result<Awaited<R>>
+type Callback<E extends Env, P extends string, O, R> = (
+  c: Context<E, P, { in: RequestInputs<O>; out: Inputs<O> }>,
+  input: Inputs<O>
+) => R
+type Allowed<O> = O extends { response: unknown }
+  ? SchemaInput<O['response']> | Response | Promise<SchemaInput<O['response']> | Response>
+  : unknown
+
+/** Defines a validated handler using an environment and path. @experimental */
+export interface HandlerBuilder<E extends Env = Env, P extends string = string, O = {}> {
+  <R extends Allowed<O>>(
+    handler: Callback<E, P, O, R>
+  ): Handler<E, P, { in: RequestInputs<O>; out: Inputs<O> }, Promise<Return<O, R>>> & {
+    validations: O
+  }
+  <E2 extends Env, R extends Allowed<O>>(
+    middleware: MiddlewareHandler<E2, P>,
+    handler: Callback<E & E2, P, O, R>
+  ): Handler<E & E2, P, { in: RequestInputs<O>; out: Inputs<O> }, Promise<Return<O, R>>> & {
+    validations: O
+  }
+  <E2 extends Env, E3 extends Env, R extends Allowed<O>>(
+    middleware1: MiddlewareHandler<E2, P>,
+    middleware2: MiddlewareHandler<E2 & E3, P>,
+    handler: Callback<E & E2 & E3, P, O, R>
+  ): Handler<E & E2 & E3, P, { in: RequestInputs<O>; out: Inputs<O> }, Promise<Return<O, R>>> & {
+    validations: O
+  }
+  <
+    M extends MiddlewareHandler<any, P>[],
+    R extends Allowed<O>,
+    ME extends Env = E &
+      UnionToIntersection<M[number] extends MiddlewareHandler<infer V, any> ? V : never>,
+  >(
+    ...handlers: [...M, Callback<ME, P, O, R>]
+  ): Handler<ME, P, { in: RequestInputs<O>; out: Inputs<O> }, Promise<Return<O, R>>> & {
+    validations: O
+  }
+}
+
+/** Defines handlers or configures their validations. @experimental */
+export interface DefineHandler<
+  E extends Env = Env,
+  P extends string = string,
+> extends HandlerBuilder<E, P> {
+  <O extends Options<E>>(options: O): HandlerBuilder<E, P, O>
+}
+
+/** Validates a value with a schema or transformation. */
+const validate = async (validation: Validation<any>, value: unknown, c: Context<any>) => {
+  if ('~standard' in validation) {
+    return validation['~standard'].validate(value)
+  }
+  return { value: await validation(value, c) }
+}
+
+/** Creates a handler and its surrounding middleware chain. */
+const build = (options: Options<any>, handlers: any[]): any => {
+  const handler = handlers[handlers.length - 1]
+  const endpoint: Handler = async (c) => {
+    const input: Record<string, unknown> = {}
+    const failures: ValidationFailure['issues'] = []
+    for (const slot of ['param', 'query', 'header', 'cookie', 'form', 'json'] as const) {
+      const validation = options[slot]
+      if (!validation) {
+        continue
+      }
+      const response = await validator(slot, async (value) => {
+        const result = await validate(validation, value, c)
+        if (result.issues) {
+          failures.push({ slot, issues: result.issues })
+        } else {
+          input[slot] = result.value
+          return result.value
+        }
+      })(c, async () => {})
+      if (response instanceof Response) {
+        return response
+      }
+    }
+    if (failures.length) {
+      throw new HTTPException(400, {
+        res: c.json(
+          {
+            error: 'Validation failed',
+            issues: failures.map(({ slot, issues }) => ({
+              slot,
+              issues: issues.map(({ message, path }) => ({
+                message,
+                ...(path?.length
+                  ? {
+                      path: path
+                        .map((item) => (typeof item === 'object' ? String(item.key) : String(item)))
+                        .join('.'),
+                    }
+                  : {}),
+              })),
+            })),
+          },
+          400
+        ),
+        cause: { issues: failures } satisfies ValidationFailure,
+      })
+    }
+    const value = await handler(c, input)
+    if (value instanceof Response) {
+      return value
+    }
+    if (options.response) {
+      const result = await validate(options.response, value, c)
+      if (result.issues) {
+        throw new HTTPException(500, {
+          res: c.json({ error: 'Response validation failed' }, 500),
+          cause: {
+            issues: [{ slot: 'response', issues: result.issues }],
+          } satisfies ValidationFailure,
+        })
+      }
+      return result.value instanceof Response ? result.value : c.json(result.value)
+    }
+    if (value == null) {
+      return c.body(null, 204)
+    }
+    if (typeof value === 'string' || value.isEscaped) {
+      return c.html(value)
+    }
+    return c.json(value)
+  }
+  return Object.assign(
+    async (c: Context) => {
+      let index = -1
+      /** Dispatches middleware without changing the request's route index. */
+      const dispatch = async (i: number): Promise<void> => {
+        if (i <= index) {
+          throw new Error('next() called multiple times')
+        }
+        index = i
+        const response = await (i < handlers.length - 1 ? handlers[i] : endpoint)(c, () =>
+          dispatch(i + 1)
+        )
+        if (response) {
+          c.res = response
+        }
+      }
+      await dispatch(0)
+      return c.res
+    },
+    { validations: options }
+  )
+}
+
+/** Defines a handler with optional request and response validation. @experimental */
+export const defineHandler: {
+  <E extends Env = Env, P extends string = string, O extends Options<E> = Options<E>>(
+    options: O
+  ): HandlerBuilder<E, P, O>
+  <E extends Env = Env, P extends string = string, R = any>(
+    handler: Callback<E, P, {}, R>
+  ): Handler<E, P, {}, Promise<Result<Awaited<R>>>>
+} & DefineHandler = ((...args: any[]) =>
+  typeof args[0] === 'function'
+    ? build({}, args)
+    : (...handlers: any[]) => build(args[0], handlers)) as any
diff --git a/src/helper/factory/index.test.ts b/src/helper/factory/index.test.ts
index 11660e5..e308521 100644
--- a/src/helper/factory/index.test.ts
+++ b/src/helper/factory/index.test.ts
@@ -432,3 +432,230 @@ describe('Lint rules', () => {
     expect(createMiddleware).toBeDefined()
   })
 })
+
+describe('defineHandler', () => {
+  it('converts values and preserves responses', async () => {
+    const { defineHandler } = await import('./index')
+    for (const [value, status, body, contentType] of [
+      [{ ok: true }, 200, '{"ok":true}', 'application/json'],
+      ['<b>hello</b>', 200, '<b>hello</b>', 'text/html'],
+      [null, 204, '', null],
+      [undefined, 204, '', null],
+      [new Response('original', { status: 202 }), 202, 'original', 'text/plain'],
+    ] as const) {
+      const app = new Hono().get(
+        '/',
+        defineHandler(async () => value)
+      )
+      const res = await app.request('/')
+      expect(res.status).toBe(status)
+      expect(await res.text()).toBe(body)
+      if (contentType) expect(res.headers.get('content-type')).toContain(contentType)
+    }
+  })
+
+  it('validates in order inside middleware and transforms responses', async () => {
+    const { defineHandler, defineMiddleware } = await import('./index')
+    const order: string[] = []
+    const mw = defineMiddleware<{ Variables: { name: string } }>(async (c, next) => {
+      order.push('before')
+      c.set('name', 'Ada')
+      await next()
+      order.push('after')
+    })
+    const options = {
+      query: (value: Record<string, string | string[]>) => {
+        order.push('query')
+        return { name: String(value.name) }
+      },
+      response: (value: { name: string }) => {
+        order.push('response')
+        return { greeting: value.name }
+      },
+    }
+    const handler = defineHandler(options)(mw, (c, input) => {
+      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
+      expectTypeOf(input.query).toEqualTypeOf<{ name: string }>()
+      expectTypeOf(c.req.valid('query')).toEqualTypeOf<{ name: string }>()
+      order.push('handler')
+      c.status(201)
+      c.header('X-Test', 'yes')
+      return { name: input.query.name }
+    })
+    expect(handler.validations).toBe(options)
+    const res = await new Hono().get('/', handler).request('/?name=Ada')
+    expect(res.status).toBe(201)
+    expect(res.headers.get('x-test')).toBe('yes')
+    expect(await res.json()).toEqual({ greeting: 'Ada' })
+    expect(order).toEqual(['before', 'query', 'handler', 'response', 'after'])
+  })
+})
+
+describe('defineHandler schemas', () => {
+  it('aggregates sanitized request failures and preserves raw causes', async () => {
+    const { defineHandler } = await import('./index')
+    const { HTTPException } = await import('../../http-exception')
+    const issues = [{ message: 'Invalid', path: [{ key: 'nested' }, 0], input: 'secret' }]
+    const schema = {
+      '~standard': { version: 1 as const, vendor: 'test', validate: () => ({ issues }) },
+    }
+    const app = new Hono()
+    app.onError((error, c) => {
+      expect(error).toBeInstanceOf(HTTPException)
+      expect(error.cause).toEqual({
+        issues: [
+          { slot: 'param', issues },
+          { slot: 'query', issues },
+        ],
+      })
+      return error instanceof HTTPException ? error.getResponse() : c.text('error', 500)
+    })
+    app.get(
+      '/:id',
+      defineHandler({ query: schema, param: schema })(() => {
+        throw new Error('skipped')
+      })
+    )
+    const res = await app.request('/secret')
+    expect(res.status).toBe(400)
+    expect(await res.json()).toEqual({
+      error: 'Validation failed',
+      issues: ['param', 'query'].map((slot) => ({
+        slot,
+        issues: [{ message: 'Invalid', path: 'nested.0' }],
+      })),
+    })
+  })
+
+  it('handles response schema transformations, failures and bypasses', async () => {
+    const { defineHandler } = await import('./index')
+    const schema = {
+      '~standard': {
+        version: 1 as const,
+        vendor: 'test',
+        types: undefined as { input: string; output: { length: number } } | undefined,
+        validate: async (value: unknown) =>
+          value === 'fail'
+            ? { issues: [{ message: 'secret' }] }
+            : { value: { length: String(value).length } },
+      },
+    }
+    const app = new Hono()
+    app.get(
+      '/ok',
+      defineHandler({ response: schema })(async () => 'hello')
+    )
+    app.get(
+      '/fail',
+      defineHandler({ response: schema })(() => 'fail')
+    )
+    app.get(
+      '/raw',
+      defineHandler({ response: schema })(() => new Response('raw'))
+    )
+    expect(await (await app.request('/ok')).json()).toEqual({ length: 5 })
+    const failure = await app.request('/fail')
+    expect(failure.status).toBe(500)
+    expect(await failure.json()).toEqual({ error: 'Response validation failed' })
+    expect(await (await app.request('/raw')).text()).toBe('raw')
+    // @ts-expect-error The response must match the schema input.
+    defineHandler({ response: schema })(() => 12)
+  })
+
+  it('preserves validator parsing and short circuits', async () => {
+    const { defineHandler, defineMiddleware } = await import('./index')
+    const app = new Hono()
+    app.post(
+      '/json',
+      defineHandler({ json: (value) => value })((_c, input) => input.json)
+    )
+    app.get(
+      '/validation',
+      defineHandler({ query: () => new Response('stop', { status: 403 }) })(() => 'unreachable')
+    )
+    app.get(
+      '/middleware',
+      defineHandler(
+        defineMiddleware(async () => new Response('stop')),
+        () => 'unreachable'
+      )
+    )
+    const res = await app.request('/json', {
+      method: 'POST',
+      headers: { 'Content-Type': 'application/json' },
+      body: '{',
+    })
+    expect(res.status).toBe(400)
+    expect(await res.text()).toBe('Malformed JSON in request body')
+    expect((await app.request('/validation')).status).toBe(403)
+    expect(await (await app.request('/middleware')).text()).toBe('stop')
+  })
+
+  it('supports factory defaults and RPC inference', async () => {
+    const { defineHandler, defineMiddleware } = await import('./index')
+    type E = { Variables: { name: string } }
+    const factory = createFactory<E, '/me/:id'>()
+    factory.defineHandler((c) => {
+      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
+      expectTypeOf(c.req.param('id')).toEqualTypeOf<string>()
+      return { ok: true }
+    })
+    defineHandler<E, '/me/:id'>((c) => {
+      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
+      return c.req.param('id')
+    })
+    expect(factory.defineMiddleware).toBe(factory.createMiddleware)
+    expect(defineMiddleware).toBe(createMiddleware)
+    const route = new Hono().get(
+      '/',
+      defineHandler(() => ({ name: 'Ada' }))
+    )
+    const client = hc<typeof route>('http://localhost')
+    type Res = Awaited<ReturnType<typeof client.index.$get>>
+    expectTypeOf<Awaited<ReturnType<Res['json']>>>().toEqualTypeOf<{ name: string }>()
+  })
+})
+
+it('reads every request target in order and renders escaped HTML', async () => {
+  const { defineHandler } = await import('./index')
+  const { html } = await import('../html')
+  const { jsx } = await import('../../jsx')
+  const slots: string[] = []
+  const options = Object.fromEntries(
+    ['param', 'query', 'header', 'cookie', 'form', 'json'].map((slot) => [
+      slot,
+      (value: unknown) => {
+        slots.push(slot)
+        return value
+      },
+    ])
+  )
+  const app = new Hono()
+  app.post(
+    '/:id',
+    defineHandler(options)((_c, input) => input)
+  )
+  app.get(
+    '/html',
+    defineHandler(() => html`<b>hello</b>`)
+  )
+  app.get(
+    '/jsx',
+    defineHandler(() => jsx('b', {}, 'hello'))
+  )
+  const res = await app.request('/123?q=1&q=2', {
+    method: 'POST',
+    headers: { cookie: 'name=Ada', 'Content-Type': 'application/x-www-form-urlencoded' },
+    body: 'x=1&x=2',
+  })
+  expect(slots).toEqual(['param', 'query', 'header', 'cookie', 'form', 'json'])
+  expect(await res.json()).toMatchObject({
+    param: { id: '123' },
+    query: { q: ['1', '2'] },
+    cookie: { name: 'Ada' },
+    form: { x: ['1', '2'] },
+    json: {},
+  })
+  expect(await (await app.request('/html')).text()).toBe('<b>hello</b>')
+  expect(await (await app.request('/jsx')).text()).toBe('<b>hello</b>')
+})
diff --git a/src/helper/factory/index.ts b/src/helper/factory/index.ts
index 8f88777..a9d2104 100644
--- a/src/helper/factory/index.ts
+++ b/src/helper/factory/index.ts
@@ -4,6 +4,11 @@
  */
 
 /* eslint-disable @typescript-eslint/no-explicit-any */
+import { defineHandler } from './define-handler'
+import type { DefineHandler } from './define-handler'
+export { defineHandler } from './define-handler'
+export type { StandardSchema, ValidationIssue, ValidationFailure } from './define-handler'
+
 import { Hono } from '../../hono'
 import type { HonoOptions } from '../../hono-base'
 import type {
@@ -350,10 +355,17 @@ export class Factory<E extends Env = Env, P extends string = string> {
     return app
   }
 
-  createMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
+  /** Defines middleware. @experimental */
+  defineMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
     middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
   ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
 
+  /** @deprecated Use defineMiddleware instead. */
+  createMiddleware = this.defineMiddleware
+
+  /** Defines a validated handler. @experimental */
+  defineHandler: DefineHandler<E, P> = defineHandler as unknown as DefineHandler<E, P>
+
   createHandlers: CreateHandlersInterface<E, P> = (...handlers: any) => {
     // @ts-expect-error this should not be typed
     return handlers.filter((handler) => handler !== undefined)
@@ -365,7 +377,8 @@ export const createFactory = <E extends Env = Env, P extends string = string>(in
   defaultAppOptions?: HonoOptions<E>
 }): Factory<E, P> => new Factory<E, P>(init)
 
-export const createMiddleware = <
+/** Defines middleware. @experimental */
+export const defineMiddleware = <
   E extends Env = any,
   P extends string = string,
   I extends Input = {},
@@ -373,3 +386,6 @@ export const createMiddleware = <
 >(
   middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
 ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
+
+/** @deprecated Use defineMiddleware instead. */
+export const createMiddleware = defineMiddleware
```

</details>

<details><summary>reply</summary>

I’ll check the factory and validator code, add the helper without changing Hono’s core, then run the build and focused tests.

The helper now uses `validator()` to read requests, preserving its body parsing and malformed JSON behavior. The middleware chain lives entirely in the helper. I’m checking runtime behavior and type inference next.

The type checks and runtime tests cover response conversion, validation failures, middleware order, factory defaults, and JSON RPC inference. One test failed because it registered routes after the router had been built; I’ve corrected the test setup. I’m adding coverage for the remaining request targets and HTML values before the final checks.

Added experimental `defineHandler`, validation types, factory defaults, and `defineMiddleware` with deprecated `createMiddleware` aliases. Hono’s core is unchanged.

TypeScript build and type checks passed; all 80 factory and validator tests passed.

Not run: full repository suite or runtime-specific tests. No dependencies added.

</details>

### codex, all: pass

Files: [src/helper/factory/define-handler.test.tsx](../all/codex/ts-hono-define-handler-1/files/src/helper/factory/define-handler.test.tsx), [src/helper/factory/define-handler.ts](../all/codex/ts-hono-define-handler-1/files/src/helper/factory/define-handler.ts), [src/helper/factory/index.ts](../all/codex/ts-hono-define-handler-1/files/src/helper/factory/index.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/helper/factory/define-handler.test.tsx b/src/helper/factory/define-handler.test.tsx
new file mode 100644
index 0000000..dbaf2b1
--- /dev/null
+++ b/src/helper/factory/define-handler.test.tsx
@@ -0,0 +1,279 @@
+import { expectTypeOf } from 'vitest'
+import { hc } from '../../client'
+import { Hono } from '../../hono'
+import { HTTPException } from '../../http-exception'
+import { html } from '../html'
+import { createFactory, createMiddleware, defineHandler, defineMiddleware } from './index'
+import type { StandardSchema } from './index'
+
+/** Create a schema with configurable validation. */
+function schema<I, O>(
+  validate: StandardSchema<I, O>['~standard']['validate']
+): StandardSchema<I, O> {
+  return { '~standard': { version: 1, vendor: 'test', validate } }
+}
+
+describe('defineHandler', () => {
+  it('returns schema-transformed strings as JSON and combines middleware environments', async () => {
+    const a = defineMiddleware<{ Variables: { a: string } }>(async (c, next) => {
+      c.set('a', 'a')
+      await next()
+    })
+    const b = defineMiddleware<{ Variables: { b: number } }>(async (c, next) => {
+      c.set('b', 2)
+      await next()
+    })
+    const handler = defineHandler({
+      response: schema<string, string>((value) => ({ value: String(value).toUpperCase() })),
+    })(a, b, (c) => {
+      expectTypeOf(c.get('a')).toEqualTypeOf<string>()
+      expectTypeOf(c.get('b')).toEqualTypeOf<number>()
+      return c.get('a') + c.get('b')
+    })
+    const res = await new Hono().get('/', handler).request('/')
+    expect(res.headers.get('content-type')).toBe('application/json')
+    expect(await res.json()).toBe('A2')
+    const many = defineHandler(a, b, a, b, a, (c) => ({ a: c.get('a') }))
+    expect(await (await new Hono().get('/', many).request('/')).json()).toEqual({ a: 'a' })
+  })
+
+  it('converts synchronous and asynchronous values', async () => {
+    const response = new Response('unchanged', { status: 202 })
+    const cases = [
+      [{ hello: 'world' }, 200, '{"hello":"world"}', 'application/json'],
+      ['<p>Hello</p>', 200, '<p>Hello</p>', 'text/html'],
+      [html`<b>Hello</b>`, 200, '<b>Hello</b>', 'text/html'],
+      [<span>Hello</span>, 200, '<span>Hello</span>', 'text/html'],
+      [null, 204, '', null],
+      [undefined, 204, '', null],
+      [response, 202, 'unchanged', 'text/plain'],
+    ] as const
+    for (const [value, status, body, contentType] of cases) {
+      for (const async of [false, true]) {
+        const app = new Hono().get(
+          '/',
+          defineHandler(() => (async ? Promise.resolve(value) : value))
+        )
+        const res = await app.request('/')
+        expect(res.status).toBe(status)
+        expect(await res.clone().text()).toBe(body)
+        if (contentType) expect(res.headers.get('content-type')).toContain(contentType)
+        else expect(res.body).toBeNull()
+      }
+    }
+  })
+
+  it('runs middleware around validation and handler, preserving status and headers', async () => {
+    const order: string[] = []
+    const mw = defineMiddleware<{ Variables: { user: string } }>(async (c, next) => {
+      order.push('before')
+      c.set('user', 'Alice')
+      await next()
+      order.push('after')
+      c.header('x-after', 'yes')
+    })
+    const options = {
+      query: (value: Record<string, string | string[]>) => {
+        order.push('query')
+        return { name: value.name }
+      },
+      response: schema<{ name: string }, { greeting: string }>((value) => {
+        order.push('response')
+        return { value: { greeting: (value as { name: string }).name } }
+      }),
+    }
+    const handler = defineHandler(options)(mw, (c, input) => {
+      expectTypeOf(c.get('user')).toEqualTypeOf<string>()
+      expectTypeOf(input.query.name).toEqualTypeOf<string | string[]>()
+      expect(c.req.valid('query')).toEqual(input.query)
+      order.push('handler')
+      c.status(201)
+      c.header('x-handler', 'yes')
+      return { name: c.get('user') }
+    })
+    expect(handler.validations).toBe(options)
+    const res = await new Hono().get('/', handler).request('/?name=test')
+    expect(res.status).toBe(201)
+    expect(res.headers.get('x-handler')).toBe('yes')
+    expect(res.headers.get('x-after')).toBe('yes')
+    expect(await res.json()).toEqual({ greeting: 'Alice' })
+    expect(order).toEqual(['before', 'query', 'handler', 'response', 'after'])
+  })
+
+  it('short circuits middleware, request functions and handler responses', async () => {
+    const handler = vi.fn(() => ({ ok: true }))
+    const response = new Response('stop', { status: 403 })
+    const app = new Hono()
+      .get(
+        '/middleware',
+        defineHandler(
+          defineMiddleware(async () => response),
+          handler
+        )
+      )
+      .get('/request', defineHandler({ query: async () => response })(handler))
+      .get(
+        '/response',
+        defineHandler({
+          response: () => {
+            throw new Error('must skip')
+          },
+        })(() => response)
+      )
+    for (const path of ['/middleware', '/request', '/response']) {
+      expect(await app.request(path)).toBe(response)
+    }
+    expect(handler).not.toHaveBeenCalled()
+  })
+
+  it('validates all slots in order and exposes only sanitized request issues', async () => {
+    const order: string[] = []
+    const raw = [
+      { message: 'bad', path: [{ key: 'user' }, 'name', 0], input: 'secret' },
+      { message: 'missing' },
+    ]
+    const options = Object.fromEntries(
+      ['param', 'query', 'header', 'cookie', 'form', 'json'].map((slot) => [
+        slot,
+        schema(async () => {
+          order.push(slot)
+          return { issues: raw }
+        }),
+      ])
+    )
+    let caught: unknown
+    const app = new Hono()
+    app.onError((error) => {
+      caught = error
+      return (error as HTTPException).getResponse()
+    })
+    app.post(
+      '/:id',
+      defineHandler(options)(() => {
+        throw new Error('must skip')
+      })
+    )
+    const res = await app.request('/abc')
+    expect(res.status).toBe(404)
+    const failed = await app.request('/abc', { method: 'POST' })
+    expect(failed.status).toBe(400)
+    expect(order).toEqual(['param', 'query', 'header', 'cookie', 'form', 'json'])
+    expect(await failed.json()).toEqual({
+      error: 'Validation failed',
+      issues: order.map((slot) => ({
+        slot,
+        issues: [{ message: 'bad', path: 'user.name.0' }, { message: 'missing' }],
+      })),
+    })
+    expect(caught).toBeInstanceOf(HTTPException)
+    expect((caught as HTTPException).cause).toEqual({
+      issues: order.map((slot) => ({ slot, issues: raw })),
+    })
+  })
+
+  it('hides response issues but retains their cause', async () => {
+    const issues = [{ message: 'private' }]
+    const app = new Hono()
+    app.onError((error) => {
+      expect((error as HTTPException).cause).toEqual({ issues: [{ slot: 'response', issues }] })
+      return (error as HTTPException).getResponse()
+    })
+    app.get(
+      '/',
+      defineHandler({ response: schema(() => ({ issues })) })(() => 'secret')
+    )
+    const res = await app.request('/')
+    expect(res.status).toBe(500)
+    expect(await res.json()).toEqual({ error: 'Response validation failed' })
+  })
+
+  it('uses validator request parsing and supports callable schemas', async () => {
+    const callable = Object.assign(
+      () => {},
+      schema<unknown, string>((value) => ({ value: String(value) }))
+    )
+    const app = new Hono().post(
+      '/:id',
+      defineHandler({
+        param: (value) => value,
+        query: (value) => value,
+        header: (value) => value['x-test'],
+        cookie: (value) => value.token,
+        json: callable,
+      })((c, input) => {
+        expect(c.req.valid('header')).toBe('ok')
+        return input
+      })
+    )
+    const res = await app.request('/42?q=1&q=2', {
+      method: 'POST',
+      headers: { 'content-type': 'application/json', 'x-test': 'ok', cookie: 'token=abc' },
+      body: '3',
+    })
+    expect(await res.json()).toEqual({
+      param: { id: '42' },
+      query: { q: ['1', '2'] },
+      header: 'ok',
+      cookie: 'abc',
+      json: '3',
+    })
+    const malformed = await app.request('/42', {
+      method: 'POST',
+      headers: { 'content-type': 'application/json' },
+      body: '{',
+    })
+    expect(malformed.status).toBe(400)
+    expect(await malformed.text()).toBe('Malformed JSON in request body')
+  })
+
+  it('supports form parsing and async function transforms', async () => {
+    const app = new Hono().post(
+      '/',
+      defineHandler({
+        form: async (value) => ({ name: String(value.name).toUpperCase() }),
+        response: async (value: { name: string }) => ({ result: value.name }),
+      })((_c, input) => input.form)
+    )
+    const res = await app.request('/', {
+      method: 'POST',
+      headers: { 'content-type': 'application/x-www-form-urlencoded' },
+      body: 'name=alice',
+    })
+    expect(await res.json()).toEqual({ result: 'ALICE' })
+  })
+
+  it('inherits factory and explicit environment and path types and RPC outputs', async () => {
+    type E = { Variables: { name: string } }
+    const factory = createFactory<E, '/me/:id'>()
+    expect(createMiddleware).toBe(defineMiddleware)
+    expect(factory.createMiddleware).toBe(factory.defineMiddleware)
+    factory.defineHandler((c) => {
+      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
+      expectTypeOf(c.req.param('id')).toEqualTypeOf<string>()
+      return { ok: true }
+    })
+    defineHandler<E, '/me/:id'>((c) => {
+      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
+      expectTypeOf(c.req.param('id')).toEqualTypeOf<string>()
+      return { ok: true }
+    })
+    const app = new Hono()
+      .get(
+        '/plain',
+        defineHandler(() => ({ name: 'Alice' }))
+      )
+      .get(
+        '/schema',
+        defineHandler({
+          response: schema<{ name: string }, { count: number }>(() => ({ value: { count: 1 } })),
+        })(() => ({ name: 'Alice' }))
+      )
+    // @ts-expect-error Response schema input must match the handler result.
+    defineHandler({ response: schema<string, number>(() => ({ value: 1 })) })(() => 42)
+    const client = hc<typeof app>('http://localhost', {
+      fetch: (input: RequestInfo | URL, init?: RequestInit) => app.request(input, init),
+    })
+    expectTypeOf(await (await client.plain.$get()).json()).toEqualTypeOf<{ name: string }>()
+    expectTypeOf(await (await client.schema.$get()).json()).toEqualTypeOf<{ count: number }>()
+  })
+})
diff --git a/src/helper/factory/define-handler.ts b/src/helper/factory/define-handler.ts
new file mode 100644
index 0000000..f618897
--- /dev/null
+++ b/src/helper/factory/define-handler.ts
@@ -0,0 +1,286 @@
+/* eslint-disable @typescript-eslint/no-explicit-any */
+import type { Context } from '../../context'
+import { HTTPException } from '../../http-exception'
+import type {
+  Env,
+  Handler,
+  IntersectNonAnyTypes,
+  MiddlewareHandler,
+  TypedResponse,
+  ValidationTargets,
+} from '../../types'
+import type { JSONParsed } from '../../utils/types'
+import { validator } from '../../validator'
+
+/** A Standard Schema validation issue. @experimental */
+export interface ValidationIssue {
+  readonly message: string
+  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
+}
+
+/** Raw validation failures, grouped by target. @experimental */
+export interface ValidationFailure {
+  issues: { slot: keyof ValidationTargets | 'response'; issues: readonly ValidationIssue[] }[]
+}
+
+/** A dependency-free Standard Schema contract. @experimental */
+export interface StandardSchema<Input = unknown, Output = Input> {
+  readonly '~standard': {
+    readonly version: 1
+    readonly vendor: string
+    readonly validate: (
+      value: unknown
+    ) =>
+      | { value: Output; issues?: undefined }
+      | { issues: readonly ValidationIssue[] }
+      | Promise<{ value: Output; issues?: undefined } | { issues: readonly ValidationIssue[] }>
+    readonly types?: { readonly input: Input; readonly output: Output }
+  }
+}
+
+type MiddlewareEnv<M extends MiddlewareHandler<any, any>[]> = IntersectNonAnyTypes<{
+  [K in keyof M]: M[K] extends MiddlewareHandler<infer E, any> ? E : never
+}> &
+  Env
+type Validation<E extends Env, T> = StandardSchema<any, any> | ((value: T, c: Context<E>) => any)
+type Options<E extends Env> = {
+  [K in keyof ValidationTargets]?: Validation<E, ValidationTargets[K]>
+} & { response?: Validation<E, any> }
+type Output<V> =
+  V extends StandardSchema<any, infer O>
+    ? O
+    : V extends (...args: any[]) => infer O
+      ? Exclude<Awaited<O>, Response>
+      : never
+type SchemaInput<V> =
+  V extends StandardSchema<infer I, any>
+    ? I
+    : V extends (value: infer I, ...args: any[]) => any
+      ? I
+      : never
+type RequestInput<O> = { [K in keyof O & keyof ValidationTargets]: Output<O[K]> }
+type Input<O> = {
+  in: { [K in keyof O & keyof ValidationTargets]: SchemaInput<O[K]> }
+  out: RequestInput<O>
+}
+type Result<R> = R extends TypedResponse
+  ? R
+  : R extends Response
+    ? R
+    : R extends null | undefined
+      ? TypedResponse<null, 204, 'body'>
+      : R extends string
+        ? TypedResponse<string, 200, 'html'>
+        : TypedResponse<JSONParsed<R>, 200, 'json'>
+type Return<O, R> = 'response' extends keyof O
+  ? TypedResponse<JSONParsed<Output<O['response']>>, 200, 'json'>
+  : Result<Awaited<R>>
+type Callback<E extends Env, P extends string, O, R> = (
+  c: Context<E, P, Input<O>>,
+  input: RequestInput<O>
+) => R
+type Allowed<O> = 'response' extends keyof O
+  ? SchemaInput<O['response']> | Response | Promise<SchemaInput<O['response']> | Response>
+  : unknown
+
+/** Define a validated handler using environment and path defaults. @experimental */
+export interface DefineHandler<E extends Env = Env, P extends string = string> {
+  <E2 extends Env = E, P2 extends string = P, O extends Options<E2> = Options<E2>>(
+    options: O
+  ): WithOptions<E2, P2, O>
+  <E2 extends Env = E, P2 extends string = P, R = any>(
+    handler: Callback<E2, P2, {}, R>
+  ): Handler<E2, P2, {}, Promise<Result<Awaited<R>>>>
+  <E1 extends Env = E, P2 extends string = P, R = any>(
+    mw1: MiddlewareHandler<E1, P2>,
+    handler: Callback<E & E1, P2, {}, R>
+  ): Handler<E & E1, P2, {}, Promise<Result<Awaited<R>>>>
+  <E1 extends Env = E, E2 extends Env = E, P2 extends string = P, R = any>(
+    mw1: MiddlewareHandler<E1, P2>,
+    mw2: MiddlewareHandler<E2, P2>,
+    handler: Callback<E & E1 & E2, P2, {}, R>
+  ): Handler<E & E1 & E2, P2, {}, Promise<Result<Awaited<R>>>>
+  <E1 extends Env = E, E2 extends Env = E, E3 extends Env = E, P2 extends string = P, R = any>(
+    mw1: MiddlewareHandler<E1, P2>,
+    mw2: MiddlewareHandler<E2, P2>,
+    mw3: MiddlewareHandler<E3, P2>,
+    handler: Callback<E & E1 & E2 & E3, P2, {}, R>
+  ): Handler<E & E1 & E2 & E3, P2, {}, Promise<Result<Awaited<R>>>>
+  <
+    E1 extends Env = E,
+    E2 extends Env = E,
+    E3 extends Env = E,
+    E4 extends Env = E,
+    P2 extends string = P,
+    R = any,
+  >(
+    mw1: MiddlewareHandler<E1, P2>,
+    mw2: MiddlewareHandler<E2, P2>,
+    mw3: MiddlewareHandler<E3, P2>,
+    mw4: MiddlewareHandler<E4, P2>,
+    handler: Callback<E & E1 & E2 & E3 & E4, P2, {}, R>
+  ): Handler<E & E1 & E2 & E3 & E4, P2, {}, Promise<Result<Awaited<R>>>>
+  <
+    E2 extends Env = E,
+    P2 extends string = P,
+    M extends MiddlewareHandler<any, P2>[] = MiddlewareHandler<any, P2>[],
+    R = any,
+  >(
+    ...handlers: [...M, Callback<E2 & MiddlewareEnv<M>, P2, {}, R>]
+  ): Handler<E2 & MiddlewareEnv<M>, P2, {}, Promise<Result<Awaited<R>>>>
+}
+
+/** Bind validation options to a handler. @experimental */
+export interface WithOptions<E extends Env, P extends string, O> {
+  <R extends Allowed<O>>(
+    handler: Callback<E, P, O, R>
+  ): Handler<E, P, Input<O>, Promise<Return<O, R>>> & { validations: O }
+  <E1 extends Env, R extends Allowed<O>>(
+    mw1: MiddlewareHandler<E1, P>,
+    handler: Callback<E & E1, P, O, R>
+  ): Handler<E & E1, P, Input<O>, Promise<Return<O, R>>> & { validations: O }
+  <E1 extends Env, E2 extends Env, R extends Allowed<O>>(
+    mw1: MiddlewareHandler<E1, P>,
+    mw2: MiddlewareHandler<E2, P>,
+    handler: Callback<E & E1 & E2, P, O, R>
+  ): Handler<E & E1 & E2, P, Input<O>, Promise<Return<O, R>>> & { validations: O }
+  <E1 extends Env, E2 extends Env, E3 extends Env, R extends Allowed<O>>(
+    mw1: MiddlewareHandler<E1, P>,
+    mw2: MiddlewareHandler<E2, P>,
+    mw3: MiddlewareHandler<E3, P>,
+    handler: Callback<E & E1 & E2 & E3, P, O, R>
+  ): Handler<E & E1 & E2 & E3, P, Input<O>, Promise<Return<O, R>>> & { validations: O }
+  <E1 extends Env, E2 extends Env, E3 extends Env, E4 extends Env, R extends Allowed<O>>(
+    mw1: MiddlewareHandler<E1, P>,
+    mw2: MiddlewareHandler<E2, P>,
+    mw3: MiddlewareHandler<E3, P>,
+    mw4: MiddlewareHandler<E4, P>,
+    handler: Callback<E & E1 & E2 & E3 & E4, P, O, R>
+  ): Handler<E & E1 & E2 & E3 & E4, P, Input<O>, Promise<Return<O, R>>> & { validations: O }
+  <M extends MiddlewareHandler<any, P>[], R extends Allowed<O>>(
+    ...handlers: [...M, Callback<E & MiddlewareEnv<M>, P, O, R>]
+  ): Handler<E & MiddlewareEnv<M>, P, Input<O>, Promise<Return<O, R>>> & { validations: O }
+}
+
+const targets = ['param', 'query', 'header', 'cookie', 'form', 'json'] as const
+
+/** Run a schema or validation function and retain raw issues. */
+async function validate(
+  validation: Validation<any, any>,
+  value: unknown,
+  c: Context,
+  slot: keyof ValidationTargets | 'response',
+  failures: ValidationFailure
+): Promise<unknown> {
+  if ('~standard' in validation) {
+    const result = await validation['~standard'].validate(value)
+    if (result.issues) {
+      failures.issues.push({ slot, issues: result.issues })
+      return undefined
+    }
+    return result.value
+  }
+  return validation(value, c)
+}
+
+/** Construct a validation exception without exposing input values. */
+function failure(c: Context, failures: ValidationFailure, response = false): HTTPException {
+  const status = response ? 500 : 400
+  const error = response ? 'Response validation failed' : 'Validation failed'
+  const issues = failures.issues.map(({ slot, issues }) => ({
+    slot,
+    issues: issues.map(({ message, path }) => ({
+      message,
+      ...(path?.length
+        ? {
+            path: path
+              .map((item) => (typeof item === 'object' ? item.key : item))
+              .map(String)
+              .join('.'),
+          }
+        : {}),
+    })),
+  }))
+  return new HTTPException(status, {
+    message: error,
+    res: c.json(response ? { error } : { error, issues }, status),
+    cause: failures,
+  })
+}
+
+/** Compose middleware around request validation and response conversion. */
+function build(options: Options<any>, handlers: any[]): any {
+  const handler = handlers[handlers.length - 1]
+  const middleware = handlers.slice(0, -1)
+  return Object.assign(
+    async (c: Context) => {
+      let index = -1
+      /** Dispatch middleware without changing the request's route index. */
+      async function dispatch(i: number): Promise<void> {
+        if (i <= index) {
+          throw new Error('next() called multiple times')
+        }
+        index = i
+        if (i < middleware.length) {
+          const response = await middleware[i](c, () => dispatch(i + 1))
+          if (response instanceof Response) {
+            c.res = response
+          }
+          return
+        }
+        const input: Record<string, unknown> = {}
+        const failures: ValidationFailure = { issues: [] }
+        for (const slot of targets) {
+          const validation = options[slot]
+          if (validation) {
+            const response: unknown = await validator(slot, async (value, context) => {
+              const result = await validate(validation, value, context, slot, failures)
+              input[slot] = result
+              return result
+            })(c, async () => {})
+            if (response instanceof Response) {
+              c.res = response
+              return
+            }
+          }
+        }
+        if (failures.issues.length) {
+          throw failure(c, failures)
+        }
+        let value = await handler(c, input)
+        if (value instanceof Response) {
+          c.res = value
+          return
+        }
+        if (options.response) {
+          value = await validate(options.response, value, c, 'response', failures)
+          if (failures.issues.length) {
+            throw failure(c, failures, true)
+          }
+          c.res = value instanceof Response ? value : c.json(value)
+        } else if (value == null) {
+          c.res = c.body(null, 204)
+        } else if (
+          typeof value === 'string' ||
+          value.isEscaped ||
+          typeof value.toHTML === 'function'
+        ) {
+          c.res = await c.html(typeof value.toHTML === 'function' ? value.toHTML() : value)
+        } else {
+          c.res = c.json(value)
+        }
+      }
+      await dispatch(0)
+      return c.res
+    },
+    { validations: options }
+  )
+}
+
+/** Define a handler with automatic response conversion and optional validation. @experimental */
+export const defineHandler: DefineHandler = ((...args: any[]) => {
+  if (typeof args[0] === 'object' && args[0] !== null) {
+    return (...handlers: any[]) => build(args[0], handlers)
+  }
+  return build({}, args)
+}) as DefineHandler
diff --git a/src/helper/factory/index.ts b/src/helper/factory/index.ts
index 8f88777..44d84aa 100644
--- a/src/helper/factory/index.ts
+++ b/src/helper/factory/index.ts
@@ -14,6 +14,10 @@ import type {
   IntersectNonAnyTypes,
   MiddlewareHandler,
 } from '../../types'
+import { defineHandler } from './define-handler'
+import type { DefineHandler } from './define-handler'
+export { defineHandler } from './define-handler'
+export type { StandardSchema, ValidationIssue, ValidationFailure } from './define-handler'
 
 type InitApp<E extends Env = Env> = (app: Hono<E>) => void
 
@@ -350,10 +354,17 @@ export class Factory<E extends Env = Env, P extends string = string> {
     return app
   }
 
-  createMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
+  /** Define middleware. @experimental */
+  defineMiddleware = <I extends Input = {}, R extends HandlerResponse<any> | void = void>(
     middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
   ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
 
+  /** @deprecated Use defineMiddleware instead. */
+  createMiddleware = this.defineMiddleware
+
+  /** Define a handler with factory environment and path defaults. @experimental */
+  defineHandler: DefineHandler<E, P> = defineHandler as DefineHandler<E, P>
+
   createHandlers: CreateHandlersInterface<E, P> = (...handlers: any) => {
     // @ts-expect-error this should not be typed
     return handlers.filter((handler) => handler !== undefined)
@@ -365,7 +376,8 @@ export const createFactory = <E extends Env = Env, P extends string = string>(in
   defaultAppOptions?: HonoOptions<E>
 }): Factory<E, P> => new Factory<E, P>(init)
 
-export const createMiddleware = <
+/** Define middleware. @experimental */
+export const defineMiddleware = <
   E extends Env = any,
   P extends string = string,
   I extends Input = {},
@@ -373,3 +385,6 @@ export const createMiddleware = <
 >(
   middleware: MiddlewareHandler<E, P, I, R extends void ? Response : R>
 ): MiddlewareHandler<E, P, I, R extends void ? Response : R> => middleware
+
+/** @deprecated Use defineMiddleware instead. */
+export const createMiddleware = defineMiddleware
```

</details>

<details><summary>reply</summary>

Done.
Added experimental handler validation, middleware alias, factory methods, exports. Build, type checks, package checks, 96 tests passed; full suite not run.

</details>
