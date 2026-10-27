import type {ForceRetryOptions} from '../types/force-retry.js';
import {NonError} from './NonError.js';

/** Error passed to `beforeRetry` when an `afterResponse` hook requests a retry. */
export class ForceRetryError extends Error {
	override name = 'ForceRetryError';
	readonly code: string | undefined;

	constructor(options: ForceRetryOptions = {}) {
		super(options.code === undefined ? 'Forced retry' : `Forced retry: ${options.code}`, {
			cause: options.cause === undefined || options.cause instanceof Error ? options.cause : new NonError(options.cause),
		});
		this.code = options.code;
	}
}
