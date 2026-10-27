import {NonError} from './NonError.js';

/** Options for a retry requested by an `afterResponse` hook. */
export type ForceRetryOptions = {
	/** Delay in milliseconds, bypassing jitter and the backoff limit. */
	delay?: number;
	/** Machine-readable reason for the retry. */
	code?: string;
	/** Underlying error. Non-Error values are wrapped. */
	cause?: unknown;
	/** Request to use before running `beforeRetry` hooks. */
	request?: Request;
};

/** Signals a retry requested by an `afterResponse` hook. */
export class ForceRetryError extends Error {
	override name = 'ForceRetryError';
	readonly code: string | undefined;

	/** Creates a forced retry error. */
	constructor(readonly options: ForceRetryOptions = {}) {
		super(options.code === undefined ? 'Forced retry' : `Forced retry: ${options.code}`, options.cause === undefined ? undefined : {cause: options.cause instanceof Error ? options.cause : new NonError(options.cause)});
		this.code = options.code;
	}
}
