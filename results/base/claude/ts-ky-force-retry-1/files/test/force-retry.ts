import test from 'ava';
import ky, {ForceRetryError, isForceRetryError, type Progress} from '../source/index.js';
import {createHttpTestServer} from './helpers/create-http-test-server.js';
import {parseRawBody} from './helpers/parse-body.js';

const rateLimitHook = async (_request: Request, _options: unknown, response: Response) => {
	const body = await response.json() as {error?: {code: string}};
	if (body.error) {
		return ky.retry({code: body.error.code, delay: 0});
	}
};

test('afterResponse can force a retry of a 200 response', async t => {
	const server = await createHttpTestServer();
	let requestCount = 0;
	server.get('/', (_request, response) => {
		requestCount++;
		response.json(requestCount === 1 ? {error: {code: 'RATE_LIMIT'}} : {ok: true});
	});

	const errors: unknown[] = [];
	const counts: number[] = [];
	const result = await ky.get(server.url, {
		hooks: {
			afterResponse: [rateLimitHook],
			beforeRetry: [({error, retryCount}) => {
				errors.push(error);
				counts.push(retryCount);
			}],
		},
	}).json();

	t.deepEqual(result, {ok: true});
	t.is(requestCount, 2);
	t.deepEqual(counts, [1]);
	t.true(errors[0] instanceof ForceRetryError);
	t.true(isForceRetryError(errors[0]));
	t.is((errors[0] as ForceRetryError).name, 'ForceRetryError');
	t.is((errors[0] as ForceRetryError).code, 'RATE_LIMIT');
	t.is((errors[0] as ForceRetryError).message, 'Forced retry: RATE_LIMIT');
});

test('forced retry works for POST, skips shouldRetry and later hooks, and counts against limit', async t => {
	const server = await createHttpTestServer();
	let requestCount = 0;
	server.post('/', (_request, response) => {
		requestCount++;
		response.json({});
	});

	let shouldRetryCalls = 0;
	let laterHookCalls = 0;
	await t.throwsAsync(ky.post(server.url, {
		retry: {
			limit: 2,
			shouldRetry() {
				shouldRetryCalls++;
				return false;
			},
		},
		hooks: {
			afterResponse: [
				() => ky.retry({delay: 0}),
				() => {
					laterHookCalls++;
				},
			],
		},
	}), {instanceOf: ForceRetryError, message: 'Forced retry'});

	t.is(requestCount, 3);
	t.is(shouldRetryCalls, 0);
	t.is(laterHookCalls, 0);
});

test('delay is used as is, cause is kept and non-errors are wrapped', async t => {
	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		response.json({});
	});

	const causes: unknown[] = [];
	let first = true;
	const start = Date.now();
	await ky.get(server.url, {
		retry: {backoffLimit: 1, jitter: true},
		hooks: {
			afterResponse: [() => {
				if (first) {
					first = false;
					return ky.retry({delay: 300, cause: 'nope' as unknown as Error});
				}
			}],
			beforeRetry: [({error}) => {
				causes.push(error.cause);
			}],
		},
	});

	t.true(Date.now() - start >= 280);
	t.true(causes[0] instanceof Error);
	t.is((causes[0] as Error).message, 'nope');
});

test('custom request is used and can be replaced by beforeRetry', async t => {
	const server = await createHttpTestServer();
	server.get('/first', (_request, response) => {
		response.json({});
	});
	server.get('/second', (_request, response) => {
		response.send('second');
	});
	server.get('/third', (_request, response) => {
		response.send('third');
	});

	const seen: string[] = [];
	const text = await ky.get(`${server.url}/first`, {
		hooks: {
			afterResponse: [(_request, _options, response) => {
				if (response.url.endsWith('/first')) {
					return ky.retry({delay: 0, request: new Request(`${server.url}/second`)});
				}
			}],
			beforeRetry: [({request}) => {
				seen.push(request.url);
			}],
		},
	}).text();

	t.is(text, 'second');
	t.deepEqual(seen, [`${server.url}/second`]);

	const replaced = await ky.get(`${server.url}/first`, {
		hooks: {
			afterResponse: [(_request, _options, response) => {
				if (response.url.endsWith('/first')) {
					return ky.retry({delay: 0, request: new Request(`${server.url}/second`)});
				}
			}],
			beforeRetry: [() => new Request(`${server.url}/third`)],
		},
	}).text();

	t.is(replaced, 'third');
});

test('custom request still honors the timeout', async t => {
	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		response.json({});
	});
	server.get('/slow', () => {
		// Never respond
	});

	await t.throwsAsync(ky.get(server.url, {
		timeout: 200,
		retry: {limit: 1, retryOnTimeout: false},
		hooks: {
			afterResponse: [(_request, _options, response) => {
				if (response.url === `${server.url}/`) {
					return ky.retry({delay: 0, request: new Request(`${server.url}/slow`)});
				}
			}],
		},
	}), {name: 'TimeoutError'});
});

test('onUploadProgress reports for custom and beforeRetry requests with real size', async t => {
	const server = await createHttpTestServer({bodyParser: false});
	server.post('/', async (request, response) => {
		response.json(await parseRawBody(request));
	});

	const run = async (viaHook: boolean) => {
		const progress: Progress[] = [];
		const custom = new Request(server.url, {
			method: 'POST',
			body: 'a custom body!',
			headers: {'content-type': 'text/plain'},
			duplex: 'half',
		} as RequestInit);
		let first = true;
		await ky.post(server.url, {
			json: {a: 1},
			onUploadProgress(p) {
				progress.push(p);
			},
			hooks: {
				afterResponse: [() => {
					if (first) {
						first = false;
						return viaHook ? ky.retry({delay: 0}) : ky.retry({delay: 0, request: custom});
					}
				}],
				beforeRetry: viaHook
					? [() => new Request(server.url, {method: 'POST', body: 'hook body!!', duplex: 'half'} as RequestInit)]
					: [],
			},
		});
		return progress;
	};

	const viaCustom = await run(false);
	t.is(viaCustom.at(-1)!.totalBytes, 14);
	t.is(viaCustom.at(-1)!.transferredBytes, 14);
	t.is(viaCustom.filter(p => p.percent === 1).length, 2);

	const viaHook = await run(true);
	t.is(viaHook.at(-1)!.totalBytes, 11);
	t.is(viaHook.at(-1)!.transferredBytes, 11);
});
