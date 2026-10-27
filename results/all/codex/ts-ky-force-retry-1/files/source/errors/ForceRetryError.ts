import {NonError} from './NonError.js';

/** Options for a retry requested by an `afterResponse` hook. */
export type ForceRetryOptions = {
	/** Delay in milliseconds, bypassing backoff and jitter. */
	delay?: number;
	/** Machine-readable reason for the retry. */
	code?: string;
	/** Underlying error. Non-Error values are wrapped. */
	cause?: unknown;
	/** Request to send on the retry. */
	request?: Request;
};

/** Error passed to `beforeRetry` when an `afterResponse` hook forces a retry. */
export class ForceRetryError extends Error {
	override name = 'ForceRetryError';
	readonly code: string | undefined;

	/** Create a forced retry error. */
	constructor(options: ForceRetryOptions = {}) {
		super(options.code === undefined ? 'Forced retry' : `Forced retry: ${options.code}`, options.cause === undefined ? undefined : {
			cause: options.cause instanceof Error ? options.cause : new NonError(options.cause),
		});
		this.code = options.code;
	}
}
