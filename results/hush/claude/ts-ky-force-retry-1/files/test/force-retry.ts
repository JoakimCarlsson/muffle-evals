import test from 'ava';
import ky, {ForceRetryError, isForceRetryError, type Progress} from '../source/index.js';
import {createHttpTestServer} from './helpers/create-http-test-server.js';

test('afterResponse can force a retry on a 200 response', async t => {
	let requestCount = 0;
	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;
		response.json(requestCount === 1 ? {error: {code: 'RATE_LIMIT'}} : {ok: true});
	});

	const retryCounts: number[] = [];
	const result = await ky.get(server.url, {
		hooks: {
			afterResponse: [
				async (_request, _options, response) => {
					const body = await response.json<{error?: unknown}>();
					if (body.error) {
						return ky.retry({delay: 0, code: 'RATE_LIMIT', cause: 'nope'});
					}
				},
				(_request, _options, _response, {retryCount}) => {
					t.is(retryCount, 1, 'remaining hooks are skipped for the forced response');
				},
			],
			beforeRetry: [
				({error, retryCount}) => {
					retryCounts.push(retryCount);
					t.true(isForceRetryError(error));
					t.true(error instanceof ForceRetryError);
					t.is(error.name, 'ForceRetryError');
					t.is(error.message, 'Forced retry: RATE_LIMIT');
					t.is((error as ForceRetryError).code, 'RATE_LIMIT');
					t.true(error.cause instanceof Error);
				},
			],
		},
	}).json();

	t.deepEqual(result, {ok: true});
	t.deepEqual(retryCounts, [1]);
	t.is(requestCount, 2);
	await server.close();
});

test('forced retry works for POST, ignores shouldRetry, counts against limit', async t => {
	let requestCount = 0;
	const server = await createHttpTestServer();
	server.post('/', (_request, response) => {
		requestCount++;
		response.end('x');
	});

	const error = await t.throwsAsync(ky.post(server.url, {
		retry: {
			limit: 2, shouldRetry() {
				t.fail('shouldRetry must not be called');
				return false;
			},
		},
		hooks: {afterResponse: [() => ky.retry({delay: 0})]},
	}));

	t.true(isForceRetryError(error));
	t.is(error!.message, 'Forced retry');
	t.is(requestCount, 3);
	await server.close();
});

test('custom request is used and beforeRetry can replace it; upload progress is reported', async t => {
	const seen: string[] = [];
	const server = await createHttpTestServer();
	server.post('/', (request, response) => {
		seen.push(request.url);
		response.end('first');
	});
	server.post('/other', (request, response) => {
		seen.push(request.url);
		response.end('other');
	});

	const progress: Progress[] = [];
	const text = await ky.post(server.url, {
		body: 'abc',
		onUploadProgress(p) {
			progress.push(p);
		},
		hooks: {
			afterResponse: [
				(_request, _options, _response, {retryCount}) => retryCount === 0
					? ky.retry({delay: 0, request: new Request(`${server.url}/other`, {method: 'POST', body: 'custom-body'})})
					: undefined,
			],
		},
	}).text();

	t.is(text, 'other');
	t.deepEqual(seen, ['/', '/other']);
	t.true(progress.some(p => p.totalBytes === 11 && p.percent === 1));
	t.true(progress.some(p => p.totalBytes === 3 && p.percent === 1));
	await server.close();
});
