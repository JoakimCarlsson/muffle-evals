import test from 'ava';
import ky, {ForceRetryError, isForceRetryError, isKyError} from '../source/index.js';

test('forced retries skip method and shouldRetry checks and remaining response hooks', async t => {
	let calls = 0;
	let remainingHooks = 0;
	const cause = new Error('rate limit');
	const result = await ky.post('https://example.com', {
		retry: {
			limit: 1, shouldRetry() {
				t.fail();
				return false;
			},
		},
		fetch: async () => new Response(++calls === 1 ? 'error' : 'ok'),
		hooks: {
			afterResponse: [
				async (_request, _options, response) => (await response.text()) === 'error' ? ky.retry({delay: 0, code: 'RATE_LIMIT', cause}) : undefined,
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
	t.is(result, 'ok');
	t.is(calls, 2);
	t.is(remainingHooks, 1);
});

test('forced retry respects limit and is available on derived instances', async t => {
	let calls = 0;
	const api = ky.create().extend({});
	const error = await t.throwsAsync(api('https://example.com', {
		retry: {limit: 1, delay: () => 0},
		async fetch() {
			calls++;
			return new Response('error');
		},
		hooks: {afterResponse: [() => api.retry({cause: 'reason'})]},
	}), {instanceOf: ForceRetryError, message: 'Forced retry'});
	t.true(error?.cause instanceof Error);
	t.is(calls, 2);
});

test('replacement requests receive upload progress with their actual body size', async t => {
	const totals: number[] = [];
	const bodies: string[] = [];
	await ky.post('https://example.com', {
		body: 'first',
		onUploadProgress(progress) {
			if (progress.percent === 1) {
				totals.push(progress.totalBytes);
			}
		},
		async fetch(request) {
			bodies.push(await (request as Request).text());
			return new Response('ok');
		},
		hooks: {
			afterResponse: [(_request, _options, _response, {retryCount}) => retryCount === 0 ? ky.retry({delay: 0, request: new Request('https://example.com/custom', {method: 'PUT', body: 'custom'})}) : undefined],
			beforeRetry: [({request}) => {
				t.is(request.url, 'https://example.com/custom');
				return new Request('https://example.com/replaced', {method: 'POST', body: 'replacement'});
			}],
		},
	});
	t.deepEqual(bodies, ['first', 'replacement']);
	t.deepEqual(totals, [5, 11]);
});

test('custom retry requests retain timeout and user abort signal', async t => {
	for (const abort of [false, true]) {
		const controller = new AbortController();
		let calls = 0;
		const promise = ky('https://example.com', {
			timeout: 30,
			signal: controller.signal,
			async fetch(request) {
				calls++;
				if (calls === 1) {
					return new Response('retry');
				}

				return new Promise<Response>((_resolve, reject) => {
					(request as Request).signal.addEventListener('abort', () => {
						reject((request as Request).signal.reason as Error);
					});
					if (abort) {
						controller.abort();
					}
				});
			},
			hooks: {afterResponse: [() => ky.retry({delay: 0, request: new Request('https://example.com/custom')})]},
		});
		// eslint-disable-next-line no-await-in-loop
		await t.throwsAsync(promise, {name: abort ? 'AbortError' : 'TimeoutError'});
		t.is(calls, 2);
	}
});
