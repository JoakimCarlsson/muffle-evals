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
| claude | base | pass | +38/-0 | 21 | 2,209 | $0.091 |
| claude | muffle | pass | +42/-0 | 23 | 2,247 | $0.077 |
| claude | hush | pass | +27/-0 | 21 | 1,561 | $0.069 |
| claude | sloth | pass | +21/-0 | 0 | 1,900 | $0.077 |
| claude | all | pass | +26/-0 | 0 | 2,122 | $0.086 |
| codex | base | pass | +41/-0 | 41 | 2,067 | - |
| codex | muffle | pass | +41/-0 | 41 | 1,910 | - |
| codex | hush | pass | +20/-0 | 37 | 1,399 | - |
| codex | sloth | pass | +22/-0 | 0 | 1,175 | - |
| codex | all | pass | +22/-0 | 0 | 1,110 | - |

### claude, base: pass

Files: [doc/source/index.rst](../base/claude/python-feat-tenacity-wait-exception-1/files/doc/source/index.rst), [releasenotes/notes/add-wait-exception-3f9a1c7e5b2d4a60.yaml](../base/claude/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/add-wait-exception-3f9a1c7e5b2d4a60.yaml), [tenacity/__init__.py](../base/claude/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../base/claude/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../base/claude/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/doc/source/index.rst b/doc/source/index.rst
index 928ddd9..f2da34c 100644
--- a/doc/source/index.rst
+++ b/doc/source/index.rst
@@ -198,6 +198,17 @@ increasing jitter helps minimise collisions.
         raise Exception
 
 
+The wait time can also depend on the exception raised by the last attempt.
+
+.. testcode::
+
+    def wait_for_error(exception):
+        return 5.0 if isinstance(exception, ConnectionError) else 60.0
+
+    @retry(wait=wait_exception(wait_for_error))
+    def wait_depending_on_exception():
+        raise ConnectionError
+
 Sometimes it's necessary to build a chain of backoffs.
 
 .. testcode::
diff --git a/releasenotes/notes/add-wait-exception-3f9a1c7e5b2d4a60.yaml b/releasenotes/notes/add-wait-exception-3f9a1c7e5b2d4a60.yaml
new file mode 100644
index 0000000..782f7a9
--- /dev/null
+++ b/releasenotes/notes/add-wait-exception-3f9a1c7e5b2d4a60.yaml
@@ -0,0 +1,6 @@
+---
+features:
+  - |
+    Add ``wait_exception``, a wait strategy that calls a function with the
+    exception raised by the last attempt and waits the returned number of
+    seconds. It raises ``RuntimeError`` if the last attempt did not raise.
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
index dc3c850..f03cf40 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -56,6 +56,25 @@ class wait_fixed(wait_base):
         return self.wait_fixed
 
 
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
+            raise RuntimeError("outcome failed but the exception is None")
+        return self.predicate(exception)
+
+
 class wait_none(wait_fixed):
     """Wait strategy that doesn't wait at all before retrying."""
 
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..e9b90ff 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -1795,3 +1795,24 @@ class TestMockingSleep:
 
 if __name__ == "__main__":
     unittest.main()
+
+
+class TestWaitException(unittest.TestCase):
+    def test_wait_exception(self):
+        calls = []
+
+        def predicate(exc):
+            calls.append(exc)
+            return 3.5 if isinstance(exc, ValueError) else 60.0
+
+        r = Retrying(wait=tenacity.wait_exception(predicate))
+        for exc, expected in ((ValueError(), 3.5), (KeyError(), 60.0)):
+            rs = make_retry_state(1, 0, last_result=tenacity.Future.construct(1, exc, True))
+            self.assertEqual(expected, r.wait(rs))
+            self.assertIs(exc, calls[-1])
+
+    def test_wait_exception_no_exception(self):
+        r = Retrying(wait=tenacity.wait_exception(lambda e: 1.0))
+        rs = make_retry_state(1, 0, last_result=tenacity.Future.construct(1, "x", False))
+        with self.assertRaises(RuntimeError):
+            r.wait(rs)
```

</details>

<details><summary>reply</summary>

I added `wait_exception(predicate)` and exported it from `tenacity` alongside the other `wait_*` strategies. The test suite passes (121 passed, 1 skipped). I had to skip `tests/test_tornado.py` because `tornado` isn't installed here.

- **Behaviour:** it calls your function with the exception from the last attempt and waits exactly the number of seconds it returns. It works anywhere a wait strategy does, such as `Retrying(wait=wait_exception(predicate))`.
- **No exception:** if the last attempt returned a value, for example one that `retry_if_result` rejected, it raises `RuntimeError`.
- **Tests:** I added two to `tests/test_tenacity.py`, one for the wait value and the exception passed to your function, and one for the `RuntimeError` case.
- **Docs and release note:** I added a short example to `doc/source/index.rst` and a release note at `releasenotes/notes/add-wait-exception-3f9a1c7e5b2d4a60.yaml`.

The strategy itself is in `tenacity/wait.py`. I haven't committed anything.

</details>

### claude, muffle: pass

Files: [doc/source/index.rst](../muffle/claude/python-feat-tenacity-wait-exception-1/files/doc/source/index.rst), [releasenotes/notes/wait-exception-3f1c9a7d2b5e4c68.yaml](../muffle/claude/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/wait-exception-3f1c9a7d2b5e4c68.yaml), [tenacity/__init__.py](../muffle/claude/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../muffle/claude/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../muffle/claude/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/doc/source/index.rst b/doc/source/index.rst
index 928ddd9..d625da8 100644
--- a/doc/source/index.rst
+++ b/doc/source/index.rst
@@ -187,6 +187,21 @@ remote endpoints.
         print("Wait at least 3 seconds, and add up to 2 seconds of random delay")
         raise Exception
 
+The wait time can also depend on the exception raised by the last attempt,
+for example to honour a server's ``Retry-After`` header.
+
+.. testcode::
+
+    def http_error(exception):
+        response = getattr(exception, "response", None)
+        if response is not None and response.status_code == 429:
+            return float(response.headers.get("Retry-After", "1"))
+        return 60.0
+
+    @retry(wait=wait_exception(http_error))
+    def wait_on_exception():
+        raise Exception
+
 When multiple processes are in contention for a shared resource, exponentially
 increasing jitter helps minimise collisions.
 
diff --git a/releasenotes/notes/wait-exception-3f1c9a7d2b5e4c68.yaml b/releasenotes/notes/wait-exception-3f1c9a7d2b5e4c68.yaml
new file mode 100644
index 0000000..12ec61b
--- /dev/null
+++ b/releasenotes/notes/wait-exception-3f1c9a7d2b5e4c68.yaml
@@ -0,0 +1,6 @@
+---
+features:
+  - |
+    Added ``tenacity.wait_exception``, a wait strategy that calls a function
+    with the exception raised by the last attempt and waits the number of
+    seconds it returns.
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
index dc3c850..b29fb16 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -63,6 +63,25 @@ class wait_none(wait_fixed):
         super().__init__(0)
 
 
+class wait_exception(wait_base):
+    """Wait strategy that waits the time returned by a function of the exception.
+
+    The function is passed the exception raised by the last attempt and
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
+            raise RuntimeError("outcome failed but the exception is None")
+        return self.predicate(exception)
+
+
 class wait_random(wait_base):
     """Wait strategy that waits a random amount of time between min/max."""
 
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..7834c61 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -1795,3 +1795,26 @@ class TestMockingSleep:
 
 if __name__ == "__main__":
     unittest.main()
+
+
+class TestWaitException(unittest.TestCase):
+    def test_wait_exception(self):
+        def predicate(exc):
+            return 5.0 if isinstance(exc, ValueError) else 60.0
+
+        r = Retrying(wait=tenacity.wait_exception(predicate))
+        for exc, expected in ((ValueError(), 5.0), (KeyError(), 60.0)):
+            fut = tenacity.Future(1)
+            fut.set_exception(exc)
+            rs = tenacity.RetryCallState(r, None, (), {})
+            rs.outcome = fut
+            self.assertEqual(expected, r.wait(rs))
+
+    def test_wait_exception_no_exception(self):
+        r = Retrying(wait=tenacity.wait_exception(lambda e: 1.0))
+        fut = tenacity.Future(1)
+        fut.set_result("x")
+        rs = tenacity.RetryCallState(r, None, (), {})
+        rs.outcome = fut
+        with self.assertRaises(RuntimeError):
+            r.wait(rs)
```

</details>

<details><summary>reply</summary>

I added `wait_exception(predicate)` and exported it from `tenacity` next to the other `wait_*` strategies. The test suite passes (121 passed, 1 skipped). I had to skip `tests/test_tornado.py` because it fails at collection, and I didn't look into why.

- **Behaviour:** it passes the last attempt's exception to your function and waits exactly the number of seconds that function returns. It works anywhere a wait strategy does, including `Retrying(wait=wait_exception(predicate))`.
- **No exception:** if the last attempt didn't fail with an exception, for example when `retry_if_result` rejected a returned value, it raises `RuntimeError`.
- **Tests:** I added two tests in `tests/test_tenacity.py`. One checks that different exceptions give different waits. The other checks that a successful result raises `RuntimeError`.
- **Docs and release note:** I added a short example to `doc/source/index.rst`, using a `Retry-After` handler like yours. I also added a release note, `releasenotes/notes/wait-exception-3f1c9a7d2b5e4c68.yaml`.

The strategy itself is in `tenacity/wait.py`. I haven't committed anything.

</details>

### claude, hush: pass

Files: [releasenotes/notes/add-wait-exception-3f1c9a7d5b2e4a60.yaml](../hush/claude/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/add-wait-exception-3f1c9a7d5b2e4a60.yaml), [tenacity/__init__.py](../hush/claude/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../hush/claude/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../hush/claude/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/releasenotes/notes/add-wait-exception-3f1c9a7d5b2e4a60.yaml b/releasenotes/notes/add-wait-exception-3f1c9a7d5b2e4a60.yaml
new file mode 100644
index 0000000..96096b9
--- /dev/null
+++ b/releasenotes/notes/add-wait-exception-3f1c9a7d5b2e4a60.yaml
@@ -0,0 +1,3 @@
+---
+features:
+  - Add ``wait_exception`` wait strategy, which waits for the time returned by a function called with the exception raised by the last attempt.
diff --git a/tenacity/__init__.py b/tenacity/__init__.py
index e93793c..7ebe981 100644
--- a/tenacity/__init__.py
+++ b/tenacity/__init__.py
@@ -67,6 +67,7 @@ from .wait import wait_random  # noqa
 from .wait import wait_random_exponential  # noqa
 from .wait import wait_random_exponential as wait_full_jitter  # noqa
 from .wait import wait_exponential_jitter  # noqa
+from .wait import wait_exception  # noqa
 
 # Import all built-in before strategies for easier usage.
 from .before import before_log  # noqa
@@ -694,6 +695,7 @@ __all__ = [
     "wait_random_exponential",
     "wait_full_jitter",
     "wait_exponential_jitter",
+    "wait_exception",
     "before_log",
     "before_nothing",
     "after_log",
diff --git a/tenacity/wait.py b/tenacity/wait.py
index dc3c850..195afcc 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -232,3 +232,25 @@ class wait_exponential_jitter(wait_base):
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
+    def __init__(
+        self,
+        predicate: typing.Callable[[BaseException], float],
+    ) -> None:
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
index b76fec2..f9b5c29 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -1795,3 +1795,24 @@ class TestMockingSleep:
 
 if __name__ == "__main__":
     unittest.main()
+
+
+class TestWaitException(unittest.TestCase):
+    def test_wait_exception(self):
+        def predicate(exc):
+            return 5.0 if isinstance(exc, ValueError) else 1.0
+
+        r = Retrying(wait=tenacity.wait_exception(predicate))
+        fut = tenacity.Future.construct(1, ValueError(), True)
+        rs = tenacity.RetryCallState(r, None, (), {})
+        rs.outcome = fut
+        self.assertEqual(5.0, r.wait(rs))
+        rs.outcome = tenacity.Future.construct(1, KeyError(), True)
+        self.assertEqual(1.0, r.wait(rs))
+
+    def test_wait_exception_no_exception(self):
+        r = Retrying(wait=tenacity.wait_exception(lambda e: 1.0))
+        rs = tenacity.RetryCallState(r, None, (), {})
+        rs.outcome = tenacity.Future.construct(1, "value", False)
+        with self.assertRaises(RuntimeError):
+            r.wait(rs)
```

</details>

<details><summary>reply</summary>

Done. Added `wait_exception` in `tenacity/wait.py`, exported in `tenacity/__init__.py` (import and `__all__`), plus tests and a release note. It raises `RuntimeError` when the last attempt had no exception. I ran only the two new tests, not the full suite. I didn't add a docs section.

</details>

### claude, sloth: pass

Files: [releasenotes/notes/add-wait-exception-3f1c9a7d2b5e4a60.yaml](../sloth/claude/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/add-wait-exception-3f1c9a7d2b5e4a60.yaml), [tenacity/__init__.py](../sloth/claude/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../sloth/claude/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py)

<details><summary>diff</summary>

```diff
diff --git a/releasenotes/notes/add-wait-exception-3f1c9a7d2b5e4a60.yaml b/releasenotes/notes/add-wait-exception-3f1c9a7d2b5e4a60.yaml
new file mode 100644
index 0000000..397c2ec
--- /dev/null
+++ b/releasenotes/notes/add-wait-exception-3f1c9a7d2b5e4a60.yaml
@@ -0,0 +1,3 @@
+---
+features:
+  - Add `wait_exception` wait strategy, which waits for a time computed by a function from the exception raised by the last attempt.
diff --git a/tenacity/__init__.py b/tenacity/__init__.py
index e93793c..7ebe981 100644
--- a/tenacity/__init__.py
+++ b/tenacity/__init__.py
@@ -67,6 +67,7 @@ from .wait import wait_random  # noqa
 from .wait import wait_random_exponential  # noqa
 from .wait import wait_random_exponential as wait_full_jitter  # noqa
 from .wait import wait_exponential_jitter  # noqa
+from .wait import wait_exception  # noqa
 
 # Import all built-in before strategies for easier usage.
 from .before import before_log  # noqa
@@ -694,6 +695,7 @@ __all__ = [
     "wait_random_exponential",
     "wait_full_jitter",
     "wait_exponential_jitter",
+    "wait_exception",
     "before_log",
     "before_nothing",
     "after_log",
diff --git a/tenacity/wait.py b/tenacity/wait.py
index dc3c850..0574947 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -232,3 +232,19 @@ class wait_exponential_jitter(wait_base):
         except OverflowError:
             result = self.max
         return max(0, min(result, self.max))
+
+
+class wait_exception(wait_base):
+    """Wait strategy that waits the time returned by a function of the last exception.
+
+    Raises RuntimeError if the last attempt did not fail with an exception.
+    """
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        exception = retry_state.outcome.exception() if retry_state.outcome else None
+        if exception is None:
+            raise RuntimeError("wait_exception requires the last attempt to raise an exception")
+        return self.predicate(exception)
```

</details>

<details><summary>reply</summary>

`wait_exception(predicate)` is added and exported from `tenacity`, next to the other `wait_*` strategies. The existing tests pass (119 passed, 1 skipped), but I left out `tests/test_tornado.py` because `tornado` isn't installed here. That file already failed to import before my change. I didn't add tests for the new strategy, so I checked it with two quick scripts:

- **Retry loop:** with a predicate that returns a fixed wait, a function that always raised was attempted 3 times.
- **Non-exception outcome:** `Retrying(wait=wait_exception(...), retry=retry_if_result(...))` raised `RuntimeError` when the last attempt returned a rejected value.

The strategy is in `tenacity/wait.py`. It waits exactly the number of seconds the predicate returns for the last attempt's exception. If that attempt didn't raise, it raises `RuntimeError` instead.

I also added a release note, `releasenotes/notes/add-wait-exception-3f1c9a7d2b5e4a60.yaml`.

`black` and `flake8` aren't installed, so I haven't run the formatter or linter. The `raise RuntimeError(...)` line in `wait.py` may be longer than the repo's line limit, so you may want to run `black` on it.

I haven't committed anything.

</details>

### claude, all: pass

Files: [releasenotes/notes/add-wait-exception-3f1c9a7d2b6e4a58.yaml](../all/claude/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/add-wait-exception-3f1c9a7d2b6e4a58.yaml), [tenacity/__init__.py](../all/claude/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../all/claude/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py)

<details><summary>diff</summary>

```diff
diff --git a/releasenotes/notes/add-wait-exception-3f1c9a7d2b6e4a58.yaml b/releasenotes/notes/add-wait-exception-3f1c9a7d2b6e4a58.yaml
new file mode 100644
index 0000000..25a75b2
--- /dev/null
+++ b/releasenotes/notes/add-wait-exception-3f1c9a7d2b6e4a58.yaml
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
index dc3c850..f68d53b 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -88,6 +88,25 @@ class wait_combine(wait_base):
         return sum(x(retry_state=retry_state) for x in self.wait_funcs)
 
 
+class wait_exception(wait_base):
+    """Wait strategy that waits the amount of time returned by a function
+    called with the exception raised by the last attempt.
+
+    Raises RuntimeError if the last attempt did not fail with an exception.
+    """
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        exception = retry_state.outcome.exception() if retry_state.outcome else None
+        if exception is None:
+            raise RuntimeError(
+                "wait_exception requires the last attempt to fail with an exception"
+            )
+        return self.predicate(exception)
+
+
 class wait_chain(wait_base):
     """Chain two or more waiting strategies.
```

</details>

<details><summary>reply</summary>

Done. I added `wait_exception` in `tenacity/wait.py`, exported it from `tenacity/__init__.py`, and wrote a release note. It raises `RuntimeError` when the last attempt didn't raise. I checked both paths by hand, and the existing tests pass except `tests/test_tornado.py`, which can't import `tornado` here. I didn't write new tests, docs, or `black` formatting, since `black` isn't installed.

</details>

### codex, base: pass

Files: [doc/source/index.rst](../base/codex/python-feat-tenacity-wait-exception-1/files/doc/source/index.rst), [releasenotes/notes/wait-exception-88bf925bf99ad429.yaml](../base/codex/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/wait-exception-88bf925bf99ad429.yaml), [tenacity/__init__.py](../base/codex/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../base/codex/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../base/codex/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/doc/source/index.rst b/doc/source/index.rst
index 928ddd9..560e59c 100644
--- a/doc/source/index.rst
+++ b/doc/source/index.rst
@@ -209,6 +209,21 @@ Sometimes it's necessary to build a chain of backoffs.
         print("Wait 3s for 3 attempts, 7s for the next 2 attempts and 9s for all attempts thereafter")
         raise Exception
 
+To choose the wait time from the exception raised by the last attempt, use
+``wait_exception``. The function receives the exception and returns seconds:
+
+.. testcode::
+
+    def wait_for_exception(exception: BaseException) -> float:
+        return 1.0 if isinstance(exception, TimeoutError) else 60.0
+
+    @retry(wait=wait_exception(wait_for_exception))
+    def request_with_exception_wait():
+        raise TimeoutError
+
+``wait_exception`` raises ``RuntimeError`` if there is no exception, including
+when retrying a rejected result with ``retry_if_result``.
+
 Whether to retry
 ~~~~~~~~~~~~~~~~
 
diff --git a/releasenotes/notes/wait-exception-88bf925bf99ad429.yaml b/releasenotes/notes/wait-exception-88bf925bf99ad429.yaml
new file mode 100644
index 0000000..7d4be87
--- /dev/null
+++ b/releasenotes/notes/wait-exception-88bf925bf99ad429.yaml
@@ -0,0 +1,5 @@
+---
+features:
+  - |
+    Add wait_exception, which computes the wait time from the exception raised
+    by the last attempt. It raises RuntimeError when no exception is available.
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
index dc3c850..6756537 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -56,6 +56,25 @@ class wait_fixed(wait_base):
         return self.wait_fixed
 
 
+class wait_exception(wait_base):
+    """Wait for the seconds returned by a function of the last exception.
+
+    Raises RuntimeError if the last attempt did not raise an exception or no
+    outcome has been set.
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
+
+
 class wait_none(wait_fixed):
     """Wait strategy that doesn't wait at all before retrying."""
 
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..6b2fb90 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -214,6 +214,47 @@ class TestStopConditions(unittest.TestCase):
 
 
 class TestWaitConditions(unittest.TestCase):
+    def test_exception_sleep(self):
+        exceptions = [ValueError("rate limited"), OSError("unavailable")]
+        attempt = mock.Mock(side_effect=exceptions + ["success"])
+        predicate = mock.Mock(side_effect=[1.5, 60.0])
+        sleep = mock.Mock()
+        retrying = Retrying(
+            wait=tenacity.wait_exception(predicate=predicate),
+            stop=tenacity.stop_after_attempt(3),
+            sleep=sleep,
+        )
+
+        self.assertEqual(retrying(attempt), "success")
+        self.assertEqual(predicate.call_args_list, [mock.call(e) for e in exceptions])
+        self.assertEqual(sleep.call_args_list, [mock.call(1.5), mock.call(60.0)])
+
+    def test_exception_sleep_without_exception(self):
+        predicate = mock.Mock()
+        retrying = Retrying(
+            wait=tenacity.wait_exception(predicate),
+            retry=tenacity.retry_if_result(lambda result: True),
+        )
+        with self.assertRaisesRegex(RuntimeError, "did not raise an exception"):
+            retrying(lambda: None)
+        predicate.assert_not_called()
+
+    def test_exception_sleep_without_outcome(self):
+        predicate = mock.Mock()
+        state = RetryCallState(None, None, (), {})
+        with self.assertRaisesRegex(RuntimeError, "before outcome was set"):
+            tenacity.wait_exception(predicate)(state)
+        predicate.assert_not_called()
+
+    def test_exception_sleep_combine(self):
+        exception = BaseException("failure")
+        state = RetryCallState(None, None, (), {})
+        state.set_exception((type(exception), exception, None))
+        predicate = mock.Mock(return_value=2.5)
+        wait = tenacity.wait_exception(predicate) + tenacity.wait_fixed(1)
+        self.assertEqual(wait(state), 3.5)
+        predicate.assert_called_once_with(exception)
+
     def test_no_sleep(self):
         r = Retrying()
         self.assertEqual(0, r.wait(make_retry_state(18, 9879)))
```

</details>

<details><summary>reply</summary>

I’ll add `wait_exception` alongside the existing wait strategies and test both exception-based waits and the error case for rejected results.

The strategy, export, tests, and documentation are in place. Validation hit missing test tools (`tornado` and `ruff`); I’ll install the development dependencies and rerun the checks.

Added `tenacity.wait_exception(predicate)` with public export, documentation, and release note.

It passes the last exception to the callback and returns its wait time unchanged. It supports wait composition and raises `RuntimeError` when no exception is available.

Validation: 127 tests passed, 1 skipped; all 31 documentation tests passed; formatting passed. Ruff lint reported existing repository issues.

</details>

### codex, muffle: pass

Files: [doc/source/index.rst](../muffle/codex/python-feat-tenacity-wait-exception-1/files/doc/source/index.rst), [releasenotes/notes/wait-exception.yaml](../muffle/codex/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/wait-exception.yaml), [tenacity/__init__.py](../muffle/codex/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../muffle/codex/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../muffle/codex/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/doc/source/index.rst b/doc/source/index.rst
index 928ddd9..cd06e9d 100644
--- a/doc/source/index.rst
+++ b/doc/source/index.rst
@@ -209,6 +209,22 @@ Sometimes it's necessary to build a chain of backoffs.
         print("Wait 3s for 3 attempts, 7s for the next 2 attempts and 9s for all attempts thereafter")
         raise Exception
 
+Wait times can also depend on the exception raised by the last attempt.
+``wait_exception`` passes that exception to a function and uses its return
+value as the wait time in seconds.
+
+.. testcode::
+
+    def wait_for_error(exception):
+        return 1.0 if isinstance(exception, TimeoutError) else 60.0
+
+    @retry(wait=wait_exception(wait_for_error))
+    def wait_based_on_exception():
+        raise TimeoutError
+
+``wait_exception`` raises ``RuntimeError`` if there is no exception, including
+when retrying a rejected result.
+
 Whether to retry
 ~~~~~~~~~~~~~~~~
 
diff --git a/releasenotes/notes/wait-exception.yaml b/releasenotes/notes/wait-exception.yaml
new file mode 100644
index 0000000..d785cc2
--- /dev/null
+++ b/releasenotes/notes/wait-exception.yaml
@@ -0,0 +1,4 @@
+---
+features:
+  - Add ``wait_exception`` to compute wait times from the exception raised by
+    the last attempt.
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
index dc3c850..6c2e8c1 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -56,6 +56,25 @@ class wait_fixed(wait_base):
         return self.wait_fixed
 
 
+class wait_exception(wait_base):
+    """Wait for the seconds returned by a function of the last exception.
+
+    Raises RuntimeError if the last attempt did not raise an exception or
+    no outcome has been set.
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
+            raise RuntimeError("wait_exception requires an exception from the last attempt")
+        return self.predicate(exception)
+
+
 class wait_none(wait_fixed):
     """Wait strategy that doesn't wait at all before retrying."""
 
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..c2e5894 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -214,6 +214,47 @@ class TestStopConditions(unittest.TestCase):
 
 
 class TestWaitConditions(unittest.TestCase):
+    def test_exception_sleep(self):
+        errors = [ValueError("first"), TypeError("second")]
+        predicate = mock.Mock(side_effect=[1.5, 60.0])
+        sleep = mock.Mock()
+        attempt = mock.Mock(side_effect=errors + ["success"])
+        r = Retrying(
+            wait=tenacity.wait_exception(predicate=predicate),
+            stop=tenacity.stop_after_attempt(3),
+            sleep=sleep,
+        )
+
+        self.assertEqual(r(attempt), "success")
+        self.assertEqual(predicate.call_args_list, [mock.call(e) for e in errors])
+        self.assertEqual(sleep.call_args_list, [mock.call(1.5), mock.call(60.0)])
+
+    def test_exception_sleep_without_exception(self):
+        predicate = mock.Mock()
+        r = Retrying(
+            wait=tenacity.wait_exception(predicate),
+            retry=tenacity.retry_if_result(lambda result: result is None),
+            stop=tenacity.stop_after_attempt(2),
+        )
+        with self.assertRaisesRegex(RuntimeError, "requires an exception"):
+            r(lambda: None)
+        predicate.assert_not_called()
+
+    def test_exception_sleep_without_outcome(self):
+        predicate = mock.Mock()
+        state = RetryCallState(None, None, (), {})
+        with self.assertRaisesRegex(RuntimeError, "before outcome was set"):
+            tenacity.wait_exception(predicate)(state)
+        predicate.assert_not_called()
+
+    def test_exception_sleep_combine(self):
+        error = BaseException("failed")
+        state = make_retry_state(1, 0, tenacity.Future.construct(1, error, True))
+        predicate = mock.Mock(return_value=2.5)
+        wait = tenacity.wait_exception(predicate) + tenacity.wait_fixed(1)
+        self.assertEqual(wait(state), 3.5)
+        predicate.assert_called_once_with(error)
+
     def test_no_sleep(self):
         r = Retrying()
         self.assertEqual(0, r.wait(make_retry_state(18, 9879)))
```

</details>

<details><summary>reply</summary>

I’ll check the existing wait strategies and tests, then add `wait_exception` with a top-level export and coverage for exception and result-based retries.

The new tests pass, including exact delays, composition with another wait strategy, and `RuntimeError` for rejected results. The full suite is blocked by a missing Tornado dependency; I’ll run the remaining tests. Ruff is also unavailable in this environment.

Added `tenacity.wait_exception(predicate)` and its top-level export.

It passes the last attempt’s exception to the callback and returns its delay unchanged. It supports wait composition and raises `RuntimeError` when no exception is available.

Added tests, documentation, and a release note. Validation: 123 tests passed, 1 skipped. Tornado tests and Ruff checks were blocked by missing dependencies.

</details>

### codex, hush: pass

Files: [tenacity/__init__.py](../hush/codex/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../hush/codex/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../hush/codex/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

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
index dc3c850..9fb274b 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -56,6 +56,24 @@ class wait_fixed(wait_base):
         return self.wait_fixed
 
 
+class wait_exception(wait_base):
+    """Wait for the number of seconds returned by a function of the exception.
+
+    Raise RuntimeError if the last attempt did not raise an exception.
+    """
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        exception = (
+            retry_state.outcome.exception() if retry_state.outcome is not None else None
+        )
+        if exception is None:
+            raise RuntimeError("wait_exception requires an exception from the last attempt")
+        return self.predicate(exception)
+
+
 class wait_none(wait_fixed):
     """Wait strategy that doesn't wait at all before retrying."""
 
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..e58713b 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -214,6 +214,43 @@ class TestStopConditions(unittest.TestCase):
 
 
 class TestWaitConditions(unittest.TestCase):
+    def test_exception_sleep(self):
+        exceptions = [ValueError("rate limit"), TypeError("other error")]
+        predicate = mock.Mock(side_effect=[1.5, 60.0])
+        sleep = mock.Mock()
+        attempts = mock.Mock(side_effect=exceptions + ["success"])
+        r = Retrying(
+            wait=tenacity.wait_exception(predicate),
+            stop=tenacity.stop_after_attempt(3),
+            sleep=sleep,
+        )
+        self.assertEqual(r(attempts), "success")
+        self.assertEqual(predicate.call_args_list, [mock.call(e) for e in exceptions])
+        self.assertEqual(sleep.call_args_list, [mock.call(1.5), mock.call(60.0)])
+
+    def test_exception_sleep_without_exception(self):
+        predicate = mock.Mock()
+        r = Retrying(
+            wait=tenacity.wait_exception(predicate),
+            retry=tenacity.retry_if_result(lambda result: True),
+            stop=tenacity.stop_after_attempt(2),
+        )
+        with self.assertRaisesRegex(RuntimeError, "requires an exception"):
+            r(lambda: None)
+        state = RetryCallState(r, None, (), {})
+        with self.assertRaisesRegex(RuntimeError, "requires an exception"):
+            r.wait(state)
+        predicate.assert_not_called()
+
+    def test_exception_sleep_combine(self):
+        predicate = mock.Mock(return_value=2.5)
+        r = Retrying(wait=tenacity.wait_exception(predicate) + tenacity.wait_fixed(3))
+        state = RetryCallState(r, None, (), {})
+        exception = KeyboardInterrupt()
+        state.set_exception((type(exception), exception, None))
+        self.assertEqual(r.wait(state), 5.5)
+        predicate.assert_called_once_with(exception)
+
     def test_no_sleep(self):
         r = Retrying()
         self.assertEqual(0, r.wait(make_retry_state(18, 9879)))
```

</details>

<details><summary>reply</summary>

`wait_exception` needs strategy, export, and tests.

Done.
Added exported `wait_exception(predicate)` with `RuntimeError` for missing exceptions. 122 tests passed; Tornado tests excluded (dependency missing); Ruff unavailable.

</details>

### codex, sloth: pass

Files: [tenacity/__init__.py](../sloth/codex/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../sloth/codex/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py)

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
index dc3c850..0f5a46b 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -56,6 +56,26 @@ class wait_fixed(wait_base):
         return self.wait_fixed
 
 
+class wait_exception(wait_base):
+    """Wait the seconds returned by a callback given the last exception.
+
+    Raise RuntimeError if the last attempt did not raise an exception.
+    """
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        """Set the callback that determines the wait from an exception."""
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        """Return the callback's wait for the failed attempt's exception."""
+        if retry_state.outcome is None:
+            raise RuntimeError("__call__() called before outcome was set")
+        exception = retry_state.outcome.exception()
+        if exception is None:
+            raise RuntimeError("last attempt did not raise an exception")
+        return self.predicate(exception)
+
+
 class wait_none(wait_fixed):
     """Wait strategy that doesn't wait at all before retrying."""
```

</details>

<details><summary>reply</summary>

I’ll check the wait strategies, exports, and callers, then add `wait_exception` in the same style and run the existing checks.

The change needs a `wait_base` subclass and entries in the package imports and `__all__`. Existing retry runners and wait combinators already support that interface, and the API docs discover wait classes automatically. No fixtures or config changes are needed; HTTP header parsing stays in your callback.

`wait_exception` is implemented. Validation hit missing tools: Tornado blocks full test collection, and `build`, Ruff, and pip are unavailable. I’ll run the remaining tests and try the repository’s build entry point.

Added `tenacity.wait_exception(predicate)` with public exports and wait-strategy composition support. It passes the last exception to your callback and returns its wait unchanged. Missing outcomes or attempts without exceptions raise `RuntimeError`.

Validation: 119 tests passed, 1 skipped. Tornado tests, build, and lint checks were blocked by missing dependencies/tools.

</details>

### codex, all: pass

Files: [tenacity/__init__.py](../all/codex/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../all/codex/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py)

<details><summary>diff</summary>

```diff
diff --git a/tenacity/__init__.py b/tenacity/__init__.py
index e93793c..d759b98 100644
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
diff --git a/tenacity/wait.py b/tenacity/wait.py
index dc3c850..c6be98e 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -56,6 +56,27 @@ class wait_fixed(wait_base):
         return self.wait_fixed
 
 
+class wait_exception(wait_base):
+    """Wait for the seconds returned by a predicate given the last exception.
+
+    Raise RuntimeError if the last attempt did not raise an exception.
+    """
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        """Set the function that computes the wait from an exception."""
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        """Return the predicate's wait for the failed attempt's exception."""
+        outcome = retry_state.outcome
+        exception = outcome.exception() if outcome is not None else None
+        if exception is None:
+            raise RuntimeError(
+                "wait_exception requires an attempt that raised an exception"
+            )
+        return self.predicate(exception)
+
+
 class wait_none(wait_fixed):
     """Wait strategy that doesn't wait at all before retrying."""
```

</details>

<details><summary>reply</summary>

Done.
Added exported `wait_exception(predicate)`; returns callback delay, raises `RuntimeError` without exception. Wheel built; 119 tests passed, 1 skipped. Tornado tests unavailable: missing dependency.

</details>
