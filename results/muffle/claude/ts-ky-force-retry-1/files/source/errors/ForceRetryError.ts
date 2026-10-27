import {NonError} from './NonError.js';

export type ForceRetryOptions = {
	/**
	Delay in milliseconds before the retry. Used as is: jitter and `backoffLimit` are not applied, and `0` retries immediately. Without it, the normal retry delay is used.
	*/
	delay?: number;

	/**
	A machine-readable code describing why the retry was forced. Available as `error.code` in `beforeRetry` hooks.
	*/
	code?: string;

	/**
	The underlying error, kept as the `cause` of the `ForceRetryError`. Non-`Error` values are wrapped.
	*/
	cause?: Error;

	/**
	A custom request to send for the retry, for example with another URL, headers, method, or body. Ky's timeout and the user's abort signal still apply to it.
	*/
	request?: Request;
};

/**
The value returned by `ky.retry()`. Returning it from an `afterResponse` hook forces a retry.
*/
export class RetryMarker {
	constructor(public readonly options: ForceRetryOptions = {}) {}
}

export class ForceRetryError extends Error {
	public code?: string | undefined;

	constructor(options: Pick<ForceRetryOptions, 'code' | 'cause'> = {}) {
		super(
			options.code === undefined ? 'Forced retry' : `Forced retry: ${options.code}`,
			options.cause === undefined ? undefined : {cause: options.cause instanceof Error ? options.cause : new NonError(options.cause)},
		);

		this.name = 'ForceRetryError';
		this.code = options.code;
	}
}
