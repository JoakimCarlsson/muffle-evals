import {NonError} from './NonError.js';

export type ForceRetryOptions = {
	/**
	Delay in milliseconds before the retry. Used as is, bypassing jitter and `backoffLimit`. `0` retries instantly. Without it, the normal retry delay is used.
	*/
	delay?: number;

	/**
	A machine-readable code, available as `error.code` in `beforeRetry` hooks.
	*/
	code?: string;

	/**
	The cause of the retry, kept as `error.cause`. Non-Error values are wrapped.
	*/
	cause?: Error;

	/**
	A custom request to send for the retry. Ky's timeout and the user's abort signal still apply to it.
	*/
	request?: Request;
};

/**
Returned from an `afterResponse` hook (via `ky.retry()`) to force a retry.
*/
export class RetryMarker {
	constructor(readonly options: ForceRetryOptions = {}) {}
}

/**
The error passed to `beforeRetry` hooks when an `afterResponse` hook forced a retry with `ky.retry()`.
*/
export class ForceRetryError extends Error {
	override name = 'ForceRetryError';
	readonly code?: string | undefined;
	readonly customDelay?: number | undefined;
	readonly customRequest?: Request | undefined;

	constructor({delay, code, cause, request}: ForceRetryOptions = {}) {
		super(code === undefined ? 'Forced retry' : `Forced retry: ${code}`, cause === undefined ? undefined : {cause: cause instanceof Error ? cause : new NonError(cause)});

		this.code = code;
		this.customDelay = delay;
		this.customRequest = request;
	}
}
