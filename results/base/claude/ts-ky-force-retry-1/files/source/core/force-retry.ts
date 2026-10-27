import {NonError} from '../errors/NonError.js';
import type {ForceRetryOptions} from '../types/retry.js';

/**
The value returned by `ky.retry()`.
*/
export class ForceRetrySignal {
	readonly delay?: number | undefined;
	readonly code?: string | undefined;
	readonly cause?: Error;
	readonly request?: Request | undefined;

	constructor(options: ForceRetryOptions = {}) {
		if (options.delay !== undefined && (typeof options.delay !== 'number' || !Number.isFinite(options.delay) || options.delay < 0)) {
			throw new TypeError('The `delay` option of `ky.retry()` must be a non-negative finite number');
		}

		if (options.request !== undefined && !(options.request instanceof globalThis.Request)) {
			throw new TypeError('The `request` option of `ky.retry()` must be a `Request`');
		}

		this.delay = options.delay;
		this.code = options.code;
		this.request = options.request;

		if (options.cause !== undefined) {
			this.cause = options.cause instanceof Error ? options.cause : new NonError(options.cause);
		}
	}
}

export const retry = (options?: ForceRetryOptions): ForceRetrySignal => new ForceRetrySignal(options);
