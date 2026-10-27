import { describe, expect, expectTypeOf, it } from 'vitest'
import { createFactory, defineHandler, defineMiddleware } from '.'
import type { StandardSchema } from '.'
import { hc } from '../../client'
import { Hono } from '../../hono'
import { HTTPException } from '../../http-exception'
import { html } from '../html'

const schema: StandardSchema<{ name: string }, { length: number }> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value) => ({ value: { length: (value as { name: string }).name.length } }),
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
        defineHandler(() => html`<b>hello</b>`)
      )
      .get(
        '/string',
        defineHandler(() => '<b>hello</b>')
      )
      .get(
        '/empty',
        defineHandler(() => undefined)
      )
      .get(
        '/response',
        defineHandler(() => response)
      )
    expect(await (await app.request('/json')).json()).toEqual({ hello: 'world' })
    expect(await (await app.request('/html')).text()).toBe('<b>hello</b>')
    expect((await app.request('/string')).headers.get('content-type')).toContain('text/html')
    expect((await app.request('/empty')).status).toBe(204)
    expect(await app.request('/response')).toBe(response)
    const client = hc<typeof app>('http://localhost', { fetch: app.request })
    expectTypeOf(await (await client.json.$get()).json()).toEqualTypeOf<{ hello: string }>()
  })

  it('validates between middleware before and after, preserving context status and headers', async () => {
    const order: string[] = []
    const middleware = defineMiddleware<{ Variables: { user: string } }>(async (c, next) => {
      order.push('before')
      c.set('user', 'Ada')
      await next()
      order.push('after')
    })
    const handler = defineHandler({
      query: (value) => {
        order.push('query')
        return { name: String(value.name) }
      },
      response: schema,
    })(middleware, (c, input) => {
      expectTypeOf(c.get('user')).toEqualTypeOf<string>()
      expectTypeOf(input.query).toEqualTypeOf<{ name: string }>()
      expectTypeOf(c.req.valid('query')).toEqualTypeOf<{ name: string }>()
      order.push('handler')
      c.status(201)
      c.header('x-test', c.get('user'))
      return input.query
    })
    const app = new Hono().get('/', handler)
    const res = await app.request('/?name=Ada')
    expect(res.status).toBe(201)
    expect(res.headers.get('x-test')).toBe('Ada')
    expect(await res.json()).toEqual({ length: 3 })
    expect(order).toEqual(['before', 'query', 'handler', 'after'])
    expect(handler.validations.response).toBe(schema)
    const client = hc<typeof app>('http://localhost', { fetch: app.request })
    expectTypeOf(await (await client.index.$get({ query: { name: 'Ada' } })).json()).toEqualTypeOf<{
      length: number
    }>()
  })

  it('aggregates schema issues without leaking values and retains raw causes', async () => {
    const issues = [{ message: 'Invalid', path: [{ key: 'name' }, 0], input: 'secret' }]
    const bad: StandardSchema = {
      '~standard': { version: 1, vendor: 'test', validate: async () => ({ issues }) },
    }
    let caught: unknown
    const app = new Hono()
      .onError((error) => {
        caught = error
        return (error as HTTPException).getResponse()
      })
      .get(
        '/',
        defineHandler({ query: bad, header: bad })(() => {
          throw new Error('unreachable')
        })
      )
    const res = await app.request('/?name=secret')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Validation failed',
      issues: ['query', 'header'].map((slot) => ({
        slot,
        issues: [{ message: 'Invalid', path: 'name.0' }],
      })),
    })
    expect(caught).toBeInstanceOf(HTTPException)
    expect((caught as Error).cause).toEqual({
      issues: [
        { slot: 'query', issues },
        { slot: 'header', issues },
      ],
    })
  })

  it('handles malformed JSON and early responses', async () => {
    const app = new Hono()
      .post(
        '/',
        defineHandler({ json: (v) => v })(() => ({ ok: true }))
      )
      .get(
        '/early',
        defineHandler({ query: () => new Response('stop', { status: 403 }) })(() => {
          throw new Error('unreachable')
        })
      )
      .get(
        '/middleware',
        defineHandler(
          defineMiddleware(async () => new Response('stop')),
          () => {
            throw new Error('unreachable')
          }
        )
      )
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('Malformed JSON in request body')
    expect((await app.request('/early')).status).toBe(403)
    expect(await (await app.request('/middleware')).text()).toBe('stop')
  })

  it('hides response issues', async () => {
    const bad: StandardSchema<string> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: () => ({ issues: [{ message: 'secret' }] }),
      },
    }
    const app = new Hono().get(
      '/',
      defineHandler({ response: bad })(() => 'hello')
    )
    const res = await app.request('/')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Response validation failed' })
    // @ts-expect-error response must match the schema input
    defineHandler({ response: schema })(() => ({ length: 3 }))
  })

  it('supports callable schemas and validates all request slots in order', async () => {
    const order: string[] = []
    const callable = Object.assign(() => {}, {
      '~standard': {
        version: 1 as const,
        vendor: 'test',
        validate: async (value: unknown) => {
          order.push('param')
          return { value: value as { id: string } }
        },
      },
    })
    const app = new Hono().post(
      '/:id',
      defineHandler({
        param: callable,
        query: (v) => {
          order.push('query')
          return v
        },
        header: (v) => {
          order.push('header')
          return v
        },
        cookie: (v) => {
          order.push('cookie')
          return v
        },
        form: (v) => {
          order.push('form')
          return v
        },
        json: (v) => {
          order.push('json')
          return v
        },
        response: async (v: { id: string }) => {
          order.push('response')
          return { id: Number(v.id) }
        },
      })((c, input) => {
        order.push('handler')
        expect(c.req.valid('param')).toEqual({ id: '42' })
        expect(input.query).toEqual({ name: ['a', 'b'] })
        expect(input.cookie).toEqual({ token: 'abc' })
        expect(input.form).toEqual({ tags: ['a', 'b'] })
        expect(input.json).toEqual({})
        return input.param
      })
    )
    const res = await app.request('/42?name=a&name=b', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: 'token=abc' },
      body: 'tags=a&tags=b',
    })
    expect(await res.json()).toEqual({ id: 42 })
    expect(order).toEqual([
      'param',
      'query',
      'header',
      'cookie',
      'form',
      'json',
      'handler',
      'response',
    ])
  })

  it('uses explicit and factory context defaults', () => {
    type E = { Variables: { user: string } }
    defineHandler<E, '/me/:id'>((c) => {
      expectTypeOf(c.get('user')).toEqualTypeOf<string>()
      expectTypeOf(c.req.param('id')).toEqualTypeOf<string>()
      return {}
    })
    createFactory<E, '/me/:id'>().defineHandler((c) => {
      expectTypeOf(c.get('user')).toEqualTypeOf<string>()
      return c.req.param('id')
    })
  })
})
