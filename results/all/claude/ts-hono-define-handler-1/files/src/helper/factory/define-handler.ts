/**
 * @module
 * `defineHandler()` for Hono: a handler together with its request and response validation.
 */

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
import type { ContentfulStatusCode } from '../../utils/http-status'
import type { JSONParsed } from '../../utils/types'
import { validator } from '../../validator'

/**
 * Standard Schema (https://standardschema.dev) v1 interface. Zod, Valibot, ArkType and others
 * implement it, so no dependency is needed.
 *
 * @experimental
 */
export interface StandardSchema<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown
    ) => StandardResult<Output> | Promise<StandardResult<Output>>
    readonly types?: { readonly input: Input; readonly output: Output } | undefined
  }
}

type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<ValidationIssue> }

/**
 * A raw issue reported by a Standard Schema.
 *
 * @experimental
 */
export interface ValidationIssue {
  readonly message: string
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined
}

/**
 * The raw issues of one failed slot, as found in `HTTPException#cause.issues`.
 * `slot` is a request target or `'response'`.
 *
 * @experimental
 */
export interface ValidationFailure {
  slot: Slot | 'response'
  issues: ReadonlyArray<ValidationIssue>
}

type Slot = 'param' | 'query' | 'header' | 'cookie' | 'form' | 'json'

const slots: Slot[] = ['param', 'query', 'header', 'cookie', 'form', 'json']

type Validation<In, E extends Env, P extends string> =
  | StandardSchema<any, any>
  | ((value: In, c: Context<E, P>) => any)

type ResponseValidation<E extends Env, P extends string> =
  | StandardSchema<any, any>
  | ((value: any, c: Context<E, P>) => any)

/**
 * Validations given to `defineHandler()`.
 *
 * @experimental
 */
export type DefineHandlerOptions<E extends Env = any, P extends string = any> = {
  [K in Slot]?: Validation<ValidationTargets<any, P>[K], E, P>
} & { response?: ResponseValidation<E, P> }

type OutputOf<V> = V extends StandardSchema<any, infer O>
  ? O
  : V extends (...args: any) => infer R
    ? Exclude<Awaited<R>, Response | TypedResponse<any, any, any>>
    : never

type InputOf<V> = V extends StandardSchema<infer I, any> ? I : OutputOf<V>

type SlotKeys<O> = keyof O & Slot

type HandlerInput<O> = {
  in: { [K in SlotKeys<O>]: InputOf<O[K]> }
  out: { [K in SlotKeys<O>]: OutputOf<O[K]> }
}

type ValidatedInput<O> = { [K in SlotKeys<O>]: OutputOf<O[K]> }

type Allowed<O> = O extends { response: infer S }
  ? S extends StandardSchema<infer I, any>
    ? unknown extends I
      ? unknown
      : I | Response | null | undefined
    : unknown
  : unknown

type Wire<R> = R extends Response
  ? R
  : R extends null | undefined | void
    ? TypedResponse<null, 204, 'body'>
    : R extends string | { isEscaped: true }
      ? TypedResponse<string, ContentfulStatusCode, 'html'>
      : TypedResponse<JSONParsed<R>, ContentfulStatusCode, 'json'>

type Wired<O, R> = O extends { response: infer S }
  ? Extract<Awaited<R>, Response> | TypedResponse<JSONParsed<OutputOf<S>>, ContentfulStatusCode, 'json'>
  : Wire<Awaited<R>>

type HandlerFn<E extends Env, P extends string, O, R> = (
  c: Context<E, P, HandlerInput<O>>,
  input: ValidatedInput<O>
) => R

type MiddlewareList = MiddlewareHandler<any, any, any, any>[]

type MiddlewareEnvs<MW extends MiddlewareList> = {
  [K in keyof MW]: MW[K] extends MiddlewareHandler<infer E, any, any, any> ? E : never
}

type Result<E extends Env, P extends string, O, R> = Handler<
  E,
  P,
  HandlerInput<O>,
  Promise<Wired<O, R>>
>

/**
 * Handler without validation options.
 *
 * @experimental
 */
export interface DefineHandler<E0 extends Env, P0 extends string> {
  <E extends Env = E0, P extends string = P0, R = unknown>(
    handler: HandlerFn<E, P, {}, R>
  ): Result<E, P, {}, R>
  <MW extends MiddlewareList, P extends string = P0, R = unknown>(
    ...args: [
      ...MW,
      HandlerFn<IntersectNonAnyTypes<[E0, ...MiddlewareEnvs<MW>]>, P, {}, R>,
    ]
  ): Result<IntersectNonAnyTypes<[E0, ...MiddlewareEnvs<MW>]>, P, {}, R>
  <O extends DefineHandlerOptions<E0, P0>>(options: O): DefineHandlerWithOptions<E0, P0, O>
}

/**
 * The function returned by `defineHandler(options)`.
 *
 * @experimental
 */
export interface DefineHandlerWithOptions<E0 extends Env, P0 extends string, O> {
  <E extends Env = E0, P extends string = P0, R extends Allowed<O> | Promise<Allowed<O>> = any>(
    handler: HandlerFn<E, P, O, R>
  ): Result<E, P, O, R> & { validations: O }
  <
    MW extends MiddlewareList,
    P extends string = P0,
    R extends Allowed<O> | Promise<Allowed<O>> = any,
  >(
    ...args: [
      ...MW,
      HandlerFn<IntersectNonAnyTypes<[E0, ...MiddlewareEnvs<MW>]>, P, O, R>,
    ]
  ): Result<IntersectNonAnyTypes<[E0, ...MiddlewareEnvs<MW>]>, P, O, R> & { validations: O }
}

const isStandardSchema = (v: unknown): v is StandardSchema =>
  (typeof v === 'object' || typeof v === 'function') && v !== null && '~standard' in v

const pathOf = (path: ValidationIssue['path']): string | undefined =>
  path?.length
    ? path.map((p) => String(typeof p === 'object' && p !== null ? p.key : p)).join('.')
    : undefined

const failure = (
  status: 400 | 500,
  body: Record<string, unknown>,
  failures: ValidationFailure[]
) =>
  new HTTPException(status, {
    message: String(body.error),
    res: Response.json(body, { status }),
    cause: { issues: failures },
  })

/**
 * Runs one validation. A Standard Schema failure is pushed to `failures` and `undefined` returned;
 * a function result (possibly a `Response`) is returned as is.
 */
const run = async (
  slot: ValidationFailure['slot'],
  validation: unknown,
  value: unknown,
  c: Context,
  failures: ValidationFailure[]
): Promise<unknown> => {
  if (!isStandardSchema(validation)) {
    return (validation as (v: unknown, c: Context) => unknown)(value, c)
  }
  const result = await validation['~standard'].validate(value)
  if (result.issues) {
    failures.push({ slot, issues: result.issues })
    return undefined
  }
  return result.value
}

const toResponse = (c: Context, value: unknown): Response | Promise<Response> => {
  if (value instanceof Response) {
    return value
  }
  if (value === null || value === undefined) {
    return c.body(null, 204)
  }
  if (
    typeof value === 'string' ||
    value instanceof String ||
    (value as { isEscaped?: boolean }).isEscaped
  ) {
    return c.html(value as string)
  }
  return c.json(value as object)
}

const noop = async () => {}

const build = (options: DefineHandlerOptions | undefined, fns: Function[]) => {
  const handler = fns[fns.length - 1] as Function
  const middleware = fns.slice(0, -1) as MiddlewareHandler[]

  const final = async (c: Context): Promise<Response> => {
    const input: Record<string, unknown> = {}
    if (options) {
      const failures: ValidationFailure[] = []
      for (const slot of slots) {
        const validation = options[slot]
        if (!validation) {
          continue
        }
        const res = await validator(slot, (value: unknown, c: Context) =>
          run(slot, validation, value, c, failures).then((out) => (input[slot] = out ?? {}))
        )(c, noop)
        if ((res as unknown) instanceof Response) {
          return res
        }
      }
      if (failures.length) {
        throw failure(
          400,
          {
            error: 'Validation failed',
            issues: failures.map(({ slot, issues }) => ({
              slot,
              issues: issues.map(({ message, path }) => {
                const p = pathOf(path)
                return p === undefined ? { message } : { message, path: p }
              }),
            })),
          },
          failures
        )
      }
    }

    const returned = await handler(c, input)
    if (!options?.response || returned instanceof Response) {
      return toResponse(c, returned)
    }

    const failures: ValidationFailure[] = []
    const out = await run('response', options.response, returned, c, failures)
    if (failures.length) {
      throw failure(500, { error: 'Response validation failed' }, failures)
    }
    return out instanceof Response ? out : c.json(out as object)
  }

  const dispatch = async (c: Context, i: number): Promise<Response | void> => {
    if (i === middleware.length) {
      return final(c)
    }
    return middleware[i](c, async () => {
      const res = await dispatch(c, i + 1)
      if (res) {
        c.res = res
      }
    })
  }

  const composed = async (c: Context): Promise<Response | void> => {
    const res = await dispatch(c, 0)
    return res ?? (c.finalized ? c.res : undefined)
  }
  return composed
}

/**
 * Defines a handler together with its request and response validation.
 *
 * Order: middleware, request validation (`param`, `query`, `header`, `cookie`, `form`, `json`),
 * handler, response validation, then the code of the middleware after `await next()`.
 *
 * The handler's return value is converted to a `Response`: an object becomes JSON, a string, JSX or
 * `html` template becomes HTML, `null`/`undefined` becomes `204`, a `Response` is kept.
 *
 * @experimental
 *
 * @example
 * ```ts
 * app.get(
 *   '/posts',
 *   defineHandler({ query: z.object({ page: z.coerce.number() }) })((c, { query }) => ({
 *     page: query.page,
 *   }))
 * )
 * ```
 */
export const defineHandler: DefineHandler<any, any> = ((...args: unknown[]) => {
  if (typeof args[0] === 'function') {
    return build(undefined, args as Function[])
  }
  const options = args[0] as DefineHandlerOptions
  return (...fns: Function[]) => Object.assign(build(options, fns), { validations: options })
}) as any
