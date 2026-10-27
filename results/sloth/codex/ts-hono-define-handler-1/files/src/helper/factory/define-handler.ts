/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context } from '../../context'
import { HTTPException } from '../../http-exception'
import type { Env, Handler, MiddlewareHandler, TypedResponse, ValidationTargets } from '../../types'
import type { JSONParsed, UnionToIntersection } from '../../utils/types'
import { validator } from '../../validator'

/** A dependency-free Standard Schema contract. @experimental */
export interface StandardSchema<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly types?: { readonly input: Input; readonly output: Output }
    readonly validate: (
      value: unknown
    ) =>
      | { readonly value: Output; readonly issues?: undefined }
      | { readonly issues: readonly ValidationIssue[] }
      | Promise<
          | { readonly value: Output; readonly issues?: undefined }
          | { readonly issues: readonly ValidationIssue[] }
        >
  }
}

/** A raw Standard Schema issue. @experimental */
export interface ValidationIssue {
  readonly message: string
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
}

/** The cause attached to validation exceptions. @experimental */
export interface ValidationFailure {
  issues: { slot: keyof ValidationTargets | 'response'; issues: readonly ValidationIssue[] }[]
}

type Validation<E extends Env, T = any> =
  | StandardSchema<any, any>
  | ((value: T, c: Context<E>) => any)
type Options<E extends Env> = {
  [K in keyof ValidationTargets]?: Validation<E, ValidationTargets[K]>
} & {
  response?: Validation<E>
}
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
      : unknown
type Inputs<O> = { [K in keyof O as K extends keyof ValidationTargets ? K : never]: Output<O[K]> }
type RequestInputs<O> = {
  [K in keyof O as K extends keyof ValidationTargets ? K : never]: SchemaInput<O[K]>
}
type Result<R> = R extends Response | TypedResponse<any>
  ? R
  : R extends string
    ? TypedResponse<string, 200, 'html'>
    : R extends null | undefined | void
      ? TypedResponse<null, 204, 'body'>
      : TypedResponse<JSONParsed<R>, 200, 'json'>
type Return<O, R> = O extends { response: unknown }
  ? TypedResponse<JSONParsed<Output<O['response']>>, 200, 'json'> | Extract<Awaited<R>, Response>
  : Result<Awaited<R>>
type Callback<E extends Env, P extends string, O, R> = (
  c: Context<E, P, { in: RequestInputs<O>; out: Inputs<O> }>,
  input: Inputs<O>
) => R
type Allowed<O> = O extends { response: unknown }
  ? SchemaInput<O['response']> | Response | Promise<SchemaInput<O['response']> | Response>
  : unknown

/** Defines a validated handler using an environment and path. @experimental */
export interface HandlerBuilder<E extends Env = Env, P extends string = string, O = {}> {
  <R extends Allowed<O>>(
    handler: Callback<E, P, O, R>
  ): Handler<E, P, { in: RequestInputs<O>; out: Inputs<O> }, Promise<Return<O, R>>> & {
    validations: O
  }
  <E2 extends Env, R extends Allowed<O>>(
    middleware: MiddlewareHandler<E2, P>,
    handler: Callback<E & E2, P, O, R>
  ): Handler<E & E2, P, { in: RequestInputs<O>; out: Inputs<O> }, Promise<Return<O, R>>> & {
    validations: O
  }
  <E2 extends Env, E3 extends Env, R extends Allowed<O>>(
    middleware1: MiddlewareHandler<E2, P>,
    middleware2: MiddlewareHandler<E2 & E3, P>,
    handler: Callback<E & E2 & E3, P, O, R>
  ): Handler<E & E2 & E3, P, { in: RequestInputs<O>; out: Inputs<O> }, Promise<Return<O, R>>> & {
    validations: O
  }
  <
    M extends MiddlewareHandler<any, P>[],
    R extends Allowed<O>,
    ME extends Env = E &
      UnionToIntersection<M[number] extends MiddlewareHandler<infer V, any> ? V : never>,
  >(
    ...handlers: [...M, Callback<ME, P, O, R>]
  ): Handler<ME, P, { in: RequestInputs<O>; out: Inputs<O> }, Promise<Return<O, R>>> & {
    validations: O
  }
}

/** Defines handlers or configures their validations. @experimental */
export interface DefineHandler<
  E extends Env = Env,
  P extends string = string,
> extends HandlerBuilder<E, P> {
  <O extends Options<E>>(options: O): HandlerBuilder<E, P, O>
}

/** Validates a value with a schema or transformation. */
const validate = async (validation: Validation<any>, value: unknown, c: Context<any>) => {
  if ('~standard' in validation) {
    return validation['~standard'].validate(value)
  }
  return { value: await validation(value, c) }
}

/** Creates a handler and its surrounding middleware chain. */
const build = (options: Options<any>, handlers: any[]): any => {
  const handler = handlers[handlers.length - 1]
  const endpoint: Handler = async (c) => {
    const input: Record<string, unknown> = {}
    const failures: ValidationFailure['issues'] = []
    for (const slot of ['param', 'query', 'header', 'cookie', 'form', 'json'] as const) {
      const validation = options[slot]
      if (!validation) {
        continue
      }
      const response = await validator(slot, async (value) => {
        const result = await validate(validation, value, c)
        if (result.issues) {
          failures.push({ slot, issues: result.issues })
        } else {
          input[slot] = result.value
          return result.value
        }
      })(c, async () => {})
      if (response instanceof Response) {
        return response
      }
    }
    if (failures.length) {
      throw new HTTPException(400, {
        res: c.json(
          {
            error: 'Validation failed',
            issues: failures.map(({ slot, issues }) => ({
              slot,
              issues: issues.map(({ message, path }) => ({
                message,
                ...(path?.length
                  ? {
                      path: path
                        .map((item) => (typeof item === 'object' ? String(item.key) : String(item)))
                        .join('.'),
                    }
                  : {}),
              })),
            })),
          },
          400
        ),
        cause: { issues: failures } satisfies ValidationFailure,
      })
    }
    const value = await handler(c, input)
    if (value instanceof Response) {
      return value
    }
    if (options.response) {
      const result = await validate(options.response, value, c)
      if (result.issues) {
        throw new HTTPException(500, {
          res: c.json({ error: 'Response validation failed' }, 500),
          cause: {
            issues: [{ slot: 'response', issues: result.issues }],
          } satisfies ValidationFailure,
        })
      }
      return result.value instanceof Response ? result.value : c.json(result.value)
    }
    if (value == null) {
      return c.body(null, 204)
    }
    if (typeof value === 'string' || value.isEscaped) {
      return c.html(value)
    }
    return c.json(value)
  }
  return Object.assign(
    async (c: Context) => {
      let index = -1
      /** Dispatches middleware without changing the request's route index. */
      const dispatch = async (i: number): Promise<void> => {
        if (i <= index) {
          throw new Error('next() called multiple times')
        }
        index = i
        const response = await (i < handlers.length - 1 ? handlers[i] : endpoint)(c, () =>
          dispatch(i + 1)
        )
        if (response) {
          c.res = response
        }
      }
      await dispatch(0)
      return c.res
    },
    { validations: options }
  )
}

/** Defines a handler with optional request and response validation. @experimental */
export const defineHandler: {
  <E extends Env = Env, P extends string = string, O extends Options<E> = Options<E>>(
    options: O
  ): HandlerBuilder<E, P, O>
  <E extends Env = Env, P extends string = string, R = any>(
    handler: Callback<E, P, {}, R>
  ): Handler<E, P, {}, Promise<Result<Awaited<R>>>>
} & DefineHandler = ((...args: any[]) =>
  typeof args[0] === 'function'
    ? build({}, args)
    : (...handlers: any[]) => build(args[0], handlers)) as any
