import { expectTypeOf } from 'vitest'
import { hc } from '../../client'
import { Hono } from '../../index'
import { html } from '../html'
import { createFactory, defineHandler, defineMiddleware } from './index'
import type { StandardSchema } from './index'

const schema = <T>(check: (v: any) => T | undefined, vendor = 't'): StandardSchema<any, T> => ({
  '~standard': {
    version: 1,
    vendor,
    validate: (v) => {
      const out = check(v)
      return out === undefined
        ? { issues: [{ message: `bad ${vendor}`, path: [{ key: 'a' }, 'b', 0] }] }
        : { value: out }
    },
  },
})
const name = schema((v) => (typeof v?.name === 'string' ? (v as { name: string }) : undefined), 'q')

describe('defineHandler', () => {
  it('converts return values', async () => {
    const app = new Hono()
    app.get('/o', defineHandler(() => ({ a: 1 })))
    app.get('/s', defineHandler(async () => 'hi'))
    app.get('/h', defineHandler(() => html`<p>x</p>`))
    app.get('/n', defineHandler(() => undefined))
    app.get('/r', defineHandler((c) => c.text('r', 201)))
    expect(await (await app.request('/o')).json()).toEqual({ a: 1 })
    const s = await app.request('/s')
    expect(s.headers.get('content-type')).toMatch(/html/)
    expect(await s.text()).toBe('hi')
    expect(await (await app.request('/h')).text()).toBe('<p>x</p>')
    const n = await app.request('/n')
    expect(n.status).toBe(204)
    expect(await n.text()).toBe('')
    expect((await app.request('/r')).status).toBe(201)
  })

  it('runs middleware around the handler', async () => {
    const order: string[] = []
    const mw = defineMiddleware<{ Variables: { v: string } }>(async (c, next) => {
      c.set('v', 'x')
      order.push('before')
      await next()
      order.push('after')
      c.header('X-A', c.res.headers.get('X-H') ?? '')
    })
    const stop = defineMiddleware(async (c) => c.text('stopped'))
    const app = new Hono()
    app.get(
      '/a/:id',
      defineHandler(mw, (c) => {
        expectTypeOf(c.get('v')).toEqualTypeOf<string>()
        order.push('handler')
        c.header('X-H', 'h')
        return { v: c.get('v'), id: c.req.param('id') }
      })
    )
    app.get('/s', defineHandler(stop, () => ({ no: 1 })))
    const res = await app.request('/a/7')
    expect(await res.json()).toEqual({ v: 'x', id: '7' })
    expect(res.headers.get('X-A')).toBe('h')
    expect(order).toEqual(['before', 'handler', 'after'])
    expect(await (await app.request('/s')).text()).toBe('stopped')
  })

  it('validates request, in order, and exposes input', async () => {
    const q = schema((v) => (v.page ? { page: Number(v.page) } : undefined), 'query')
    const j = schema((v) => (v.name ? { name: String(v.name) } : undefined), 'json')
    const h = defineHandler({
      query: q,
      json: j,
      header: (v: Record<string, string>) => ({ h: v['x-h'] }),
    })((c, input) => {
      expectTypeOf(input.query).toEqualTypeOf<{ page: number }>()
      expect(c.req.valid('json')).toEqual(input.json)
      return { ...input.query, ...input.json, ...input.header }
    })
    expect(Object.keys(h.validations)).toEqual(['query', 'json', 'header'])
    const app = new Hono()
    app.post('/', h)
    const ok = await app.request('/?page=2', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-h': 'z' },
      body: JSON.stringify({ name: 'n', secret: 'S3CRET' }),
    })
    expect(await ok.json()).toEqual({ page: 2, name: 'n', h: 'z' })
  })

  it('throws 400 HTTPException with all failures and no input value', async () => {
    const q = schema(() => undefined, 'query')
    const j = schema(() => undefined, 'json')
    const app = new Hono()
    let cause: unknown
    app.onError((e: any, c) => {
      cause = e.cause
      return e.getResponse()
    })
    app.post('/', defineHandler({ json: j, query: q })(() => 'x'))
    const res = await app.request('/?s=SECRET', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ s: 'SECRET' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({
      error: 'Validation failed',
      issues: [
        { slot: 'query', issues: [{ message: 'bad query', path: 'a.b.0' }] },
        { slot: 'json', issues: [{ message: 'bad json', path: 'a.b.0' }] },
      ],
    })
    expect(JSON.stringify(body)).not.toContain('SECRET')
    expect((cause as any).issues[0].issues[0].path).toEqual([{ key: 'a' }, 'b', 0])
    const bad = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })
    expect(bad.status).toBe(400)
    expect(await bad.text()).toBe('Malformed JSON in request body')
  })

  it('omits path when there is none; function returning Response skips handler', async () => {
    const s: StandardSchema = {
      '~standard': { version: 1, vendor: 'x', validate: async () => ({ issues: [{ message: 'm' }] }) },
    }
    const handler = vi.fn(() => 'x')
    const app = new Hono()
    app.get('/a', defineHandler({ query: s })(handler))
    app.get('/b', defineHandler({ query: (_v, c) => c.text('early', 418) })(handler))
    expect(await (await app.request('/a')).json()).toEqual({
      error: 'Validation failed',
      issues: [{ slot: 'query', issues: [{ message: 'm' }] }],
    })
    expect((await app.request('/b')).status).toBe(418)
    expect(handler).not.toHaveBeenCalled()
  })

  it('validates and transforms the response', async () => {
    const res = schema((v: any) => (typeof v?.n === 'number' ? { n: String(v.n) } : undefined), 'res')
    const app = new Hono()
    app.onError((e: any) => {
      expect(e.cause.issues[0].slot).toBe('response')
      return e.getResponse()
    })
    const route = app.get(
      '/ok',
      defineHandler({ response: res })((c) => {
        c.status(201)
        c.header('X-T', 't')
        return { n: 1 }
      })
    )
    app.get('/raw', defineHandler({ response: res })((c) => c.text('raw')))
    app.get('/bad', defineHandler({ response: res })(() => ({ n: 'x' }) as any))
    const ok = await app.request('/ok')
    expect(ok.status).toBe(201)
    expect(ok.headers.get('X-T')).toBe('t')
    expect(await ok.json()).toEqual({ n: '1' })
    expect(await (await app.request('/raw')).text()).toBe('raw')
    const bad = await app.request('/bad')
    expect(bad.status).toBe(500)
    expect(await bad.json()).toEqual({ error: 'Response validation failed' })
    const client = hc<typeof route>('http://x')
    expectTypeOf(client.ok.$get).returns.resolves.toHaveProperty('json')
  })

  it('factory defaults', async () => {
    type E = { Variables: { u: string } }
    const f = createFactory<E>()
    const app = new Hono<E>()
    app.use((c, next) => (c.set('u', 'me'), next()))
    app.get(
      '/',
      f.defineHandler((c) => ({ u: c.get('u') }))
    )
    expect(await (await app.request('/')).json()).toEqual({ u: 'me' })
    const h = defineHandler<E, '/me/:id'>((c) => {
      expectTypeOf(c.get('u')).toEqualTypeOf<string>()
      return c.req.param('id')
    })
    expect(h).toBeTypeOf('function')
    expect(f.defineMiddleware).toBeTypeOf('function')
  })
})
