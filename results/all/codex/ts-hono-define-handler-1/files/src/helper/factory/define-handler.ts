/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context } from '../../context'
import { HTTPException } from '../../http-exception'
import type {
  Env,
  Handler,
  IntersectNonAnyTypes,
  MiddlewareHandler,
  TypedResponse,
  ValidationTargets,
} from '../../types'
import type { JSONParsed } from '../../utils/types'
import { validator } from '../../validator'

/** A Standard Schema validation issue. @experimental */
export interface ValidationIssue {
  readonly message: string
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
}

/** Raw validation failures, grouped by target. @experimental */
export interface ValidationFailure {
  issues: { slot: keyof ValidationTargets | 'response'; issues: readonly ValidationIssue[] }[]
}

/** A dependency-free Standard Schema contract. @experimental */
export interface StandardSchema<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown
    ) =>
      | { value: Output; issues?: undefined }
      | { issues: readonly ValidationIssue[] }
      | Promise<{ value: Output; issues?: undefined } | { issues: readonly ValidationIssue[] }>
    readonly types?: { readonly input: Input; readonly output: Output }
  }
}

type MiddlewareEnv<M extends MiddlewareHandler<any, any>[]> = IntersectNonAnyTypes<{
  [K in keyof M]: M[K] extends MiddlewareHandler<infer E, any> ? E : never
}> &
  Env
type Validation<E extends Env, T> = StandardSchema<any, any> | ((value: T, c: Context<E>) => any)
type Options<E extends Env> = {
  [K in keyof ValidationTargets]?: Validation<E, ValidationTargets[K]>
} & { response?: Validation<E, any> }
type Output<V> =
  V extends StandardSchema<any, infer O>
    ? O
    : V extends (...args: any[]) => infer O
      ? Exclude<Awaited<O>, Response>
      : never
type SchemaInput<V> =
  V extends StandardSchema<infer I, any>
    ? I
    : V extends (value: infer I, ...args: any[]) => any
      ? I
      : never
type RequestInput<O> = { [K in keyof O & keyof ValidationTargets]: Output<O[K]> }
type Input<O> = {
  in: { [K in keyof O & keyof ValidationTargets]: SchemaInput<O[K]> }
  out: RequestInput<O>
}
type Result<R> = R extends TypedResponse
  ? R
  : R extends Response
    ? R
    : R extends null | undefined
      ? TypedResponse<null, 204, 'body'>
      : R extends string
        ? TypedResponse<string, 200, 'html'>
        : TypedResponse<JSONParsed<R>, 200, 'json'>
type Return<O, R> = 'response' extends keyof O
  ? TypedResponse<JSONParsed<Output<O['response']>>, 200, 'json'>
  : Result<Awaited<R>>
type Callback<E extends Env, P extends string, O, R> = (
  c: Context<E, P, Input<O>>,
  input: RequestInput<O>
) => R
type Allowed<O> = 'response' extends keyof O
  ? SchemaInput<O['response']> | Response | Promise<SchemaInput<O['response']> | Response>
  : unknown

/** Define a validated handler using environment and path defaults. @experimental */
export interface DefineHandler<E extends Env = Env, P extends string = string> {
  <E2 extends Env = E, P2 extends string = P, O extends Options<E2> = Options<E2>>(
    options: O
  ): WithOptions<E2, P2, O>
  <E2 extends Env = E, P2 extends string = P, R = any>(
    handler: Callback<E2, P2, {}, R>
  ): Handler<E2, P2, {}, Promise<Result<Awaited<R>>>>
  <E1 extends Env = E, P2 extends string = P, R = any>(
    mw1: MiddlewareHandler<E1, P2>,
    handler: Callback<E & E1, P2, {}, R>
  ): Handler<E & E1, P2, {}, Promise<Result<Awaited<R>>>>
  <E1 extends Env = E, E2 extends Env = E, P2 extends string = P, R = any>(
    mw1: MiddlewareHandler<E1, P2>,
    mw2: MiddlewareHandler<E2, P2>,
    handler: Callback<E & E1 & E2, P2, {}, R>
  ): Handler<E & E1 & E2, P2, {}, Promise<Result<Awaited<R>>>>
  <E1 extends Env = E, E2 extends Env = E, E3 extends Env = E, P2 extends string = P, R = any>(
    mw1: MiddlewareHandler<E1, P2>,
    mw2: MiddlewareHandler<E2, P2>,
    mw3: MiddlewareHandler<E3, P2>,
    handler: Callback<E & E1 & E2 & E3, P2, {}, R>
  ): Handler<E & E1 & E2 & E3, P2, {}, Promise<Result<Awaited<R>>>>
  <
    E1 extends Env = E,
    E2 extends Env = E,
    E3 extends Env = E,
    E4 extends Env = E,
    P2 extends string = P,
    R = any,
  >(
    mw1: MiddlewareHandler<E1, P2>,
    mw2: MiddlewareHandler<E2, P2>,
    mw3: MiddlewareHandler<E3, P2>,
    mw4: MiddlewareHandler<E4, P2>,
    handler: Callback<E & E1 & E2 & E3 & E4, P2, {}, R>
  ): Handler<E & E1 & E2 & E3 & E4, P2, {}, Promise<Result<Awaited<R>>>>
  <
    E2 extends Env = E,
    P2 extends string = P,
    M extends MiddlewareHandler<any, P2>[] = MiddlewareHandler<any, P2>[],
    R = any,
  >(
    ...handlers: [...M, Callback<E2 & MiddlewareEnv<M>, P2, {}, R>]
  ): Handler<E2 & MiddlewareEnv<M>, P2, {}, Promise<Result<Awaited<R>>>>
}

/** Bind validation options to a handler. @experimental */
export interface WithOptions<E extends Env, P extends string, O> {
  <R extends Allowed<O>>(
    handler: Callback<E, P, O, R>
  ): Handler<E, P, Input<O>, Promise<Return<O, R>>> & { validations: O }
  <E1 extends Env, R extends Allowed<O>>(
    mw1: MiddlewareHandler<E1, P>,
    handler: Callback<E & E1, P, O, R>
  ): Handler<E & E1, P, Input<O>, Promise<Return<O, R>>> & { validations: O }
  <E1 extends Env, E2 extends Env, R extends Allowed<O>>(
    mw1: MiddlewareHandler<E1, P>,
    mw2: MiddlewareHandler<E2, P>,
    handler: Callback<E & E1 & E2, P, O, R>
  ): Handler<E & E1 & E2, P, Input<O>, Promise<Return<O, R>>> & { validations: O }
  <E1 extends Env, E2 extends Env, E3 extends Env, R extends Allowed<O>>(
    mw1: MiddlewareHandler<E1, P>,
    mw2: MiddlewareHandler<E2, P>,
    mw3: MiddlewareHandler<E3, P>,
    handler: Callback<E & E1 & E2 & E3, P, O, R>
  ): Handler<E & E1 & E2 & E3, P, Input<O>, Promise<Return<O, R>>> & { validations: O }
  <E1 extends Env, E2 extends Env, E3 extends Env, E4 extends Env, R extends Allowed<O>>(
    mw1: MiddlewareHandler<E1, P>,
    mw2: MiddlewareHandler<E2, P>,
    mw3: MiddlewareHandler<E3, P>,
    mw4: MiddlewareHandler<E4, P>,
    handler: Callback<E & E1 & E2 & E3 & E4, P, O, R>
  ): Handler<E & E1 & E2 & E3 & E4, P, Input<O>, Promise<Return<O, R>>> & { validations: O }
  <M extends MiddlewareHandler<any, P>[], R extends Allowed<O>>(
    ...handlers: [...M, Callback<E & MiddlewareEnv<M>, P, O, R>]
  ): Handler<E & MiddlewareEnv<M>, P, Input<O>, Promise<Return<O, R>>> & { validations: O }
}

const targets = ['param', 'query', 'header', 'cookie', 'form', 'json'] as const

/** Run a schema or validation function and retain raw issues. */
async function validate(
  validation: Validation<any, any>,
  value: unknown,
  c: Context,
  slot: keyof ValidationTargets | 'response',
  failures: ValidationFailure
): Promise<unknown> {
  if ('~standard' in validation) {
    const result = await validation['~standard'].validate(value)
    if (result.issues) {
      failures.issues.push({ slot, issues: result.issues })
      return undefined
    }
    return result.value
  }
  return validation(value, c)
}

/** Construct a validation exception without exposing input values. */
function failure(c: Context, failures: ValidationFailure, response = false): HTTPException {
  const status = response ? 500 : 400
  const error = response ? 'Response validation failed' : 'Validation failed'
  const issues = failures.issues.map(({ slot, issues }) => ({
    slot,
    issues: issues.map(({ message, path }) => ({
      message,
      ...(path?.length
        ? {
            path: path
              .map((item) => (typeof item === 'object' ? item.key : item))
              .map(String)
              .join('.'),
          }
        : {}),
    })),
  }))
  return new HTTPException(status, {
    message: error,
    res: c.json(response ? { error } : { error, issues }, status),
    cause: failures,
  })
}

/** Compose middleware around request validation and response conversion. */
function build(options: Options<any>, handlers: any[]): any {
  const handler = handlers[handlers.length - 1]
  const middleware = handlers.slice(0, -1)
  return Object.assign(
    async (c: Context) => {
      let index = -1
      /** Dispatch middleware without changing the request's route index. */
      async function dispatch(i: number): Promise<void> {
        if (i <= index) {
          throw new Error('next() called multiple times')
        }
        index = i
        if (i < middleware.length) {
          const response = await middleware[i](c, () => dispatch(i + 1))
          if (response instanceof Response) {
            c.res = response
          }
          return
        }
        const input: Record<string, unknown> = {}
        const failures: ValidationFailure = { issues: [] }
        for (const slot of targets) {
          const validation = options[slot]
          if (validation) {
            const response: unknown = await validator(slot, async (value, context) => {
              const result = await validate(validation, value, context, slot, failures)
              input[slot] = result
              return result
            })(c, async () => {})
            if (response instanceof Response) {
              c.res = response
              return
            }
          }
        }
        if (failures.issues.length) {
          throw failure(c, failures)
        }
        let value = await handler(c, input)
        if (value instanceof Response) {
          c.res = value
          return
        }
        if (options.response) {
          value = await validate(options.response, value, c, 'response', failures)
          if (failures.issues.length) {
            throw failure(c, failures, true)
          }
          c.res = value instanceof Response ? value : c.json(value)
        } else if (value == null) {
          c.res = c.body(null, 204)
        } else if (
          typeof value === 'string' ||
          value.isEscaped ||
          typeof value.toHTML === 'function'
        ) {
          c.res = await c.html(typeof value.toHTML === 'function' ? value.toHTML() : value)
        } else {
          c.res = c.json(value)
        }
      }
      await dispatch(0)
      return c.res
    },
    { validations: options }
  )
}

/** Define a handler with automatic response conversion and optional validation. @experimental */
export const defineHandler: DefineHandler = ((...args: any[]) => {
  if (typeof args[0] === 'object' && args[0] !== null) {
    return (...handlers: any[]) => build(args[0], handlers)
  }
  return build({}, args)
}) as DefineHandler
