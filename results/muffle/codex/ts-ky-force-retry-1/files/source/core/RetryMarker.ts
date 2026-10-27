import type {ForceRetryOptions} from '../types/retry.js';

/** A retry requested by an `afterResponse` hook. */
export class RetryMarker {
	constructor(readonly options: ForceRetryOptions = {}) {}
}
