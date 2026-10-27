import { describe, expect, expectTypeOf, it } from 'vitest'
import { hc } from '../../client'
import { Hono } from '../../hono'
import { HTTPException } from '../../http-exception'
import { jsx } from '../../jsx/jsx-runtime'
import { html } from '../html'
import { createFactory, defineHandler, defineMiddleware } from './index'
import type { StandardSchema } from './index'

const number: StandardSchema<string, number> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value) =>
      typeof value === 'string'
        ? { value: Number(value) }
        : { issues: [{ message: 'Expected string', path: [{ key: 'secret' }, 0] }] },
  },
}

describe('defineHandler', () => {
  it('converts values and preserves responses', async () => {
    const response = new Response('raw', { status: 201 })
    const app = new Hono()
      .get(
        '/json',
        defineHandler(() => ({ hello: 'world' }))
      )
      .get(
        '/html',
        defineHandler(() => '<p>Hello</p>')
      )
      .get(
        '/template',
        defineHandler(() => html`<p>Hello</p>`)
      )
      .get(
        '/jsx',
        defineHandler(() => jsx('p', { children: 'Hello' }))
      )
      .get(
        '/undefined',
        defineHandler(async () => undefined)
      )
      .get(
        '/empty',
        defineHandler(() => null)
      )
      .get(
        '/raw',
        defineHandler(() => response)
      )
    expect(await (await app.request('/json')).json()).toEqual({ hello: 'world' })
    expect((await app.request('/html')).headers.get('content-type')).toContain('text/html')
    expect(await (await app.request('/template')).text()).toBe('<p>Hello</p>')
    expect((await app.request('/empty')).status).toBe(204)
    expect((await app.request('/undefined')).status).toBe(204)
    expect(await (await app.request('/jsx')).text()).toBe('<p>Hello</p>')
    expect(await app.request('/raw')).toBe(response)
    const client = hc<typeof app>('http://localhost', { fetch: app.request })
    expectTypeOf(await (await client.json.$get()).json()).toEqualTypeOf<{ hello: string }>()
  })

  it('runs middleware around validation and the handler', async () => {
    const order: string[] = []
    const mw = defineMiddleware<{ Variables: { name: string } }>(async (c, next) => {
      order.push('before')
      c.set('name', 'Ada')
      await next()
      order.push('after')
      c.header('after', 'yes')
    })
    const options = {
      query: (value: Record<string, string | string[]>) => {
        order.push('request')
        return { name: String(value.name) }
      },
      response: (value: { name: string }) => {
        order.push('response')
        return { greeting: value.name }
      },
    }
    const handler = defineHandler(options)(mw, (c, input) => {
      order.push('handler')
      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
      expectTypeOf(input.query).toEqualTypeOf<{ name: string }>()
      expect(c.req.valid('query')).toEqual(input.query)
      c.status(201)
      c.header('test', 'yes')
      return { name: c.get('name') }
    })
    expect(handler.validations).toBe(options)
    const res = await new Hono().get('/', handler).request('/?name=Ada')
    expect(order).toEqual(['before', 'request', 'handler', 'response', 'after'])
    expect(res.status).toBe(201)
    expect(res.headers.get('test')).toBe('yes')
    expect(res.headers.get('after')).toBe('yes')
    expect(await res.json()).toEqual({ greeting: 'Ada' })
  })

  it('aggregates schema failures and preserves raw causes', async () => {
    const app = new Hono()
    app.onError((err) => {
      expect(err).toBeInstanceOf(HTTPException)
      expect(err.cause).toEqual({
        issues: [
          { slot: 'query', issues: [{ message: 'Expected string', path: [{ key: 'secret' }, 0] }] },
          { slot: 'json', issues: [{ message: 'Expected string', path: [{ key: 'secret' }, 0] }] },
        ],
      })
      return (err as HTTPException).getResponse()
    })
    app.post(
      '/',
      defineHandler({ json: number, query: number })(() => {
        throw Error('unreachable')
      })
    )
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"password":"private"}',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Validation failed',
      issues: [
        { slot: 'query', issues: [{ message: 'Expected string', path: 'secret.0' }] },
        { slot: 'json', issues: [{ message: 'Expected string', path: 'secret.0' }] },
      ],
    })
  })

  it('transforms schema responses and rejects invalid output', async () => {
    const app = new Hono().get(
      '/',
      defineHandler({ response: number })(() => '42')
    )
    expect(await (await app.request('/')).json()).toBe(42)
    const client = hc<typeof app>('http://localhost', { fetch: app.request })
    expectTypeOf(await (await client.index.$get()).json()).toEqualTypeOf<number>()
    // @ts-expect-error Response schema requires a string
    defineHandler({ response: number })(() => 42)
    const bad: StandardSchema<unknown> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: () => ({ issues: [{ message: 'private' }] }),
      },
    }
    const res = await new Hono()
      .get(
        '/',
        defineHandler({ response: bad })(() => ({}))
      )
      .request('/')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Response validation failed' })
  })

  it('validates all request targets in order and accepts callable async schemas', async () => {
    const order: string[] = []
    const rule = (slot: string) => (value: unknown) => {
      order.push(slot)
      return value
    }
    const callable = Object.assign(() => {}, {
      '~standard': {
        version: 1 as const,
        vendor: 'test',
        validate: async (value: unknown) => {
          order.push('query')
          return { value: value as { n: string } }
        },
      },
    })
    const app = new Hono().post(
      '/:id',
      defineHandler({
        json: rule('json'),
        form: rule('form'),
        cookie: rule('cookie'),
        header: rule('header'),
        query: callable,
        param: rule('param'),
      })((_c, input) => {
        expectTypeOf(input.query).toEqualTypeOf<{ n: string }>()
        expect(input.form).toEqual({ a: ['one', 'two'] })
        expect(input.cookie).toEqual({ session: 'test' })
        return { n: input.query.n }
      })
    )
    const res = await app.request('/123?n=1', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: 'session=test' },
      body: 'a=one&a=two',
    })
    expect(res.status).toBe(200)
    expect(order).toEqual(['param', 'query', 'header', 'cookie', 'form', 'json'])
  })

  it('supports factory and explicit context defaults', () => {
    type E = { Variables: { name: string } }
    const factory = createFactory<E, '/me/:id'>()
    factory.defineHandler((c) => {
      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
      expectTypeOf(c.req.param('id')).toEqualTypeOf<string>()
      return { name: c.get('name') }
    })
    defineHandler<E, '/me/:id'>((c) => ({ name: c.get('name'), id: c.req.param('id') }))
    expect(factory.createMiddleware).toBe(factory.defineMiddleware)
    const mw = defineMiddleware<E>(async (c, next) => {
      c.set('name', 'Ada')
      await next()
    })
    defineHandler(mw, (c) => {
      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
      return { name: c.get('name') }
    })
  })

  it('short circuits and preserves malformed JSON errors', async () => {
    const app = new Hono()
      .get(
        '/mw',
        defineHandler(
          defineMiddleware(async (c) => c.text('stop', 401)),
          () => {
            throw Error('unreachable')
          }
        )
      )
      .post(
        '/json',
        defineHandler({ json: (value) => value })(() => ({}))
      )
      .get(
        '/rule',
        defineHandler({ query: (_, c) => c.text('stop', 403) })(() => {
          throw Error('unreachable')
        })
      )
    expect((await app.request('/mw')).status).toBe(401)
    expect((await app.request('/rule')).status).toBe(403)
    const res = await app.request('/json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('Malformed JSON in request body')
  })
})
