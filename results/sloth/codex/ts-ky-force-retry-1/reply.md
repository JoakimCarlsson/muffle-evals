I’ll trace the retry, hook, and upload-progress paths, then add the API and focused tests in the existing style.

The retry loop currently excludes POST before hooks run, and upload progress is attached only to the initial request. I’ll move those checks to the shared retry and send paths so forced retries and replacement requests get the requested behavior.

The API and retry path are implemented. The new tests cover POST retries, limits, delays, errors, custom requests, timeout/abort handling, and upload sizes. Upload progress now attaches at send time; it measures the serialized body so replacement requests report their own size.

The build and 84 relevant tests passed. I then added coverage for cancelling response bodies retained by earlier hooks and documented the API. The final check will include that cancellation test.

Implemented `ky.retry()` with typed hook support, exported `ForceRetryError` and guard, custom requests, retry controls, and response cancellation. Upload progress now covers replacement requests with their actual body sizes.

Build, lint, and 85 relevant tests passed. Full suite not run.

Limit: upload progress measures the body before sending. No unrelated features added.
