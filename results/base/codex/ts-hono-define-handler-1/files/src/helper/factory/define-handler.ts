/** @module Factory handler helpers. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context } from '../../context'
import { HTTPException } from '../../http-exception'
import type { Env, Handler, MiddlewareHandler, TypedResponse, ValidationTargets } from '../../types'
import type { HtmlEscaped } from '../../utils/html'
import type { JSONParsed } from '../../utils/types'
import { validator } from '../../validator'

/** A dependency-free Standard Schema v1 contract. @experimental */
export interface StandardSchema<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown
    ) =>
      | { readonly value: Output; readonly issues?: undefined }
      | { readonly issues: readonly ValidationIssue[] }
      | Promise<
          | { readonly value: Output; readonly issues?: undefined }
          | { readonly issues: readonly ValidationIssue[] }
        >
    readonly types?: { readonly input: Input; readonly output: Output }
  }
}

/** @experimental */
export interface ValidationIssue {
  readonly message: string
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
}

/** Raw validation issues, available as HTTPException.cause. @experimental */
export interface ValidationFailure {
  issues: { slot: keyof ValidationTargets | 'response'; issues: readonly ValidationIssue[] }[]
}

type Rule<E extends Env = any, P extends string = string> =
  | StandardSchema<any, any>
  | ((value: any, c: Context<E, P>) => any)
type Options<E extends Env = any, P extends string = string> = Partial<
  Record<keyof ValidationTargets | 'response', Rule<E, P>>
>
type Output<T> =
  T extends StandardSchema<any, infer O>
    ? O
    : T extends (...args: any[]) => infer R
      ? Exclude<Awaited<R>, Response>
      : never
type SchemaInput<T> =
  T extends StandardSchema<infer I, any>
    ? I
    : T extends (...args: any[]) => any
      ? Parameters<T>[0]
      : unknown
type Inputs<S> = { [K in keyof S as K extends keyof ValidationTargets ? K : never]: Output<S[K]> }
type RequestInput<S> = {
  in: { [K in keyof S as K extends keyof ValidationTargets ? K : never]: SchemaInput<S[K]> }
  out: Inputs<S>
}
type ConvertedResult<R> = R extends TypedResponse
  ? R
  : R extends Response
    ? Response
    : R extends null | undefined | void
      ? TypedResponse<null, 204, 'body'>
      : R extends string | HtmlEscaped
        ? TypedResponse<string, 200, 'html'>
        : TypedResponse<JSONParsed<R>, 200, 'json'>
type Result<R> = ConvertedResult<Awaited<R>>
type CheckedReturn<S> = S extends { response: infer V }
  ? SchemaInput<V> | Response | Promise<SchemaInput<V> | Response>
  : any
type CheckedResult<S, R> = S extends { response: infer V }
  ? TypedResponse<JSONParsed<Output<V>>, 200, 'json'>
  : Result<R>

type Builder<E extends Env, P extends string, S extends Options> = {
  <R extends CheckedReturn<S> = CheckedReturn<S>>(
    handler: (c: Context<E, P, RequestInput<S>>, input: Inputs<S>) => R
  ): Handler<E, P, RequestInput<S>, CheckedResult<S, R>> & { validations: S }
  <E1 extends Env = E, R extends CheckedReturn<S> = CheckedReturn<S>>(
    mw1: MiddlewareHandler<E1, P>,
    handler: (c: Context<E & E1, P, RequestInput<S>>, input: Inputs<S>) => R
  ): Handler<E & E1, P, RequestInput<S>, CheckedResult<S, R>> & { validations: S }
  <E1 extends Env = E, E2 extends Env = E, R extends CheckedReturn<S> = CheckedReturn<S>>(
    mw1: MiddlewareHandler<E1, P>,
    mw2: MiddlewareHandler<E2, P>,
    handler: (c: Context<E & E1 & E2, P, RequestInput<S>>, input: Inputs<S>) => R
  ): Handler<E & E1 & E2, P, RequestInput<S>, CheckedResult<S, R>> & { validations: S }
  <
    E1 extends Env = E,
    E2 extends Env = E,
    E3 extends Env = E,
    R extends CheckedReturn<S> = CheckedReturn<S>,
  >(
    mw1: MiddlewareHandler<E1, P>,
    mw2: MiddlewareHandler<E2, P>,
    mw3: MiddlewareHandler<E3, P>,
    handler: (c: Context<E & E1 & E2 & E3, P, RequestInput<S>>, input: Inputs<S>) => R
  ): Handler<E & E1 & E2 & E3, P, RequestInput<S>, CheckedResult<S, R>> & { validations: S }
  <
    E1 extends Env = E,
    E2 extends Env = E,
    E3 extends Env = E,
    E4 extends Env = E,
    R extends CheckedReturn<S> = CheckedReturn<S>,
  >(
    mw1: MiddlewareHandler<E1, P>,
    mw2: MiddlewareHandler<E2, P>,
    mw3: MiddlewareHandler<E3, P>,
    mw4: MiddlewareHandler<E4, P>,
    handler: (c: Context<E & E1 & E2 & E3 & E4, P, RequestInput<S>>, input: Inputs<S>) => R
  ): Handler<E & E1 & E2 & E3 & E4, P, RequestInput<S>, CheckedResult<S, R>> & { validations: S }
  <
    E1 extends Env = E,
    E2 extends Env = E,
    E3 extends Env = E,
    E4 extends Env = E,
    E5 extends Env = E,
    R extends CheckedReturn<S> = CheckedReturn<S>,
  >(
    mw1: MiddlewareHandler<E1, P>,
    mw2: MiddlewareHandler<E2, P>,
    mw3: MiddlewareHandler<E3, P>,
    mw4: MiddlewareHandler<E4, P>,
    mw5: MiddlewareHandler<E5, P>,
    handler: (c: Context<E & E1 & E2 & E3 & E4 & E5, P, RequestInput<S>>, input: Inputs<S>) => R
  ): Handler<E & E1 & E2 & E3 & E4 & E5, P, RequestInput<S>, CheckedResult<S, R>> & {
    validations: S
  }
}

/** Define a handler and its validation together. @experimental */
export interface DefineHandler<E extends Env = Env, P extends string = string> {
  <E2 extends Env = E, P2 extends string = P, S extends Options<E2, P2> = Options<E2, P2>>(
    options: S
  ): Builder<E2, P2, S>
  <E2 extends Env = E, P2 extends string = P, R = any>(
    handler: (c: Context<E2, P2>) => R
  ): Handler<E2, P2, {}, Result<R>>
  <E2 extends Env = E, P2 extends string = P, M1 extends Env = E2, R = any>(
    mw1: MiddlewareHandler<M1, P2>,
    handler: (c: Context<E2 & M1, P2>) => R
  ): Handler<E2 & M1, P2, {}, Result<R>>
  <E2 extends Env = E, P2 extends string = P, M1 extends Env = E2, M2 extends Env = E2, R = any>(
    mw1: MiddlewareHandler<M1, P2>,
    mw2: MiddlewareHandler<M2, P2>,
    handler: (c: Context<E2 & M1 & M2, P2>) => R
  ): Handler<E2 & M1 & M2, P2, {}, Result<R>>
  <
    E2 extends Env = E,
    P2 extends string = P,
    M1 extends Env = E2,
    M2 extends Env = E2,
    M3 extends Env = E2,
    R = any,
  >(
    mw1: MiddlewareHandler<M1, P2>,
    mw2: MiddlewareHandler<M2, P2>,
    mw3: MiddlewareHandler<M3, P2>,
    handler: (c: Context<E2 & M1 & M2 & M3, P2>) => R
  ): Handler<E2 & M1 & M2 & M3, P2, {}, Result<R>>
  <
    E2 extends Env = E,
    P2 extends string = P,
    M1 extends Env = E2,
    M2 extends Env = E2,
    M3 extends Env = E2,
    M4 extends Env = E2,
    R = any,
  >(
    mw1: MiddlewareHandler<M1, P2>,
    mw2: MiddlewareHandler<M2, P2>,
    mw3: MiddlewareHandler<M3, P2>,
    mw4: MiddlewareHandler<M4, P2>,
    handler: (c: Context<E2 & M1 & M2 & M3 & M4, P2>) => R
  ): Handler<E2 & M1 & M2 & M3 & M4, P2, {}, Result<R>>
  <
    E2 extends Env = E,
    P2 extends string = P,
    M1 extends Env = E2,
    M2 extends Env = E2,
    M3 extends Env = E2,
    M4 extends Env = E2,
    M5 extends Env = E2,
    R = any,
  >(
    mw1: MiddlewareHandler<M1, P2>,
    mw2: MiddlewareHandler<M2, P2>,
    mw3: MiddlewareHandler<M3, P2>,
    mw4: MiddlewareHandler<M4, P2>,
    mw5: MiddlewareHandler<M5, P2>,
    handler: (c: Context<E2 & M1 & M2 & M3 & M4 & M5, P2>) => R
  ): Handler<E2 & M1 & M2 & M3 & M4 & M5, P2, {}, Result<R>>
}

const slots = ['param', 'query', 'header', 'cookie', 'form', 'json'] as const
const isSchema = (rule: Rule): rule is StandardSchema<any, any> => '~standard' in rule

const build = (options: Options, functions: Function[]) => {
  const handler = functions[functions.length - 1]
  const middleware = functions.slice(0, -1)
  return Object.assign(
    async (c: Context) => {
      let index = -1
      const dispatch = async (i: number): Promise<void> => {
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
        for (const slot of slots) {
          const rule = options[slot]
          if (!rule) {
            continue
          }
          const response = await validator(slot, async (value, context) => {
            if (isSchema(rule)) {
              const result = await rule['~standard'].validate(value)
              if (result.issues) {
                failures.issues.push({ slot, issues: result.issues })
                return undefined
              }
              input[slot] = result.value
              return result.value
            }
            const result = await rule(value, context)
            input[slot] = result
            return result
          })(c, async () => {})
          if (response instanceof Response) {
            c.res = response
            return
          }
        }
        if (failures.issues.length) {
          throw new HTTPException(400, {
            cause: failures,
            res: Response.json(
              {
                error: 'Validation failed',
                issues: failures.issues.map(({ slot, issues }) => ({
                  slot,
                  issues: issues.map(({ message, path }) => ({
                    message,
                    ...(path?.length
                      ? {
                          path: path
                            .map((part) =>
                              typeof part === 'object' ? String(part.key) : String(part)
                            )
                            .join('.'),
                        }
                      : {}),
                  })),
                })),
              },
              { status: 400 }
            ),
          })
        }
        let value = await handler(c, input)
        if (value instanceof Response) {
          c.res = value
          return
        }
        if (options.response) {
          const rule = options.response
          if (isSchema(rule)) {
            const result = await rule['~standard'].validate(value)
            if (result.issues) {
              throw new HTTPException(500, {
                cause: {
                  issues: [{ slot: 'response', issues: result.issues }],
                } satisfies ValidationFailure,
                res: Response.json({ error: 'Response validation failed' }, { status: 500 }),
              })
            }
            value = result.value
          } else {
            value = await rule(value, c)
          }
          c.res = value instanceof Response ? value : c.json(value)
        } else if (value == null) {
          c.res = c.body(null, 204)
        } else if (typeof value === 'string' || (typeof value === 'object' && value.isEscaped)) {
          c.res = await c.html(value)
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

/** @experimental */
export const defineHandler: DefineHandler = ((...args: any[]) =>
  typeof args[0] === 'function'
    ? build({}, args)
    : (...handlers: Function[]) => build(args[0], handlers)) as DefineHandler
