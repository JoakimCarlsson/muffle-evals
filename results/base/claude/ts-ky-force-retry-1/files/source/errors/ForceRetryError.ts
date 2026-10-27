/**
Error passed to `beforeRetry` hooks when an `afterResponse` hook forces a retry with `ky.retry()`.
*/
export class ForceRetryError extends Error {
	override name = 'ForceRetryError';
	code?: string | undefined;

	constructor(options?: {code?: string | undefined; cause?: Error | undefined}) {
		super(
			options?.code ? `Forced retry: ${options.code}` : 'Forced retry',
			options?.cause ? {cause: options.cause} : undefined,
		);

		this.code = options?.code;
	}
}
