/**
 * @module
 * `defineHandler()` for Hono: defines a handler together with its request and response validation.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context } from '../../context'
import { HTTPException } from '../../http-exception'
import type {
  Env,
  Handler,
  Input,
  IntersectNonAnyTypes,
  MiddlewareHandler,
  TypedResponse,
  ValidationTargets,
} from '../../types'
import type { ContentfulStatusCode } from '../../utils/http-status'
import type { JSONParsed } from '../../utils/types'
import { validator } from '../../validator'

////////////////////////////////////////
//////                            //////
//////      Standard Schema       //////
//////                            //////
////////////////////////////////////////

type PathSegment = PropertyKey | { readonly key: PropertyKey }

type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<ValidationIssue> }

/**
 * A [Standard Schema](https://standardschema.dev). Objects and callables that carry `~standard`
 * are accepted, so zod, valibot, ArkType and similar libraries work without a dependency.
 *
 * @experimental
 */
export type StandardSchema<Input = unknown, Output = Input> = {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown,
      ...rest: any[]
    ) => StandardResult<Output> | Promise<StandardResult<Output>>
    readonly types?: { readonly input: Input; readonly output: Output } | undefined
  }
}

/**
 * An issue reported by a Standard Schema.
 *
 * @experimental
 */
export type ValidationIssue = {
  readonly message: string
  readonly path?: ReadonlyArray<PathSegment> | undefined
}

/**
 * The issues of one failed validation. `slot` is the request target, or `'response'`.
 * Available as `exception.cause.issues` of the `HTTPException` thrown on failure.
 *
 * @experimental
 */
export type ValidationFailure = {
  slot: string
  issues: ReadonlyArray<ValidationIssue>
}

////////////////////////////////////////
//////                            //////
//////           Types            //////
//////                            //////
////////////////////////////////////////

type Target = 'param' | 'query' | 'header' | 'cookie' | 'form' | 'json'
const TARGETS: readonly Target[] = ['param', 'query', 'header', 'cookie', 'form', 'json']

type MaybePromise<T> = T | Promise<T>

type ValidationFunction<T extends Target, E extends Env, P extends string> = (
  value: ValidationTargets[T],
  c: Context<E, P>
) => unknown

/**
 * Options of `defineHandler()`. A request target is validated by a Standard Schema or by a
 * function `(value, c) => newValue`; a function may return a `Response` to skip the handler.
 *
 * @experimental
 */
export type DefineHandlerOptions<E extends Env = any, P extends string = string> = {
  [T in Target]?: StandardSchema<any, any> | ValidationFunction<T, E, P>
} & {
  response?: StandardSchema<any, any>
}

type ValidatedValue<T> =
  T extends StandardSchema<any, infer O>
    ? O
    : T extends (...args: any[]) => infer R
      ? Exclude<Awaited<R>, Response | TypedResponse<any, any, any>>
      : never

type SchemaInput<T> =
  T extends StandardSchema<infer I, any>
    ? I
    : T extends (...args: any[]) => any
      ? ValidatedValue<T>
      : never

type PresentTargets<V> = {
  [T in Target]: T extends keyof V ? (undefined extends V[T] ? never : T) : never
}[Target]

/** The validated value per request target. */
export type ValidatedInput<V> = { [T in PresentTargets<V>]: ValidatedValue<V[T & keyof V]> }

type OptionsInput<V> = {
  in: { [T in PresentTargets<V>]: SchemaInput<V[T & keyof V]> }
  out: { [T in PresentTargets<V>]: ValidatedValue<V[T & keyof V]> }
}

type ResponseInputOf<V> = V extends { response: StandardSchema<infer I, any> } ? I : never
type ResponseOutputOf<V> = V extends { response: StandardSchema<any, infer O> } ? O : never
type HasResponse<V> = V extends { response: StandardSchema<any, any> } ? true : false

type HtmlLike = string | { isEscaped: true }

type ToResponse<R> =
  Awaited<R> extends infer X
    ? X extends TypedResponse<any, any, any>
      ? X
      : X extends Response
        ? X
        : X extends null | undefined | void
          ? TypedResponse<null, 204, 'body'>
          : X extends HtmlLike
            ? TypedResponse<string, ContentfulStatusCode, 'html'>
            : TypedResponse<JSONParsed<X>, ContentfulStatusCode, 'json'>
    : never

type ToValidatedResponse<V, R> =
  | TypedResponse<JSONParsed<ResponseOutputOf<V>>, ContentfulStatusCode, 'json'>
  | Extract<Awaited<R>, Response>

type ResultOf<V, R> = HasResponse<V> extends true ? ToValidatedResponse<V, R> : ToResponse<R>

type ReturnConstraint<V> =
  HasResponse<V> extends true ? MaybePromise<ResponseInputOf<V> | Response> : unknown

/** The handler of `defineHandler(options)(handler)`. */
type OptionsHandler<E extends Env, P extends string, I extends Input, V, R> = (
  c: Context<E, P, I>,
  input: ValidatedInput<V>
) => R

type Validated<H, V> = H & { validations: V }

/**
 * `defineHandler(...)(...)` with validation options, returned by `defineHandler(options)`.
 *
 * @experimental
 */
export interface DefineHandlerWithOptions<
  V extends DefineHandlerOptions<any, any>,
  E extends Env = any,
  P extends string = string,
> {
  validations: V

  <R extends ReturnConstraint<V>, E2 extends Env = E>(
    handler: OptionsHandler<E2, P, OptionsInput<V>, V, R>
  ): Validated<Handler<E2, P, OptionsInput<V>, Promise<ResultOf<V, R>>>, V>

  <
    I extends Input,
    R extends ReturnConstraint<V>,
    E2 extends Env = E,
    E3 extends Env = IntersectNonAnyTypes<[E, E2]>,
  >(
    middleware1: MiddlewareHandler<E2, P, I, any>,
    handler: OptionsHandler<E3, P, I & OptionsInput<V>, V, R>
  ): Validated<Handler<E3, P, I & OptionsInput<V>, Promise<ResultOf<V, R>>>, V>

  <
    I extends Input,
    R extends ReturnConstraint<V>,
    E2 extends Env = E,
    E3 extends Env = E,
    E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>,
  >(
    middleware1: MiddlewareHandler<E2, P, I, any>,
    middleware2: MiddlewareHandler<E3, P, I, any>,
    handler: OptionsHandler<E4, P, I & OptionsInput<V>, V, R>
  ): Validated<Handler<E4, P, I & OptionsInput<V>, Promise<ResultOf<V, R>>>, V>

  <
    I extends Input,
    R extends ReturnConstraint<V>,
    E2 extends Env = E,
    E3 extends Env = E,
    E4 extends Env = E,
    E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>,
  >(
    middleware1: MiddlewareHandler<E2, P, I, any>,
    middleware2: MiddlewareHandler<E3, P, I, any>,
    middleware3: MiddlewareHandler<E4, P, I, any>,
    handler: OptionsHandler<E5, P, I & OptionsInput<V>, V, R>
  ): Validated<Handler<E5, P, I & OptionsInput<V>, Promise<ResultOf<V, R>>>, V>
}

/**
 * Overloads of `defineHandler` for a given default Env and path (used by `factory.defineHandler`).
 *
 * @experimental
 */
export interface DefineHandlerInterface<E extends Env = any, P extends string = string> {
  // with validation options
  <V extends DefineHandlerOptions<E, P>>(options: V): DefineHandlerWithOptions<V, E, P>

  // handler
  <I extends Input = {}, R = unknown, E2 extends Env = E>(
    handler: (c: Context<E2, P, I>) => R
  ): Handler<E2, P, I, Promise<ToResponse<R>>>

  // middleware x1 + handler
  <
    I extends Input = {},
    R = unknown,
    E2 extends Env = E,
    E3 extends Env = IntersectNonAnyTypes<[E, E2]>,
  >(
    middleware1: MiddlewareHandler<E2, P, I, any>,
    handler: (c: Context<E3, P, I>) => R
  ): Handler<E3, P, I, Promise<ToResponse<R>>>

  // middleware x2 + handler
  <
    I extends Input = {},
    R = unknown,
    E2 extends Env = E,
    E3 extends Env = E,
    E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>,
  >(
    middleware1: MiddlewareHandler<E2, P, I, any>,
    middleware2: MiddlewareHandler<E3, P, I, any>,
    handler: (c: Context<E4, P, I>) => R
  ): Handler<E4, P, I, Promise<ToResponse<R>>>

  // middleware x3 + handler
  <
    I extends Input = {},
    R = unknown,
    E2 extends Env = E,
    E3 extends Env = E,
    E4 extends Env = E,
    E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>,
  >(
    middleware1: MiddlewareHandler<E2, P, I, any>,
    middleware2: MiddlewareHandler<E3, P, I, any>,
    middleware3: MiddlewareHandler<E4, P, I, any>,
    handler: (c: Context<E5, P, I>) => R
  ): Handler<E5, P, I, Promise<ToResponse<R>>>
}

////////////////////////////////////////
//////                            //////
//////          Runtime           //////
//////                            //////
////////////////////////////////////////

const isStandardSchema = (value: unknown): value is StandardSchema<any, any> =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  typeof (value as any)['~standard']?.validate === 'function'

const formatPath = (path: ReadonlyArray<PathSegment>): string =>
  path.map((p) => String(typeof p === 'object' && p !== null ? p.key : p)).join('.')

const throwFailures = (
  status: 400 | 500,
  error: string,
  failures: ValidationFailure[],
  expose: boolean
): never => {
  const body: { error: string; issues?: unknown } = { error }
  if (expose) {
    // Only the message and the path are exposed, never the input value.
    body.issues = failures.map(({ slot, issues }) => ({
      slot,
      issues: issues.map(({ message, path }) =>
        path && path.length > 0 ? { message, path: formatPath(path) } : { message }
      ),
    }))
  }
  throw new HTTPException(status, {
    message: error,
    res: new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
    cause: { issues: failures },
  })
}

const toResponse = (c: Context, value: unknown): Response | Promise<Response> => {
  if (value instanceof Response) {
    return value
  }
  if (value === null || value === undefined) {
    return c.body(null, 204)
  }
  if (typeof value === 'string' || (typeof value === 'object' && (value as any).isEscaped)) {
    return c.html(value as string)
  }
  return c.json(value as any)
}

const validateRequest = async (
  c: Context,
  options: DefineHandlerOptions
): Promise<Response | undefined> => {
  const failures: ValidationFailure[] = []
  for (const slot of TARGETS) {
    const validation = options[slot]
    if (validation === undefined) {
      continue
    }
    let passed = false
    // `validator()` reads the request, so every target is read exactly like it does.
    const res = await validator(slot, async (value: unknown, ctx: Context) => {
      if (isStandardSchema(validation)) {
        const result = await validation['~standard'].validate(value)
        if (result.issues) {
          failures.push({ slot, issues: result.issues })
          return value
        }
        return (result as { value: unknown }).value
      }
      return (validation as ValidationFunction<Target, any, any>)(value as never, ctx)
    })(c, async () => {
      passed = true
    })
    if (!passed) {
      return res as unknown as Response
    }
  }
  if (failures.length > 0) {
    throwFailures(400, 'Validation failed', failures, true)
  }
  return undefined
}

const compose = async (
  c: Context,
  middleware: MiddlewareHandler[],
  last: () => Promise<Response>
): Promise<Response | undefined> => {
  if (middleware.length === 0) {
    return last()
  }
  let index = -1
  const dispatch = async (i: number): Promise<void> => {
    if (i <= index) {
      throw new Error('next() called multiple times')
    }
    index = i
    if (i === middleware.length) {
      c.res = await last()
      return
    }
    const res = await middleware[i](c, () => dispatch(i + 1))
    if (res && !c.finalized) {
      c.res = res
    }
  }
  await dispatch(0)
  return c.finalized ? c.res : undefined
}

const build = (
  options: DefineHandlerOptions | undefined,
  middleware: MiddlewareHandler[],
  handler: (c: Context, input: any) => unknown
) => {
  const core = async (c: Context): Promise<Response> => {
    if (options) {
      const res = await validateRequest(c, options)
      if (res) {
        return res
      }
    }
    const input: Record<string, unknown> = {}
    if (options) {
      for (const slot of TARGETS) {
        if (options[slot] !== undefined) {
          input[slot] = c.req.valid(slot as never)
        }
      }
    }
    const result = await handler(c, input)
    if (result instanceof Response) {
      return result
    }
    if (options?.response) {
      const checked = await options.response['~standard'].validate(result)
      if (checked.issues) {
        throwFailures(
          500,
          'Response validation failed',
          [{ slot: 'response', issues: checked.issues }],
          false
        )
      }
      return c.json((checked as { value: unknown }).value as any)
    }
    return toResponse(c, result)
  }
  const defined = (c: Context) => compose(c, middleware, () => core(c))
  return options ? Object.assign(defined, { validations: options }) : defined
}

/**
 * Defines a handler together with its request and response validation in one place.
 *
 * Without options it converts the returned value to a `Response`: an object becomes JSON, a string,
 * JSX or an `html` template becomes HTML, `null`/`undefined` becomes `204`, and a `Response` is
 * returned as is. Middleware passed before the handler runs around it.
 *
 * With options, each given request target (`param`, `query`, `header`, `cookie`, `form`, `json`) is
 * validated in that order before the handler runs, and the handler receives `(c, input)`. Standard
 * Schema failures throw an `HTTPException` (`400`, or `500` for `response`) that `onError` can handle.
 * The order is: middleware before, request validation, handler, response validation, middleware after.
 *
 * @experimental
 *
 * @example
 * ```ts
 * app.get(
 *   '/posts',
 *   defineHandler({ query: z.object({ page: z.coerce.number() }) })((c, { query }) => {
 *     return { page: query.page }
 *   })
 * )
 * ```
 */
export const defineHandler: {
  // with validation options
  <V extends DefineHandlerOptions<any, string>>(
    options: V
  ): DefineHandlerWithOptions<V, any, string>
  <
    E extends Env,
    P extends string = string,
    V extends DefineHandlerOptions<E, P> = DefineHandlerOptions<E, P>,
  >(
    options: V
  ): DefineHandlerWithOptions<V, E, P>

  // handler
  <
    E extends Env = any,
    P extends string = string,
    I extends Input = {},
    R = unknown,
    E2 extends Env = E,
  >(
    handler: (c: Context<E2, P, I>) => R
  ): Handler<E2, P, I, Promise<ToResponse<R>>>

  // middleware x1 + handler
  <
    E extends Env = any,
    P extends string = string,
    I extends Input = {},
    R = unknown,
    E2 extends Env = E,
    E3 extends Env = IntersectNonAnyTypes<[E, E2]>,
  >(
    middleware1: MiddlewareHandler<E2, P, I, any>,
    handler: (c: Context<E3, P, I>) => R
  ): Handler<E3, P, I, Promise<ToResponse<R>>>

  // middleware x2 + handler
  <
    E extends Env = any,
    P extends string = string,
    I extends Input = {},
    R = unknown,
    E2 extends Env = E,
    E3 extends Env = E,
    E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>,
  >(
    middleware1: MiddlewareHandler<E2, P, I, any>,
    middleware2: MiddlewareHandler<E3, P, I, any>,
    handler: (c: Context<E4, P, I>) => R
  ): Handler<E4, P, I, Promise<ToResponse<R>>>

  // middleware x3 + handler
  <
    E extends Env = any,
    P extends string = string,
    I extends Input = {},
    R = unknown,
    E2 extends Env = E,
    E3 extends Env = E,
    E4 extends Env = E,
    E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>,
  >(
    middleware1: MiddlewareHandler<E2, P, I, any>,
    middleware2: MiddlewareHandler<E3, P, I, any>,
    middleware3: MiddlewareHandler<E4, P, I, any>,
    handler: (c: Context<E5, P, I>) => R
  ): Handler<E5, P, I, Promise<ToResponse<R>>>
} = (...args: any[]): any => {
  if (typeof args[0] === 'function') {
    return build(undefined, args.slice(0, -1), args[args.length - 1])
  }
  const options = args[0] as DefineHandlerOptions
  const define = (...fns: any[]) => build(options, fns.slice(0, -1), fns[fns.length - 1])
  return Object.assign(define, { validations: options })
}
