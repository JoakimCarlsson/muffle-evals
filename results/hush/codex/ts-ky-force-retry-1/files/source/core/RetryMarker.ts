import type {ForceRetryOptions} from '../types/force-retry.js';

export class RetryMarker {
	constructor(readonly options: ForceRetryOptions = {}) {}
}
