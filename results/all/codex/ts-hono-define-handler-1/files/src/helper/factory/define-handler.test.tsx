import { expectTypeOf } from 'vitest'
import { hc } from '../../client'
import { Hono } from '../../hono'
import { HTTPException } from '../../http-exception'
import { html } from '../html'
import { createFactory, createMiddleware, defineHandler, defineMiddleware } from './index'
import type { StandardSchema } from './index'

/** Create a schema with configurable validation. */
function schema<I, O>(
  validate: StandardSchema<I, O>['~standard']['validate']
): StandardSchema<I, O> {
  return { '~standard': { version: 1, vendor: 'test', validate } }
}

describe('defineHandler', () => {
  it('returns schema-transformed strings as JSON and combines middleware environments', async () => {
    const a = defineMiddleware<{ Variables: { a: string } }>(async (c, next) => {
      c.set('a', 'a')
      await next()
    })
    const b = defineMiddleware<{ Variables: { b: number } }>(async (c, next) => {
      c.set('b', 2)
      await next()
    })
    const handler = defineHandler({
      response: schema<string, string>((value) => ({ value: String(value).toUpperCase() })),
    })(a, b, (c) => {
      expectTypeOf(c.get('a')).toEqualTypeOf<string>()
      expectTypeOf(c.get('b')).toEqualTypeOf<number>()
      return c.get('a') + c.get('b')
    })
    const res = await new Hono().get('/', handler).request('/')
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(await res.json()).toBe('A2')
    const many = defineHandler(a, b, a, b, a, (c) => ({ a: c.get('a') }))
    expect(await (await new Hono().get('/', many).request('/')).json()).toEqual({ a: 'a' })
  })

  it('converts synchronous and asynchronous values', async () => {
    const response = new Response('unchanged', { status: 202 })
    const cases = [
      [{ hello: 'world' }, 200, '{"hello":"world"}', 'application/json'],
      ['<p>Hello</p>', 200, '<p>Hello</p>', 'text/html'],
      [html`<b>Hello</b>`, 200, '<b>Hello</b>', 'text/html'],
      [<span>Hello</span>, 200, '<span>Hello</span>', 'text/html'],
      [null, 204, '', null],
      [undefined, 204, '', null],
      [response, 202, 'unchanged', 'text/plain'],
    ] as const
    for (const [value, status, body, contentType] of cases) {
      for (const async of [false, true]) {
        const app = new Hono().get(
          '/',
          defineHandler(() => (async ? Promise.resolve(value) : value))
        )
        const res = await app.request('/')
        expect(res.status).toBe(status)
        expect(await res.clone().text()).toBe(body)
        if (contentType) expect(res.headers.get('content-type')).toContain(contentType)
        else expect(res.body).toBeNull()
      }
    }
  })

  it('runs middleware around validation and handler, preserving status and headers', async () => {
    const order: string[] = []
    const mw = defineMiddleware<{ Variables: { user: string } }>(async (c, next) => {
      order.push('before')
      c.set('user', 'Alice')
      await next()
      order.push('after')
      c.header('x-after', 'yes')
    })
    const options = {
      query: (value: Record<string, string | string[]>) => {
        order.push('query')
        return { name: value.name }
      },
      response: schema<{ name: string }, { greeting: string }>((value) => {
        order.push('response')
        return { value: { greeting: (value as { name: string }).name } }
      }),
    }
    const handler = defineHandler(options)(mw, (c, input) => {
      expectTypeOf(c.get('user')).toEqualTypeOf<string>()
      expectTypeOf(input.query.name).toEqualTypeOf<string | string[]>()
      expect(c.req.valid('query')).toEqual(input.query)
      order.push('handler')
      c.status(201)
      c.header('x-handler', 'yes')
      return { name: c.get('user') }
    })
    expect(handler.validations).toBe(options)
    const res = await new Hono().get('/', handler).request('/?name=test')
    expect(res.status).toBe(201)
    expect(res.headers.get('x-handler')).toBe('yes')
    expect(res.headers.get('x-after')).toBe('yes')
    expect(await res.json()).toEqual({ greeting: 'Alice' })
    expect(order).toEqual(['before', 'query', 'handler', 'response', 'after'])
  })

  it('short circuits middleware, request functions and handler responses', async () => {
    const handler = vi.fn(() => ({ ok: true }))
    const response = new Response('stop', { status: 403 })
    const app = new Hono()
      .get(
        '/middleware',
        defineHandler(
          defineMiddleware(async () => response),
          handler
        )
      )
      .get('/request', defineHandler({ query: async () => response })(handler))
      .get(
        '/response',
        defineHandler({
          response: () => {
            throw new Error('must skip')
          },
        })(() => response)
      )
    for (const path of ['/middleware', '/request', '/response']) {
      expect(await app.request(path)).toBe(response)
    }
    expect(handler).not.toHaveBeenCalled()
  })

  it('validates all slots in order and exposes only sanitized request issues', async () => {
    const order: string[] = []
    const raw = [
      { message: 'bad', path: [{ key: 'user' }, 'name', 0], input: 'secret' },
      { message: 'missing' },
    ]
    const options = Object.fromEntries(
      ['param', 'query', 'header', 'cookie', 'form', 'json'].map((slot) => [
        slot,
        schema(async () => {
          order.push(slot)
          return { issues: raw }
        }),
      ])
    )
    let caught: unknown
    const app = new Hono()
    app.onError((error) => {
      caught = error
      return (error as HTTPException).getResponse()
    })
    app.post(
      '/:id',
      defineHandler(options)(() => {
        throw new Error('must skip')
      })
    )
    const res = await app.request('/abc')
    expect(res.status).toBe(404)
    const failed = await app.request('/abc', { method: 'POST' })
    expect(failed.status).toBe(400)
    expect(order).toEqual(['param', 'query', 'header', 'cookie', 'form', 'json'])
    expect(await failed.json()).toEqual({
      error: 'Validation failed',
      issues: order.map((slot) => ({
        slot,
        issues: [{ message: 'bad', path: 'user.name.0' }, { message: 'missing' }],
      })),
    })
    expect(caught).toBeInstanceOf(HTTPException)
    expect((caught as HTTPException).cause).toEqual({
      issues: order.map((slot) => ({ slot, issues: raw })),
    })
  })

  it('hides response issues but retains their cause', async () => {
    const issues = [{ message: 'private' }]
    const app = new Hono()
    app.onError((error) => {
      expect((error as HTTPException).cause).toEqual({ issues: [{ slot: 'response', issues }] })
      return (error as HTTPException).getResponse()
    })
    app.get(
      '/',
      defineHandler({ response: schema(() => ({ issues })) })(() => 'secret')
    )
    const res = await app.request('/')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Response validation failed' })
  })

  it('uses validator request parsing and supports callable schemas', async () => {
    const callable = Object.assign(
      () => {},
      schema<unknown, string>((value) => ({ value: String(value) }))
    )
    const app = new Hono().post(
      '/:id',
      defineHandler({
        param: (value) => value,
        query: (value) => value,
        header: (value) => value['x-test'],
        cookie: (value) => value.token,
        json: callable,
      })((c, input) => {
        expect(c.req.valid('header')).toBe('ok')
        return input
      })
    )
    const res = await app.request('/42?q=1&q=2', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test': 'ok', cookie: 'token=abc' },
      body: '3',
    })
    expect(await res.json()).toEqual({
      param: { id: '42' },
      query: { q: ['1', '2'] },
      header: 'ok',
      cookie: 'abc',
      json: '3',
    })
    const malformed = await app.request('/42', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })
    expect(malformed.status).toBe(400)
    expect(await malformed.text()).toBe('Malformed JSON in request body')
  })

  it('supports form parsing and async function transforms', async () => {
    const app = new Hono().post(
      '/',
      defineHandler({
        form: async (value) => ({ name: String(value.name).toUpperCase() }),
        response: async (value: { name: string }) => ({ result: value.name }),
      })((_c, input) => input.form)
    )
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'name=alice',
    })
    expect(await res.json()).toEqual({ result: 'ALICE' })
  })

  it('inherits factory and explicit environment and path types and RPC outputs', async () => {
    type E = { Variables: { name: string } }
    const factory = createFactory<E, '/me/:id'>()
    expect(createMiddleware).toBe(defineMiddleware)
    expect(factory.createMiddleware).toBe(factory.defineMiddleware)
    factory.defineHandler((c) => {
      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
      expectTypeOf(c.req.param('id')).toEqualTypeOf<string>()
      return { ok: true }
    })
    defineHandler<E, '/me/:id'>((c) => {
      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
      expectTypeOf(c.req.param('id')).toEqualTypeOf<string>()
      return { ok: true }
    })
    const app = new Hono()
      .get(
        '/plain',
        defineHandler(() => ({ name: 'Alice' }))
      )
      .get(
        '/schema',
        defineHandler({
          response: schema<{ name: string }, { count: number }>(() => ({ value: { count: 1 } })),
        })(() => ({ name: 'Alice' }))
      )
    // @ts-expect-error Response schema input must match the handler result.
    defineHandler({ response: schema<string, number>(() => ({ value: 1 })) })(() => 42)
    const client = hc<typeof app>('http://localhost', {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => app.request(input, init),
    })
    expectTypeOf(await (await client.plain.$get()).json()).toEqualTypeOf<{ name: string }>()
    expectTypeOf(await (await client.schema.$get()).json()).toEqualTypeOf<{ count: number }>()
  })
})
