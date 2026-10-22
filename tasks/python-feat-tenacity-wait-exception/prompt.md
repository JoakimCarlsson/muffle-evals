I'd like a wait strategy where the wait time depends on the exception that the last attempt raised. My use case is HTTP requests: on a 429 I want to wait for what the server's `Retry-After` header says, and on other errors a fixed longer time.

Something like this, exported from `tenacity` next to the other `wait_*` strategies:

```python
def http_error(exception: BaseException) -> float:
    if isinstance(exception, requests.HTTPError) and exception.response.status_code == 429:
        return float(exception.response.headers.get("Retry-After", "1"))
    return 60.0

@retry(stop=stop_after_attempt(3), wait=tenacity.wait_exception(http_error))
def http_get_request(url: str) -> None:
    requests.get(url).raise_for_status()
```

`wait_exception(predicate)` takes a function that is passed the exception object of the failed attempt and returns the number of seconds to wait, and the strategy waits exactly that. It should work anywhere a wait strategy does, such as `Retrying(wait=wait_exception(predicate))`. If it is asked for a wait time when the last attempt did not fail with an exception (for example, it returned a value that a `retry_if_result` rejected), it should raise `RuntimeError`, since there is no exception to pass to the function.

Please add this.
