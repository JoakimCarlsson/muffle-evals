import test from 'ava';
import ky, {ForceRetryError, isForceRetryError, isKyError} from '../source/index.js';

test('forced POST retry skips policy and remaining response hooks', async t => {
	let calls = 0;
	let remainingHooks = 0;
	const cause = new Error('rate limit');
	const result = await ky.post('https://example.com', {
		body: 'body',
		retry: {
			limit: 1, shouldRetry() {
				throw new Error('must not run');
			},
		},
		fetch: async () => new Response(++calls === 1 ? 'retry' : 'success'),
		hooks: {
			afterResponse: [
				async (_request, _options, response) => {
					if (await response.text() === 'retry') {
						return ky.retry({delay: 0, code: 'RATE_LIMIT', cause});
					}
				},
				() => {
					remainingHooks++;
				},
			],
			beforeRetry: [({error, retryCount}) => {
				t.true(isForceRetryError(error));
				t.true(isKyError(error));
				t.is(error.cause, cause);
				t.is(error.message, 'Forced retry: RATE_LIMIT');
				t.is(retryCount, 1);
			}],
		},
	}).text();
	t.is(result, 'success');
	t.is(calls, 2);
	t.is(remainingHooks, 1);
});

test('forced retry respects limit and wraps causes on all instances', async t => {
	for (const api of [ky, ky.create(), ky.extend({})]) {
		let calls = 0;
		// eslint-disable-next-line no-await-in-loop
		const error = await t.throwsAsync(api('https://example.com', {
			retry: 0,
			async fetch() {
				calls++;
				return new Response('retry');
			},
			hooks: {afterResponse: [() => api.retry({cause: 'reason'})]},
		}), {instanceOf: ForceRetryError, message: 'Forced retry'});
		t.true(error?.cause instanceof Error);
		t.is(calls, 1);
	}
});

test('custom retry requests and beforeRetry replacements report actual upload size', async t => {
	for (const replaceInHook of [false, true]) {
		const sizes: number[] = [];
		const bodies: string[] = [];
		// eslint-disable-next-line no-await-in-loop
		await ky.post('https://example.com', {
			body: 'first',
			onUploadProgress(progress) {
				if (progress.percent === 1) {
					sizes.push(progress.totalBytes);
				}
			},
			async fetch(request) {
				bodies.push(await (request as Request).text());
				return new Response('ok');
			},
			hooks: {
				afterResponse: [(_request, _options, _response, {retryCount}) => {
					if (retryCount === 0) {
						return ky.retry({delay: 0, request: new Request('https://example.com/other', {method: 'PUT', body: 'replacement'})});
					}
				}],
				beforeRetry: [({request}) => {
					t.is(request.url, 'https://example.com/other');
					if (replaceInHook) {
						return new Request('https://example.com/final', {method: 'POST', body: 'final'});
					}
				}],
			},
		}).text();
		t.deepEqual(bodies, ['first', replaceInHook ? 'final' : 'replacement']);
		t.deepEqual(sizes, [5, replaceInHook ? 5 : 11]);
	}
});

test('explicit delay bypasses delay policy, jitter, and backoff limit', async t => {
	let calls = 0;
	await ky('https://example.com', {
		retry: {
			backoffLimit: 0,
			delay() {
				throw new Error('delay policy must not run');
			},
			jitter() {
				throw new Error('jitter must not run');
			},
		},
		fetch: async () => new Response(String(++calls)),
		hooks: {afterResponse: [(_request, _options, _response, {retryCount}) => retryCount === 0 ? ky.retry({delay: 0}) : undefined]},
	});
	t.is(calls, 2);
});

test('custom requests retain timeout and user abort signal', async t => {
	for (const abort of [false, true]) {
		const controller = new AbortController();
		let calls = 0;
		let sentSignal: AbortSignal | undefined;
		// eslint-disable-next-line no-await-in-loop
		await t.throwsAsync(ky('https://example.com', {
			signal: controller.signal,
			timeout: 20,
			async fetch(request) {
				calls++;
				if (calls === 1) {
					return new Response('retry');
				}

				sentSignal = (request as Request).signal;
				return new Promise<Response>((_resolve, reject) => {
					sentSignal!.addEventListener('abort', () => {
						reject(sentSignal!.reason as Error);
					});
					if (abort) {
						controller.abort();
					}
				});
			},
			hooks: {afterResponse: [() => ky.retry({delay: 0, request: new Request('https://example.com/other')})]},
		}), {name: abort ? 'AbortError' : 'TimeoutError'});
		t.true(sentSignal?.aborted);
		t.is(calls, 2);
	}
});

test('forced retry without explicit delay uses normal delay policy', async t => {
	const counts: number[] = [];
	await ky.post('https://example.com', {
		retry: {
			delay(retryCount) {
				counts.push(retryCount);
				return 0;
			},
		},
		fetch: async () => new Response('ok'),
		hooks: {afterResponse: [(_request, _options, _response, {retryCount}) => retryCount === 0 ? ky.retry() : undefined]},
	}).text();
	t.deepEqual(counts, [1]);
});

test('forced retry cancels discarded responses and hook clones', async t => {
	const responses: Response[] = [];
	const hookResponses: Response[] = [];
	await ky('https://example.com', {
		async fetch() {
			const response = new Response('ok');
			responses.push(response);
			return response;
		},
		hooks: {
			afterResponse: [(_request, _options, response, {retryCount}) => {
				hookResponses.push(response);
				if (retryCount === 0) {
					return ky.retry({delay: 0});
				}
			}],
		},
	}).text();
	t.true(responses[0]!.bodyUsed);
	t.true(hookResponses[0]!.bodyUsed);
});

test('forced retry may reuse the hook request with upload progress on every attempt', async t => {
	const sizes: number[] = [];
	const bodies: string[] = [];
	await ky.post('https://example.com', {
		body: 'payload',
		onUploadProgress({percent, totalBytes}) {
			if (percent === 1) {
				sizes.push(totalBytes);
			}
		},
		async fetch(request) {
			bodies.push(await (request as Request).text());
			return new Response('ok');
		},
		hooks: {afterResponse: [(request, _options, _response, {retryCount}) => retryCount === 0 ? ky.retry({delay: 0, request}) : undefined]},
	}).text();
	t.deepEqual(bodies, ['payload', 'payload']);
	t.deepEqual(sizes, [7, 7]);
});
