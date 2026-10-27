/**
 * @module
 * `defineHandler()` helper for Hono. It defines a handler together with its
 * request and response validation in one place.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context } from '../../context'
import { HTTPException } from '../../http-exception'
import type {
  Env,
  H,
  Input,
  IntersectNonAnyTypes,
  MiddlewareHandler,
  ParsedFormValue,
  TypedResponse,
  ValidationTargets,
} from '../../types'
import type { ContentfulStatusCode } from '../../utils/http-status'
import type { JSONParsed } from '../../utils/types'
import type { ExtractValidatorOutput } from '../../validator/validator'
import { getValidationTargetValue } from '../../validator/validator'

type RequestTarget = 'param' | 'query' | 'header' | 'cookie' | 'form' | 'json'

// The order in which the request targets are validated.
const REQUEST_TARGETS: readonly RequestTarget[] = [
  'param',
  'query',
  'header',
  'cookie',
  'form',
  'json',
]

/**
 * An issue reported by a Standard Schema.
 *
 * @experimental `defineHandler` is an experimental feature.
 * The API might be changed.
 */
export interface ValidationIssue {
  readonly message: string
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined
}

/**
 * The issues of one slot (`query`, `json`, `response`, ...) that failed validation.
 * `exception.cause` of the thrown `HTTPException` is `{ issues: ValidationFailure[] }`.
 *
 * @experimental `defineHandler` is an experimental feature.
 * The API might be changed.
 */
export interface ValidationFailure {
  slot: RequestTarget | 'response'
  issues: ReadonlyArray<ValidationIssue>
}

/**
 * The Standard Schema interface (https://standardschema.dev). Schemas of zod, valibot,
 * ArkType and others implement it, so no dependency is needed.
 *
 * @experimental `defineHandler` is an experimental feature.
 * The API might be changed.
 */
export interface StandardSchema<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown
    ) =>
      | { readonly value: Output; readonly issues?: undefined }
      | { readonly issues: ReadonlyArray<ValidationIssue> }
      | Promise<
          | { readonly value: Output; readonly issues?: undefined }
          | { readonly issues: ReadonlyArray<ValidationIssue> }
        >
    readonly types?: { readonly input: Input; readonly output: Output } | undefined
  }
}

// Method syntax makes the parameters bivariant, so that a function can annotate a narrower value.
type ValidationFunction<In> = {
  bivarianceHack(value: In, c: Context<any, any, any>): any
}['bivarianceHack']

type Validation<In> = StandardSchema<any, any> | ValidationFunction<In>

/**
 * Options of `defineHandler()`. Every request target is validated, if given,
 * before the handler runs. `response` validates the value the handler returns.
 *
 * @experimental `defineHandler` is an experimental feature.
 * The API might be changed.
 */
export interface DefineHandlerOptions<P extends string = string> {
  param?: Validation<ValidationTargets<ParsedFormValue, P>['param']>
  query?: Validation<ValidationTargets['query']>
  header?: Validation<ValidationTargets['header']>
  cookie?: Validation<ValidationTargets['cookie']>
  form?: Validation<ValidationTargets['form']>
  json?: Validation<ValidationTargets['json']>
  response?: Validation<any>
}

type TargetsOf<O> = Extract<keyof O, RequestTarget>

type ValidationInput<V> = V extends { '~standard': { types?: infer T } }
  ? NonNullable<T> extends { input: infer I }
    ? I
    : unknown
  : ExtractValidatorOutput<V>

type ValidationOutput<V> = V extends { '~standard': { types?: infer T } }
  ? NonNullable<T> extends { output: infer O }
    ? O
    : unknown
  : ExtractValidatorOutput<V>

// What the handler has to return for the `response` validation.
type ResponseValueOf<V> = V extends { '~standard': any }
  ? ValidationInput<V>
  : V extends (value: infer In, ...args: any[]) => any
    ? In
    : never

type ToInput<O> = {
  in: { [K in TargetsOf<O>]: ValidationInput<O[K]> }
  out: { [K in TargetsOf<O>]: ValidationOutput<O[K]> }
}

type ToValidated<O> = { [K in TargetsOf<O>]: ValidationOutput<O[K]> }

type HandlerReturn<O> = O extends { response: infer V } ? ResponseValueOf<V> | Response : any

type JSONResponse<T> = Response & TypedResponse<JSONParsed<T>, ContentfulStatusCode, 'json'>

type ToTypedResponse<T> = T extends Response
  ? T
  : T extends null | undefined | void
    ? Response & TypedResponse<undefined, 204, 'body'>
    : T extends string | { isEscaped: true }
      ? Response
      : JSONResponse<T>

type HandlerResult<R, O> = O extends { response: infer V }
  ? JSONResponse<ValidationOutput<V>> | Extract<R, Response>
  : ToTypedResponse<R>

/**
 * `defineHandler` with the options, waiting for the handler and the middleware.
 *
 * @experimental `defineHandler` is an experimental feature.
 * The API might be changed.
 */
export interface DefineHandlerWithOptions<E extends Env, P extends string, O> {
  // with options, handler only
  <
    R extends HandlerReturn<O> = HandlerReturn<O>,
    EH extends Env = IntersectNonAnyTypes<[E]>,
    IH extends Input = ToInput<O>,
  >(
    handler: (c: Context<EH, P, IH>, input: ToValidated<O>) => R | Promise<R>
  ): H<EH, P, IH, Promise<HandlerResult<R, O>>> & { validations: O }

  // with options, 1 middleware
  <
    I1 extends Input = {},
    E1 extends Env = E,
    R extends HandlerReturn<O> = HandlerReturn<O>,
    EH extends Env = IntersectNonAnyTypes<[E, E1]>,
    IH extends Input = I1 & ToInput<O>,
  >(
    middleware1: MiddlewareHandler<E1, P, I1, any>,
    handler: (c: Context<EH, P, IH>, input: ToValidated<O>) => R | Promise<R>
  ): H<EH, P, IH, Promise<HandlerResult<R, O>>> & { validations: O }

  // with options, 2 middleware
  <
    I1 extends Input = {},
    I2 extends Input = {},
    E1 extends Env = E,
    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
    R extends HandlerReturn<O> = HandlerReturn<O>,
    EH extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
    IH extends Input = I1 & I2 & ToInput<O>,
  >(
    middleware1: MiddlewareHandler<E1, P, I1, any>,
    middleware2: MiddlewareHandler<E2, P, I2, any>,
    handler: (c: Context<EH, P, IH>, input: ToValidated<O>) => R | Promise<R>
  ): H<EH, P, IH, Promise<HandlerResult<R, O>>> & { validations: O }

  // with options, 3 middleware
  <
    I1 extends Input = {},
    I2 extends Input = {},
    I3 extends Input = {},
    E1 extends Env = E,
    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
    R extends HandlerReturn<O> = HandlerReturn<O>,
    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
    IH extends Input = I1 & I2 & I3 & ToInput<O>,
  >(
    middleware1: MiddlewareHandler<E1, P, I1, any>,
    middleware2: MiddlewareHandler<E2, P, I2, any>,
    middleware3: MiddlewareHandler<E3, P, I3, any>,
    handler: (c: Context<EH, P, IH>, input: ToValidated<O>) => R | Promise<R>
  ): H<EH, P, IH, Promise<HandlerResult<R, O>>> & { validations: O }

  // with options, 4 middleware
  <
    I1 extends Input = {},
    I2 extends Input = {},
    I3 extends Input = {},
    I4 extends Input = {},
    E1 extends Env = E,
    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
    E4 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
    R extends HandlerReturn<O> = HandlerReturn<O>,
    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4]>,
    IH extends Input = I1 & I2 & I3 & I4 & ToInput<O>,
  >(
    middleware1: MiddlewareHandler<E1, P, I1, any>,
    middleware2: MiddlewareHandler<E2, P, I2, any>,
    middleware3: MiddlewareHandler<E3, P, I3, any>,
    middleware4: MiddlewareHandler<E4, P, I4, any>,
    handler: (c: Context<EH, P, IH>, input: ToValidated<O>) => R | Promise<R>
  ): H<EH, P, IH, Promise<HandlerResult<R, O>>> & { validations: O }

  // with options, 5 middleware
  <
    I1 extends Input = {},
    I2 extends Input = {},
    I3 extends Input = {},
    I4 extends Input = {},
    I5 extends Input = {},
    E1 extends Env = E,
    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
    E4 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
    E5 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4]>,
    R extends HandlerReturn<O> = HandlerReturn<O>,
    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4, E5]>,
    IH extends Input = I1 & I2 & I3 & I4 & I5 & ToInput<O>,
  >(
    middleware1: MiddlewareHandler<E1, P, I1, any>,
    middleware2: MiddlewareHandler<E2, P, I2, any>,
    middleware3: MiddlewareHandler<E3, P, I3, any>,
    middleware4: MiddlewareHandler<E4, P, I4, any>,
    middleware5: MiddlewareHandler<E5, P, I5, any>,
    handler: (c: Context<EH, P, IH>, input: ToValidated<O>) => R | Promise<R>
  ): H<EH, P, IH, Promise<HandlerResult<R, O>>> & { validations: O }
}

/**
 * The type of `defineHandler()` and `factory.defineHandler()`.
 *
 * @experimental `defineHandler` is an experimental feature.
 * The API might be changed.
 */
export interface DefineHandlerInterface<E extends Env, P extends string> {
  // handler only
  <R = any, EH extends Env = IntersectNonAnyTypes<[E]>, IH extends Input = {}>(
    handler: (c: Context<EH, P, IH>) => R | Promise<R>
  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>

  // 1 middleware
  <
    I1 extends Input = {},
    E1 extends Env = E,
    R = any,
    EH extends Env = IntersectNonAnyTypes<[E, E1]>,
    IH extends Input = I1,
  >(
    middleware1: MiddlewareHandler<E1, P, I1, any>,
    handler: (c: Context<EH, P, IH>) => R | Promise<R>
  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>

  // 2 middleware
  <
    I1 extends Input = {},
    I2 extends Input = {},
    E1 extends Env = E,
    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
    R = any,
    EH extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
    IH extends Input = I1 & I2,
  >(
    middleware1: MiddlewareHandler<E1, P, I1, any>,
    middleware2: MiddlewareHandler<E2, P, I2, any>,
    handler: (c: Context<EH, P, IH>) => R | Promise<R>
  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>

  // 3 middleware
  <
    I1 extends Input = {},
    I2 extends Input = {},
    I3 extends Input = {},
    E1 extends Env = E,
    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
    R = any,
    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
    IH extends Input = I1 & I2 & I3,
  >(
    middleware1: MiddlewareHandler<E1, P, I1, any>,
    middleware2: MiddlewareHandler<E2, P, I2, any>,
    middleware3: MiddlewareHandler<E3, P, I3, any>,
    handler: (c: Context<EH, P, IH>) => R | Promise<R>
  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>

  // 4 middleware
  <
    I1 extends Input = {},
    I2 extends Input = {},
    I3 extends Input = {},
    I4 extends Input = {},
    E1 extends Env = E,
    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
    E4 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
    R = any,
    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4]>,
    IH extends Input = I1 & I2 & I3 & I4,
  >(
    middleware1: MiddlewareHandler<E1, P, I1, any>,
    middleware2: MiddlewareHandler<E2, P, I2, any>,
    middleware3: MiddlewareHandler<E3, P, I3, any>,
    middleware4: MiddlewareHandler<E4, P, I4, any>,
    handler: (c: Context<EH, P, IH>) => R | Promise<R>
  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>

  // 5 middleware
  <
    I1 extends Input = {},
    I2 extends Input = {},
    I3 extends Input = {},
    I4 extends Input = {},
    I5 extends Input = {},
    E1 extends Env = E,
    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
    E4 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
    E5 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4]>,
    R = any,
    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4, E5]>,
    IH extends Input = I1 & I2 & I3 & I4 & I5,
  >(
    middleware1: MiddlewareHandler<E1, P, I1, any>,
    middleware2: MiddlewareHandler<E2, P, I2, any>,
    middleware3: MiddlewareHandler<E3, P, I3, any>,
    middleware4: MiddlewareHandler<E4, P, I4, any>,
    middleware5: MiddlewareHandler<E5, P, I5, any>,
    handler: (c: Context<EH, P, IH>) => R | Promise<R>
  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>

  // with options
  <O extends DefineHandlerOptions<P>>(options: O): DefineHandlerWithOptions<E, P, O>
}

interface DefineHandler {
  // handler only
  <
    E extends Env = any,
    P extends string = string,
    R = any,
    EH extends Env = IntersectNonAnyTypes<[E]>,
    IH extends Input = {},
  >(
    handler: (c: Context<EH, P, IH>) => R | Promise<R>
  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>

  // 1 middleware
  <
    E extends Env = any,
    P extends string = string,
    I1 extends Input = {},
    E1 extends Env = E,
    R = any,
    EH extends Env = IntersectNonAnyTypes<[E, E1]>,
    IH extends Input = I1,
  >(
    middleware1: MiddlewareHandler<E1, P, I1, any>,
    handler: (c: Context<EH, P, IH>) => R | Promise<R>
  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>

  // 2 middleware
  <
    E extends Env = any,
    P extends string = string,
    I1 extends Input = {},
    I2 extends Input = {},
    E1 extends Env = E,
    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
    R = any,
    EH extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
    IH extends Input = I1 & I2,
  >(
    middleware1: MiddlewareHandler<E1, P, I1, any>,
    middleware2: MiddlewareHandler<E2, P, I2, any>,
    handler: (c: Context<EH, P, IH>) => R | Promise<R>
  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>

  // 3 middleware
  <
    E extends Env = any,
    P extends string = string,
    I1 extends Input = {},
    I2 extends Input = {},
    I3 extends Input = {},
    E1 extends Env = E,
    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
    R = any,
    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
    IH extends Input = I1 & I2 & I3,
  >(
    middleware1: MiddlewareHandler<E1, P, I1, any>,
    middleware2: MiddlewareHandler<E2, P, I2, any>,
    middleware3: MiddlewareHandler<E3, P, I3, any>,
    handler: (c: Context<EH, P, IH>) => R | Promise<R>
  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>

  // 4 middleware
  <
    E extends Env = any,
    P extends string = string,
    I1 extends Input = {},
    I2 extends Input = {},
    I3 extends Input = {},
    I4 extends Input = {},
    E1 extends Env = E,
    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
    E4 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
    R = any,
    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4]>,
    IH extends Input = I1 & I2 & I3 & I4,
  >(
    middleware1: MiddlewareHandler<E1, P, I1, any>,
    middleware2: MiddlewareHandler<E2, P, I2, any>,
    middleware3: MiddlewareHandler<E3, P, I3, any>,
    middleware4: MiddlewareHandler<E4, P, I4, any>,
    handler: (c: Context<EH, P, IH>) => R | Promise<R>
  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>

  // 5 middleware
  <
    E extends Env = any,
    P extends string = string,
    I1 extends Input = {},
    I2 extends Input = {},
    I3 extends Input = {},
    I4 extends Input = {},
    I5 extends Input = {},
    E1 extends Env = E,
    E2 extends Env = IntersectNonAnyTypes<[E, E1]>,
    E3 extends Env = IntersectNonAnyTypes<[E, E1, E2]>,
    E4 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3]>,
    E5 extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4]>,
    R = any,
    EH extends Env = IntersectNonAnyTypes<[E, E1, E2, E3, E4, E5]>,
    IH extends Input = I1 & I2 & I3 & I4 & I5,
  >(
    middleware1: MiddlewareHandler<E1, P, I1, any>,
    middleware2: MiddlewareHandler<E2, P, I2, any>,
    middleware3: MiddlewareHandler<E3, P, I3, any>,
    middleware4: MiddlewareHandler<E4, P, I4, any>,
    middleware5: MiddlewareHandler<E5, P, I5, any>,
    handler: (c: Context<EH, P, IH>) => R | Promise<R>
  ): H<EH, P, IH, Promise<ToTypedResponse<R>>>

  // with options
  <O extends DefineHandlerOptions>(options: O): DefineHandlerWithOptions<any, string, O>
}

const isStandardSchema = (value: unknown): value is StandardSchema =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  '~standard' in value

const toIssue = ({ message, path }: ValidationIssue): { message: string; path?: string } => {
  const joined = path?.map((item) => String(typeof item === 'object' ? item.key : item)).join('.')
  return joined ? { message, path: joined } : { message }
}

const validationError = (
  status: 400 | 500,
  failures: ValidationFailure[],
  error: string
): HTTPException => {
  // The input value is never part of the response.
  const body =
    status === 400
      ? {
          error,
          issues: failures.map(({ slot, issues }) => ({
            slot,
            issues: issues.map(toIssue),
          })),
        }
      : { error }
  return new HTTPException(status, {
    message: error,
    res: new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
    cause: { issues: failures },
  })
}

type Outcome = { value: unknown } | { issues: ReadonlyArray<ValidationIssue> } | { res: Response }

const validate = async (
  validation: Validation<any>,
  value: unknown,
  c: Context
): Promise<Outcome> => {
  if (isStandardSchema(validation)) {
    const result = await validation['~standard'].validate(value)
    return result.issues ? { issues: result.issues } : { value: result.value }
  }
  const result = await (validation as ValidationFunction<unknown>)(value, c)
  return result instanceof Response ? { res: result } : { value: result }
}

const toResponse = async (c: Context, value: unknown): Promise<Response> => {
  if (value instanceof Response) {
    return value
  }
  if (value === null || value === undefined) {
    return c.body(null, 204)
  }
  if (
    typeof value === 'string' ||
    (typeof value === 'object' && (value as { isEscaped?: unknown }).isEscaped === true)
  ) {
    // string, `html` template and JSX
    return c.html(value as string)
  }
  return c.json(value)
}

const build = (
  options: DefineHandlerOptions | undefined,
  functions: Function[]
): ((c: Context) => Promise<Response | undefined>) => {
  const handler = functions[functions.length - 1]
  const middleware = functions.slice(0, -1)

  const core = async (c: Context): Promise<Response> => {
    const input: Record<string, unknown> = {}

    if (options) {
      const failures: ValidationFailure[] = []
      for (const target of REQUEST_TARGETS) {
        const validation = options[target]
        if (validation === undefined) {
          continue
        }
        const outcome = await validate(validation, await getValidationTargetValue(c, target), c)
        if ('res' in outcome) {
          return outcome.res
        }
        if ('issues' in outcome) {
          failures.push({ slot: target, issues: outcome.issues })
        } else if (!failures.length) {
          input[target] = outcome.value
          c.req.addValidatedData(target, outcome.value as {})
        }
      }
      if (failures.length) {
        throw validationError(400, failures, 'Validation failed')
      }
    }

    const value = await handler(c, input)

    if (options?.response !== undefined && !(value instanceof Response)) {
      const outcome = await validate(options.response, value, c)
      if ('res' in outcome) {
        return outcome.res
      }
      if ('issues' in outcome) {
        throw validationError(
          500,
          [{ slot: 'response', issues: outcome.issues }],
          'Response validation failed'
        )
      }
      return c.json(outcome.value as {})
    }

    return toResponse(c, value)
  }

  if (!middleware.length) {
    return core
  }

  const chain = [...middleware, core]
  return async (c) => {
    let index = -1
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('next() called multiple times')
      }
      index = i
      const res = await chain[i](c, () => dispatch(i + 1))
      if (res && !c.finalized) {
        c.res = res
      }
    }
    await dispatch(0)
    return c.finalized ? c.res : undefined
  }
}

/**
 * Defines a handler together with its request and response validation in one place.
 *
 * Without options, the value the handler returns is converted to a `Response`:
 * an object as JSON, a string, JSX or an `html` template as HTML, `null` or `undefined` as `204`,
 * and a `Response` as is. Middleware can be passed before the handler.
 *
 * With options, the request targets are validated in the order `param`, `query`, `header`,
 * `cookie`, `form`, `json` before the handler runs, and the returned value is validated with
 * `response`. A validation is a Standard Schema, or a function `(value, c) => newValue`.
 * A failing Standard Schema throws an `HTTPException`: `400` for the request and `500` for the response.
 *
 * @experimental `defineHandler` is an experimental feature.
 * The API might be changed.
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
export const defineHandler: DefineHandler = ((...args: unknown[]) => {
  const [first] = args
  if (typeof first === 'function') {
    return build(undefined, args as Function[])
  }
  const options = first as DefineHandlerOptions
  return (...functions: Function[]) =>
    Object.assign(build(options, functions), { validations: options })
}) as DefineHandler
