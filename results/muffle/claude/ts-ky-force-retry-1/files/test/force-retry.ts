import test from 'ava';
import ky, {isForceRetryError, type ForceRetryError} from '../source/index.js';
import {createHttpTestServer} from './helpers/create-http-test-server.js';

const rateLimited = (body: any) => body.error?.code === 'RATE_LIMIT';

test('afterResponse can force a retry of a 200 response', async t => {
	let requestCount = 0;
	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;
		response.json(requestCount === 1 ? {error: {code: 'RATE_LIMIT', retryAfter: 0}} : {ok: true});
	});

	const errors: unknown[] = [];
	const retryCounts: number[] = [];
	const json = await ky(server.url, {
		hooks: {
			afterResponse: [
				async (_request, _options, response) => {
					if (rateLimited(await response.clone().json())) {
						return ky.retry({delay: 0, code: 'RATE_LIMIT'});
					}
				},
			],
			beforeRetry: [
				({error, retryCount}) => {
					errors.push(error);
					retryCounts.push(retryCount);
				},
			],
		},
	}).json();

	t.deepEqual(json, {ok: true});
	t.is(requestCount, 2);
	t.deepEqual(retryCounts, [1]);
	const [error] = errors as ForceRetryError[];
	t.true(isForceRetryError(error));
	t.is(error!.name, 'ForceRetryError');
	t.is(error!.message, 'Forced retry: RATE_LIMIT');
	t.is(error!.code, 'RATE_LIMIT');

	await server.close();
});

test('forced retry works for POST, skips shouldRetry, stops later hooks, respects limit', async t => {
	let requestCount = 0;
	let shouldRetryCalls = 0;
	let laterHookCalls = 0;
	const server = await createHttpTestServer();
	server.post('/', (_request, response) => {
		requestCount++;
		response.json({});
	});

	const error = await t.throwsAsync(ky.post(server.url, {
		json: {a: 1},
		retry: {
			limit: 2,
			shouldRetry() {
				shouldRetryCalls++;
				return false;
			},
		},
		hooks: {
			afterResponse: [
				() => ky.retry({delay: 0, cause: 'oops' as any}),
				() => {
					laterHookCalls++;
				},
			],
		},
	}));

	t.true(isForceRetryError(error));
	t.is(error!.message, 'Forced retry');
	t.is((error!.cause as Error).name, 'NonError');
	t.is(requestCount, 3);
	t.is(shouldRetryCalls, 0);
	t.is(laterHookCalls, 0);

	await server.close();
});

test('custom request is used, beforeRetry can replace it, upload progress reports real size', async t => {
	const seen: string[] = [];
	const server = await createHttpTestServer();
	server.post('/first', (_request, response) => {
		seen.push('first');
		response.json({retry: true});
	});
	server.post('/second', (request, response) => {
		seen.push(`second:${request.headers['x-custom'] as string}`);
		response.json({done: true});
	});
	server.post('/third', (request, response) => {
		seen.push(`third:${request.headers['x-custom'] as string}`);
		response.json({done: 3});
	});

	const progress: number[] = [];
	const result = await ky.post(`${server.url}/first`, {
		body: 'abc',
		onUploadProgress(p) {
			progress.push(p.totalBytes);
		},
		hooks: {
			afterResponse: [
				async (_request, _options, response) => {
					const body = await response.clone().json() as {retry?: boolean};
					if (body.retry) {
						return ky.retry({
							request: new Request(`${server.url}/second`, {method: 'POST', body: 'hello world', headers: {'x-custom': 'yes'}}),
						});
					}
				},
			],
		},
	}).json();

	t.deepEqual(result, {done: true});
	t.deepEqual(seen, ['first', 'second:yes']);
	t.true(progress.includes(3));
	t.true(progress.includes(11));

	// A request returned from beforeRetry is replaced and reports progress too
	seen.length = 0;
	progress.length = 0;
	const result2 = await ky.post(`${server.url}/first`, {
		onUploadProgress(p) {
			progress.push(p.totalBytes);
		},
		body: 'abc',
		hooks: {
			afterResponse: [
				async (_request, _options, response) => {
					const body = await response.clone().json() as {retry?: boolean};
					if (body.retry) {
						return ky.retry({request: new Request(`${server.url}/second`, {method: 'POST', body: 'hello world'})});
					}
				},
			],
			beforeRetry: [
				({request}) => new Request(`${server.url}/third`, {method: 'POST', body: 'twelve bytes', headers: {'x-custom': 'hook', ...Object.fromEntries(request.headers)}}),
			],
		},
	}).json();

	t.deepEqual(result2, {done: 3});
	t.is(seen.at(-1), 'third:hook');
	t.true(progress.includes(12));

	await server.close();
});

test('user abort signal applies to a custom retry request', async t => {
	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		response.json({});
	});

	const controller = new AbortController();
	await t.throwsAsync(ky(server.url, {
		signal: controller.signal,
		hooks: {
			afterResponse: [
				() => {
					controller.abort();
					return ky.retry({delay: 0, request: new Request(server.url)});
				},
			],
		},
	}), {name: 'AbortError'});

	await server.close();
});
