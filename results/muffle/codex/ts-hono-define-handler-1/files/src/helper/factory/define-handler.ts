/** @module Handler definitions with request and response validation. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context } from '../../context'
import { HTTPException } from '../../http-exception'
import type { Env, Handler, MiddlewareHandler, TypedResponse, ValidationTargets } from '../../types'
import type { HtmlEscaped } from '../../utils/html'
import type { JSONParsed } from '../../utils/types'
import { validator } from '../../validator'
import type { InferInput } from '../../validator/utils'

/** @experimental */
export interface ValidationIssue {
  readonly message: string
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
}

/** @experimental */
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
export interface ValidationFailure {
  issues: { slot: keyof ValidationTargets | 'response'; issues: readonly ValidationIssue[] }[]
}

type Rule = StandardSchema<any, any> | ((value: any, c: Context<any>) => any)
type Options<E extends Env = any, P extends string = string> = {
  [K in keyof ValidationTargets]?:
    | StandardSchema<any, any>
    | ((value: ValidationTargets[K], c: Context<E, P>) => any)
} & { response?: Rule }
type Output<S> =
  S extends StandardSchema<any, infer O>
    ? O
    : S extends (...args: any[]) => infer R
      ? Exclude<Awaited<R>, Response>
      : never
type SchemaInput<S> =
  S extends StandardSchema<infer I, any>
    ? I
    : S extends (value: infer I, ...args: any[]) => any
      ? I
      : never
type Validated<O> = { [K in Exclude<keyof O, 'response'>]: Output<O[K]> }
type RequestInput<O> = {
  in: {
    [K in Extract<keyof O, keyof ValidationTargets>]: K extends 'json'
      ? SchemaInput<O[K]>
      : InferInput<SchemaInput<O[K]>, K>
  }
  out: Validated<O>
}
type Result<R> = R extends Response
  ? R
  : R extends TypedResponse
    ? R
    : R extends string | HtmlEscaped
      ? TypedResponse<R, 200, 'html'>
      : R extends null | undefined | void
        ? TypedResponse<null, 204, 'body'>
        : TypedResponse<JSONParsed<R>, 200, 'json'>
type Returned<O, R> = O extends { response: Rule }
  ? TypedResponse<JSONParsed<Output<O['response']>>, 200, 'json'>
  : Result<Awaited<R>>
type Value<O> = O extends { response: Rule } ? SchemaInput<O['response']> | Response : unknown
type Callback<E extends Env, P extends string, O, R> = (
  c: Context<E, P, RequestInput<O>>,
  input: Validated<O>
) => R

type Built<E extends Env, P extends string, O, R> = Handler<
  E,
  P,
  RequestInput<O>,
  Promise<Returned<O, R>>
> & { validations: O }

/** @experimental */
export interface HandlerBuilder<E extends Env, P extends string, O> {
  <R extends Value<O> | Promise<Value<O>>>(handler: Callback<E, P, O, R>): Built<E, P, O, R>
  <E2 extends Env, R extends Value<O> | Promise<Value<O>>>(
    mw: MiddlewareHandler<E2, P>,
    handler: Callback<E & E2, P, O, R>
  ): Built<E & E2, P, O, R>
  <E2 extends Env, E3 extends Env, R extends Value<O> | Promise<Value<O>>>(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    handler: Callback<E & E2 & E3, P, O, R>
  ): Built<E & E2 & E3, P, O, R>
  <E2 extends Env, E3 extends Env, E4 extends Env, R extends Value<O> | Promise<Value<O>>>(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    mw3: MiddlewareHandler<E4, P>,
    handler: Callback<E & E2 & E3 & E4, P, O, R>
  ): Built<E & E2 & E3 & E4, P, O, R>
  <
    E2 extends Env,
    E3 extends Env,
    E4 extends Env,
    E5 extends Env,
    R extends Value<O> | Promise<Value<O>>,
  >(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    mw3: MiddlewareHandler<E4, P>,
    mw4: MiddlewareHandler<E5, P>,
    handler: Callback<E & E2 & E3 & E4 & E5, P, O, R>
  ): Built<E & E2 & E3 & E4 & E5, P, O, R>
  <
    E2 extends Env,
    E3 extends Env,
    E4 extends Env,
    E5 extends Env,
    E6 extends Env,
    R extends Value<O> | Promise<Value<O>>,
  >(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    mw3: MiddlewareHandler<E4, P>,
    mw4: MiddlewareHandler<E5, P>,
    mw5: MiddlewareHandler<E6, P>,
    handler: Callback<E & E2 & E3 & E4 & E5 & E6, P, O, R>
  ): Built<E & E2 & E3 & E4 & E5 & E6, P, O, R>
  <
    E2 extends Env,
    E3 extends Env,
    E4 extends Env,
    E5 extends Env,
    E6 extends Env,
    E7 extends Env,
    R extends Value<O> | Promise<Value<O>>,
  >(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    mw3: MiddlewareHandler<E4, P>,
    mw4: MiddlewareHandler<E5, P>,
    mw5: MiddlewareHandler<E6, P>,
    mw6: MiddlewareHandler<E7, P>,
    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7, P, O, R>
  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7, P, O, R>
  <
    E2 extends Env,
    E3 extends Env,
    E4 extends Env,
    E5 extends Env,
    E6 extends Env,
    E7 extends Env,
    E8 extends Env,
    R extends Value<O> | Promise<Value<O>>,
  >(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    mw3: MiddlewareHandler<E4, P>,
    mw4: MiddlewareHandler<E5, P>,
    mw5: MiddlewareHandler<E6, P>,
    mw6: MiddlewareHandler<E7, P>,
    mw7: MiddlewareHandler<E8, P>,
    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7 & E8, P, O, R>
  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7 & E8, P, O, R>
  <
    E2 extends Env,
    E3 extends Env,
    E4 extends Env,
    E5 extends Env,
    E6 extends Env,
    E7 extends Env,
    E8 extends Env,
    E9 extends Env,
    R extends Value<O> | Promise<Value<O>>,
  >(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    mw3: MiddlewareHandler<E4, P>,
    mw4: MiddlewareHandler<E5, P>,
    mw5: MiddlewareHandler<E6, P>,
    mw6: MiddlewareHandler<E7, P>,
    mw7: MiddlewareHandler<E8, P>,
    mw8: MiddlewareHandler<E9, P>,
    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9, P, O, R>
  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9, P, O, R>
  <
    E2 extends Env,
    E3 extends Env,
    E4 extends Env,
    E5 extends Env,
    E6 extends Env,
    E7 extends Env,
    E8 extends Env,
    E9 extends Env,
    E10 extends Env,
    R extends Value<O> | Promise<Value<O>>,
  >(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    mw3: MiddlewareHandler<E4, P>,
    mw4: MiddlewareHandler<E5, P>,
    mw5: MiddlewareHandler<E6, P>,
    mw6: MiddlewareHandler<E7, P>,
    mw7: MiddlewareHandler<E8, P>,
    mw8: MiddlewareHandler<E9, P>,
    mw9: MiddlewareHandler<E10, P>,
    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9 & E10, P, O, R>
  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9 & E10, P, O, R>
}

/** @experimental */
export interface DefineHandler<E extends Env = Env, P extends string = string> {
  <O extends Options<E, P>>(options: O): HandlerBuilder<E, P, O>
  <E2 extends Env = E, P2 extends string = P, R = any>(
    handler: Callback<E2, P2, {}, R>
  ): Built<E2, P2, {}, R>
  <E2 extends Env, R>(
    mw: MiddlewareHandler<E2, P>,
    handler: Callback<E & E2, P, {}, R>
  ): Built<E & E2, P, {}, R>
  <E2 extends Env, E3 extends Env, R>(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    handler: Callback<E & E2 & E3, P, {}, R>
  ): Built<E & E2 & E3, P, {}, R>
  <E2 extends Env, E3 extends Env, E4 extends Env, R>(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    mw3: MiddlewareHandler<E4, P>,
    handler: Callback<E & E2 & E3 & E4, P, {}, R>
  ): Built<E & E2 & E3 & E4, P, {}, R>
  <E2 extends Env, E3 extends Env, E4 extends Env, E5 extends Env, R>(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    mw3: MiddlewareHandler<E4, P>,
    mw4: MiddlewareHandler<E5, P>,
    handler: Callback<E & E2 & E3 & E4 & E5, P, {}, R>
  ): Built<E & E2 & E3 & E4 & E5, P, {}, R>
  <E2 extends Env, E3 extends Env, E4 extends Env, E5 extends Env, E6 extends Env, R>(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    mw3: MiddlewareHandler<E4, P>,
    mw4: MiddlewareHandler<E5, P>,
    mw5: MiddlewareHandler<E6, P>,
    handler: Callback<E & E2 & E3 & E4 & E5 & E6, P, {}, R>
  ): Built<E & E2 & E3 & E4 & E5 & E6, P, {}, R>
  <
    E2 extends Env,
    E3 extends Env,
    E4 extends Env,
    E5 extends Env,
    E6 extends Env,
    E7 extends Env,
    R,
  >(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    mw3: MiddlewareHandler<E4, P>,
    mw4: MiddlewareHandler<E5, P>,
    mw5: MiddlewareHandler<E6, P>,
    mw6: MiddlewareHandler<E7, P>,
    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7, P, {}, R>
  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7, P, {}, R>
  <
    E2 extends Env,
    E3 extends Env,
    E4 extends Env,
    E5 extends Env,
    E6 extends Env,
    E7 extends Env,
    E8 extends Env,
    R,
  >(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    mw3: MiddlewareHandler<E4, P>,
    mw4: MiddlewareHandler<E5, P>,
    mw5: MiddlewareHandler<E6, P>,
    mw6: MiddlewareHandler<E7, P>,
    mw7: MiddlewareHandler<E8, P>,
    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7 & E8, P, {}, R>
  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7 & E8, P, {}, R>
  <
    E2 extends Env,
    E3 extends Env,
    E4 extends Env,
    E5 extends Env,
    E6 extends Env,
    E7 extends Env,
    E8 extends Env,
    E9 extends Env,
    R,
  >(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    mw3: MiddlewareHandler<E4, P>,
    mw4: MiddlewareHandler<E5, P>,
    mw5: MiddlewareHandler<E6, P>,
    mw6: MiddlewareHandler<E7, P>,
    mw7: MiddlewareHandler<E8, P>,
    mw8: MiddlewareHandler<E9, P>,
    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9, P, {}, R>
  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9, P, {}, R>
  <
    E2 extends Env,
    E3 extends Env,
    E4 extends Env,
    E5 extends Env,
    E6 extends Env,
    E7 extends Env,
    E8 extends Env,
    E9 extends Env,
    E10 extends Env,
    R,
  >(
    mw1: MiddlewareHandler<E2, P>,
    mw2: MiddlewareHandler<E3, P>,
    mw3: MiddlewareHandler<E4, P>,
    mw4: MiddlewareHandler<E5, P>,
    mw5: MiddlewareHandler<E6, P>,
    mw6: MiddlewareHandler<E7, P>,
    mw7: MiddlewareHandler<E8, P>,
    mw8: MiddlewareHandler<E9, P>,
    mw9: MiddlewareHandler<E10, P>,
    handler: Callback<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9 & E10, P, {}, R>
  ): Built<E & E2 & E3 & E4 & E5 & E6 & E7 & E8 & E9 & E10, P, {}, R>
  <E2 extends Env = E, P2 extends string = P, O extends Options<E2, P2> = Options<E2, P2>>(
    options: O
  ): HandlerBuilder<E2, P2, O>
  <E2 extends Env = E, P2 extends string = P, R = any>(
    ...handlers: [...MiddlewareHandler<E2, P2>[], Callback<E2, P2, {}, R>]
  ): Built<E2, P2, {}, R>
}

const slots = ['param', 'query', 'header', 'cookie', 'form', 'json'] as const
const isSchema = (rule: Rule): rule is StandardSchema<any, any> => '~standard' in rule

const build = (options: Options, handlers: Function[]) => {
  const handler = handlers[handlers.length - 1]
  const middleware = handlers.slice(0, -1)
  return Object.assign(
    async (c: Context) => {
      const run = async () => {
        const input: Record<string, unknown> = {}
        const failures: ValidationFailure['issues'] = []
        for (const slot of slots) {
          const rule = options[slot]
          if (!rule) {
            continue
          }
          const response = await validator(slot, async (value, context) => {
            if (isSchema(rule)) {
              const result = await rule['~standard'].validate(value)
              if (result.issues) {
                failures.push({ slot, issues: result.issues })
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
            return response
          }
        }
        if (failures.length) {
          throw new HTTPException(400, {
            res: Response.json({
              error: 'Validation failed',
              issues: failures.map(({ slot, issues }) => ({
                slot,
                issues: issues.map(({ message, path }) => ({
                  message,
                  ...(path?.length
                    ? {
                        path: path
                          .map((item) => String(typeof item === 'object' ? item.key : item))
                          .join('.'),
                      }
                    : {}),
                })),
              })),
            }),
            cause: { issues: failures } satisfies ValidationFailure,
          })
        }
        let value = await handler(c, input)
        if (value instanceof Response) {
          return value
        }
        if (options.response) {
          const rule = options.response
          if (isSchema(rule)) {
            const result = await rule['~standard'].validate(value)
            if (result.issues) {
              throw new HTTPException(500, {
                res: Response.json({ error: 'Response validation failed' }),
                cause: {
                  issues: [{ slot: 'response', issues: result.issues }],
                } satisfies ValidationFailure,
              })
            }
            value = result.value
          } else {
            value = await rule(value, c)
            if (value instanceof Response) {
              return value
            }
          }
          return c.json(value)
        }
        if (value == null) {
          return c.body(null, 204)
        }
        if (typeof value === 'string' || value.isEscaped) {
          return c.html(value)
        }
        return c.json(value)
      }
      let index = -1
      const dispatch = async (i: number): Promise<void> => {
        if (i <= index) {
          throw new Error('next() called multiple times')
        }
        index = i
        const response =
          i === middleware.length ? await run() : await middleware[i](c, () => dispatch(i + 1))
        if (response instanceof Response) {
          c.res = response
        }
      }
      await dispatch(0)
      return c.res
    },
    { validations: options }
  )
}

/** Define a handler and its validation in one place. @experimental */
export const defineHandler: DefineHandler = ((...args: any[]) => {
  if (typeof args[0] === 'object') {
    return (...handlers: Function[]) => build(args[0], handlers)
  }
  return build({}, args)
}) as DefineHandler
