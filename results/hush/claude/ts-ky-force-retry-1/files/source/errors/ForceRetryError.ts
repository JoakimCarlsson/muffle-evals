import {NonError} from './NonError.js';

export class ForceRetryError extends Error {
	override name = 'ForceRetryError';
	code?: string | undefined;

	constructor(options?: {code?: string | undefined; cause?: unknown}) {
		const code = options?.code;
		super(code ? `Forced retry: ${code}` : 'Forced retry');

		this.code = code;

		if (options?.cause !== undefined) {
			this.cause = options.cause instanceof Error ? options.cause : new NonError(options.cause);
		}
	}
}
