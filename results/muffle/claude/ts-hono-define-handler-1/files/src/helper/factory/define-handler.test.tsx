/* eslint-disable @typescript-eslint/no-explicit-any */
import { expectTypeOf } from 'vitest'
import { z } from 'zod'
import { hc } from '../../client'
import type { HTTPException } from '../../http-exception'
import { Hono } from '../../index'
import { html } from '../html'
import { createFactory, createMiddleware, defineHandler, defineMiddleware } from './index'

type Env = { Variables: { foo: string } }

describe('defineHandler without options', () => {
  const app = new Hono()
  app.get(
    '/obj',
    defineHandler(() => ({ a: 1 }))
  )
  app.get(
    '/str',
    defineHandler(async () => 'hi')
  )
  app.get(
    '/jsx',
    defineHandler(() => <p>x</p>)
  )
  app.get(
    '/html',
    defineHandler(() => html`<b>${'<'}</b>`)
  )
  app.get(
    '/none',
    defineHandler(() => undefined)
  )
  app.get(
    '/res',
    defineHandler((c) => c.text('t', 201))
  )

  it('converts return values', async () => {
    expect(await (await app.request('/obj')).json()).toEqual({ a: 1 })
    const str = await app.request('/str')
    expect(str.headers.get('Content-Type')).toMatch(/text\/html/)
    expect(await str.text()).toBe('hi')
    expect(await (await app.request('/jsx')).text()).toBe('<p>x</p>')
    expect(await (await app.request('/html')).text()).toBe('<b>&lt;</b>')
    const none = await app.request('/none')
    expect(none.status).toBe(204)
    expect(await none.text()).toBe('')
    const res = await app.request('/res')
    expect(res.status).toBe(201)
  })

  it('runs middleware around the handler', async () => {
    const order: string[] = []
    const mw = createMiddleware<Env>(async (c, next) => {
      c.set('foo', 'bar')
      order.push('before')
      await next()
      order.push('after')
      c.header('X-After', '1')
    })
    const stop = defineMiddleware(async (c) => c.text('stopped', 401))
    const app = new Hono()
    const route = app.get(
      '/a',
      defineHandler(mw, (c) => {
        expectTypeOf(c.get('foo')).toEqualTypeOf<string>()
        order.push('handler')
        return { foo: c.get('foo') }
      })
    )
    app.get(
      '/b',
      defineHandler(stop, () => ({ never: true }))
    )
    const res = await app.request('/a')
    expect(order).toEqual(['before', 'handler', 'after'])
    expect(res.headers.get('X-After')).toBe('1')
    expect(await res.json()).toEqual({ foo: 'bar' })
    const res2 = await app.request('/b')
    expect(res2.status).toBe(401)
    expectTypeOf<ReturnType<typeof hc<typeof route>>>().not.toBeAny()
  })

  it('types Env and path', async () => {
    const app = new Hono<Env>()
    app.get(
      '/me/:id',
      defineHandler<Env, '/me/:id'>((c) => {
        expectTypeOf(c.req.param('id')).toEqualTypeOf<string>()
        return { id: c.req.param('id') }
      })
    )
    expect(await (await app.request('/me/1')).json()).toEqual({ id: '1' })
  })

  it('infers the json body for hc', async () => {
    const app = new Hono()
    const route = app.get(
      '/x',
      defineHandler(() => ({ a: 1 }))
    )
    const client = hc<typeof route>('http://localhost', {
      fetch: (i: any, init: any) => app.request(i, init),
    })
    const res = await client.x.$get()
    expectTypeOf(await res.json()).toEqualTypeOf<{ a: number }>()
  })

  it('factory', async () => {
    const factory = createFactory<Env>()
    const mw = factory.defineMiddleware(async (c, next) => {
      c.set('foo', 'f')
      await next()
    })
    const h = factory.defineHandler((c) => {
      expectTypeOf(c.get('foo')).toEqualTypeOf<string>()
      return c.var.foo ?? null
    })
    const app = factory.createApp()
    app.get('/', mw, h)
    expect(await (await app.request('/')).text()).toBe('f')
  })
})

describe('defineHandler with options', () => {
  it('validates all targets in order and gives input', async () => {
    const app = new Hono()
    const route = app.post(
      '/p/:id',
      defineHandler({
        param: z.object({ id: z.string() }),
        query: z.object({ page: z.coerce.number() }),
        header: (v: Record<string, string>) => ({ ua: v['x-a'] }),
        cookie: async (v) => v,
        json: z.object({ name: z.string() }),
        response: z.object({ n: z.number() }).transform((v) => ({ ...v, t: 1 })),
      })((c, input) => {
        expectTypeOf(input.query.page).toEqualTypeOf<number>()
        expectTypeOf(input.json.name).toEqualTypeOf<string>()
        expectTypeOf(input.header.ua).toEqualTypeOf<string>()
        expect(c.req.valid('json')).toBe(input.json)
        c.status(201)
        c.header('X-H', 'h')
        return { n: input.query.page }
      })
    )
    const res = await app.request('/p/7?page=3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-a': 'u' },
      body: JSON.stringify({ name: 'n' }),
    })
    expect(res.status).toBe(201)
    expect(res.headers.get('X-H')).toBe('h')
    expect(await res.json()).toEqual({ n: 3, t: 1 })
    const client = hc<typeof route>('http://localhost', {
      fetch: (i: any, init: any) => app.request(i, init),
    })
    const r = await client.p[':id'].$post({
      param: { id: '1' },
      query: { page: '1' as any },
      json: { name: 'x' },
      cookie: {},
      header: { ua: 'x' } as any,
    })
    expectTypeOf(await r.json()).toEqualTypeOf<{ n: number; t: number }>()
  })

  it('throws HTTPException with issues of every failed target', async () => {
    const app = new Hono()
    let cause: unknown
    app.onError((e) => {
      cause = (e as HTTPException).cause
      return (e as HTTPException).getResponse()
    })
    app.post(
      '/',
      defineHandler({
        query: z.object({ a: z.string() }),
        json: z.object({ b: z.object({ c: z.number() }) }),
      })(() => ({}))
    )
    const res = await app.request('/?x=secret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ b: { c: 'secret' } }),
    })
    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toBe('Validation failed')
    expect(body.issues.map((i: any) => i.slot)).toEqual(['query', 'json'])
    expect(body.issues[1].issues[0].path).toBe('b.c')
    expect(JSON.stringify(body)).not.toContain('secret')
    expect((cause as any).issues[1].slot).toBe('json')
    expect(Array.isArray((cause as any).issues[1].issues)).toBe(true)
  })

  it('keeps malformed JSON as 400', async () => {
    const app = new Hono()
    app.post(
      '/',
      defineHandler({ json: z.any() })(() => ({}))
    )
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('Malformed JSON in request body')
  })

  it('function validator may return a Response; middleware order', async () => {
    const order: string[] = []
    const mw = defineMiddleware(async (_c, next) => {
      order.push('mw-before')
      await next()
      order.push('mw-after')
    })
    const app = new Hono()
    app.get(
      '/',
      defineHandler({
        query: (v, c) => {
          order.push('validate')
          return v.stop ? c.text('halt', 418) : v
        },
        response: z.object({ ok: z.boolean() }),
      })(mw, () => {
        order.push('handler')
        return { ok: true }
      })
    )
    expect((await app.request('/?stop=1')).status).toBe(418)
    order.length = 0
    expect(await (await app.request('/')).json()).toEqual({ ok: true })
    expect(order).toEqual(['mw-before', 'validate', 'handler', 'mw-after'])
  })

  it('response validation failure is a 500 without issues', async () => {
    const app = new Hono()
    let cause: any
    app.onError((e) => {
      cause = e.cause
      return (e as HTTPException).getResponse()
    })
    app.get(
      '/',
      defineHandler({ response: z.object({ n: z.number() }) })(() => ({ n: 'x' }) as any)
    )
    const res = await app.request('/')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Response validation failed' })
    expect(cause.issues[0].slot).toBe('response')
  })

  it('exposes validations', () => {
    const options = { query: z.object({}) }
    expect(defineHandler(options).validations).toBe(options)
    expect(defineHandler(options)(() => 1).validations).toBe(options)
  })
})
