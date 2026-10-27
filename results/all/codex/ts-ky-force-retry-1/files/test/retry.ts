import {setTimeout as delay} from 'node:timers/promises';
import test from 'ava';
import ky, {ForceRetryError, isForceRetryError, isKyError} from '../source/index.js';
import {createHttpTestServer} from './helpers/create-http-test-server.js';
import {withPerformance} from './helpers/with-performance.js';

const fixture = 'fixture';
const defaultRetryCount = 2;
const retryAfterOn500 = 2;
const retryAfterOn413 = 2;

test('network error', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;

		if (requestCount === defaultRetryCount + 1) {
			response.end(fixture);
		} else {
			response.status(99_999).end();
		}
	});

	t.is(await ky(server.url).text(), fixture);
	t.is(requestCount, defaultRetryCount + 1);

	await server.close();
});

test('status code 500', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;

		if (requestCount === defaultRetryCount + 1) {
			response.end(fixture);
		} else {
			response.sendStatus(500);
		}
	});

	t.is(await ky(server.url).text(), fixture);
	t.is(requestCount, defaultRetryCount + 1);

	await server.close();
});

test('only on defined status codes', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;

		if (requestCount === defaultRetryCount + 1) {
			response.end(fixture);
		} else {
			response.sendStatus(400);
		}
	});

	await t.throwsAsync(ky(server.url).text(), {message: /Bad Request/});
	t.is(requestCount, 1);

	await server.close();
});

test('not on POST', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.post('/', (_request, response) => {
		requestCount++;

		if (requestCount === defaultRetryCount + 1) {
			response.end(fixture);
		} else {
			response.sendStatus(500);
		}
	});

	await t.throwsAsync(ky.post(server.url).text(), {
		message: /Internal Server Error/,
	});
	t.is(requestCount, 1);

	await server.close();
});

test('respect Retry-After: 0 and retry immediately', async t => {
	const retryCount = 4;
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;

		if (requestCount === retryCount + 1) {
			response.end(fixture);
		} else {
			response.writeHead(413, {
				'Retry-After': 0,
			});

			response.end('');
		}
	});

	await withPerformance({
		t,
		expectedDuration: 4 + 4 + 4 + 4,
		async test() {
			t.is(await ky(server.url, {
				retry: retryCount,
			}).text(), fixture);
		},
	});

	t.is(requestCount, 5);

	await server.close();
});

test('RateLimit-Reset is treated the same as Retry-After', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;

		if (requestCount === defaultRetryCount + 1) {
			response.end(fixture);
		} else {
			const header = (requestCount < 2) ? 'RateLimit-Reset' : 'Retry-After';
			response.writeHead(429, {
				[header]: 1,
			});

			response.end('');
		}
	});

	await withPerformance({
		t,
		expectedDuration: 1000 + 1000,
		async test() {
			t.is(await ky(server.url).text(), fixture);
		},
	});

	t.is(requestCount, 3);

	await server.close();
});

test('RateLimit-Reset with time since epoch', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;

		if (requestCount === defaultRetryCount + 1) {
			response.end(fixture);
		} else {
			const twoSecondsByDelta = 2;
			const oneSecondByEpoch = (Date.now() / 1000) + 1;
			response.writeHead(429, {
				'RateLimit-Reset': (requestCount < 2) ? twoSecondsByDelta : oneSecondByEpoch,
			});

			response.end('');
		}
	});

	await withPerformance({
		t,
		expectedDuration: 2000 + 1000,
		async test() {
			t.is(await ky(server.url).text(), fixture);
		},
	});

	t.is(requestCount, 3);

	await server.close();
});

test('respect 413 Retry-After', async t => {
	const startTime = Date.now();
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;

		if (requestCount === defaultRetryCount + 1) {
			response.end((Date.now() - startTime).toString());
		} else {
			response.writeHead(413, {
				'Retry-After': retryAfterOn413,
			});
			response.end('');
		}
	});

	const timeElapsedInMs = Number(await ky(server.url).text());
	t.true(timeElapsedInMs >= retryAfterOn413 * 1000);
	t.is(requestCount, retryAfterOn413 + 1);

	await server.close();
});

test('respect 413 Retry-After with timestamp', async t => {
	const startTime = Date.now();
	let requestCount = 0;

	const server = await createHttpTestServer({bodyParser: false});
	server.get('/', (_request, response) => {
		requestCount++;
		if (requestCount === defaultRetryCount + 1) {
			response.end((Date.now() - startTime).toString());
		} else {
			// @NOTE we need to round up to the next second due to http-date resolution
			const date = new Date(Date.now() + ((retryAfterOn413 + 1) * 1000)).toUTCString();
			response.writeHead(413, {
				'Retry-After': date,
			});
			response.end('');
		}
	});

	const timeElapsedInMs = Number(await ky(server.url).text());
	t.true(timeElapsedInMs >= retryAfterOn413 * 1000);
	t.is(requestCount, retryAfterOn413 + 1);

	await server.close();
});

test('doesn\'t retry on 413 without Retry-After header', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;
		response.sendStatus(413);
	});

	await t.throwsAsync(ky(server.url).text(), {message: /Payload Too Large/});
	t.is(requestCount, 1);
	await ky(server.url, {throwHttpErrors: false}).text();
	t.is(requestCount, 2);

	await server.close();
});

test('respect custom `afterStatusCodes` (500) with Retry-After header', async t => {
	const startTime = Date.now();
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;

		if (requestCount === defaultRetryCount + 1) {
			response.end((Date.now() - startTime).toString());
		} else {
			response.writeHead(500, {
				'Retry-After': retryAfterOn500,
			});
			response.end('');
		}
	});

	const timeElapsedInMs = Number(await ky(server.url, {retry: {afterStatusCodes: [500]}}).text());
	t.true(timeElapsedInMs >= retryAfterOn500 * 1000);
	t.is(requestCount, retryAfterOn500 + 1);

	await server.close();
});

test('respect number of retries', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;
		response.sendStatus(408);
	});

	await t.throwsAsync(
		ky(server.url, {
			retry: {
				limit: 3,
			},
		}).text(),
		{
			message: /Request Timeout/,
		},
	);
	t.is(requestCount, 4);

	await server.close();
});

test('respect retry methods', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.post('/', (_request, response) => {
		requestCount++;
		response.sendStatus(408);
	});

	server.get('/', (_request, response) => {
		requestCount++;
		response.sendStatus(408);
	});

	await t.throwsAsync(
		ky(server.url, {
			method: 'post',
			retry: {
				limit: 3,
				methods: ['get'],
			},
		}).text(),
		{
			message: /Request Timeout/,
		},
	);
	t.is(requestCount, 1);

	requestCount = 0;
	await t.throwsAsync(
		ky(server.url, {
			retry: {
				limit: 2,
				methods: ['get'],
			},
		}).text(),
		{
			message: /Request Timeout/,
		},
	);
	t.is(requestCount, defaultRetryCount + 1);

	await server.close();
});

test('respect maxRetryAfter', async t => {
	const retryCount = 4;
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;

		if (requestCount === retryCount + 1) {
			response.end(fixture);
		} else {
			response.writeHead(413, {
				'Retry-After': 1,
			});

			response.end('');
		}
	});

	await withPerformance({
		t,
		expectedDuration: 420 + 420 + 420 + 420,
		async test() {
			t.is(await ky(server.url, {
				retry: {
					limit: retryCount,
					maxRetryAfter: 420,
				},
			}).text(), fixture);
		},
	});

	t.is(requestCount, 5);

	requestCount = 0;

	await withPerformance({
		t,
		expectedDuration: 1000 + 1000 + 1000 + 1000,
		async test() {
			t.is(await ky(server.url, {
				retry: {
					limit: retryCount,
					maxRetryAfter: 2000,
				},
			}).text(), fixture);
		},
	});

	t.is(requestCount, 5);

	await server.close();
});

test('retry - can provide retry as number', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', async (_request, response) => {
		requestCount++;
		response.sendStatus(408);
	});

	await t.throwsAsync(ky(server.url, {retry: 4}).text(), {
		message: /Request Timeout/,
	});
	t.is(requestCount, 5);

	await server.close();
});

test('doesn\'t retry on 413 with empty statusCodes and methods', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();

	server.get('/', async (_request, response) => {
		requestCount++;
		response.sendStatus(413);
	});

	await t.throwsAsync(
		ky(server.url, {
			retry: {
				limit: 10,
				statusCodes: [],
				methods: [],
			},
		}).text(),
		{
			message: /Payload Too Large/,
		},
	);

	t.is(requestCount, 1);

	await server.close();
});

test('doesn\'t retry on 413 with empty methods', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', async (_request, response) => {
		requestCount++;
		response.sendStatus(413);
	});

	await t.throwsAsync(
		ky(server.url, {
			retry: {
				limit: 10,
				methods: [],
			},
		}).text(),
		{
			message: /Payload Too Large/,
		},
	);

	t.is(requestCount, 1);

	await server.close();
});

test('does retry on 408 with methods provided as array', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', async (_request, response) => {
		requestCount++;
		response.sendStatus(408);
	});

	await t.throwsAsync(
		ky(server.url, {
			retry: {
				limit: 3,
				methods: ['get'],
			},
		}).text(),
		{
			message: /Request Timeout/,
		},
	);

	t.is(requestCount, 4);

	await server.close();
});

test('does retry on 408 with statusCodes provided as array', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', async (_request, response) => {
		requestCount++;
		response.sendStatus(408);
	});

	await t.throwsAsync(
		ky(server.url, {
			retry: {
				limit: 3,
				statusCodes: [408],
			},
		}).text(),
		{
			message: /Request Timeout/,
		},
	);

	t.is(requestCount, 4);

	await server.close();
});

test('doesn\'t retry when retry.limit is set to 0', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;
		response.sendStatus(408);
	});

	await t.throwsAsync(
		ky(server.url, {
			retry: {
				limit: 0,
			},
		}).text(),
		{
			message: /Request Timeout/,
		},
	);

	t.is(requestCount, 1);

	await server.close();
});

test('throws when retry.methods is not an array', async t => {
	const server = await createHttpTestServer();

	t.throws(() => {
		void ky(server.url, {
			retry: {
				// @ts-expect-error
				methods: 'get',
			},
		});
	});

	await server.close();
});

test('throws when retry.statusCodes is not an array', async t => {
	const server = await createHttpTestServer();

	t.throws(() => {
		void ky(server.url, {
			retry: {
				// @ts-expect-error
				statusCodes: 403,
			},
		});
	});

	await server.close();
});

test('respect maximum backoffLimit', async t => {
	const retryCount = 4;
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;

		if (requestCount === retryCount + 1) {
			response.end(fixture);
		} else {
			response.sendStatus(500);
		}
	});

	await withPerformance({
		t,
		expectedDuration: 300 + 600 + 1200 + 2400,
		async test() {
			t.is(await ky(server.url, {
				retry: retryCount,
			}).text(), fixture);
		},
	});

	t.is(requestCount, 5);

	requestCount = 0;

	await withPerformance({
		t,
		expectedDuration: 300 + 600 + 1000 + 1000,
		async test() {
			t.is(await ky(server.url, {
				retry: {
					limit: retryCount,
					backoffLimit: 1000,
				},
			}).text(), fixture);
		},
	});

	t.is(requestCount, 5);

	await server.close();
});

test('respect custom retry.delay', async t => {
	const retryCount = 4;
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;

		if (requestCount === retryCount + 1) {
			response.end(fixture);
		} else {
			response.sendStatus(500);
		}
	});

	await withPerformance({
		t,
		expectedDuration: 200 + 300 + 400 + 500,
		async test() {
			t.is(await ky(server.url, {
				retry: {
					limit: retryCount,
					delay: n => 100 * (n + 1),
				},
			}).text(), fixture);
		},
	});

	t.is(requestCount, 5);

	await server.close();
});

test('jitter: true applies full jitter to delay', async t => {
	const retryCount = 3;
	let requestCount = 0;
	const delays: number[] = [];
	let lastTime = Date.now();

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		const now = Date.now();
		if (requestCount > 0) {
			delays.push(now - lastTime);
		}

		lastTime = now;
		requestCount++;

		if (requestCount === retryCount + 1) {
			response.end(fixture);
		} else {
			response.sendStatus(500);
		}
	});

	await ky(server.url, {
		retry: {
			limit: retryCount,
			jitter: true,
		},
	}).text();

	t.is(requestCount, 4);

	// Full jitter should produce delays between 0 and the computed delay
	// Add 50% tolerance for system overhead and CI variability
	t.true(delays[0] >= 0 && delays[0] <= 450);
	t.true(delays[1] >= 0 && delays[1] <= 900);
	t.true(delays[2] >= 0 && delays[2] <= 1800);

	await server.close();
});

test('jitter: custom function applies custom jitter', async t => {
	const retryCount = 3;
	let requestCount = 0;
	const jitterCalls: number[] = [];

	const customJitter = (delay: number) => {
		jitterCalls.push(delay);
		return delay * 0.5; // Half the delay
	};

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;

		if (requestCount === retryCount + 1) {
			response.end(fixture);
		} else {
			response.sendStatus(500);
		}
	});

	await ky(server.url, {
		retry: {
			limit: retryCount,
			jitter: customJitter,
		},
	}).text();

	t.is(requestCount, 4);
	t.is(jitterCalls.length, 3); // Called for each retry

	// Verify the jitter function received the correct delays
	t.is(jitterCalls[0], 300); // First retry
	t.is(jitterCalls[1], 600); // Second retry
	t.is(jitterCalls[2], 1200); // Third retry

	await server.close();
});

test('jitter respects backoffLimit', async t => {
	const retryCount = 3;
	let requestCount = 0;
	const delays: number[] = [];
	let lastTime = Date.now();

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		const now = Date.now();
		if (requestCount > 0) {
			delays.push(now - lastTime);
		}

		lastTime = now;
		requestCount++;

		if (requestCount === retryCount + 1) {
			response.end(fixture);
		} else {
			response.sendStatus(500);
		}
	});

	await ky(server.url, {
		retry: {
			limit: retryCount,
			backoffLimit: 500,
			jitter: true,
		},
	}).text();

	t.is(requestCount, 4);

	// With backoffLimit of 500, all delays should be <= 500ms
	// Even though the computed delays would be 300, 600, 1200
	// After jitter and backoffLimit, they should all be <= 500
	// Add 50% tolerance for system overhead and CI variability
	t.true(delays[0] >= 0 && delays[0] <= 750);
	t.true(delays[1] >= 0 && delays[1] <= 750);
	t.true(delays[2] >= 0 && delays[2] <= 750);

	await server.close();
});

test('jitter works with custom delay function', async t => {
	const retryCount = 2;
	let requestCount = 0;
	const jitterCalls: number[] = [];

	const customJitter = (delay: number) => {
		jitterCalls.push(delay);
		return delay * 0.5;
	};

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;

		if (requestCount === retryCount + 1) {
			response.end(fixture);
		} else {
			response.sendStatus(500);
		}
	});

	await ky(server.url, {
		retry: {
			limit: retryCount,
			delay: n => 100 * n, // Custom delay: 100ms, 200ms, etc.
			jitter: customJitter,
		},
	}).text();

	t.is(requestCount, 3);
	t.is(jitterCalls.length, 2);
	t.is(jitterCalls[0], 100); // First retry with custom delay
	t.is(jitterCalls[1], 200); // Second retry with custom delay

	await server.close();
});

test('jitter is not applied when Retry-After header is present', async t => {
	const startTime = Date.now();
	let requestCount = 0;
	const jitterCalls: number[] = [];

	const customJitter = (delay: number) => {
		jitterCalls.push(delay);
		return delay * 0.5;
	};

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;

		if (requestCount === 3) {
			response.end((Date.now() - startTime).toString());
		} else {
			response.writeHead(429, {
				'Retry-After': 1,
			});
			response.end('');
		}
	});

	const timeElapsedInMs = Number(await ky(server.url, {
		retry: {
			jitter: customJitter,
		},
	}).text());

	// Should have made 3 requests (initial + 2 retries)
	t.is(requestCount, 3);
	// Jitter function should NOT have been called when Retry-After is present
	t.is(jitterCalls.length, 0);
	// Should have waited at least 2 seconds (1s per retry)
	t.true(timeElapsedInMs >= 2000);

	await server.close();
});

test('retryOnTimeout: false (default) - does not retry on timeout', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', async (_request, response) => {
		requestCount++;
		// Delay longer than timeout to trigger timeout
		await delay(1000);
		response.end(fixture);
	});

	await t.throwsAsync(
		ky(server.url, {
			timeout: 500,
			retry: {
				limit: 3,
			},
		}).text(),
		{
			name: 'TimeoutError',
		},
	);

	t.is(requestCount, 1); // Should not retry

	await server.close();
});

test('retryOnTimeout: true - retries on timeout', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', async (_request, response) => {
		requestCount++;
		if (requestCount <= 2) {
			// Delay longer than timeout to trigger timeout
			await delay(1000);
			response.end(fixture);
		} else {
			response.end(fixture);
		}
	});

	const result = await ky(server.url, {
		timeout: 500,
		retry: {
			limit: 3,
			retryOnTimeout: true,
		},
	}).text();

	t.is(result, fixture);
	t.is(requestCount, 3); // Initial + 2 retries

	await server.close();
});

test('retryOnTimeout: true - respects retry limit on timeout', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', async (_request, response) => {
		requestCount++;
		// Always timeout
		await delay(2000);
	});

	await t.throwsAsync(
		ky(server.url, {
			timeout: 500,
			retry: {
				limit: 2,
				retryOnTimeout: true,
			},
		}).text(),
		{
			name: 'TimeoutError',
		},
	);

	t.is(requestCount, 3); // Initial + 2 retries

	await server.close();
});

test('shouldRetry: returns true - forces retry bypassing all checks', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', async (_request, response) => {
		requestCount++;
		if (requestCount <= 2) {
			// Delay longer than timeout to trigger timeout
			await delay(1000);
			response.end(fixture);
		} else {
			response.end(fixture);
		}
	});

	const result = await ky(server.url, {
		timeout: 500,
		retry: {
			limit: 3,
			retryOnTimeout: false, // Disabled
			shouldRetry: () => true, // But shouldRetry forces retry
		},
	}).text();

	t.is(result, fixture);
	t.is(requestCount, 3);

	await server.close();
});

test('shouldRetry: returns false - prevents retry', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;
		response.sendStatus(500); // Normally retriable
	});

	await t.throwsAsync(
		ky(server.url, {
			retry: {
				limit: 3,
				shouldRetry: () => false, // Prevent all retries
			},
		}).text(),
		{
			message: /Internal Server Error/,
		},
	);

	t.is(requestCount, 1); // No retries

	await server.close();
});

test('shouldRetry: returns undefined - uses default retry logic', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;
		if (requestCount <= 2) {
			response.sendStatus(500); // Retriable
		} else {
			response.end(fixture);
		}
	});

	const result = await ky(server.url, {
		retry: {
			limit: 3,
			shouldRetry: () => undefined, // Fall through to default
		},
	}).text();

	t.is(result, fixture);
	t.is(requestCount, 3); // Default retry behavior

	await server.close();
});

test('shouldRetry: receives correct state object', async t => {
	let requestCount = 0;
	const states: Array<{errorName: string; retryCount: number}> = [];

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;
		if (requestCount <= 2) {
			response.sendStatus(500);
		} else {
			response.end(fixture);
		}
	});

	await ky(server.url, {
		retry: {
			limit: 3,
			shouldRetry({error, retryCount}) {
				states.push({errorName: error.name, retryCount});
				return undefined; // Use default logic
			},
		},
	}).text();

	t.is(states.length, 2);
	t.is(states[0].errorName, 'HTTPError');
	t.is(states[0].retryCount, 1); // First retry
	t.is(states[1].errorName, 'HTTPError');
	t.is(states[1].retryCount, 2); // Second retry

	await server.close();
});

test('shouldRetry: custom business logic with HTTPError', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;
		if (requestCount === 1) {
			response.sendStatus(429); // Rate limit
		} else if (requestCount === 2) {
			response.sendStatus(500); // Server error
		} else {
			response.end(fixture);
		}
	});

	const result = await ky(server.url, {
		retry: {
			limit: 3,
			async shouldRetry({error, retryCount}) {
				const {HTTPError} = await import('../source/index.js');
				if (error instanceof HTTPError) {
					const {status} = error.response;
					// Retry on 429 but only first attempt
					if (status === 429 && retryCount <= 1) {
						return true;
					}

					// Don't retry on 4xx
					if (status >= 400 && status < 500) {
						return false;
					}
				}

				return undefined;
			},
		},
	}).text();

	t.is(result, fixture);
	t.is(requestCount, 3);

	await server.close();
});

test('shouldRetry: error propagates if shouldRetry throws', async t => {
	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		response.sendStatus(500);
	});

	await t.throwsAsync(
		ky(server.url, {
			retry: {
				limit: 3,
				shouldRetry() {
					throw new Error('shouldRetry failed');
				},
			},
		}).text(),
		{
			message: 'shouldRetry failed',
		},
	);

	await server.close();
});

test('shouldRetry: works with TimeoutError', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', async (_request, response) => {
		requestCount++;
		if (requestCount <= 2) {
			// Delay longer than timeout to trigger timeout
			await delay(1000);
			response.end(fixture);
		} else {
			response.end(fixture);
		}
	});

	const result = await ky(server.url, {
		timeout: 500,
		retry: {
			limit: 3,
			async shouldRetry({error}) {
				const {TimeoutError} = await import('../source/index.js');
				return error instanceof TimeoutError;
			},
		},
	}).text();

	t.is(result, fixture);
	t.is(requestCount, 3);

	await server.close();
});

test('shouldRetry: precedence over retryOnTimeout', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', async (_request, response) => {
		requestCount++;
		// Delay longer than timeout to trigger timeout
		await delay(1000);
		response.end(fixture);
	});

	await t.throwsAsync(
		ky(server.url, {
			timeout: 500,
			retry: {
				limit: 3,
				retryOnTimeout: true, // Would retry
				shouldRetry: () => false, // But shouldRetry prevents it
			},
		}).text(),
		{
			name: 'TimeoutError',
		},
	);

	t.is(requestCount, 1); // No retries

	await server.close();
});

test('shouldRetry: works with synchronous function', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;
		if (requestCount <= 2) {
			response.sendStatus(500);
		} else {
			response.end(fixture);
		}
	});

	const result = await ky(server.url, {
		retry: {
			limit: 3,
			shouldRetry: () => true, // Sync function returning true
		},
	}).text();

	t.is(result, fixture);
	t.is(requestCount, 3);

	await server.close();
});

test('shouldRetry: non-boolean return values fall through to default logic', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;
		if (requestCount <= 2) {
			response.sendStatus(500); // Retriable by default
		} else {
			response.end(fixture);
		}
	});

	// Test with various non-boolean return values - all should fall through
	const result = await ky(server.url, {
		retry: {
			limit: 3,
			shouldRetry: () => 42 as any, // Non-boolean (number) falls through
		},
	}).text();

	t.is(result, fixture);
	t.is(requestCount, 3); // Should retry using default logic

	await server.close();
});

test('shouldRetry: receives proper Error instance even for HTTPError', async t => {
	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		response.sendStatus(404);
	});

	let receivedError: Error | undefined;

	await t.throwsAsync(
		ky(server.url, {
			retry: {
				limit: 1,
				shouldRetry({error}) {
					receivedError = error;
					// Verify it's a proper Error instance
					t.true(error instanceof Error);
					t.is(error.name, 'HTTPError');
					return false;
				},
			},
		}).text(),
	);

	// Ensure shouldRetry was called
	t.truthy(receivedError);

	await server.close();
});

test('shouldRetry: combines with default status code logic when returning undefined', async t => {
	let requestCount = 0;
	const capturedStatuses: number[] = [];

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;
		if (requestCount === 1) {
			response.sendStatus(500); // Retriable
		} else if (requestCount === 2) {
			response.sendStatus(404); // Not retriable
		} else {
			response.end(fixture);
		}
	});

	await t.throwsAsync(
		ky(server.url, {
			retry: {
				limit: 3,
				async shouldRetry({error}) {
					const {HTTPError} = await import('../source/index.js');
					if (error instanceof HTTPError) {
						capturedStatuses.push(error.response.status);
					}

					return undefined; // Fall through to default logic
				},
			},
		}).text(),
		{
			message: /Not Found/,
		},
	);

	// Should retry on 500, then fail on 404
	t.is(requestCount, 2);
	t.deepEqual(capturedStatuses, [500, 404]);

	await server.close();
});

test('shouldRetry: retryCount starts at 1 for first retry', async t => {
	const retryCounts: number[] = [];

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		response.sendStatus(500);
	});

	await t.throwsAsync(
		ky(server.url, {
			retry: {
				limit: 3,
				shouldRetry({retryCount}) {
					retryCounts.push(retryCount);
					return retryCount < 3; // Stop at 3rd retry
				},
			},
		}).text(),
	);

	t.deepEqual(retryCounts, [1, 2, 3]);

	await server.close();
});

test('shouldRetry: handles Promise return value correctly', async t => {
	let requestCount = 0;

	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		requestCount++;
		if (requestCount <= 2) {
			response.sendStatus(500);
		} else {
			response.end(fixture);
		}
	});

	const result = await ky(server.url, {
		retry: {
			limit: 3,
			shouldRetry: async () => true,
		},
	}).text();

	t.is(result, fixture);
	t.is(requestCount, 3);

	await server.close();
});

test('shouldRetry: error propagates if shouldRetry returns rejected Promise', async t => {
	const server = await createHttpTestServer();
	server.get('/', (_request, response) => {
		response.sendStatus(500);
	});

	await t.throwsAsync(
		ky(server.url, {
			retry: {
				limit: 3,
				// eslint-disable-next-line @typescript-eslint/promise-function-async
				shouldRetry: () => Promise.reject(new Error('shouldRetry Promise rejected')),
			},
		}).text(),
		{
			message: 'shouldRetry Promise rejected',
		},
	);

	await server.close();
});

for (const [index, instance] of [ky, ky.create(), ky.extend({})].entries()) {
	test(`forced retries on POST: ${index}`, async t => {
		const cause = new Error('rate limit');
		let calls = 0;
		let hooks = 0;
		const result = await instance.post('https://example.com', {
			fetch: async () => new Response(JSON.stringify(++calls === 1 ? {error: {code: 'RATE_LIMIT', retryAfter: 2}} : {ok: true})),
			retry: {
				limit: 1, methods: [], shouldRetry() {
					t.fail();
					return false;
				},
			},
			hooks: {
				afterResponse: [async (_request, _options, response) => {
					const body = await response.json() as {error?: {code: string; retryAfter: number}};
					if (body.error) {
						return instance.retry({delay: 0, code: body.error.code, cause});
					}
				}, () => {
					hooks++;
				}],
				beforeRetry: [({error, retryCount}) => {
					t.true(isForceRetryError(error));
					t.true(isKyError(error));
					t.true(error instanceof ForceRetryError);
					t.is(error.message, 'Forced retry: RATE_LIMIT');
					t.is(error.cause, cause);
					t.is((error as ForceRetryError).code, 'RATE_LIMIT');
					t.is(retryCount, 1);
				}],
			},
		}).json();
		t.deepEqual(result, {ok: true});
		t.is(calls, 2);
		t.is(hooks, 1);
	});
}

for (const limit of [0, 2]) {
	test(`forced retry respects limit ${limit}`, async t => {
		let calls = 0;
		const error = await t.throwsAsync(ky('https://example.com', {
			async fetch() {
				calls++;
				return new Response('retry');
			},
			retry: {limit},
			hooks: {afterResponse: [() => ky.retry({delay: 0, cause: 'reason'})]},
		}), {instanceOf: ForceRetryError, message: 'Forced retry'});
		t.is((error?.cause as Error).message, 'reason');
		t.is(calls, limit + 1);
	});
}

for (const explicit of [true, false]) {
	test(`forced retry delay ${explicit ? 'explicit' : 'default'}`, async t => {
		let calls = 0;
		let delays = 0;
		let jitters = 0;
		const start = performance.now();
		await ky('https://example.com', {
			async fetch() {
				calls++;
				return new Response();
			},
			retry: {
				delay() {
					delays++;
					return 1;
				},
				jitter(value) {
					jitters++;
					return value;
				},
				backoffLimit: 0,
			},
			hooks: {afterResponse: [() => calls === 1 ? ky.retry(explicit ? {delay: 50} : undefined) : undefined]},
		});
		t.is(delays, explicit ? 0 : 1);
		t.is(jitters, explicit ? 0 : 1);
		if (explicit) {
			t.true(performance.now() - start >= 45);
		}
	});
}

test('forced retry custom requests and hook replacements report actual upload sizes', async t => {
	const bodies: string[] = [];
	const totals: number[] = [];
	const custom = new Request('https://example.com/custom', {method: 'PUT', body: 'custom body', headers: {custom: 'yes'}});
	await ky.post('https://example.com', {
		body: 'initial',
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
			afterResponse: [(_request, _options, _response, {retryCount}) => retryCount < 2 ? ky.retry({request: custom.clone(), delay: 0}) : undefined],
			beforeRetry: [({request, retryCount}) => {
				t.is(request.url, custom.url);
				t.is(request.method, 'PUT');
				t.is(request.headers.get('custom'), 'yes');
				if (retryCount === 2) {
					return new Request('https://example.com/replaced', {method: 'PATCH', body: 'replacement'});
				}
			}],
		},
	});
	t.deepEqual(bodies, ['initial', 'custom body', 'replacement']);
	t.deepEqual(totals, [7, 11, 11]);
});

for (const abort of [true, false]) {
	test(`custom forced retry preserves ${abort ? 'user abort' : 'timeout'}`, async t => {
		const controller = new AbortController();
		let calls = 0;
		await t.throwsAsync(ky('https://example.com', {
			signal: controller.signal,
			timeout: abort ? false : 20,
			async fetch(request) {
				if (++calls === 1) {
					return new Response();
				}

				return new Promise((_resolve, reject) => {
					(request as Request).signal.addEventListener('abort', () => {
						reject((request as Request).signal.reason as Error);
					});
					if (abort) {
						controller.abort();
					}
				});
			},
			hooks: {afterResponse: [() => ky.retry({delay: 0, request: new Request('https://example.com/custom')})]},
		}), {name: abort ? 'AbortError' : 'TimeoutError'});
		t.is(calls, 2);
	});
}

test('forced retries cancel original and hook response bodies', async t => {
	let cancelled = false;
	let calls = 0;
	await ky('https://example.com', {
		async fetch() {
			if (++calls > 1) {
				return new Response();
			}

			return new Response(new ReadableStream({
				cancel() {
					cancelled = true;
				},
			}));
		},
		hooks: {afterResponse: [() => undefined, () => calls === 1 ? ky.retry({delay: 0}) : undefined]},
	});
	await delay(0);
	t.true(cancelled);
	t.false(isForceRetryError(new Error('ordinary')));
	t.false(isForceRetryError(null));
});
