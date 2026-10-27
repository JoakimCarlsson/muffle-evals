# python-feat-tenacity-wait-exception

Source: https://github.com/jd/tenacity/pull/541

## Prompt

> I'd like a wait strategy where the wait time depends on the exception that the last attempt raised. My use case is HTTP requests: on a 429 I want to wait for what the server's `Retry-After` header says, and on other errors a fixed longer time.
> 
> Something like this, exported from `tenacity` next to the other `wait_*` strategies:
> 
> ```python
> def http_error(exception: BaseException) -> float:
>     if isinstance(exception, requests.HTTPError) and exception.response.status_code == 429:
>         return float(exception.response.headers.get("Retry-After", "1"))
>     return 60.0
> 
> @retry(stop=stop_after_attempt(3), wait=tenacity.wait_exception(http_error))
> def http_get_request(url: str) -> None:
>     requests.get(url).raise_for_status()
> ```
> 
> `wait_exception(predicate)` takes a function that is passed the exception object of the failed attempt and returns the number of seconds to wait, and the strategy waits exactly that. It should work anywhere a wait strategy does, such as `Retrying(wait=wait_exception(predicate))`. If it is asked for a wait time when the last attempt did not fail with an exception (for example, it returned a value that a `retry_if_result` rejected), it should raise `RuntimeError`, since there is no exception to pass to the function.
> 
> Please add this.

## Upstream change (tests left out)

Files: [tenacity/__init__.py](../../tasks/python-feat-tenacity-wait-exception/upstream/tenacity/__init__.py), [tenacity/wait.py](../../tasks/python-feat-tenacity-wait-exception/upstream/tenacity/wait.py), [tests/test_tenacity.py](../../tasks/python-feat-tenacity-wait-exception/upstream/tests/test_tenacity.py)

```diff
diff --git a/tenacity/__init__.py b/tenacity/__init__.py
index e93793c..b0b4794 100644
--- a/tenacity/__init__.py
+++ b/tenacity/__init__.py
@@ -59,6 +59,7 @@ from .stop import stop_when_event_set  # noqa
 # Import all built-in wait strategies for easier usage.
 from .wait import wait_chain  # noqa
 from .wait import wait_combine  # noqa
+from .wait import wait_exception  # noqa
 from .wait import wait_exponential  # noqa
 from .wait import wait_fixed  # noqa
 from .wait import wait_incrementing  # noqa
@@ -686,6 +687,7 @@ __all__ = [
     "stop_when_event_set",
     "wait_chain",
     "wait_combine",
+    "wait_exception",
     "wait_exponential",
     "wait_fixed",
     "wait_incrementing",
diff --git a/tenacity/wait.py b/tenacity/wait.py
index dc3c850..abfde77 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -113,6 +113,45 @@ class wait_chain(wait_base):
         return wait_func(retry_state=retry_state)
 
 
+class wait_exception(wait_base):
+    """Wait strategy that waits the amount of time returned by the predicate.
+
+    The predicate is passed the exception object. Based on the exception, the
+    user can decide how much time to wait before retrying.
+
+    For example::
+
+        def http_error(exception: BaseException) -> float:
+            if (
+                isinstance(exception, requests.HTTPError)
+                and exception.response.status_code == requests.codes.too_many_requests
+            ):
+                return float(exception.response.headers.get("Retry-After", "1"))
+            return 60.0
+
+
+        @retry(
+            stop=stop_after_attempt(3),
+            wait=wait_exception(http_error),
+        )
+        def http_get_request(url: str) -> None:
+            response = requests.get(url)
+            response.raise_for_status()
+    """
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        if retry_state.outcome is None:
+            raise RuntimeError("__call__() called before outcome was set")
+
+        exception = retry_state.outcome.exception()
+        if exception is None:
+            raise RuntimeError("outcome failed but the exception is None")
+        return self.predicate(exception)
+
+
 class wait_incrementing(wait_base):
     """Wait an incremental amount of time after each attempt.
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +37/-0 | 41 | 2,898 | $0.082 |
| claude | hush | pass | +26/-0 | 0 | 1,392 | $0.081 |
| claude | sloth | pass | +38/-0 | 19 | 3,360 | $0.127 |
| claude | all | pass | +27/-0 | 17 | 1,629 | $0.083 |
| codex | base | pass | +34/-0 | 43 | 1,913 | - |
| codex | muffle | pass | +45/-0 | 50 | 2,063 | - |
| codex | hush | pass | +40/-0 | 37 | 1,540 | - |
| codex | sloth | pass | +21/-0 | 45 | 2,687 | - |
| codex | all | pass | +19/-0 | 52 | 1,623 | - |

### claude, base: pass

Files: [doc/source/index.rst](../base/claude/python-feat-tenacity-wait-exception-1/files/doc/source/index.rst), [releasenotes/notes/add-wait-exception-3f1c9a7d2b5e4a60.yaml](../base/claude/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/add-wait-exception-3f1c9a7d2b5e4a60.yaml), [tenacity/__init__.py](../base/claude/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../base/claude/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../base/claude/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/doc/source/index.rst b/doc/source/index.rst
index 928ddd9..8f1b497 100644
--- a/doc/source/index.rst
+++ b/doc/source/index.rst
@@ -198,6 +198,16 @@ increasing jitter helps minimise collisions.
         raise Exception
 
 
+To choose the wait time from the exception raised by the last attempt, use
+`wait_exception`, which passes that exception to a function returning the
+number of seconds to wait.
+
+.. testcode::
+
+    @retry(wait=wait_exception(lambda e: 5.0 if isinstance(e, TimeoutError) else 60.0))
+    def wait_depends_on_exception():
+        raise Exception
+
 Sometimes it's necessary to build a chain of backoffs.
 
 .. testcode::
diff --git a/releasenotes/notes/add-wait-exception-3f1c9a7d2b5e4a60.yaml b/releasenotes/notes/add-wait-exception-3f1c9a7d2b5e4a60.yaml
new file mode 100644
index 0000000..b542733
--- /dev/null
+++ b/releasenotes/notes/add-wait-exception-3f1c9a7d2b5e4a60.yaml
@@ -0,0 +1,6 @@
+---
+features:
+  - |
+    Add ``wait_exception``, a wait strategy that waits for the number of
+    seconds returned by a function called with the exception raised by the
+    last attempt.
diff --git a/tenacity/__init__.py b/tenacity/__init__.py
index e93793c..b0b4794 100644
--- a/tenacity/__init__.py
+++ b/tenacity/__init__.py
@@ -59,6 +59,7 @@ from .stop import stop_when_event_set  # noqa
 # Import all built-in wait strategies for easier usage.
 from .wait import wait_chain  # noqa
 from .wait import wait_combine  # noqa
+from .wait import wait_exception  # noqa
 from .wait import wait_exponential  # noqa
 from .wait import wait_fixed  # noqa
 from .wait import wait_incrementing  # noqa
@@ -686,6 +687,7 @@ __all__ = [
     "stop_when_event_set",
     "wait_chain",
     "wait_combine",
+    "wait_exception",
     "wait_exponential",
     "wait_fixed",
     "wait_incrementing",
diff --git a/tenacity/wait.py b/tenacity/wait.py
index dc3c850..5ebb100 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -232,3 +232,22 @@ class wait_exponential_jitter(wait_base):
         except OverflowError:
             result = self.max
         return max(0, min(result, self.max))
+
+
+class wait_exception(wait_base):
+    """Wait strategy that waits the amount of time returned by a predicate.
+
+    The predicate is called with the exception raised by the last attempt and
+    must return the number of seconds to wait.
+    """
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        if retry_state.outcome is None:
+            raise RuntimeError("__call__() called before outcome was set")
+        exception = retry_state.outcome.exception()
+        if exception is None:
+            raise RuntimeError("outcome failed but the exception is None")
+        return self.predicate(exception)
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..ca8b321 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -1795,3 +1795,44 @@ class TestMockingSleep:
 
 if __name__ == "__main__":
     unittest.main()
+
+
+class TestWaitException(unittest.TestCase):
+    def test_wait_exception(self):
+        def predicate(exc):
+            return 7.5 if isinstance(exc, ValueError) else 60.0
+
+        r = Retrying(wait=tenacity.wait_exception(predicate))
+        for exc, expected in ((ValueError(), 7.5), (KeyError(), 60.0)):
+            fut = tenacity.Future(1)
+            fut.set_exception(exc)
+            rs = RetryCallState(r, None, (), {})
+            rs.outcome = fut
+            self.assertEqual(expected, r.wait(rs))
+
+    def test_wait_exception_no_exception(self):
+        r = Retrying(wait=tenacity.wait_exception(lambda e: 1.0))
+        fut = tenacity.Future(1)
+        fut.set_result(None)
+        rs = RetryCallState(r, None, (), {})
+        rs.outcome = fut
+        with self.assertRaises(RuntimeError):
+            r.wait(rs)
+
+    def test_wait_exception_in_retry(self):
+        seen = []
+        sleeps = []
+
+        @retry(
+            stop=tenacity.stop_after_attempt(3),
+            wait=tenacity.wait_exception(lambda e: seen.append(e) or 2.0),
+            sleep=sleeps.append,
+            reraise=True,
+        )
+        def f():
+            raise ValueError("x")
+
+        with self.assertRaises(ValueError):
+            f()
+        self.assertEqual([2.0, 2.0], sleeps)
+        self.assertTrue(all(isinstance(e, ValueError) for e in seen))
```

</details>

<details><summary>reply</summary>

Fixing my test: tenacity computes the wait on the final attempt too, so the predicate runs 3 times, not 2.

I added `wait_exception(predicate)` and exported it from `tenacity` next to the other `wait_*` strategies. The test suite passes (122 passed, 1 skipped), but I had to leave out `tests/test_tornado.py` because `tornado` isn't installed here. Nothing is committed.

- **Behaviour:** it calls `predicate` with the exception from the last attempt and waits exactly the number of seconds it returns. It works anywhere a wait strategy does, including `Retrying(wait=wait_exception(predicate))` and combined with `+`.
- **No exception:** if the last attempt didn't fail with an exception, for example a result that `retry_if_result` rejected, it raises `RuntimeError`.
- **Final attempt:** tenacity computes the wait after the last attempt too, so with `stop_after_attempt(3)` your predicate runs 3 times, not 2. The third wait is never slept, but the predicate still runs, so keep it free of side effects.
- **Tests and docs:** I added three tests (exception-dependent waits, the `RuntimeError` case, and a full `@retry` run). I also added a short example in `doc/source/index.rst` and a release note under `releasenotes/notes/`.

The strategy itself is in `tenacity/wait.py`.

</details>

### claude, hush: pass

Files: [releasenotes/notes/add-wait-exception-7c1d2e9a4b3f5a60.yaml](../hush/claude/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/add-wait-exception-7c1d2e9a4b3f5a60.yaml), [tenacity/__init__.py](../hush/claude/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../hush/claude/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py)

<details><summary>diff</summary>

```diff
diff --git a/releasenotes/notes/add-wait-exception-7c1d2e9a4b3f5a60.yaml b/releasenotes/notes/add-wait-exception-7c1d2e9a4b3f5a60.yaml
new file mode 100644
index 0000000..25a75b2
--- /dev/null
+++ b/releasenotes/notes/add-wait-exception-7c1d2e9a4b3f5a60.yaml
@@ -0,0 +1,5 @@
+---
+features:
+  - |
+    Add ``wait_exception``, a wait strategy that waits the number of seconds
+    returned by a function called with the exception raised by the last attempt.
diff --git a/tenacity/__init__.py b/tenacity/__init__.py
index e93793c..b0b4794 100644
--- a/tenacity/__init__.py
+++ b/tenacity/__init__.py
@@ -59,6 +59,7 @@ from .stop import stop_when_event_set  # noqa
 # Import all built-in wait strategies for easier usage.
 from .wait import wait_chain  # noqa
 from .wait import wait_combine  # noqa
+from .wait import wait_exception  # noqa
 from .wait import wait_exponential  # noqa
 from .wait import wait_fixed  # noqa
 from .wait import wait_incrementing  # noqa
@@ -686,6 +687,7 @@ __all__ = [
     "stop_when_event_set",
     "wait_chain",
     "wait_combine",
+    "wait_exception",
     "wait_exponential",
     "wait_fixed",
     "wait_incrementing",
diff --git a/tenacity/wait.py b/tenacity/wait.py
index dc3c850..643dc05 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -232,3 +232,22 @@ class wait_exponential_jitter(wait_base):
         except OverflowError:
             result = self.max
         return max(0, min(result, self.max))
+
+
+class wait_exception(wait_base):
+    """Wait strategy that waits the amount of time returned by the predicate.
+
+    The predicate is passed the exception raised by the last attempt and
+    returns the number of seconds to wait.
+    """
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        if retry_state.outcome is None:
+            raise RuntimeError("__call__() called before outcome was set")
+        exception = retry_state.outcome.exception()
+        if exception is None:
+            raise RuntimeError("last attempt did not raise an exception")
+        return self.predicate(exception)
```

</details>

<details><summary>reply</summary>

Done. Added `wait_exception` in `tenacity/wait.py`, exported from `tenacity`, plus a release note. A quick manual check passed: it retries on an exception and raises `RuntimeError` after a rejected result. I didn't add tests or docs.

</details>

### claude, sloth: pass

Files: [doc/source/index.rst](../sloth/claude/python-feat-tenacity-wait-exception-1/files/doc/source/index.rst), [releasenotes/notes/add-wait-exception-3f1c9a7d5b2e4c60.yaml](../sloth/claude/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/add-wait-exception-3f1c9a7d5b2e4c60.yaml), [tenacity/__init__.py](../sloth/claude/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../sloth/claude/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../sloth/claude/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/doc/source/index.rst b/doc/source/index.rst
index 928ddd9..0407d16 100644
--- a/doc/source/index.rst
+++ b/doc/source/index.rst
@@ -198,6 +198,20 @@ increasing jitter helps minimise collisions.
         raise Exception
 
 
+The wait can also depend on the exception raised by the last attempt.
+
+.. testcode::
+
+    def http_error(exception):
+        if isinstance(exception, requests.HTTPError) and exception.response.status_code == 429:
+            return float(exception.response.headers.get("Retry-After", "1"))
+        return 60.0
+
+    @retry(wait=wait_exception(http_error))
+    def wait_for_retry_after():
+        raise Exception
+
+
 Sometimes it's necessary to build a chain of backoffs.
 
 .. testcode::
diff --git a/releasenotes/notes/add-wait-exception-3f1c9a7d5b2e4c60.yaml b/releasenotes/notes/add-wait-exception-3f1c9a7d5b2e4c60.yaml
new file mode 100644
index 0000000..a803fbf
--- /dev/null
+++ b/releasenotes/notes/add-wait-exception-3f1c9a7d5b2e4c60.yaml
@@ -0,0 +1,6 @@
+---
+features:
+  - |
+    Added ``wait_exception``, a wait strategy that waits for the number of
+    seconds returned by a function called with the exception raised by the
+    last attempt. It raises ``RuntimeError`` if the last attempt did not raise.
diff --git a/tenacity/__init__.py b/tenacity/__init__.py
index e93793c..b0b4794 100644
--- a/tenacity/__init__.py
+++ b/tenacity/__init__.py
@@ -59,6 +59,7 @@ from .stop import stop_when_event_set  # noqa
 # Import all built-in wait strategies for easier usage.
 from .wait import wait_chain  # noqa
 from .wait import wait_combine  # noqa
+from .wait import wait_exception  # noqa
 from .wait import wait_exponential  # noqa
 from .wait import wait_fixed  # noqa
 from .wait import wait_incrementing  # noqa
@@ -686,6 +687,7 @@ __all__ = [
     "stop_when_event_set",
     "wait_chain",
     "wait_combine",
+    "wait_exception",
     "wait_exponential",
     "wait_fixed",
     "wait_incrementing",
diff --git a/tenacity/wait.py b/tenacity/wait.py
index dc3c850..a863405 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -232,3 +232,19 @@ class wait_exponential_jitter(wait_base):
         except OverflowError:
             result = self.max
         return max(0, min(result, self.max))
+
+
+class wait_exception(wait_base):
+    """Wait strategy that waits the time returned by a function of the last exception."""
+
+    def __init__(
+        self, predicate: typing.Callable[[BaseException], _utils.time_unit_type]
+    ) -> None:
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        if retry_state.outcome is None or not retry_state.outcome.failed:
+            raise RuntimeError("wait_exception requires the last attempt to have raised")
+        exception = retry_state.outcome.exception()
+        assert exception is not None
+        return _utils.to_seconds(self.predicate(exception))
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..5cd9b3e 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -369,6 +369,25 @@ class TestWaitConditions(unittest.TestCase):
             self.assertLess(w, 8)
             self.assertGreaterEqual(w, 5)
 
+    def test_wait_exception(self):
+        def failed(exc):
+            fut = tenacity.Future(1)
+            fut.set_exception(exc)
+            return fut
+
+        r = Retrying(
+            wait=tenacity.wait_exception(
+                lambda e: 5.0 if isinstance(e, ValueError) else 60.0
+            )
+        )
+        self.assertEqual(5.0, r.wait(make_retry_state(1, 0, failed(ValueError()))))
+        self.assertEqual(60.0, r.wait(make_retry_state(1, 0, failed(KeyError()))))
+
+    def test_wait_exception_without_exception(self):
+        r = Retrying(wait=tenacity.wait_exception(lambda e: 1.0))
+        with self.assertRaises(RuntimeError):
+            r.wait(make_retry_state(1, 0))
+
     def test_wait_double_sum(self):
         r = Retrying(wait=tenacity.wait_random(0, 3) + tenacity.wait_fixed(5))
         # Test it a few time since it's random
```

</details>

<details><summary>reply</summary>

Adding the tests and a docs/release note next, then running the suite.

I added `wait_exception(predicate)` to `tenacity/wait.py` and exported it from `tenacity` next to the other `wait_*` strategies. The full test suite passes (125 passed, 1 skipped). I did not run your `requests` example against a live server.

- **Behaviour:** it calls `predicate(exception)` with the exception from the last attempt and waits exactly the number of seconds returned. It works anywhere a wait strategy does, including `Retrying(wait=...)`. It also accepts a `timedelta` return value, because it converts the result with tenacity's existing `to_seconds`.
- **No exception:** if the last attempt returned a value (for example one that `retry_if_result` rejected), it raises `RuntimeError`.
- **Tests:** I added two to `tests/test_tenacity.py`, one picking the wait by exception type and one for the `RuntimeError` case.
- **Docs:** I added a short example based on your `http_error` function to the wait section of `README.rst`. `doc/source/index.rst` carries the same edit, so I didn't edit it separately. I also added a release note, `releasenotes/notes/add-wait-exception-3f1c9a7d5b2e4c60.yaml`.

Nothing is committed.

</details>

### claude, all: pass

Files: [releasenotes/notes/wait-exception-3c1f7a9d5b2e4a60.yaml](../all/claude/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/wait-exception-3c1f7a9d5b2e4a60.yaml), [tenacity/__init__.py](../all/claude/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../all/claude/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../all/claude/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/releasenotes/notes/wait-exception-3c1f7a9d5b2e4a60.yaml b/releasenotes/notes/wait-exception-3c1f7a9d5b2e4a60.yaml
new file mode 100644
index 0000000..4c480da
--- /dev/null
+++ b/releasenotes/notes/wait-exception-3c1f7a9d5b2e4a60.yaml
@@ -0,0 +1,5 @@
+---
+features:
+  - |
+    Add ``wait_exception``, a wait strategy that waits for the number of
+    seconds returned by a function passed the last attempt's exception.
diff --git a/tenacity/__init__.py b/tenacity/__init__.py
index e93793c..51a1945 100644
--- a/tenacity/__init__.py
+++ b/tenacity/__init__.py
@@ -58,6 +58,7 @@ from .stop import stop_when_event_set  # noqa
 
 # Import all built-in wait strategies for easier usage.
 from .wait import wait_chain  # noqa
+from .wait import wait_exception  # noqa
 from .wait import wait_combine  # noqa
 from .wait import wait_exponential  # noqa
 from .wait import wait_fixed  # noqa
@@ -685,6 +686,7 @@ __all__ = [
     "stop_never",
     "stop_when_event_set",
     "wait_chain",
+    "wait_exception",
     "wait_combine",
     "wait_exponential",
     "wait_fixed",
diff --git a/tenacity/wait.py b/tenacity/wait.py
index dc3c850..9e73b8b 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -232,3 +232,23 @@ class wait_exponential_jitter(wait_base):
         except OverflowError:
             result = self.max
         return max(0, min(result, self.max))
+
+
+class wait_exception(wait_base):
+    """Wait strategy that waits for the time returned by a function.
+
+    The function is passed the exception raised by the last attempt and
+    returns the number of seconds to wait. Raises RuntimeError if the last
+    attempt did not raise an exception.
+    """
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        if retry_state.outcome is None:
+            raise RuntimeError("outcome is not set")
+        exception = retry_state.outcome.exception()
+        if exception is None:
+            raise RuntimeError("wait_exception requires the last attempt to raise")
+        return self.predicate(exception)
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..66329ae 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -224,6 +224,23 @@ class TestWaitConditions(unittest.TestCase):
                 r = Retrying(wait=tenacity.wait_fixed(wait))
                 self.assertEqual(1, r.wait(make_retry_state(12, 6546)))
 
+    def test_wait_exception(self):
+        def predicate(exc):
+            return 5 if isinstance(exc, ValueError) else 60
+
+        r = Retrying(wait=tenacity.wait_exception(predicate))
+        for exc, expected in ((ValueError(), 5), (KeyError(), 60)):
+            fut = tenacity.Future(1)
+            fut.set_exception(exc)
+            self.assertEqual(
+                expected, r.wait(make_retry_state(1, 0, last_result=fut))
+            )
+
+    def test_wait_exception_without_exception(self):
+        r = Retrying(wait=tenacity.wait_exception(lambda e: 1))
+        with self.assertRaises(RuntimeError):
+            r.wait(make_retry_state(1, 0))
+
     def test_incrementing_sleep(self):
         for start, increment in (
             (500, 100),
```

</details>

<details><summary>reply</summary>

Done. Added `wait_exception` in `tenacity/wait.py`, exported from `tenacity`, with tests and a release note. It raises `RuntimeError` when the last attempt has no exception. The existing test file passes (96 tests); I didn't run the `requests` example.

</details>

### codex, base: pass

Files: [doc/source/index.rst](../base/codex/python-feat-tenacity-wait-exception-1/files/doc/source/index.rst), [releasenotes/notes/wait-exception-1cd859ea098a421c.yaml](../base/codex/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/wait-exception-1cd859ea098a421c.yaml), [tenacity/__init__.py](../base/codex/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../base/codex/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../base/codex/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/doc/source/index.rst b/doc/source/index.rst
index 928ddd9..bf5b953 100644
--- a/doc/source/index.rst
+++ b/doc/source/index.rst
@@ -209,6 +209,17 @@ Sometimes it's necessary to build a chain of backoffs.
         print("Wait 3s for 3 attempts, 7s for the next 2 attempts and 9s for all attempts thereafter")
         raise Exception
 
+To choose a delay from the exception raised by the last attempt, use
+``wait_exception``. Its callback receives the exception and returns the wait
+time in seconds. It raises ``RuntimeError`` if the last attempt has no exception,
+including when retrying a rejected result.
+
+.. testcode::
+
+    @retry(wait=wait_exception(lambda exc: 1.0 if isinstance(exc, TimeoutError) else 60.0))
+    def wait_for_exception():
+        raise TimeoutError
+
 Whether to retry
 ~~~~~~~~~~~~~~~~
 
diff --git a/releasenotes/notes/wait-exception-1cd859ea098a421c.yaml b/releasenotes/notes/wait-exception-1cd859ea098a421c.yaml
new file mode 100644
index 0000000..4d166f2
--- /dev/null
+++ b/releasenotes/notes/wait-exception-1cd859ea098a421c.yaml
@@ -0,0 +1,2 @@
+features:
+  - Add wait_exception to compute the wait time from the last attempt's exception.
diff --git a/tenacity/__init__.py b/tenacity/__init__.py
index e93793c..8e7f0be 100644
--- a/tenacity/__init__.py
+++ b/tenacity/__init__.py
@@ -60,6 +60,7 @@ from .stop import stop_when_event_set  # noqa
 from .wait import wait_chain  # noqa
 from .wait import wait_combine  # noqa
 from .wait import wait_exponential  # noqa
+from .wait import wait_exception  # noqa
 from .wait import wait_fixed  # noqa
 from .wait import wait_incrementing  # noqa
 from .wait import wait_none  # noqa
@@ -687,6 +688,7 @@ __all__ = [
     "wait_chain",
     "wait_combine",
     "wait_exponential",
+    "wait_exception",
     "wait_fixed",
     "wait_incrementing",
     "wait_none",
diff --git a/tenacity/wait.py b/tenacity/wait.py
index dc3c850..6d0adf8 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -56,6 +56,25 @@ class wait_fixed(wait_base):
         return self.wait_fixed
 
 
+class wait_exception(wait_base):
+    """Wait for the seconds returned by a predicate given the last exception.
+
+    Raises RuntimeError if the last attempt did not raise an exception.
+    """
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        if retry_state.outcome is None or not retry_state.outcome.failed:
+            raise RuntimeError(
+                "wait_exception requires an exception from the last attempt"
+            )
+        exception = retry_state.outcome.exception()
+        assert exception is not None
+        return self.predicate(exception)
+
+
 class wait_none(wait_fixed):
     """Wait strategy that doesn't wait at all before retrying."""
 
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..79104ce 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -214,6 +214,49 @@ class TestStopConditions(unittest.TestCase):
 
 
 class TestWaitConditions(unittest.TestCase):
+    def test_exception_sleep(self):
+        exceptions = [ValueError("rate limited"), TypeError("other error")]
+        predicate = mock.Mock(side_effect=[1.25, 60.0])
+        sleep = mock.Mock()
+        attempts = mock.Mock(side_effect=exceptions + ["success"])
+        r = Retrying(wait=tenacity.wait_exception(predicate), sleep=sleep)
+
+        self.assertEqual(r(attempts), "success")
+        self.assertEqual(predicate.call_args_list, [mock.call(e) for e in exceptions])
+        self.assertEqual(sleep.call_args_list, [mock.call(1.25), mock.call(60.0)])
+
+    def test_exception_sleep_without_exception(self):
+        predicate = mock.Mock()
+        wait = tenacity.wait_exception(predicate)
+        state = RetryCallState(Retrying(), None, (), {})
+        with self.assertRaises(RuntimeError):
+            wait(state)
+        state.set_result(None)
+        with self.assertRaises(RuntimeError):
+            wait(state)
+        r = Retrying(wait=wait, retry=tenacity.retry_if_result(lambda result: True))
+        with self.assertRaises(RuntimeError):
+            r(lambda: None)
+        predicate.assert_not_called()
+
+    def test_exception_sleep_combine(self):
+        exception = BaseException("failure")
+        predicate = mock.Mock(return_value=2.5)
+        state = RetryCallState(Retrying(), None, (), {})
+        state.set_exception((type(exception), exception, None))
+        wait = tenacity.wait_exception(predicate) + tenacity.wait_fixed(3)
+        self.assertEqual(wait(retry_state=state), 5.5)
+        predicate.assert_called_once_with(exception)
+
+    def test_exception_sleep_predicate_error(self):
+        error = ValueError("invalid delay")
+        predicate = mock.Mock(side_effect=error)
+        state = RetryCallState(Retrying(), None, (), {})
+        state.set_exception((TypeError, TypeError(), None))
+        with self.assertRaises(ValueError) as raised:
+            tenacity.wait_exception(predicate)(state)
+        self.assertIs(raised.exception, error)
+
     def test_no_sleep(self):
         r = Retrying()
         self.assertEqual(0, r.wait(make_retry_state(18, 9879)))
```

</details>

<details><summary>reply</summary>

I’ll check how the existing wait strategies are implemented, add `wait_exception`, and test its callback and error behavior.

The strategy is implemented, and all 98 tests in `test_tenacity.py` pass, including the new cases. The full suite cannot collect because Tornado is missing; I’ll run the remaining tests. Ruff is also unavailable.

Added `tenacity.wait_exception(predicate)` with public export, documentation, and tests.

It passes the last exception to the callback and returns its delay unchanged. It raises `RuntimeError` when no exception is available and supports wait-strategy composition.

Validation: 123 passed, 1 skipped with Tornado tests excluded. Full collection requires Tornado; Ruff was unavailable.

</details>

### codex, muffle: pass

Files: [doc/source/index.rst](../muffle/codex/python-feat-tenacity-wait-exception-1/files/doc/source/index.rst), [releasenotes/notes/wait-exception.yaml](../muffle/codex/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/wait-exception.yaml), [tenacity/__init__.py](../muffle/codex/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../muffle/codex/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../muffle/codex/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/doc/source/index.rst b/doc/source/index.rst
index 928ddd9..25573a4 100644
--- a/doc/source/index.rst
+++ b/doc/source/index.rst
@@ -156,6 +156,22 @@ seconds between retries.
         print("Wait 2 second between retries")
         raise Exception
 
+A wait can also depend on the exception raised by the last attempt. The
+function passed to ``wait_exception`` receives that exception and returns the
+number of seconds to wait.
+
+.. testcode::
+
+    def exception_delay(exception):
+        return 1.0 if isinstance(exception, TimeoutError) else 60.0
+
+    @retry(wait=wait_exception(exception_delay))
+    def wait_for_exception():
+        raise TimeoutError
+
+``wait_exception`` raises ``RuntimeError`` if the last attempt has no exception,
+including when retrying a rejected result with ``retry_if_result``.
+
 Some things perform best with a bit of randomness injected.
 
 .. testcode::
diff --git a/releasenotes/notes/wait-exception.yaml b/releasenotes/notes/wait-exception.yaml
new file mode 100644
index 0000000..b46ba21
--- /dev/null
+++ b/releasenotes/notes/wait-exception.yaml
@@ -0,0 +1,3 @@
+features:
+  - Add ``wait_exception`` to compute a wait duration from the exception raised
+    by the last attempt.
diff --git a/tenacity/__init__.py b/tenacity/__init__.py
index e93793c..b0b4794 100644
--- a/tenacity/__init__.py
+++ b/tenacity/__init__.py
@@ -59,6 +59,7 @@ from .stop import stop_when_event_set  # noqa
 # Import all built-in wait strategies for easier usage.
 from .wait import wait_chain  # noqa
 from .wait import wait_combine  # noqa
+from .wait import wait_exception  # noqa
 from .wait import wait_exponential  # noqa
 from .wait import wait_fixed  # noqa
 from .wait import wait_incrementing  # noqa
@@ -686,6 +687,7 @@ __all__ = [
     "stop_when_event_set",
     "wait_chain",
     "wait_combine",
+    "wait_exception",
     "wait_exponential",
     "wait_fixed",
     "wait_incrementing",
diff --git a/tenacity/wait.py b/tenacity/wait.py
index dc3c850..82be947 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -56,6 +56,30 @@ class wait_fixed(wait_base):
         return self.wait_fixed
 
 
+class wait_exception(wait_base):
+    """Wait for the number of seconds returned by a function of the exception.
+
+    The predicate receives the exception raised by the last attempt. Raise
+    RuntimeError if the last attempt has no exception (including result retries).
+    """
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        outcome = retry_state.outcome
+        if outcome is None or not outcome.failed:
+            raise RuntimeError(
+                "wait_exception requires an exception from the last attempt"
+            )
+        exception = outcome.exception()
+        if exception is None:
+            raise RuntimeError(
+                "wait_exception requires an exception from the last attempt"
+            )
+        return self.predicate(exception)
+
+
 class wait_none(wait_fixed):
     """Wait strategy that doesn't wait at all before retrying."""
 
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..997d855 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -224,6 +224,56 @@ class TestWaitConditions(unittest.TestCase):
                 r = Retrying(wait=tenacity.wait_fixed(wait))
                 self.assertEqual(1, r.wait(make_retry_state(12, 6546)))
 
+    def test_exception_sleep(self):
+        for exception in (ValueError("bad value"), BaseException("base error")):
+            with self.subTest(exception=exception):
+                state = make_retry_state(1, 0)
+                state.set_exception((type(exception), exception, None))
+                predicate = mock.Mock(return_value=2.75)
+                wait = tenacity.wait_exception(predicate)
+                self.assertEqual(wait(retry_state=state), 2.75)
+                self.assertEqual((wait + tenacity.wait_fixed(3))(state), 5.75)
+                predicate.assert_called_with(exception)
+
+    def test_exception_sleep_without_exception(self):
+        predicate = mock.Mock()
+        wait = tenacity.wait_exception(predicate)
+        for state in (RetryCallState(None, None, (), {}), make_retry_state(1, 0)):
+            with self.subTest(state=state):
+                with self.assertRaisesRegex(RuntimeError, "requires an exception"):
+                    wait(state)
+        predicate.assert_not_called()
+
+    def test_exception_sleep_retrying(self):
+        first = ValueError("first")
+        second = TypeError("second")
+        operation = mock.Mock(side_effect=[first, second, "success"])
+        predicate = mock.Mock(side_effect=[1.25, 60.0])
+        sleep = mock.Mock()
+        retrying = Retrying(
+            wait=tenacity.wait_exception(predicate),
+            stop=tenacity.stop_after_attempt(3),
+            sleep=sleep,
+        )
+        self.assertEqual(retrying(operation), "success")
+        self.assertEqual(predicate.call_args_list, [mock.call(first), mock.call(second)])
+        self.assertEqual(sleep.call_args_list, [mock.call(1.25), mock.call(60.0)])
+
+    def test_exception_sleep_result_retry(self):
+        predicate = mock.Mock()
+
+        @retry(
+            wait=tenacity.wait_exception(predicate),
+            retry=tenacity.retry_if_result(lambda result: result is None),
+            stop=tenacity.stop_after_attempt(3),
+        )
+        def operation():
+            return None
+
+        with self.assertRaisesRegex(RuntimeError, "requires an exception"):
+            operation()
+        predicate.assert_not_called()
+
     def test_incrementing_sleep(self):
         for start, increment in (
             (500, 100),
```

</details>

<details><summary>reply</summary>

I’ll check the existing wait strategies, add `wait_exception` and its export, then test exception-based waits and result-based retries.

The strategy, export, and documentation are in place. Tests cover passing the original exception, exact sleep durations, composition, and `RuntimeError` for result retries. The full suite hit a missing Tornado dependency; I’ll run the remaining tests and formatting checks.

Added `tenacity.wait_exception(predicate)` with documentation and tests. It passes the last exception to the callback, returns its wait duration unchanged, and raises `RuntimeError` when no exception exists. It also supports wait composition.

Validation: 123 tests passed, 1 skipped. Tornado tests could not run because Tornado is missing; Ruff is also unavailable.

</details>

### codex, hush: pass

Files: [doc/source/index.rst](../hush/codex/python-feat-tenacity-wait-exception-1/files/doc/source/index.rst), [releasenotes/notes/wait-exception-76968fea35d90af2.yaml](../hush/codex/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/wait-exception-76968fea35d90af2.yaml), [tenacity/__init__.py](../hush/codex/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../hush/codex/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../hush/codex/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/doc/source/index.rst b/doc/source/index.rst
index 928ddd9..bc30324 100644
--- a/doc/source/index.rst
+++ b/doc/source/index.rst
@@ -156,6 +156,19 @@ seconds between retries.
         print("Wait 2 second between retries")
         raise Exception
 
+Use ``wait_exception(predicate)`` to choose the delay from the last exception.
+The function receives the exception object and returns the wait in seconds::
+
+    def exception_delay(exception: BaseException) -> float:
+        return 1.0 if isinstance(exception, TimeoutError) else 60.0
+
+    @retry(wait=wait_exception(exception_delay))
+    def fetch_resource():
+        raise TimeoutError()
+
+This strategy raises ``RuntimeError`` if there is no exception from the last
+attempt, including when a result is rejected by ``retry_if_result``.
+
 Some things perform best with a bit of randomness injected.
 
 .. testcode::
diff --git a/releasenotes/notes/wait-exception-76968fea35d90af2.yaml b/releasenotes/notes/wait-exception-76968fea35d90af2.yaml
new file mode 100644
index 0000000..b70ec0f
--- /dev/null
+++ b/releasenotes/notes/wait-exception-76968fea35d90af2.yaml
@@ -0,0 +1,4 @@
+features:
+  - Add ``wait_exception`` to calculate the wait in seconds from the exception
+    raised by the last attempt. It raises ``RuntimeError`` when no exception
+    is available.
diff --git a/tenacity/__init__.py b/tenacity/__init__.py
index e93793c..8e7f0be 100644
--- a/tenacity/__init__.py
+++ b/tenacity/__init__.py
@@ -60,6 +60,7 @@ from .stop import stop_when_event_set  # noqa
 from .wait import wait_chain  # noqa
 from .wait import wait_combine  # noqa
 from .wait import wait_exponential  # noqa
+from .wait import wait_exception  # noqa
 from .wait import wait_fixed  # noqa
 from .wait import wait_incrementing  # noqa
 from .wait import wait_none  # noqa
@@ -687,6 +688,7 @@ __all__ = [
     "wait_chain",
     "wait_combine",
     "wait_exponential",
+    "wait_exception",
     "wait_fixed",
     "wait_incrementing",
     "wait_none",
diff --git a/tenacity/wait.py b/tenacity/wait.py
index dc3c850..464fcfd 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -56,6 +56,27 @@ class wait_fixed(wait_base):
         return self.wait_fixed
 
 
+class wait_exception(wait_base):
+    """Wait for the seconds returned by a function of the last exception.
+
+    Raise RuntimeError if the last attempt did not raise an exception.
+    """
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        outcome = retry_state.outcome
+        if outcome is None or not outcome.failed:
+            raise RuntimeError(
+                "wait_exception requires an exception from the last attempt"
+            )
+        exception = outcome.exception()
+        if exception is None:
+            raise RuntimeError("outcome failed but the exception is None")
+        return self.predicate(exception)
+
+
 class wait_none(wait_fixed):
     """Wait strategy that doesn't wait at all before retrying."""
 
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..1394cee 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -214,6 +214,43 @@ class TestStopConditions(unittest.TestCase):
 
 
 class TestWaitConditions(unittest.TestCase):
+    def test_exception_sleep(self):
+        errors = [ValueError("rate limited"), OSError("unavailable")]
+        operation = mock.Mock(side_effect=[*errors, "ok"])
+        predicate = mock.Mock(side_effect=[1.5, 60.0])
+        sleep = mock.Mock()
+        r = Retrying(
+            wait=tenacity.wait_exception(predicate),
+            stop=tenacity.stop_after_attempt(3),
+            sleep=sleep,
+        )
+        self.assertEqual(r(operation), "ok")
+        self.assertEqual(predicate.call_args_list, [mock.call(e) for e in errors])
+        self.assertEqual(sleep.call_args_list, [mock.call(1.5), mock.call(60.0)])
+
+    def test_exception_sleep_without_exception(self):
+        predicate = mock.Mock()
+        strategy = tenacity.wait_exception(predicate)
+        state = RetryCallState(None, None, (), {})
+        with self.assertRaises(RuntimeError):
+            strategy(state)
+        state.set_result(None)
+        with self.assertRaises(RuntimeError):
+            strategy(state)
+        r = Retrying(wait=strategy, retry=tenacity.retry_if_result(lambda _: True))
+        with self.assertRaises(RuntimeError):
+            r(lambda: None)
+        predicate.assert_not_called()
+
+    def test_exception_sleep_composition(self):
+        state = RetryCallState(None, None, (), {})
+        error = KeyboardInterrupt()
+        state.set_exception((type(error), error, None))
+        predicate = mock.Mock(return_value=2.5)
+        strategy = tenacity.wait_exception(predicate) + tenacity.wait_fixed(3)
+        self.assertEqual(strategy(retry_state=state), 5.5)
+        predicate.assert_called_once_with(error)
+
     def test_no_sleep(self):
         r = Retrying()
         self.assertEqual(0, r.wait(make_retry_state(18, 9879)))
```

</details>

<details><summary>reply</summary>

Done.
Added exported `wait_exception`, missing-exception errors, docs, tests. Tests: 126 passed, 1 skipped. Lint blocked by existing violations; docs build unchecked.

</details>

### codex, sloth: pass

Files: [tenacity/__init__.py](../sloth/codex/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../sloth/codex/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../sloth/codex/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/tenacity/__init__.py b/tenacity/__init__.py
index e93793c..b0b4794 100644
--- a/tenacity/__init__.py
+++ b/tenacity/__init__.py
@@ -59,6 +59,7 @@ from .stop import stop_when_event_set  # noqa
 # Import all built-in wait strategies for easier usage.
 from .wait import wait_chain  # noqa
 from .wait import wait_combine  # noqa
+from .wait import wait_exception  # noqa
 from .wait import wait_exponential  # noqa
 from .wait import wait_fixed  # noqa
 from .wait import wait_incrementing  # noqa
@@ -686,6 +687,7 @@ __all__ = [
     "stop_when_event_set",
     "wait_chain",
     "wait_combine",
+    "wait_exception",
     "wait_exponential",
     "wait_fixed",
     "wait_incrementing",
diff --git a/tenacity/wait.py b/tenacity/wait.py
index dc3c850..4b2ad14 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -56,6 +56,25 @@ class wait_fixed(wait_base):
         return self.wait_fixed
 
 
+class wait_exception(wait_base):
+    """Wait for the duration returned by a predicate given the last exception."""
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        """Set the function that determines the wait from an exception."""
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        """Return the wait duration, raising RuntimeError without an exception."""
+        if retry_state.outcome is None:
+            raise RuntimeError("__call__() called before outcome was set")
+        exception = retry_state.outcome.exception()
+        if exception is None:
+            raise RuntimeError(
+                "wait_exception requires an exception from the last attempt"
+            )
+        return self.predicate(exception)
+
+
 class wait_none(wait_fixed):
     """Wait strategy that doesn't wait at all before retrying."""
 
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..0042592 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -214,6 +214,51 @@ class TestStopConditions(unittest.TestCase):
 
 
 class TestWaitConditions(unittest.TestCase):
+    def test_exception_sleep(self):
+        """Use the current exception and its exact duration through both APIs."""
+        for decorate in (False, True):
+            with self.subTest(decorate=decorate):
+                exceptions = [ValueError("rate limited"), OSError("unavailable")]
+                predicate = mock.Mock(side_effect=[0.25, 60.0])
+                sleep = mock.Mock()
+                call = mock.Mock(side_effect=[*exceptions, "success"])
+                kwargs = {
+                    "wait": tenacity.wait_exception(predicate),
+                    "stop": tenacity.stop_after_attempt(3),
+                    "sleep": sleep,
+                }
+                if decorate:
+                    result = retry(**kwargs)(call)()
+                else:
+                    result = Retrying(**kwargs)(call)
+                self.assertEqual(result, "success")
+                self.assertEqual(
+                    predicate.call_args_list, list(map(mock.call, exceptions))
+                )
+                self.assertEqual(sleep.call_args_list, [mock.call(0.25), mock.call(60.0)])
+
+    def test_exception_sleep_without_exception(self):
+        """Reject missing outcomes and result based retries without calling the predicate."""
+        predicate = mock.Mock()
+        wait = tenacity.wait_exception(predicate)
+        with self.assertRaises(RuntimeError):
+            wait(RetryCallState(None, None, (), {}))
+        with self.assertRaises(RuntimeError):
+            Retrying(wait=wait, retry=tenacity.retry_if_result(lambda value: True))(
+                lambda: None
+            )
+        predicate.assert_not_called()
+
+    def test_exception_sleep_combine(self):
+        """Compose exception waits with existing wait strategies, including zero waits."""
+        state = make_retry_state(1, 0)
+        state.set_exception((ValueError, ValueError(), None))
+        for duration in (0.0, 0.25, 60.0):
+            with self.subTest(duration=duration):
+                wait = tenacity.wait_exception(mock.Mock(return_value=duration))
+                self.assertEqual(wait(state), duration)
+                self.assertEqual((wait + tenacity.wait_fixed(1))(state), duration + 1)
+
     def test_no_sleep(self):
         r = Retrying()
         self.assertEqual(0, r.wait(make_retry_state(18, 9879)))
```

</details>

<details><summary>reply</summary>

I’ll check how the existing wait strategies are implemented and tested, then add `wait_exception` and its public export.

The strategy and export are in place. The focused tests pass for decorator and `Retrying` usage, exact callback delays, composition, and `RuntimeError` when no exception is available. I’ll now run the full suite and build the package. The literal HTTP example can’t run here because `requests` isn’t installed.

Added and exported `tenacity.wait_exception(predicate)`. It passes the last exception to the callback, returns its exact delay, and raises `RuntimeError` when no exception exists.

Source build succeeded; tests: **126 passed, 1 skipped**.

Left out HTTP-specific handling; that belongs in the callback. The literal HTTP example wasn’t run because `requests` isn’t installed. Ruff reported existing repository lint issues.

</details>

### codex, all: pass

Files: [tenacity/__init__.py](../all/codex/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../all/codex/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../all/codex/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/tenacity/__init__.py b/tenacity/__init__.py
index e93793c..b0b4794 100644
--- a/tenacity/__init__.py
+++ b/tenacity/__init__.py
@@ -59,6 +59,7 @@ from .stop import stop_when_event_set  # noqa
 # Import all built-in wait strategies for easier usage.
 from .wait import wait_chain  # noqa
 from .wait import wait_combine  # noqa
+from .wait import wait_exception  # noqa
 from .wait import wait_exponential  # noqa
 from .wait import wait_fixed  # noqa
 from .wait import wait_incrementing  # noqa
@@ -686,6 +687,7 @@ __all__ = [
     "stop_when_event_set",
     "wait_chain",
     "wait_combine",
+    "wait_exception",
     "wait_exponential",
     "wait_fixed",
     "wait_incrementing",
diff --git a/tenacity/wait.py b/tenacity/wait.py
index dc3c850..7c329dd 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -56,6 +56,23 @@ class wait_fixed(wait_base):
         return self.wait_fixed
 
 
+class wait_exception(wait_base):
+    """Wait for the duration returned by a predicate given the last exception."""
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        """Set the function that determines the wait from an exception."""
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        """Return the wait time, raising RuntimeError if no exception exists."""
+        if retry_state.outcome is None:
+            raise RuntimeError("__call__() called before outcome was set")
+        exception = retry_state.outcome.exception()
+        if exception is None:
+            raise RuntimeError("wait_exception requires an exception from the last attempt")
+        return self.predicate(exception)
+
+
 class wait_none(wait_fixed):
     """Wait strategy that doesn't wait at all before retrying."""
 
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..1d7e4e0 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -213,6 +213,58 @@ class TestStopConditions(unittest.TestCase):
         self.assertTrue(r.stop(make_retry_state(101, 101)))
 
 
+class TestWaitException:
+    @pytest.mark.parametrize("decorated", [False, True])
+    def test_exception_wait(self, decorated):
+        """Use each failed attempt's exception and sleep for its exact duration."""
+        errors = [ValueError("429"), OSError("other")]
+        attempts = iter(errors + [None])
+        seen = []
+        sleeps = []
+
+        def predicate(exception):
+            """Choose a wait based on the exact exception received."""
+            seen.append(exception)
+            return 1.25 if exception is errors[0] else 60.0
+
+        def request():
+            """Fail twice, then succeed."""
+            exception = next(attempts)
+            if exception is not None:
+                raise exception
+            return "ok"
+
+        options = {
+            "wait": tenacity.wait_exception(predicate),
+            "stop": tenacity.stop_after_attempt(3),
+            "sleep": sleeps.append,
+        }
+        result = retry(**options)(request)() if decorated else Retrying(**options)(request)
+        assert result == "ok"
+        assert seen[0] is errors[0]
+        assert seen[1] is errors[1]
+        assert sleeps == [1.25, 60.0]
+
+    def test_result_retry(self):
+        """Reject a result retry without calling the predicate."""
+        predicate = mock.Mock()
+        retrying = Retrying(
+            wait=tenacity.wait_exception(predicate),
+            retry=tenacity.retry_if_result(lambda result: True),
+        )
+        with pytest.raises(RuntimeError):
+            retrying(lambda: None)
+        predicate.assert_not_called()
+
+    def test_missing_outcome(self):
+        """Reject a state with no completed attempt."""
+        predicate = mock.Mock()
+        state = tenacity.RetryCallState(Retrying(), None, (), {})
+        with pytest.raises(RuntimeError):
+            tenacity.wait_exception(predicate)(state)
+        predicate.assert_not_called()
+
+
 class TestWaitConditions(unittest.TestCase):
     def test_no_sleep(self):
         r = Retrying()
```

</details>

<details><summary>reply</summary>

I’ll check the wait strategies, exports, and tests, then add `wait_exception` and verify exception and result-retry behavior.


Done.
Added exported `wait_exception(predicate)` with RuntimeError for missing exceptions. Compilation passed; 127 tests passed, 1 skipped. Lint reports existing violations.

</details>
