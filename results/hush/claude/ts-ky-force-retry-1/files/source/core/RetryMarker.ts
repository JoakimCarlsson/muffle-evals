import type {ForceRetryOptions} from '../types/retry.js';

/**
The value returned by `ky.retry()`. Returning it from an `afterResponse` hook forces a retry.
*/
export class RetryMarker {
	constructor(readonly options?: ForceRetryOptions) {}
}
