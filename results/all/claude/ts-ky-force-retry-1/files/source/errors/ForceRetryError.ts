import {NonError} from './NonError.js';

export type ForceRetryOptions = {
	/**
	Delay in milliseconds before the retry. Used as is: jitter and `backoffLimit` are not applied, and `0` retries immediately. If omitted, the normal retry delay is used.
	*/
	delay?: number;

	/**
	A machine-readable code, available as `error.code` in `beforeRetry` hooks.
	*/
	code?: string;

	/**
	The reason for the retry. Kept as the `cause` of the `ForceRetryError`; non-`Error` values are wrapped.
	*/
	cause?: unknown;

	/**
	A custom request to send for the retry. Ky's timeout and the user's abort signal still apply to it.
	*/
	request?: Request;
};

/**
The value returned by `ky.retry()`. Return it from an `afterResponse` hook to force a retry.
*/
export class ForceRetrySignal {
	constructor(readonly options: ForceRetryOptions = {}) {}
}

/**
The error passed to `beforeRetry` hooks when a retry was forced with `ky.retry()`.
*/
export class ForceRetryError extends Error {
	override name = 'ForceRetryError';
	readonly code: string | undefined;

	constructor({code, cause}: ForceRetryOptions = {}) {
		super(
			code === undefined ? 'Forced retry' : `Forced retry: ${code}`,
			cause === undefined ? undefined : {cause: cause instanceof Error ? cause : new NonError(cause)},
		);

		this.code = code;
	}
}
