import test from 'ava';
import ky, {ForceRetryError, isForceRetryError, isKyError} from '../source/index.js';

test('forced retries bypass method and shouldRetry, stop hooks, and expose errors', async t => {
	const cause = new Error('rate limit');
	let sends = 0;
	let remainingHooks = 0;
	const counts: number[] = [];
	const api = ky.extend({retry: {limit: 2, shouldRetry: () => t.fail('shouldRetry called')}});
	const response = await api.post('https://example.com', {
		fetch: async () => new Response(String(++sends)),
		hooks: {
			afterResponse: [
				async (_request, _options, response, {retryCount}) => retryCount < 2 ? api.retry({delay: 0, code: 'RATE_LIMIT', cause}) : response,
				() => {
					remainingHooks++;
				},
			],
			beforeRetry: [({error, retryCount}) => {
				t.true(isForceRetryError(error));
				t.true(isKyError(error));
				t.true(error instanceof ForceRetryError);
				t.is(error.message, 'Forced retry: RATE_LIMIT');
				t.is(error.cause, cause);
				counts.push(retryCount);
			}],
		},
	});
	t.is(await response.text(), '3');
	t.deepEqual(counts, [1, 2]);
	t.is(remainingHooks, 1);
});

test('forced retries respect limit and wrap non-Error causes', async t => {
	let sends = 0;
	const error = await t.throwsAsync(ky('https://example.com', {
		retry: 1,
		async fetch() {
			sends++;
			return new Response('retry');
		},
		hooks: {afterResponse: [() => ky.retry({delay: 0, cause: 'reason'})]},
	}), {instanceOf: ForceRetryError, message: 'Forced retry'});
	t.is(sends, 2);
	t.true(error?.cause instanceof Error);
});

test('custom requests and beforeRetry replacements report their actual upload size', async t => {
	const sent: string[] = [];
	const totals: number[] = [];
	let retries = 0;
	await ky.post('https://example.com', {
		body: 'first',
		onUploadProgress(progress) {
			if (progress.percent === 1) {
				totals.push(progress.totalBytes);
			}
		},
		async fetch(request) {
			const outgoing = request as Request;
			sent.push(await outgoing.text());
			return new Response('ok');
		},
		hooks: {
			afterResponse: [() => retries < 2 ? ky.create().retry({delay: 0, request: new Request('https://example.com/custom', {method: 'PUT', body: 'custom body'})}) : undefined],
			beforeRetry: [({request}) => {
				t.is(request.url, 'https://example.com/custom');
				retries++;
				if (retries === 2) {
					return new Request('https://example.com/replaced', {method: 'POST', body: 'replacement'});
				}
			}],
		},
	});
	t.deepEqual(sent, ['first', 'custom body', 'replacement']);
	t.deepEqual(totals, [5, 11, 11]);
});

test('default forced retry delay uses normal backoff', async t => {
	const delays: number[] = [];
	let sends = 0;
	await ky('https://example.com', {
		retry: {
			delay(count) {
				delays.push(count);
				return 0;
			},
		},
		async fetch() {
			sends++;
			return new Response('ok');
		},
		hooks: {afterResponse: [() => sends === 1 ? ky.retry() : undefined]},
	});
	t.deepEqual(delays, [1]);
});

test('explicit forced retry delay skips jitter and backoff', async t => {
	let sends = 0;
	await ky('https://example.com', {
		retry: {
			delay() {
				t.fail('delay called');
				return 1000;
			},
			jitter() {
				t.fail('jitter called');
				return 1000;
			},
			backoffLimit: 0,
		},
		async fetch() {
			sends++;
			return new Response('ok');
		},
		hooks: {afterResponse: [() => sends === 1 ? ky.retry({delay: 0}) : undefined]},
	});
	t.is(sends, 2);
});

test('custom retry requests retain user cancellation', async t => {
	const controller = new AbortController();
	let sends = 0;
	await t.throwsAsync(ky('https://example.com', {
		signal: controller.signal,
		async fetch(request) {
			sends++;
			if (sends === 2) {
				controller.abort();
				(request as Request).signal.throwIfAborted();
			}

			return new Response('ok');
		},
		hooks: {afterResponse: [() => ky.retry({delay: 0, request: new Request('https://example.com/custom')})]},
	}), {name: 'AbortError'});
	t.is(sends, 2);
});
