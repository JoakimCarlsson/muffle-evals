/* eslint-disable @typescript-eslint/no-unused-vars */
import { expectTypeOf } from "vitest";
import { z } from "zod";
import { hc } from "../../client";
import { HTTPException } from "../../http-exception";
import { Hono } from "../../index";
import { html } from "../html";
import {
  createFactory,
  createMiddleware,
  defineHandler,
  defineMiddleware,
} from "./index";

type Env = { Variables: { user: string } };

describe("defineHandler without options", () => {
  const app = new Hono();
  app.get(
    "/obj",
    defineHandler(() => ({ ok: true })),
  );
  app.get(
    "/async",
    defineHandler(async () => [1, 2]),
  );
  app.get(
    "/str",
    defineHandler(() => "hi"),
  );
  app.get(
    "/html",
    defineHandler(() => html`<b>x</b>`),
  );
  app.get(
    "/none",
    defineHandler(() => null),
  );
  app.get(
    "/undef",
    defineHandler(async () => undefined),
  );
  app.get(
    "/res",
    defineHandler((c) => c.text("t", 201)),
  );

  it("converts return values", async () => {
    let res = await app.request("/obj");
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("content-type")).toMatch(/json/);
    expect(await (await app.request("/async")).json()).toEqual([1, 2]);
    res = await app.request("/str");
    expect(res.headers.get("content-type")).toMatch(/html/);
    expect(await res.text()).toBe("hi");
    res = await app.request("/html");
    expect(res.headers.get("content-type")).toMatch(/html/);
    expect(await res.text()).toBe("<b>x</b>");
    for (const path of ["/none", "/undef"]) {
      res = await app.request(path);
      expect(res.status).toBe(204);
      expect(await res.text()).toBe("");
    }
    res = await app.request("/res");
    expect(res.status).toBe(201);
  });

  it("runs middleware around the handler", async () => {
    const order: string[] = [];
    const mw = (n: string) =>
      defineMiddleware<Env>(async (c, next) => {
        order.push(`${n}-before`);
        c.set("user", "bob");
        await next();
        order.push(`${n}-after`);
      });
    const app = new Hono();
    app.get(
      "/",
      defineHandler(mw("a"), mw("b"), (c) => {
        expectTypeOf(c.get("user")).toEqualTypeOf<string>();
        order.push("handler");
        return { user: c.get("user") };
      }),
    );
    const res = await app.request("/");
    expect(await res.json()).toEqual({ user: "bob" });
    expect(order).toEqual([
      "a-before",
      "b-before",
      "handler",
      "b-after",
      "a-after",
    ]);
  });

  it("stops the chain when middleware returns a response", async () => {
    const handler = vi.fn(() => "x");
    const app = new Hono();
    app.get(
      "/",
      defineHandler(async (c) => c.text("denied", 401), handler),
    );
    const res = await app.request("/");
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("types with explicit Env and path", async () => {
    const app = new Hono<Env>();
    app.get(
      "/me/:id",
      defineHandler<Env, "/me/:id">((c) => {
        expectTypeOf(c.get("user")).toEqualTypeOf<string>();
        return { id: c.req.param("id") };
      }),
    );
    app.use(async (c, next) => {
      c.set("user", "u");
      await next();
    });
    expect(await (await app.request("/me/7")).json()).toEqual({ id: "7" });
  });

  it("infers the RPC type", async () => {
    const route = new Hono().get(
      "/x",
      defineHandler(() => ({ a: 1 })),
    );
    const client = hc<typeof route>("http://localhost", {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        route.request(input, init),
    });
    const res = await client.x.$get();
    expectTypeOf(await res.json()).toEqualTypeOf<{ a: number }>();
  });

  it("keeps createMiddleware as an alias", () => {
    expect(createMiddleware).toBe(defineMiddleware);
    const f = createFactory();
    expect(typeof f.defineMiddleware).toBe("function");
    expect(typeof f.defineHandler).toBe("function");
  });
});

describe("defineHandler with options", () => {
  const calls: string[] = [];
  const query = z.object({ page: z.coerce.number() });
  const json = z.object({ name: z.string().min(3) });

  const app = new Hono();
  const route = app.post(
    "/items/:id",
    defineHandler({
      param: (v) => {
        calls.push("param");
        return { id: Number(v.id) };
      },
      query,
      json,
      response: z.object({
        id: z.number(),
        name: z.string().transform((s) => s.toUpperCase()),
      }),
    })(async (c, input) => {
      expectTypeOf(input.query.page).toEqualTypeOf<number>();
      expectTypeOf(input.param.id).toEqualTypeOf<number>();
      expect(c.req.valid("json")).toBe(input.json);
      c.status(201);
      c.header("X-A", "b");
      return { id: input.param.id, name: input.json.name };
    }),
  );

  it("validates and transforms", async () => {
    const res = await app.request("/items/5?page=2", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "abc" }),
    });
    expect(res.status).toBe(201);
    expect(res.headers.get("x-a")).toBe("b");
    expect(await res.json()).toEqual({ id: 5, name: "ABC" });
  });

  it("reports all failed targets without the input", async () => {
    let exception: HTTPException | undefined;
    app.onError((e) => {
      exception = e as HTTPException;
      return e instanceof HTTPException
        ? e.getResponse()
        : new Response("x", { status: 500 });
    });
    const res = await app.request("/items/5?page=abc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "secret-ab" === "" ? "" : "a" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe("Validation failed");
    expect(body.issues.map((i: any) => i.slot)).toEqual(["query", "json"]);
    expect(body.issues[0].issues[0].path).toBe("page");
    expect(JSON.stringify(body)).not.toContain("abc");
    expect((exception!.cause as any).issues[0].issues[0].message).toBeTypeOf(
      "string",
    );
  });

  it("keeps malformed JSON as 400", async () => {
    const res = await app.request("/items/5?page=1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Malformed JSON in request body");
  });

  it("returns a Response from a validation function", async () => {
    const handler = vi.fn(() => ({}));
    const app = new Hono();
    app.get(
      "/",
      defineHandler({ query: (_v, c) => c.text("no", 403) })(handler),
    );
    expect((await app.request("/")).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("fails response validation with 500 and no issues", async () => {
    const app = new Hono();
    let cause: unknown;
    app.onError((e) => {
      cause = e.cause;
      return (e as HTTPException).getResponse();
    });
    // @ts-expect-error wrong return type
    app.get(
      "/",
      defineHandler({ response: z.object({ a: z.string() }) })(() => ({
        a: 1,
      })),
    );
    const res = await app.request("/");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Response validation failed" });
    expect((cause as any).issues[0].slot).toBe("response");
  });

  it("passes through a returned Response and exposes validations", async () => {
    const options = { response: z.object({ a: z.string() }) };
    const h = defineHandler(options)((c) => c.json({ other: 1 }, 202));
    expect(h.validations).toBe(options);
    const app = new Hono();
    app.get("/", h);
    const res = await app.request("/");
    expect(res.status).toBe(202);
  });

  it("infers the RPC types", async () => {
    const client = hc<typeof route>("http://localhost", {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        app.request(input, init),
    });
    const res = await client.items[":id"].$post({
      param: { id: "1" },
      query: { page: "1" },
      json: { name: "abc" },
    });
    expectTypeOf(await res.json()).toEqualTypeOf<{
      id: number;
      name: string;
    }>();
  });

  it("works with factory and middleware", async () => {
    const factory = createFactory<Env>();
    const app = new Hono<Env>();
    app.get(
      "/",
      factory.defineHandler({ query: z.object({ q: z.string() }) })(
        factory.defineMiddleware(async (c, next) => {
          c.set("user", "z");
          await next();
        }),
        (c, { query }) => ({ q: query.q, u: c.get("user") }),
      ),
    );
    expect(await (await app.request("/?q=1")).json()).toEqual({
      q: "1",
      u: "z",
    });
  });
});
