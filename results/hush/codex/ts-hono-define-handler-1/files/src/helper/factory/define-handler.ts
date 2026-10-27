/** @module Experimental handlers with request and response validation. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context } from '../../context'
import { HTTPException } from '../../http-exception'
import type { Env, Handler, MiddlewareHandler, TypedResponse, ValidationTargets } from '../../types'
import type { HtmlEscaped } from '../../utils/html'
import type { JSONParsed } from '../../utils/types'
import { validator } from '../../validator'

/** @experimental A Standard Schema issue. */
export interface ValidationIssue {
  readonly message: string
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
}

/** @experimental A failed validation target, retaining the original issues. */
export interface ValidationFailure {
  readonly slot: keyof ValidationTargets | 'response'
  readonly issues: ReadonlyArray<ValidationIssue>
}

/** @experimental The dependency-free Standard Schema validation contract. */
export interface StandardSchema<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version?: 1
    readonly vendor?: string
    readonly types?: { readonly input: Input; readonly output: Output }
    readonly validate: (
      value: unknown
    ) =>
      | { readonly value: Output; readonly issues?: undefined }
      | { readonly issues: ReadonlyArray<ValidationIssue> }
      | Promise<
          | { readonly value: Output; readonly issues?: undefined }
          | { readonly issues: ReadonlyArray<ValidationIssue> }
        >
  }
}

type Validation<E extends Env, P extends string, V = any> =
  | StandardSchema<any, any>
  | ((value: V, c: Context<E, P>) => any)
type Options<E extends Env, P extends string> = {
  [K in keyof ValidationTargets]?: Validation<E, P, ValidationTargets[K]>
} & { response?: Validation<E, P> }
type Output<V> =
  V extends StandardSchema<any, infer O>
    ? O
    : V extends (...args: any[]) => infer R
      ? Exclude<Awaited<R>, Response>
      : never
type SchemaInput<V> = V extends StandardSchema<infer I, any> ? I : unknown
type RequestInput<O> = {
  in: {
    [K in keyof O & keyof ValidationTargets]: O[K] extends StandardSchema<infer I, any>
      ? I
      : ValidationTargets[K]
  }
  out: { [K in keyof O & keyof ValidationTargets]: Output<O[K]> }
}
type Result<R> = R extends Response | TypedResponse
  ? R
  : R extends null | undefined | void
    ? TypedResponse<null, 204, 'text'>
    : R extends string | HtmlEscaped
      ? TypedResponse<string, 200, 'html'>
      : TypedResponse<JSONParsed<R>, 200, 'json'>
type Returned<E extends Env, P extends string, O, R> = Handler<
  E,
  P,
  RequestInput<O>,
  Promise<
    'response' extends keyof O
      ? TypedResponse<JSONParsed<Output<O['response']>>, 200, 'json'>
      : Result<Awaited<R>>
  >
>
type Callback<E extends Env, P extends string, O, R> = (
  c: Context<E, P, RequestInput<O>>,
  input: RequestInput<O>['out']
) => R

type Allowed<O> = 'response' extends keyof O ? SchemaInput<O['response']> | Response : unknown

/** @experimental A handler builder with validation options. */
export interface HandlerBuilder<E extends Env, P extends string, O> {
  <R extends Allowed<O> | Promise<Allowed<O>>>(
    handler: Callback<E, P, O, R>
  ): Returned<E, P, O, R> & { validations: O }
  <R extends Allowed<O> | Promise<Allowed<O>>, E0 extends Env = E>(
    mw0: MiddlewareHandler<E0, P, any, any>,
    handler: Callback<E & E0, P, O, R>
  ): Returned<E & E0, P, O, R> & { validations: O }
  <R extends Allowed<O> | Promise<Allowed<O>>, E0 extends Env = E, E1 extends Env = E>(
    mw0: MiddlewareHandler<E0, P, any, any>,
    mw1: MiddlewareHandler<E1, P, any, any>,
    handler: Callback<E & E0 & E1, P, O, R>
  ): Returned<E & E0 & E1, P, O, R> & { validations: O }
  <
    R extends Allowed<O> | Promise<Allowed<O>>,
    E0 extends Env = E,
    E1 extends Env = E,
    E2 extends Env = E,
  >(
    mw0: MiddlewareHandler<E0, P, any, any>,
    mw1: MiddlewareHandler<E1, P, any, any>,
    mw2: MiddlewareHandler<E2, P, any, any>,
    handler: Callback<E & E0 & E1 & E2, P, O, R>
  ): Returned<E & E0 & E1 & E2, P, O, R> & { validations: O }
  <
    R extends Allowed<O> | Promise<Allowed<O>>,
    E0 extends Env = E,
    E1 extends Env = E,
    E2 extends Env = E,
    E3 extends Env = E,
  >(
    mw0: MiddlewareHandler<E0, P, any, any>,
    mw1: MiddlewareHandler<E1, P, any, any>,
    mw2: MiddlewareHandler<E2, P, any, any>,
    mw3: MiddlewareHandler<E3, P, any, any>,
    handler: Callback<E & E0 & E1 & E2 & E3, P, O, R>
  ): Returned<E & E0 & E1 & E2 & E3, P, O, R> & { validations: O }
  <
    R extends Allowed<O> | Promise<Allowed<O>>,
    E0 extends Env = E,
    E1 extends Env = E,
    E2 extends Env = E,
    E3 extends Env = E,
    E4 extends Env = E,
  >(
    mw0: MiddlewareHandler<E0, P, any, any>,
    mw1: MiddlewareHandler<E1, P, any, any>,
    mw2: MiddlewareHandler<E2, P, any, any>,
    mw3: MiddlewareHandler<E3, P, any, any>,
    mw4: MiddlewareHandler<E4, P, any, any>,
    handler: Callback<E & E0 & E1 & E2 & E3 & E4, P, O, R>
  ): Returned<E & E0 & E1 & E2 & E3 & E4, P, O, R> & { validations: O }
  <
    R extends Allowed<O> | Promise<Allowed<O>>,
    E0 extends Env = E,
    E1 extends Env = E,
    E2 extends Env = E,
    E3 extends Env = E,
    E4 extends Env = E,
    E5 extends Env = E,
  >(
    mw0: MiddlewareHandler<E0, P, any, any>,
    mw1: MiddlewareHandler<E1, P, any, any>,
    mw2: MiddlewareHandler<E2, P, any, any>,
    mw3: MiddlewareHandler<E3, P, any, any>,
    mw4: MiddlewareHandler<E4, P, any, any>,
    mw5: MiddlewareHandler<E5, P, any, any>,
    handler: Callback<E & E0 & E1 & E2 & E3 & E4 & E5, P, O, R>
  ): Returned<E & E0 & E1 & E2 & E3 & E4 & E5, P, O, R> & { validations: O }
}

/** @experimental Define a handler with optional validation and middleware. */
export interface DefineHandler<E extends Env = Env, P extends string = string> {
  <Base extends Env = E, P2 extends string = P, O extends Options<Base, P2> = Options<Base, P2>>(
    options: O
  ): HandlerBuilder<Base, P2, O>
  <Base extends Env = E, P2 extends string = P, R = any>(
    handler: Callback<Base, P2, {}, R>
  ): Returned<Base, P2, {}, R>
  <Base extends Env = E, P2 extends string = P, R = any, E0 extends Env = Base>(
    mw0: MiddlewareHandler<E0, P2, any, any>,
    handler: Callback<Base & E0, P2, {}, R>
  ): Returned<Base & E0, P2, {}, R>
  <
    Base extends Env = E,
    P2 extends string = P,
    R = any,
    E0 extends Env = Base,
    E1 extends Env = Base,
  >(
    mw0: MiddlewareHandler<E0, P2, any, any>,
    mw1: MiddlewareHandler<E1, P2, any, any>,
    handler: Callback<Base & E0 & E1, P2, {}, R>
  ): Returned<Base & E0 & E1, P2, {}, R>
  <
    Base extends Env = E,
    P2 extends string = P,
    R = any,
    E0 extends Env = Base,
    E1 extends Env = Base,
    E2 extends Env = Base,
  >(
    mw0: MiddlewareHandler<E0, P2, any, any>,
    mw1: MiddlewareHandler<E1, P2, any, any>,
    mw2: MiddlewareHandler<E2, P2, any, any>,
    handler: Callback<Base & E0 & E1 & E2, P2, {}, R>
  ): Returned<Base & E0 & E1 & E2, P2, {}, R>
  <
    Base extends Env = E,
    P2 extends string = P,
    R = any,
    E0 extends Env = Base,
    E1 extends Env = Base,
    E2 extends Env = Base,
    E3 extends Env = Base,
  >(
    mw0: MiddlewareHandler<E0, P2, any, any>,
    mw1: MiddlewareHandler<E1, P2, any, any>,
    mw2: MiddlewareHandler<E2, P2, any, any>,
    mw3: MiddlewareHandler<E3, P2, any, any>,
    handler: Callback<Base & E0 & E1 & E2 & E3, P2, {}, R>
  ): Returned<Base & E0 & E1 & E2 & E3, P2, {}, R>
  <
    Base extends Env = E,
    P2 extends string = P,
    R = any,
    E0 extends Env = Base,
    E1 extends Env = Base,
    E2 extends Env = Base,
    E3 extends Env = Base,
    E4 extends Env = Base,
  >(
    mw0: MiddlewareHandler<E0, P2, any, any>,
    mw1: MiddlewareHandler<E1, P2, any, any>,
    mw2: MiddlewareHandler<E2, P2, any, any>,
    mw3: MiddlewareHandler<E3, P2, any, any>,
    mw4: MiddlewareHandler<E4, P2, any, any>,
    handler: Callback<Base & E0 & E1 & E2 & E3 & E4, P2, {}, R>
  ): Returned<Base & E0 & E1 & E2 & E3 & E4, P2, {}, R>
  <
    Base extends Env = E,
    P2 extends string = P,
    R = any,
    E0 extends Env = Base,
    E1 extends Env = Base,
    E2 extends Env = Base,
    E3 extends Env = Base,
    E4 extends Env = Base,
    E5 extends Env = Base,
  >(
    mw0: MiddlewareHandler<E0, P2, any, any>,
    mw1: MiddlewareHandler<E1, P2, any, any>,
    mw2: MiddlewareHandler<E2, P2, any, any>,
    mw3: MiddlewareHandler<E3, P2, any, any>,
    mw4: MiddlewareHandler<E4, P2, any, any>,
    mw5: MiddlewareHandler<E5, P2, any, any>,
    handler: Callback<Base & E0 & E1 & E2 & E3 & E4 & E5, P2, {}, R>
  ): Returned<Base & E0 & E1 & E2 & E3 & E4 & E5, P2, {}, R>
}

const targets = ['param', 'query', 'header', 'cookie', 'form', 'json'] as const
const isSchema = (value: any): value is StandardSchema<any, any> =>
  value != null && typeof value['~standard']?.validate === 'function'

const failure = (issues: ValidationFailure[], response = false): never => {
  const message = response ? 'Response validation failed' : 'Validation failed'
  throw new HTTPException(response ? 500 : 400, {
    message,
    cause: { issues },
    res: Response.json(
      response
        ? { error: message }
        : {
            error: message,
            issues: issues.map(({ slot, issues }) => ({
              slot,
              issues: issues.map(({ message, path }) => ({
                message,
                ...(path?.length
                  ? {
                      path: path
                        .map((part) => String(typeof part === 'object' ? part.key : part))
                        .join('.'),
                    }
                  : {}),
              })),
            })),
          }
    ),
  })
}

const build = (options: Options<any, any>, handlers: Function[]) => {
  const handler = handlers[handlers.length - 1]
  const middleware = handlers.slice(0, -1)
  return Object.assign(
    async (c: Context) => {
      let index = -1
      const dispatch = async (i: number): Promise<void> => {
        if (i <= index) {
          throw new Error('next() called multiple times')
        }
        index = i
        if (i < middleware.length) {
          const res = await middleware[i](c, () => dispatch(i + 1))
          if (res instanceof Response) {
            c.res = res
          }
          return
        }
        const input: Record<string, unknown> = {}
        const issues: ValidationFailure[] = []
        for (const target of targets) {
          const validation = options[target]
          if (!validation) {
            continue
          }
          const res = await validator(target, async (value, context) => {
            if (isSchema(validation)) {
              const result = await validation['~standard'].validate(value)
              if (result.issues) {
                issues.push({ slot: target, issues: result.issues })
                return undefined
              }
              input[target] = result.value
              return result.value
            }
            const result = await validation(value, context)
            if (!(result instanceof Response)) {
              input[target] = result
            }
            return result
          })(c, async () => {})
          if (res instanceof Response) {
            c.res = res
            return
          }
        }
        if (issues.length) {
          failure(issues)
        }
        let value = await handler(c, input)
        if (value instanceof Response) {
          c.res = value
          return
        }
        if (options.response) {
          if (isSchema(options.response)) {
            const result = await options.response['~standard'].validate(value)
            if (result.issues) {
              failure([{ slot: 'response', issues: result.issues }], true)
            }
            value = 'value' in result ? result.value : undefined
          } else {
            value = await options.response(value, c)
            if (value instanceof Response) {
              c.res = value
              return
            }
          }
          c.res = c.json(value)
        } else if (value == null) {
          c.res = c.body(null, 204)
        } else if (typeof value === 'string' || value.isEscaped) {
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

/** @experimental Define a handler and its validation without changing Hono's core. */
export const defineHandler: DefineHandler = ((...args: any[]) => {
  // Callable Standard Schemas are valid options values, not middleware.
  if (typeof args[0] !== 'function') {
    return (...handlers: Function[]) => build(args[0], handlers)
  }
  return build({}, args)
}) as unknown as DefineHandler
