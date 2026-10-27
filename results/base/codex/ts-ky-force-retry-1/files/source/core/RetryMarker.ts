import type {ForceRetryOptions} from '../types/retry.js';

export class RetryMarker {
	constructor(readonly options: ForceRetryOptions = {}) {}
}
