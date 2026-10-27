/** Options for a retry requested by an `afterResponse` hook. */
export type ForceRetryOptions = {
	/** Delay in milliseconds. Bypasses jitter and `backoffLimit`. */
	delay?: number;
	/** Machine-readable reason for the retry. */
	code?: string;
	/** Underlying error. Non-Error values are wrapped. */
	cause?: unknown;
	/** Request to use before running `beforeRetry` hooks. */
	request?: Request;
};
