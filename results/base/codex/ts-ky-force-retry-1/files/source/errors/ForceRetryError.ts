import type {ForceRetryOptions} from '../types/retry.js';
import {NonError} from './NonError.js';

/** Error passed to beforeRetry hooks when an afterResponse hook forces a retry. */
export class ForceRetryError extends Error {
	override name = 'ForceRetryError';
	readonly code: string | undefined;

	constructor(readonly options: ForceRetryOptions = {}) {
		super(options.code === undefined ? 'Forced retry' : `Forced retry: ${options.code}`, options.cause === undefined ? undefined : {
			cause: options.cause instanceof Error ? options.cause : new NonError(options.cause),
		});
		this.code = options.code;
	}
}
