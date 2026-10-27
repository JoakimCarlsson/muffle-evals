/**
 * @module
 * `defineHandler()` for Hono: a handler together with its request and response validation.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context } from "../../context";
import { HTTPException } from "../../http-exception";
import type {
  Env,
  FormValue,
  Handler,
  Input,
  IntersectNonAnyTypes,
  MiddlewareHandler,
  TypedResponse,
  ValidationTargets,
} from "../../types";
import type { ContentfulStatusCode } from "../../utils/http-status";
import type { JSONParsed } from "../../utils/types";
import { validator } from "../../validator";
import type { InferInput } from "../../validator/utils";

/**
 * Standard Schema (https://standardschema.dev) v1 interface.
 * Implemented by zod, valibot, arktype and others.
 *
 * @experimental
 */
export interface StandardSchema<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) =>
      | { readonly value: Output; readonly issues?: undefined }
      | { readonly issues: ReadonlyArray<ValidationIssue> }
      | Promise<
          | { readonly value: Output; readonly issues?: undefined }
          | { readonly issues: ReadonlyArray<ValidationIssue> }
        >;
    readonly types?:
      { readonly input: Input; readonly output: Output } | undefined;
  };
}

/**
 * An issue reported by a Standard Schema.
 *
 * @experimental
 */
export interface ValidationIssue {
  readonly message: string;
  readonly path?:
    ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined;
}

/**
 * The `cause` of the `HTTPException` thrown when a Standard Schema fails.
 *
 * @experimental
 */
export interface ValidationFailure {
  issues: {
    slot: RequestTarget | "response";
    issues: ReadonlyArray<ValidationIssue>;
  }[];
}

type RequestTarget = "param" | "query" | "header" | "cookie" | "form" | "json";

const REQUEST_TARGETS: readonly RequestTarget[] = [
  "param",
  "query",
  "header",
  "cookie",
  "form",
  "json",
];

type Validation<In, E extends Env, P extends string> =
  StandardSchema<any, any> | ((value: In, c: Context<E, P>) => any);

/**
 * Options of `defineHandler()`.
 *
 * @experimental
 */
export type DefineHandlerOptions<
  E extends Env = any,
  P extends string = string,
> = {
  [K in RequestTarget]?: Validation<ValidationTargets[K], E, P>;
} & {
  response?: Validation<any, E, P>;
};

type ValidationOutput<V> =
  V extends StandardSchema<any, infer Out>
    ? Out
    : V extends (...args: any[]) => infer R
      ? Exclude<Awaited<R>, Response | TypedResponse<any, any, any>>
      : never;

type ValidationInput<V, K extends RequestTarget> =
  V extends StandardSchema<infer In, any>
    ? In
    : K extends "json"
      ? ValidationOutput<V>
      : InferInput<ValidationOutput<V>, K, FormValue>;

type OptionTargets<O> = Extract<keyof O, RequestTarget>;

/** The validated values given to the handler as its second argument. */
export type DefineHandlerInput<O> = {
  [K in OptionTargets<O>]: ValidationOutput<O[K]>;
};

type OptionsToInput<O> = [OptionTargets<O>] extends [never]
  ? {}
  : {
      in: { [K in OptionTargets<O>]: ValidationInput<O[K], K> };
      out: { [K in OptionTargets<O>]: ValidationOutput<O[K]> };
    };

type ResponseInput<O> = O extends { response: infer S }
  ? S extends StandardSchema<infer In, any>
    ? In
    : any
  : unknown;

type ValueToResponse<T> = T extends Response
  ? T
  : T extends null | undefined | void
    ? Response & TypedResponse<undefined, 204, "body">
    : T extends string
      ? Response & TypedResponse<string, ContentfulStatusCode, "text">
      : Response & TypedResponse<JSONParsed<T>, ContentfulStatusCode, "json">;

type DefinedResponse<O, R> = O extends { response: infer S }
  ? | Extract<Awaited<R>, Response>
    | ([Exclude<Awaited<R>, Response>] extends [never]
        ? never
        : Response &
            TypedResponse<
              JSONParsed<ValidationOutput<S>>,
              ContentfulStatusCode,
              "json"
            >)
  : ValueToResponse<Awaited<R>>;

type DefinedHandlerFn<
  E extends Env,
  P extends string,
  I extends Input,
  O,
  R,
> = (
  c: Context<E, P, I & OptionsToInput<O>>,
  input: DefineHandlerInput<O>,
) => R;

type Defined<
  E extends Env,
  P extends string,
  I extends Input,
  O,
  R,
  X,
> = Handler<E, P, I & OptionsToInput<O>, Promise<DefinedResponse<O, R>>> & X;

type ReturnOf<O> =
  ResponseInput<O> | Response | Promise<ResponseInput<O> | Response>;

/**
 * Call signatures shared by `defineHandler(...)` and `defineHandler(options)(...)`.
 *
 * @experimental
 */
export interface HandlerBuilder<
  O extends DefineHandlerOptions,
  E0 extends Env,
  P0 extends string,
  X,
> {
  <
    E extends Env = E0,
    P extends string = P0,
    I extends Input = {},
    R extends ReturnOf<O> = ReturnOf<O>,
  >(
    handler: DefinedHandlerFn<E, P, I, O, R>,
  ): Defined<E, P, I, O, R, X>;

  <
    E1 extends Env = any,
    P extends string = P0,
    I1 extends Input = {},
    R extends ReturnOf<O> = ReturnOf<O>,
  >(
    mw1: MiddlewareHandler<E1, P, I1, any>,
    handler: DefinedHandlerFn<IntersectNonAnyTypes<[E0, E1]>, P, I1, O, R>,
  ): Defined<IntersectNonAnyTypes<[E0, E1]>, P, I1, O, R, X>;

  <
    E1 extends Env = any,
    E2 extends Env = any,
    P extends string = P0,
    I1 extends Input = {},
    I2 extends Input = {},
    R extends ReturnOf<O> = ReturnOf<O>,
  >(
    mw1: MiddlewareHandler<E1, P, I1, any>,
    mw2: MiddlewareHandler<E2, P, I2, any>,
    handler: DefinedHandlerFn<
      IntersectNonAnyTypes<[E0, E1, E2]>,
      P,
      I1 & I2,
      O,
      R
    >,
  ): Defined<IntersectNonAnyTypes<[E0, E1, E2]>, P, I1 & I2, O, R, X>;

  <
    E1 extends Env = any,
    E2 extends Env = any,
    E3 extends Env = any,
    P extends string = P0,
    I1 extends Input = {},
    I2 extends Input = {},
    I3 extends Input = {},
    R extends ReturnOf<O> = ReturnOf<O>,
  >(
    mw1: MiddlewareHandler<E1, P, I1, any>,
    mw2: MiddlewareHandler<E2, P, I2, any>,
    mw3: MiddlewareHandler<E3, P, I3, any>,
    handler: DefinedHandlerFn<
      IntersectNonAnyTypes<[E0, E1, E2, E3]>,
      P,
      I1 & I2 & I3,
      O,
      R
    >,
  ): Defined<IntersectNonAnyTypes<[E0, E1, E2, E3]>, P, I1 & I2 & I3, O, R, X>;

  <
    E1 extends Env = any,
    E2 extends Env = any,
    E3 extends Env = any,
    E4 extends Env = any,
    P extends string = P0,
    I1 extends Input = {},
    I2 extends Input = {},
    I3 extends Input = {},
    I4 extends Input = {},
    R extends ReturnOf<O> = ReturnOf<O>,
  >(
    mw1: MiddlewareHandler<E1, P, I1, any>,
    mw2: MiddlewareHandler<E2, P, I2, any>,
    mw3: MiddlewareHandler<E3, P, I3, any>,
    mw4: MiddlewareHandler<E4, P, I4, any>,
    handler: DefinedHandlerFn<
      IntersectNonAnyTypes<[E0, E1, E2, E3, E4]>,
      P,
      I1 & I2 & I3 & I4,
      O,
      R
    >,
  ): Defined<
    IntersectNonAnyTypes<[E0, E1, E2, E3, E4]>,
    P,
    I1 & I2 & I3 & I4,
    O,
    R,
    X
  >;
}

/**
 * The type of `defineHandler`.
 *
 * @experimental
 */
export type DefineHandler<
  E0 extends Env = any,
  P0 extends string = string,
> = HandlerBuilder<{}, E0, P0, {}> & {
  <const O extends DefineHandlerOptions<E0, P0>>(
    options: O,
  ): HandlerBuilder<O, E0, P0, { validations: O }>;
};

const isStandardSchema = (value: unknown): value is StandardSchema<any, any> =>
  (typeof value === "object" || typeof value === "function") &&
  value !== null &&
  typeof (value as any)["~standard"]?.validate === "function";

const failureResponse = (
  status: ContentfulStatusCode,
  body: object,
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const issuePath = (path: ValidationIssue["path"]): string | undefined =>
  path?.length
    ? path
        .map((p) => String(typeof p === "object" && p !== null ? p.key : p))
        .join(".")
    : undefined;

const toResponse = async (c: Context, value: unknown): Promise<Response> => {
  if (value instanceof Response) {
    return value;
  }
  if (value === null || value === undefined) {
    return c.body(null, 204);
  }
  if (
    typeof value === "string" ||
    (typeof value === "object" &&
      (value as { isEscaped?: unknown }).isEscaped === true)
  ) {
    return c.html(value as string);
  }
  return c.json(value as object);
};

const throwFailure = (
  status: ContentfulStatusCode,
  failures: ValidationFailure["issues"],
  body: object,
): never => {
  throw new HTTPException(status, {
    res: failureResponse(status, body),
    message: (body as { error: string }).error,
    cause: { issues: failures } satisfies ValidationFailure,
  });
};

const createCore = (
  options: DefineHandlerOptions | undefined,
  handler: Function,
) => {
  const targets = options
    ? REQUEST_TARGETS.filter((t) => options[t] !== undefined)
    : [];
  const responseValidation = options?.response;

  return async (c: Context): Promise<Response> => {
    const failures: ValidationFailure["issues"] = [];

    for (const target of targets) {
      const validation = options![target]!;
      const res: unknown = await (validator as any)(
        target,
        async (value: unknown, ctx: Context) => {
          if (isStandardSchema(validation)) {
            const result = await validation["~standard"].validate(value);
            if (result.issues) {
              failures.push({ slot: target, issues: result.issues });
              return value;
            }
            return result.value;
          }
          return (validation as Function)(value, ctx);
        },
      )(c, async () => {});
      if (res instanceof Response) {
        return res;
      }
    }

    if (failures.length) {
      throwFailure(400, failures, {
        error: "Validation failed",
        issues: failures.map(({ slot, issues }) => ({
          slot,
          issues: issues.map(({ message, path }) => {
            const p = issuePath(path);
            return p === undefined ? { message } : { message, path: p };
          }),
        })),
      });
    }

    const input: Record<string, unknown> = {};
    for (const target of targets) {
      input[target] = (c.req as any).valid(target);
    }

    let value = await handler(c, input);
    if (value instanceof Response) {
      return value;
    }

    if (responseValidation !== undefined) {
      if (isStandardSchema(responseValidation)) {
        const result = await responseValidation["~standard"].validate(value);
        if (result.issues) {
          throwFailure(500, [{ slot: "response", issues: result.issues }], {
            error: "Response validation failed",
          });
        } else {
          value = result.value;
        }
      } else {
        value = await (responseValidation as Function)(value, c);
        if (value instanceof Response) {
          return value;
        }
      }
      return value === undefined ? c.body(null, 204) : c.json(value as object);
    }

    return toResponse(c, value);
  };
};

const createHandler = (
  options: DefineHandlerOptions | undefined,
  fns: Function[],
) => {
  const middleware = fns.slice(0, -1) as MiddlewareHandler[];
  const core = createCore(options, fns[fns.length - 1]);

  const run = async (c: Context, i: number): Promise<Response | void> => {
    if (i === middleware.length) {
      return core(c);
    }
    let called = false;
    return middleware[i](c, async () => {
      if (called) {
        throw new Error("next() called multiple times");
      }
      called = true;
      const res = await run(c, i + 1);
      if (res instanceof Response && !c.finalized) {
        c.res = res;
      }
    });
  };

  const handler = (c: Context) => run(c, 0);
  return options ? Object.assign(handler, { validations: options }) : handler;
};

/**
 * Defines a handler together with its request and response validation.
 *
 * Without options the handler's return value is converted to a `Response`: an object becomes JSON,
 * a string, JSX or `html` template becomes HTML, `null` / `undefined` becomes `204`, and a
 * `Response` is returned as is. Middleware can be given before the handler.
 *
 * With options, each request target is validated in the order `param`, `query`, `header`,
 * `cookie`, `form`, `json` before the handler runs, and `response` validates the returned value.
 * Validations are Standard Schemas or functions `(value, c) => newValue`.
 * A failed Standard Schema throws an `HTTPException` (`400` for the request, `500` for the response).
 *
 * @experimental
 *
 * @example
 * ```ts
 * app.get(
 *   '/posts',
 *   defineHandler({ query: z.object({ page: z.string() }), response: PostsSchema })((c, { query }) =>
 *     getPosts(query.page)
 *   )
 * )
 * ```
 */
export const defineHandler: DefineHandler = ((...args: unknown[]) => {
  if (typeof args[0] === "function") {
    return createHandler(undefined, args as Function[]);
  }
  const options = args[0] as DefineHandlerOptions;
  return (...fns: Function[]) => createHandler(options, fns);
}) as any;
