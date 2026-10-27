/* eslint-disable @typescript-eslint/no-unused-vars */
import { expectTypeOf } from 'vitest'
import { z } from 'zod'
import { hc } from '../../client'
import { HTTPException } from '../../http-exception'
import { Hono } from '../../index'
import { jsx } from '../../jsx'
import type { Equal, Expect } from '../../utils/types'
import { html } from '../html'
import { createFactory, createMiddleware, defineHandler, defineMiddleware } from './index'
import type { StandardSchema } from './index'

type Env = { Variables: { user: string } }

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

describe('defineHandler without options', () => {
  it('Should convert the returned value to a response', async () => {
    const app = new Hono()
    app.get(
      '/object',
      defineHandler(() => ({ ok: true }))
    )
    app.get(
      '/async',
      defineHandler(async () => ({ ok: 1 }))
    )
    app.get(
      '/string',
      defineHandler(() => 'hello')
    )
    app.get(
      '/jsx',
      defineHandler(() => jsx('h1', {}, 'hi'))
    )
    app.get(
      '/html',
      defineHandler(() => html`<p>${'<b>'}</p>`)
    )
    app.get(
      '/null',
      defineHandler(() => null)
    )
    app.get(
      '/undefined',
      defineHandler(async () => undefined)
    )
    app.get(
      '/response',
      defineHandler((c) => c.text('raw', 201))
    )

    let res = await app.request('/object')
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    expect(await res.json()).toEqual({ ok: true })
    expect(await (await app.request('/async')).json()).toEqual({ ok: 1 })
    res = await app.request('/string')
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    expect(await res.text()).toBe('hello')
    res = await app.request('/jsx')
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    expect(await res.text()).toBe('<h1>hi</h1>')
    res = await app.request('/html')
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    expect(await res.text()).toBe('<p>&lt;b&gt;</p>')
    for (const path of ['/null', '/undefined']) {
      res = await app.request(path)
      expect(res.status).toBe(204)
      expect(await res.text()).toBe('')
    }
    res = await app.request('/response')
    expect(res.status).toBe(201)
    expect(await res.text()).toBe('raw')
  })

  it('Should run the middleware around the handler', async () => {
    const calls: string[] = []
    const mw1 = defineMiddleware<Env>(async (c, next) => {
      calls.push('mw1 before')
      c.set('user', 'bob')
      await next()
      calls.push('mw1 after')
      c.header('X-After', 'yes')
    })
    const mw2 = createMiddleware(async (_c, next) => {
      calls.push('mw2 before')
      await next()
      calls.push('mw2 after')
    })
    const app = new Hono()
    app.get(
      '/:id',
      defineHandler(mw1, mw2, (c) => {
        calls.push('handler')
        expectTypeOf(c.get('user')).toEqualTypeOf<string>()
        return { user: c.get('user'), id: c.req.param('id') }
      })
    )
    const res = await app.request('/1')
    expect(await res.json()).toEqual({ user: 'bob', id: '1' })
    expect(res.headers.get('x-after')).toBe('yes')
    expect(calls).toEqual(['mw1 before', 'mw2 before', 'handler', 'mw2 after', 'mw1 after'])
  })

  it('Should end the chain when a middleware returns a response', async () => {
    const handler = vi.fn(() => 'never')
    const app = new Hono()
    app.get(
      '/',
      defineHandler(async (c) => c.text('stop', 401), handler)
    )
    const res = await app.request('/')
    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('Should type the context with the Env and the path', () => {
    defineHandler<Env, '/me/:id'>((c) => {
      expectTypeOf(c.get('user')).toEqualTypeOf<string>()
      expectTypeOf(c.req.param('id')).toEqualTypeOf<string>()
      return null
    })
    const factory = createFactory<Env, '/me/:id'>()
    factory.defineHandler((c) => {
      expectTypeOf(c.get('user')).toEqualTypeOf<string>()
      expectTypeOf(c.req.param('id')).toEqualTypeOf<string>()
      return null
    })
    expect(factory.defineMiddleware).toBeTypeOf('function')
    expect(factory.createMiddleware).toBeTypeOf('function')
  })

  it('Should let hc infer the JSON body', async () => {
    const app = new Hono().get(
      '/me',
      defineHandler(() => ({ name: 'a', age: 1 }))
    )
    const client = hc<typeof app>('http://localhost')
    // type-only check, the request is never sent
    const check = async () => {
      const res = await client.me.$get()
      type Body = Awaited<ReturnType<typeof res.json>>
      type verify = Expect<Equal<Body, { name: string; age: number }>>
    }
    expect(check).toBeTypeOf('function')
  })
})

describe('defineHandler with options', () => {
  const schema = z.object({ page: z.coerce.number() })

  it('Should validate the targets in order and pass the input', async () => {
    const order: string[] = []
    const track =
      <T>(name: string) =>
      (value: T) => {
        order.push(name)
        return value
      }
    const app = new Hono()
    app.post(
      '/:id',
      defineHandler({
        json: track('json'),
        form: track('form'),
        cookie: track('cookie'),
        header: track('header'),
        query: z.object({ page: z.coerce.number() }),
        param: async (v: { id: string }) => {
          order.push('param')
          return { id: Number(v.id) }
        },
      })((c, input) => {
        expectTypeOf(input.query.page).toEqualTypeOf<number>()
        expectTypeOf(input.param.id).toEqualTypeOf<number>()
        expect(c.req.valid('query')).toEqual({ page: 2 })
        return {
          input: input.query,
          id: input.param.id,
          json: c.req.valid('json'),
        }
      })
    )
    const res = await app.request('/5?page=2', json({ a: 1 }))
    expect(await res.json()).toEqual({
      input: { page: 2 },
      id: 5,
      json: { a: 1 },
    })
    expect(order).toEqual(['param', 'header', 'cookie', 'form', 'json'])
  })

  it('Should expose the options as validations', () => {
    const options = { query: schema }
    expect(defineHandler(options)(() => null).validations).toBe(options)
  })

  it('Should return the response of a validation function', async () => {
    const handler = vi.fn(() => 'x')
    const app = new Hono()
    app.get('/', defineHandler({ query: (_v, c) => c.text('nope', 403) })(handler))
    const res = await app.request('/')
    expect(res.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('Should give 400 for malformed JSON', async () => {
    const app = new Hono()
    app.post(
      '/',
      defineHandler({ json: z.object({}) })(() => null)
    )
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('Malformed JSON in request body')
  })

  it('Should throw HTTPException with all the failed targets', async () => {
    let caught: HTTPException | undefined
    const app = new Hono()
    app.onError((e, c) => {
      caught = e as HTTPException
      return (e as HTTPException).getResponse()
    })
    app.post(
      '/',
      defineHandler({
        query: schema,
        json: z.object({ user: z.object({ name: z.string() }) }),
        header: z.object({ 'x-ok': z.string().optional() }),
      })(() => null)
    )
    const res = await app.request('/?page=secret-value', json({ user: { name: 1 } }))
    expect(res.status).toBe(400)
    const body = (await res.json()) as any
    expect(body.error).toBe('Validation failed')
    expect(body.issues.map((i: any) => i.slot)).toEqual(['query', 'json'])
    expect(body.issues[1].issues[0].path).toBe('user.name')
    expect(JSON.stringify(body)).not.toContain('secret-value')
    expect(caught).toBeInstanceOf(HTTPException)
    expect((caught!.cause as any).issues.map((i: any) => i.slot)).toEqual(['query', 'json'])
    expect((caught!.cause as any).issues[0].issues[0].path).toEqual(['page'])
  })

  it('Should support object path items and omit empty paths', async () => {
    const custom: StandardSchema<unknown, unknown> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: async () => ({
          issues: [{ message: 'a', path: ['x', { key: 'y' }, 1] }, { message: 'b' }],
        }),
      },
    }
    const app = new Hono()
    app.get(
      '/',
      defineHandler({ query: custom })(() => null)
    )
    const res = await app.request('/')
    expect(await res.json()).toEqual({
      error: 'Validation failed',
      issues: [
        {
          slot: 'query',
          issues: [{ message: 'a', path: 'x.y.1' }, { message: 'b' }],
        },
      ],
    })
  })

  it('Should accept a callable Standard Schema', async () => {
    const callable = Object.assign(() => 1, schema as any as StandardSchema) as any
    Object.defineProperty(callable, '~standard', {
      value: schema['~standard'],
    })
    const app = new Hono()
    app.get(
      '/',
      defineHandler({ query: callable as typeof schema })((_c, { query }) => query)
    )
    expect(await (await app.request('/?page=3')).json()).toEqual({ page: 3 })
  })

  describe('response', () => {
    const response = z.object({ name: z.string(), n: z.coerce.number() })

    it('Should validate, transform and keep status and headers', async () => {
      const app = new Hono()
      app.get(
        '/',
        defineHandler({ response })((c) => {
          c.status(201)
          c.header('X-Foo', 'bar')
          return { name: 'a', n: '5', extra: 1 } as any
        })
      )
      const res = await app.request('/')
      expect(res.status).toBe(201)
      expect(res.headers.get('x-foo')).toBe('bar')
      expect(await res.json()).toEqual({ name: 'a', n: 5 })
    })

    it('Should return a Response as is', async () => {
      const app = new Hono()
      app.get(
        '/',
        defineHandler({ response })((c) => c.text('plain'))
      )
      expect(await (await app.request('/')).text()).toBe('plain')
    })

    it('Should throw 500 without issues', async () => {
      let caught: HTTPException | undefined
      const app = new Hono()
      app.onError((e) => {
        caught = e as HTTPException
        return (e as HTTPException).getResponse()
      })
      app.get(
        '/',
        defineHandler({ response })(() => ({ name: 1, n: 'x' }) as any)
      )
      const res = await app.request('/')
      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'Response validation failed' })
      expect((caught!.cause as any).issues[0].slot).toBe('response')
      expect((caught!.cause as any).issues[0].issues.length).toBeGreaterThan(0)
    })

    it('Should check the types', async () => {
      const app = new Hono().get(
        '/',
        defineHandler({ response })(() => ({ name: 'a', n: 1 }))
      )
      // @ts-expect-error name must be a string
      defineHandler({ response })(() => ({ name: 1, n: 1 }))
      const client = hc<typeof app>('http://localhost')
      const check = async () => {
        const res = await client.index.$get()
        type Body = Awaited<ReturnType<typeof res.json>>
        type verify = Expect<Equal<Body, { name: string; n: number }>>
      }
      expect(check).toBeTypeOf('function')
    })
  })

  it('Should run middleware before and after the validation', async () => {
    const calls: string[] = []
    const app = new Hono()
    app.get(
      '/',
      defineHandler({ query: z.object({ a: z.string() }) })(
        async (_c, next) => {
          calls.push('before')
          await next()
          calls.push('after')
        },
        (c, { query }) => {
          calls.push('handler')
          return { a: query.a }
        }
      )
    )
    expect((await app.request('/')).status).toBe(400)
    // the HTTPException propagates through the middleware
    expect(calls).toEqual(['before'])
    calls.length = 0
    expect(await (await app.request('/?a=1')).json()).toEqual({ a: '1' })
    expect(calls).toEqual(['before', 'handler', 'after'])
  })
})
