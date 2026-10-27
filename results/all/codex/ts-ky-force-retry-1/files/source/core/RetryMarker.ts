import type {ForceRetryOptions} from '../errors/ForceRetryError.js';

/** A retry requested by an `afterResponse` hook. */
export class RetryMarker {
	/** Store the requested retry options. */
	constructor(readonly options: ForceRetryOptions = {}) {}
}
