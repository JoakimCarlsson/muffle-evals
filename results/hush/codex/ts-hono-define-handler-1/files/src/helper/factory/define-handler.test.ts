import { describe, expect, expectTypeOf, it } from 'vitest'
import { createFactory, defineHandler, defineMiddleware } from '.'
import type { StandardSchema } from '.'
import { hc } from '../../client'
import { Hono } from '../../hono'
import { HTTPException } from '../../http-exception'
import { jsx } from '../../jsx'
import { html } from '../html'

const schema: StandardSchema<string, number> = {
  '~standard': {
    validate: (value) =>
      typeof value === 'string'
        ? { value: value.length }
        : { issues: [{ message: 'Expected string', path: [{ key: 'name' }, 0] }] },
  },
}

describe('defineHandler', () => {
  it('converts results and preserves responses', async () => {
    const response = new Response('raw', { status: 202 })
    const app = new Hono()
      .get(
        '/json',
        defineHandler(() => ({ ok: true }))
      )
      .get(
        '/string',
        defineHandler(() => 'hello')
      )
      .get(
        '/html',
        defineHandler(() => html`<b>hello</b>`)
      )
      .get(
        '/jsx',
        defineHandler(() => jsx('b', null, 'hello'))
      )
      .get(
        '/empty',
        defineHandler(() => undefined)
      )
      .get(
        '/null',
        defineHandler(() => null)
      )
      .get(
        '/response',
        defineHandler(() => response)
      )
    expect(await (await app.request('/json')).json()).toEqual({ ok: true })
    for (const path of ['/html', '/jsx']) {
      expect(await (await app.request(path)).text()).toBe('<b>hello</b>')
    }
    expect((await app.request('/string')).headers.get('content-type')).toContain('text/html')
    for (const path of ['/empty', '/null']) {
      const res = await app.request(path)
      expect(res.status).toBe(204)
      expect(await res.text()).toBe('')
    }
    expect(await app.request('/response')).toBe(response)
    const client = hc<typeof app>('http://localhost', { fetch: app.request })
    expectTypeOf(await (await client.json.$get()).json()).toEqualTypeOf<{ ok: boolean }>()
  })

  it('runs middleware around validation and retains status and headers', async () => {
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
      response: (value: string) => {
        order.push('response')
        return { length: value.length }
      },
    }
    const handler = defineHandler(options)(mw, (c, input) => {
      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
      expectTypeOf(c.req.valid('query')).toEqualTypeOf<{ name: string }>()
      order.push('handler')
      c.status(201)
      c.header('before', 'yes')
      return input.query.name
    })
    expect(handler.validations).toBe(options)
    const res = await new Hono().get('/', handler).request('/?name=Ada')
    expect(res.status).toBe(201)
    expect(res.headers.get('before')).toBe('yes')
    expect(res.headers.get('after')).toBe('yes')
    expect(await res.json()).toEqual({ length: 3 })
    expect(order).toEqual(['before', 'request', 'handler', 'response', 'after'])
  })

  it('aggregates schema failures without leaking input', async () => {
    let caught: HTTPException | undefined
    const app = new Hono()
    app.onError((error) => {
      caught = error as HTTPException
      return caught.getResponse()
    })
    app.post(
      '/:id',
      defineHandler({ param: schema, query: schema, json: schema })(() => 'unused')
    )
    const res = await app.request('/secret?password=secret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"password":"secret"}',
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Validation failed',
      issues: ['param', 'query', 'json'].map((slot) => ({
        slot,
        issues: [{ message: 'Expected string', path: 'name.0' }],
      })),
    })
    expect(caught).toBeInstanceOf(HTTPException)
    expect(caught?.cause).toEqual({
      issues: ['param', 'query', 'json'].map((slot) => ({
        slot,
        issues: [{ message: 'Expected string', path: [{ key: 'name' }, 0] }],
      })),
    })
  })

  it('transforms response schemas and checks their input types', async () => {
    const handler = defineHandler({ response: schema })(() => 'hello')
    // @ts-expect-error schema input is string
    defineHandler({ response: schema })(() => 42)
    const app = new Hono().get('/', handler)
    expect(await (await app.request('/')).json()).toBe(5)
    const client = hc<typeof app>('http://localhost', { fetch: app.request })
    expectTypeOf(await (await client.index.$get()).json()).toEqualTypeOf<number>()
    const bad = new Hono().get(
      '/',
      defineHandler({ response: schema })(() => 42 as never)
    )
    bad.onError((err) => (err as HTTPException).getResponse())
    const res = await bad.request('/')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Response validation failed' })
  })

  it('supports factory defaults and middleware inference', async () => {
    type E = { Variables: { name: string } }
    const factory = createFactory<E, '/:id'>()
    const mw = factory.defineMiddleware(async (c, next) => {
      c.set('name', 'Ada')
      await next()
    })
    const handler = factory.defineHandler(mw, (c) => ({
      name: c.get('name'),
      id: c.req.param('id'),
    }))
    const plain = defineHandler(mw, (c) => {
      expectTypeOf(c.get('name')).toEqualTypeOf<string>()
      return { name: c.get('name') }
    })
    const explicit = defineHandler<E, '/:id'>((c) => c.req.param('id'))
    const app = new Hono().get('/:id', handler).get('/plain', plain).get('/explicit/:id', explicit)
    expect(await (await app.request('/123')).json()).toEqual({ name: 'Ada', id: '123' })
  })

  it('reads every target in order and supports async callable schemas', async () => {
    const order: string[] = []
    const callable = Object.assign(
      () => {
        throw new Error('schema must not be called')
      },
      {
        '~standard': {
          validate: async (value: unknown) => ({ value: { parsed: value } }),
        },
      }
    )
    const app = new Hono().post(
      '/:id',
      defineHandler({
        param: async (value) => {
          order.push('param')
          return value
        },
        query: async (value) => {
          order.push('query')
          return value
        },
        header: async (value) => {
          order.push('header')
          return value
        },
        cookie: async (value) => {
          order.push('cookie')
          return value
        },
        form: async (value) => {
          order.push('form')
          return value
        },
        json: callable,
      })((c, input) => {
        expect(c.req.valid('json')).toBe(input.json)
        return input
      })
    )
    const res = await app.request('/123?q=one&q=two', {
      method: 'POST',
      headers: { Cookie: 'session=abc', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'name=Ada&name=Grace&tags%5B%5D=a&tags%5B%5D=b',
    })
    const body = await res.json()
    expect(order).toEqual(['param', 'query', 'header', 'cookie', 'form'])
    expect(body.param).toEqual({ id: '123' })
    expect(body.query).toEqual({ q: ['one', 'two'] })
    expect(body.cookie).toEqual({ session: 'abc' })
    expect(body.form).toEqual({ name: ['Ada', 'Grace'], 'tags[]': ['a', 'b'] })
    expect(body.json).toEqual({ parsed: {} })
  })

  it('bypasses response validation for Response results', async () => {
    const response = new Response('raw', { status: 202 })
    const app = new Hono().get(
      '/',
      defineHandler({ response: schema })(async () => response)
    )
    expect(await app.request('/')).toBe(response)
  })

  it('short circuits middleware and function validation and reports malformed JSON', async () => {
    const app = new Hono()
    app.get(
      '/mw',
      defineHandler(
        async () => new Response('middleware'),
        () => {
          throw Error('unreachable')
        }
      )
    )
    app.get(
      '/validation',
      defineHandler({ query: () => new Response('validation') })(() => {
        throw Error('unreachable')
      })
    )
    app.post(
      '/json',
      defineHandler({ json: (value) => value })(() => 'unused')
    )
    expect(await (await app.request('/mw')).text()).toBe('middleware')
    expect(await (await app.request('/validation')).text()).toBe('validation')
    const res = await app.request('/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('Malformed JSON in request body')
  })
})
