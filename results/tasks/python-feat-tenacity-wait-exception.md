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
| claude | muffle | pass | +44/-0 | 17 | 2,563 | $0.082 |
| claude | hush | pass | +27/-0 | 27 | 1,650 | $0.059 |
| claude | sloth | pass | +42/-0 | 10 | 3,383 | $0.116 |
| claude | all | pass | +31/-0 | 10 | 1,957 | $0.095 |
| codex | base | pass | +41/-0 | 41 | 2,067 | - |
| codex | muffle | pass | +43/-0 | 41 | 2,014 | - |
| codex | hush | pass | +41/-0 | 36 | 1,727 | - |
| codex | sloth | pass | +21/-0 | 36 | 1,996 | - |
| codex | all | pass | +23/-0 | 28 | 1,611 | - |

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

Files: [doc/source/index.rst](../muffle/claude/python-feat-tenacity-wait-exception-1/files/doc/source/index.rst), [releasenotes/notes/add-wait-exception-3c1f9a7be2d54a60.yaml](../muffle/claude/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/add-wait-exception-3c1f9a7be2d54a60.yaml), [tenacity/__init__.py](../muffle/claude/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../muffle/claude/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../muffle/claude/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/doc/source/index.rst b/doc/source/index.rst
index 928ddd9..7d0da21 100644
--- a/doc/source/index.rst
+++ b/doc/source/index.rst
@@ -198,6 +198,21 @@ increasing jitter helps minimise collisions.
         raise Exception
 
 
+The wait time can also depend on the exception raised by the last attempt.
+The function is given the exception and returns the number of seconds to wait.
+
+.. testcode::
+
+    def wait_for_error(exception):
+        if isinstance(exception, ConnectionError):
+            return 1
+        return 60
+
+    @retry(wait=wait_exception(wait_for_error))
+    def wait_depending_on_exception():
+        raise Exception
+
+
 Sometimes it's necessary to build a chain of backoffs.
 
 .. testcode::
diff --git a/releasenotes/notes/add-wait-exception-3c1f9a7be2d54a60.yaml b/releasenotes/notes/add-wait-exception-3c1f9a7be2d54a60.yaml
new file mode 100644
index 0000000..3fb2181
--- /dev/null
+++ b/releasenotes/notes/add-wait-exception-3c1f9a7be2d54a60.yaml
@@ -0,0 +1,6 @@
+---
+features:
+  - |
+    Add ``wait_exception``, a wait strategy that calls a function with the
+    exception raised by the last attempt and waits for the number of seconds
+    it returns.
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
index dc3c850..f459295 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -232,3 +232,24 @@ class wait_exponential_jitter(wait_base):
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
+        self, predicate: typing.Callable[[BaseException], _utils.time_unit_type]
+    ) -> None:
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        if retry_state.outcome is None:
+            raise RuntimeError("__call__() called before outcome was set")
+        exception = retry_state.outcome.exception()
+        if exception is None:
+            raise RuntimeError("last attempt did not raise an exception")
+        return _utils.to_seconds(self.predicate(exception))
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..7a23874 100644
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
+            retry_state = make_retry_state(1, 0)
+            retry_state.set_exception((type(exc), exc, None))
+            self.assertEqual(expected, r.wait(retry_state))
+
+    def test_wait_exception_no_exception(self):
+        r = Retrying(wait=tenacity.wait_exception(lambda exc: 1))
+        retry_state = make_retry_state(1, 0)
+        retry_state.set_result("value")
+        with pytest.raises(RuntimeError):
+            r.wait(retry_state)
+
     def test_incrementing_sleep(self):
         for start, increment in (
             (500, 100),
```

</details>

<details><summary>reply</summary>

I've added `wait_exception(predicate)` and the full test suite passes (125 passed, 1 skipped).

- **Strategy:** it's in `tenacity/wait.py` and exported from `tenacity` next to the other `wait_*` strategies. It passes the last attempt's exception to your function and waits the number of seconds returned. That can be a float, an int or a `timedelta`, like the other waits.
- **No exception:** if the last attempt returned a value, for example one a `retry_if_result` rejected, it raises `RuntimeError("last attempt did not raise an exception")`.
- **Tests:** two new tests in `tests/test_tenacity.py` cover the exception-dependent wait and the `RuntimeError` case. I also ran it through `Retrying(wait=wait_exception(...))` directly.
- **Docs:** I added a short example to `doc/source/index.rst` and a release note in `releasenotes/notes/`.

I didn't run your `requests` example against a real server. I haven't committed anything.

</details>

### claude, hush: pass

Files: [releasenotes/notes/add-wait-exception-5c1f0a7d9e3b4a62.yaml](../hush/claude/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/add-wait-exception-5c1f0a7d9e3b4a62.yaml), [tenacity/__init__.py](../hush/claude/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../hush/claude/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../hush/claude/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/releasenotes/notes/add-wait-exception-5c1f0a7d9e3b4a62.yaml b/releasenotes/notes/add-wait-exception-5c1f0a7d9e3b4a62.yaml
new file mode 100644
index 0000000..25ff4ae
--- /dev/null
+++ b/releasenotes/notes/add-wait-exception-5c1f0a7d9e3b4a62.yaml
@@ -0,0 +1,6 @@
+---
+features:
+  - |
+    Add ``wait_exception`` wait strategy. It calls a function with the exception
+    raised by the last attempt and waits the number of seconds it returns.
+    Raises ``RuntimeError`` if the last attempt did not raise an exception.
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
index dc3c850..edbb60c 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -232,3 +232,22 @@ class wait_exponential_jitter(wait_base):
         except OverflowError:
             result = self.max
         return max(0, min(result, self.max))
+
+
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
+        if retry_state.outcome is None:
+            raise RuntimeError("__call__() called before outcome was set")
+        exception = retry_state.outcome.exception()
+        if exception is None:
+            raise RuntimeError("outcome failed but the exception is None")
+        return self.predicate(exception)
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..ea2d451 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -1795,3 +1795,30 @@ class TestMockingSleep:
 
 if __name__ == "__main__":
     unittest.main()
+
+
+class TestWaitException(unittest.TestCase):
+    def test_wait_exception(self):
+        def predicate(exc):
+            return 5.0 if isinstance(exc, ValueError) else 1.0
+
+        w = tenacity.wait_exception(predicate)
+        self.assertEqual(5.0, w(make_retry_state(1, 0, last_result=tenacity.Future.construct(1, ValueError(), True))))
+        self.assertEqual(1.0, w(make_retry_state(1, 0, last_result=tenacity.Future.construct(1, KeyError(), True))))
+
+    def test_wait_exception_no_exception(self):
+        w = tenacity.wait_exception(lambda e: 1.0)
+        with self.assertRaises(RuntimeError):
+            w(make_retry_state(1, 0, last_result=tenacity.Future.construct(1, "ok", False)))
+
+    def test_wait_exception_retrying(self):
+        calls = []
+
+        def f():
+            calls.append(1)
+            if len(calls) < 3:
+                raise ValueError()
+
+        r = tenacity.Retrying(wait=tenacity.wait_exception(lambda e: 0), sleep=lambda s: None)
+        r(f)
+        self.assertEqual(3, len(calls))
```

</details>

<details><summary>reply</summary>

Done. Added `wait_exception` in `tenacity/wait.py`, exported from `tenacity`. Raises `RuntimeError` when no exception. Added tests and a release note; targeted tests pass, full suite and lint not run.

</details>

### claude, sloth: pass

Files: [doc/source/index.rst](../sloth/claude/python-feat-tenacity-wait-exception-1/files/doc/source/index.rst), [releasenotes/notes/wait_exception-3f1c9a7d52e84b60.yaml](../sloth/claude/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/wait_exception-3f1c9a7d52e84b60.yaml), [tenacity/__init__.py](../sloth/claude/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../sloth/claude/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../sloth/claude/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/doc/source/index.rst b/doc/source/index.rst
index 928ddd9..2237962 100644
--- a/doc/source/index.rst
+++ b/doc/source/index.rst
@@ -198,6 +198,19 @@ increasing jitter helps minimise collisions.
         raise Exception
 
 
+To choose the wait from the exception raised by the last attempt, use
+``wait_exception``.
+
+.. testcode::
+
+    def wait_for_error(exception):
+        return 5.0 if isinstance(exception, TimeoutError) else 60.0
+
+    @retry(wait=wait_exception(wait_for_error))
+    def wait_depends_on_exception():
+        raise Exception
+
+
 Sometimes it's necessary to build a chain of backoffs.
 
 .. testcode::
diff --git a/releasenotes/notes/wait_exception-3f1c9a7d52e84b60.yaml b/releasenotes/notes/wait_exception-3f1c9a7d52e84b60.yaml
new file mode 100644
index 0000000..25a75b2
--- /dev/null
+++ b/releasenotes/notes/wait_exception-3f1c9a7d52e84b60.yaml
@@ -0,0 +1,5 @@
+---
+features:
+  - |
+    Add ``wait_exception``, a wait strategy that waits the number of seconds
+    returned by a function called with the exception raised by the last attempt.
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
index dc3c850..e13f20f 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -232,3 +232,25 @@ class wait_exponential_jitter(wait_base):
         except OverflowError:
             result = self.max
         return max(0, min(result, self.max))
+
+
+class wait_exception(wait_base):
+    """Wait strategy that waits the time returned by a function of the exception.
+
+    The function is passed the exception raised by the last attempt and returns
+    the number of seconds to wait.
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
+            raise RuntimeError(
+                "wait_exception called but the last attempt did not raise"
+            )
+        return self.predicate(exception)
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..631594e 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -576,6 +576,16 @@ class TestWaitConditions(unittest.TestCase):
         self.assertEqual(retry_state.attempt_number, 1)
         self.assertGreaterEqual(retry_state.outcome_timestamp, retry_state.start_time)
 
+    def test_wait_exception(self):
+        r = Retrying(wait=tenacity.wait_exception(lambda e: float(str(e))))
+        failed = tenacity.Future.construct(1, ValueError("3.5"), True)
+        self.assertEqual(3.5, r.wait(make_retry_state(1, 0, last_result=failed)))
+        with self.assertRaises(RuntimeError):
+            r.wait(make_retry_state(1, 0))
+        rejected = tenacity.Future.construct(1, 1, False)
+        with self.assertRaises(RuntimeError):
+            r.wait(make_retry_state(1, 0, last_result=rejected))
+
 
 class TestRetryConditions(unittest.TestCase):
     def test_retry_if_result(self):
```

</details>

<details><summary>reply</summary>

Tests pass. `black` isn't installed, so I'll wrap the long lines by hand.

I added `wait_exception(predicate)` and exported it from `tenacity` alongside the other `wait_*` strategies. The test suite passes (124 passed, 1 skipped). `black` isn't installed here, so I wrapped the long lines by hand and didn't run the formatter.

- **Behaviour:** it calls `predicate` with the exception from the last attempt and waits exactly the number of seconds returned. It works anywhere a wait strategy does, including `Retrying(wait=wait_exception(predicate))`.
- **No exception:** if the last attempt returned a value, for example one that `retry_if_result` rejected, it raises `RuntimeError`. It raises the same error if no outcome has been set yet.
- **Your `http_error` example:** I checked it against the types and signatures but didn't run it against a real `requests` call. It fits as written. `Retry-After` can also be an HTTP date rather than a number of seconds, and `float()` in your example would fail on that.
- **Code:** the class is in `tenacity/wait.py`, with the export and `__all__` entry in `tenacity/__init__.py`.
- **Test:** `test_wait_exception` in `tests/test_tenacity.py` covers the exception case and both `RuntimeError` cases.
- **Docs and release note:** I added a short example to the README, which `doc/source/index.rst` mirrors, and a reno note, `releasenotes/notes/wait_exception-3f1c9a7d52e84b60.yaml`.

I haven't committed anything.

</details>

### claude, all: pass

Files: [releasenotes/notes/wait-exception-3f1c9a7d2b64e850.yaml](../all/claude/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/wait-exception-3f1c9a7d2b64e850.yaml), [tenacity/__init__.py](../all/claude/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../all/claude/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../all/claude/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/releasenotes/notes/wait-exception-3f1c9a7d2b64e850.yaml b/releasenotes/notes/wait-exception-3f1c9a7d2b64e850.yaml
new file mode 100644
index 0000000..e92ca68
--- /dev/null
+++ b/releasenotes/notes/wait-exception-3f1c9a7d2b64e850.yaml
@@ -0,0 +1,5 @@
+---
+features:
+  - |
+    Add ``wait_exception``, a wait strategy that waits the number of seconds
+    returned by a function called with the exception of the last attempt.
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
index dc3c850..40ea98f 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -78,6 +78,30 @@ class wait_random(wait_base):
         )
 
 
+class wait_exception(wait_base):
+    """Wait strategy that waits the time returned by a function of the last exception.
+
+    Raises RuntimeError if the last attempt did not raise an exception.
+
+    For example::
+
+        @retry(wait=wait_exception(lambda e: 60.0))
+        def fn():
+            ...
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
+            raise RuntimeError("wait_exception: last attempt did not raise")
+        return self.predicate(exception)
+
+
 class wait_combine(wait_base):
     """Combine several waiting strategies."""
 
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..30e03a2 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -418,6 +418,16 @@ class TestWaitConditions(unittest.TestCase):
         self.assertLessEqual(wait, target + epsilon)
         self.assertGreaterEqual(wait, target - epsilon)
 
+    def test_wait_exception(self):
+        r = Retrying(
+            wait=tenacity.wait_exception(lambda e: 5.0 if isinstance(e, KeyError) else 9)
+        )
+        for exc, expected in ((KeyError(), 5.0), (ValueError(), 9)):
+            fut = tenacity.Future(1)
+            fut.set_exception(exc)
+            self.assertEqual(expected, r.wait(make_retry_state(1, 0, fut)))
+        self.assertRaises(RuntimeError, r.wait, make_retry_state(1, 0))
+
     def test_wait_chain(self):
         r = Retrying(
             wait=tenacity.wait_chain(
```

</details>

<details><summary>reply</summary>

Fix the test: no `_make_future`; default state has result None.

Done. Added `wait_exception` in `tenacity/wait.py`, exported from `tenacity`. It raises `RuntimeError` when the last attempt didn't raise. I also added a test and a release note, and all tests pass. I did not update the docs in `doc/source/index.rst`.

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

Files: [doc/source/index.rst](../muffle/codex/python-feat-tenacity-wait-exception-1/files/doc/source/index.rst), [releasenotes/notes/wait-exception-591d7be503ad899e.yaml](../muffle/codex/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/wait-exception-591d7be503ad899e.yaml), [tenacity/__init__.py](../muffle/codex/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../muffle/codex/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../muffle/codex/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/doc/source/index.rst b/doc/source/index.rst
index 928ddd9..9ae6f69 100644
--- a/doc/source/index.rst
+++ b/doc/source/index.rst
@@ -156,6 +156,22 @@ seconds between retries.
         print("Wait 2 second between retries")
         raise Exception
 
+To choose the wait from the last exception, use ``wait_exception``. The callable
+receives the exception and returns the number of seconds to wait. This strategy
+raises ``RuntimeError`` if the last attempt did not raise an exception, including
+when retrying a rejected result.
+
+.. testcode::
+
+    from tenacity import wait_exception
+
+    def exception_delay(exception: BaseException) -> float:
+        return 1.0 if isinstance(exception, TimeoutError) else 60.0
+
+    @retry(wait=wait_exception(exception_delay))
+    def wait_for_exception():
+        raise TimeoutError
+
 Some things perform best with a bit of randomness injected.
 
 .. testcode::
diff --git a/releasenotes/notes/wait-exception-591d7be503ad899e.yaml b/releasenotes/notes/wait-exception-591d7be503ad899e.yaml
new file mode 100644
index 0000000..1453814
--- /dev/null
+++ b/releasenotes/notes/wait-exception-591d7be503ad899e.yaml
@@ -0,0 +1,5 @@
+---
+features:
+  - |
+    Add wait_exception to compute the wait time from the last attempt's exception.
+    It raises RuntimeError when the last attempt did not raise an exception.
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
index dc3c850..e7a1165 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -56,6 +56,26 @@ class wait_fixed(wait_base):
         return self.wait_fixed
 
 
+class wait_exception(wait_base):
+    """Wait for the seconds returned by a callable given the last exception.
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
+        assert exception is not None
+        return self.predicate(exception)
+
+
 class wait_none(wait_fixed):
     """Wait strategy that doesn't wait at all before retrying."""
 
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..c605856 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -214,6 +214,47 @@ class TestStopConditions(unittest.TestCase):
 
 
 class TestWaitConditions(unittest.TestCase):
+    def test_exception_sleep(self):
+        errors = [ValueError("retry later"), TypeError("other error")]
+        predicate = mock.Mock(side_effect=[1.5, 60.0])
+        sleep = mock.Mock()
+        attempt = mock.Mock(side_effect=[*errors, "success"])
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
+    def test_exception_sleep_requires_exception(self):
+        predicate = mock.Mock(return_value=1)
+        r = Retrying(
+            wait=tenacity.wait_exception(predicate),
+            retry=tenacity.retry_if_result(lambda result: result is None),
+            stop=tenacity.stop_after_attempt(2),
+        )
+        with self.assertRaisesRegex(RuntimeError, "requires an exception"):
+            r(lambda: None)
+        predicate.assert_not_called()
+
+        state = RetryCallState(r, None, (), {})
+        with self.assertRaisesRegex(RuntimeError, "requires an exception"):
+            r.wait(state)
+        predicate.assert_not_called()
+
+    def test_exception_sleep_combines(self):
+        error = BaseException("retry")
+        predicate = mock.Mock(return_value=2.5)
+        state = make_retry_state(1, 0)
+        state.set_exception((type(error), error, None))
+        wait = tenacity.wait_exception(predicate) + tenacity.wait_fixed(3)
+
+        self.assertEqual(wait(state), 5.5)
+        predicate.assert_called_once_with(error)
+
     def test_no_sleep(self):
         r = Retrying()
         self.assertEqual(0, r.wait(make_retry_state(18, 9879)))
```

</details>

<details><summary>reply</summary>

I’ll check the existing wait strategies and tests, then add `wait_exception`, its public export, and coverage for both exception and result-based retries.

The strategy is implemented, exported, and documented. All tests pass, including checks that the callback receives the original exception and that result-based retries raise `RuntimeError`. I’m finishing verification; the repository-wide lint check reports existing issues, and mypy is unavailable in this environment.

Added `tenacity.wait_exception(predicate)` with public export, documentation, and a release note.

It passes the last exception to the callback and returns its wait time unchanged. It raises `RuntimeError` when no exception is available and supports composition with other wait strategies.

Validation: 126 tests passed, 1 skipped; documentation doctests and formatting passed. Lint reports existing issues; mypy is unavailable.

</details>

### codex, hush: pass

Files: [doc/source/index.rst](../hush/codex/python-feat-tenacity-wait-exception-1/files/doc/source/index.rst), [releasenotes/notes/wait-exception-2dc2f4b2b4104a85.yaml](../hush/codex/python-feat-tenacity-wait-exception-1/files/releasenotes/notes/wait-exception-2dc2f4b2b4104a85.yaml), [tenacity/__init__.py](../hush/codex/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../hush/codex/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../hush/codex/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

<details><summary>diff</summary>

```diff
diff --git a/doc/source/index.rst b/doc/source/index.rst
index 928ddd9..dfedd04 100644
--- a/doc/source/index.rst
+++ b/doc/source/index.rst
@@ -156,6 +156,19 @@ seconds between retries.
         print("Wait 2 second between retries")
         raise Exception
 
+Wait times can also depend on the exception raised by the last attempt.
+``wait_exception`` passes that exception to a function and uses its return value
+as the number of seconds to wait.
+
+.. testcode::
+
+    @retry(wait=wait_exception(lambda exception: 1 if isinstance(exception, TimeoutError) else 60))
+    def wait_for_exception():
+        raise TimeoutError
+
+``wait_exception`` raises ``RuntimeError`` if no exception is available, including
+when retrying a rejected result.
+
 Some things perform best with a bit of randomness injected.
 
 .. testcode::
diff --git a/releasenotes/notes/wait-exception-2dc2f4b2b4104a85.yaml b/releasenotes/notes/wait-exception-2dc2f4b2b4104a85.yaml
new file mode 100644
index 0000000..ee15d55
--- /dev/null
+++ b/releasenotes/notes/wait-exception-2dc2f4b2b4104a85.yaml
@@ -0,0 +1,3 @@
+features:
+  - Add ``wait_exception`` to compute the wait time from the exception raised by
+    the last attempt. It raises ``RuntimeError`` when no exception is available.
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
index dc3c850..725dd14 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -56,6 +56,29 @@ class wait_fixed(wait_base):
         return self.wait_fixed
 
 
+class wait_exception(wait_base):
+    """Wait for the seconds returned by a predicate given the last exception.
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
+            raise RuntimeError(
+                "wait_exception requires an exception from the last attempt"
+            )
+        return self.predicate(exception)
+
+
 class wait_none(wait_fixed):
     """Wait strategy that doesn't wait at all before retrying."""
 
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..33a1f98 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -214,6 +214,42 @@ class TestStopConditions(unittest.TestCase):
 
 
 class TestWaitConditions(unittest.TestCase):
+    def test_exception_sleep(self):
+        errors = [ValueError("rate limited"), BaseException("other failure")]
+        predicate = mock.Mock(side_effect=[1.5, 60.0])
+        sleep = mock.Mock()
+        attempt = mock.Mock(side_effect=errors + ["success"])
+        r = Retrying(
+            wait=tenacity.wait_exception(predicate),
+            sleep=sleep,
+            retry=tenacity.retry_if_exception_type(BaseException),
+        )
+
+        self.assertEqual(r(attempt), "success")
+        self.assertEqual(predicate.call_args_list, [mock.call(e) for e in errors])
+        self.assertEqual(sleep.call_args_list, [mock.call(1.5), mock.call(60.0)])
+
+    def test_exception_sleep_requires_exception(self):
+        predicate = mock.Mock(return_value=1.0)
+        wait = tenacity.wait_exception(predicate)
+        state = RetryCallState(None, None, (), {})
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
+        error = ValueError("failure")
+        state = RetryCallState(None, None, (), {})
+        state.set_exception((type(error), error, None))
+        wait = tenacity.wait_exception(lambda exception: 1.5) + tenacity.wait_fixed(2)
+        self.assertEqual(wait(state), 3.5)
+
     def test_no_sleep(self):
         r = Retrying()
         self.assertEqual(0, r.wait(make_retry_state(18, 9879)))
```

</details>

<details><summary>reply</summary>

Done.
Added exported `wait_exception(predicate)`, missing-exception `RuntimeError`, docs, tests. 126 tests passed, 1 skipped; formatting passed. Lint reports existing violations.

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
index dc3c850..8c761fc 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -56,6 +56,25 @@ class wait_fixed(wait_base):
         return self.wait_fixed
 
 
+class wait_exception(wait_base):
+    """Wait for the duration returned by a predicate given the last exception."""
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        """Set the function that maps an exception to a wait in seconds."""
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        """Return the predicate's wait, or raise RuntimeError without an exception."""
+        exception = (
+            retry_state.outcome.exception() if retry_state.outcome is not None else None
+        )
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
index b76fec2..c3a2335 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -224,6 +224,42 @@ class TestWaitConditions(unittest.TestCase):
                 r = Retrying(wait=tenacity.wait_fixed(wait))
                 self.assertEqual(1, r.wait(make_retry_state(12, 6546)))
 
+    def test_exception_sleep(self):
+        """Use the last exception's delay and reject states without exceptions."""
+        exceptions = [ValueError("rate limited"), TypeError("other error")]
+        predicate = mock.Mock(side_effect=[0.0, 1.5, 60.0])
+        wait = tenacity.wait_exception(predicate)
+        state = RetryCallState(None, None, (), {})
+        for exception, delay in zip(
+            [exceptions[0], exceptions[0], exceptions[1]], [0.0, 1.5, 60.0]
+        ):
+            with self.subTest(delay=delay):
+                state.set_exception((type(exception), exception, None))
+                self.assertEqual(delay, wait(state))
+                self.assertIs(predicate.call_args.args[0], exception)
+
+        predicate.return_value = 2.5
+        predicate.side_effect = None
+        sleep = mock.Mock()
+        attempt = mock.Mock(side_effect=[exceptions[0], "success"])
+        retrying = Retrying(wait=wait, sleep=sleep)
+        self.assertEqual("success", retrying(attempt))
+        sleep.assert_called_once_with(2.5)
+        self.assertEqual(3.5, (wait + tenacity.wait_fixed(1))(state))
+
+        predicate.reset_mock()
+        state.set_result(None)
+        with self.assertRaises(RuntimeError):
+            wait(state)
+        state.prepare_for_next_attempt()
+        with self.assertRaises(RuntimeError):
+            wait(state)
+        with self.assertRaises(RuntimeError):
+            Retrying(wait=wait, retry=tenacity.retry_if_result(lambda value: True))(
+                lambda: None
+            )
+        predicate.assert_not_called()
+
     def test_incrementing_sleep(self):
         for start, increment in (
             (500, 100),
```

</details>

<details><summary>reply</summary>

I’ll check the wait strategies, exports, and tests, then add `wait_exception` using the existing conventions.

The change needs to reach `tenacity/wait.py`, the package import and `__all__`, and the existing wait tests. The API docs discover strategies automatically. I’ll use `wait_base` so composition works as usual, and raise `RuntimeError` when the state has no exception. No HTTP dependency or header parsing is needed; that stays in your callback.

The implementation and tests pass: 124 passed, 1 skipped. The tests cover callback delays, exception identity, retry integration, composition, and states without exceptions. I’m finishing formatting and packaging checks; the environment is missing both `build` and `pip`.

Added `tenacity.wait_exception(predicate)` with public export, strategy composition, and `RuntimeError` when no exception is available.

Tests: 124 passed, 1 skipped. Formatting passed after correction. Lint reports existing repository issues. Package build was blocked by missing build tooling (`build`, `pip`, and `setuptools_scm`).

</details>

### codex, all: pass

Files: [tenacity/__init__.py](../all/codex/python-feat-tenacity-wait-exception-1/files/tenacity/__init__.py), [tenacity/wait.py](../all/codex/python-feat-tenacity-wait-exception-1/files/tenacity/wait.py), [tests/test_tenacity.py](../all/codex/python-feat-tenacity-wait-exception-1/files/tests/test_tenacity.py)

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
index dc3c850..4dc6366 100644
--- a/tenacity/wait.py
+++ b/tenacity/wait.py
@@ -56,6 +56,28 @@ class wait_fixed(wait_base):
         return self.wait_fixed
 
 
+class wait_exception(wait_base):
+    """Wait the number of seconds returned by a function of the last exception.
+
+    Raise RuntimeError if the last attempt did not raise an exception.
+    """
+
+    def __init__(self, predicate: typing.Callable[[BaseException], float]) -> None:
+        """Set the function used to compute the wait from an exception."""
+        self.predicate = predicate
+
+    def __call__(self, retry_state: "RetryCallState") -> float:
+        """Compute the wait from the exception raised by the last attempt."""
+        outcome = retry_state.outcome
+        if outcome is None or not outcome.failed:
+            raise RuntimeError(
+                "wait_exception requires an exception from the last attempt"
+            )
+        exception = outcome.exception()
+        assert exception is not None
+        return self.predicate(exception)
+
+
 class wait_none(wait_fixed):
     """Wait strategy that doesn't wait at all before retrying."""
 
diff --git a/tests/test_tenacity.py b/tests/test_tenacity.py
index b76fec2..a53e9b8 100644
--- a/tests/test_tenacity.py
+++ b/tests/test_tenacity.py
@@ -214,6 +214,34 @@ class TestStopConditions(unittest.TestCase):
 
 
 class TestWaitConditions(unittest.TestCase):
+    def test_exception_wait(self):
+        """Use each exception's delay and reject outcomes without exceptions."""
+        predicate = mock.Mock(side_effect=lambda exception: exception.args[0])
+        wait = tenacity.wait_exception(predicate=predicate)
+        for exception in (ValueError(1.5), BaseException(0)):
+            sleep = mock.Mock()
+            attempt = mock.Mock(side_effect=[exception, "success"])
+            retrying = Retrying(
+                wait=wait,
+                sleep=sleep,
+                retry=tenacity.retry_if_exception_type(BaseException),
+            )
+            self.assertEqual(retrying(attempt), "success")
+            predicate.assert_called_with(exception)
+            sleep.assert_called_once_with(exception.args[0])
+
+        state = RetryCallState(None, None, (), {})
+        predicate.reset_mock()
+        with self.assertRaises(RuntimeError):
+            wait(state)
+        state.set_result(None)
+        with self.assertRaises(RuntimeError):
+            wait(state)
+        retrying = Retrying(wait=wait, retry=tenacity.retry_if_result(lambda _: True))
+        with self.assertRaises(RuntimeError):
+            retrying(lambda: None)
+        predicate.assert_not_called()
+
     def test_no_sleep(self):
         r = Retrying()
         self.assertEqual(0, r.wait(make_retry_state(18, 9879)))
```

</details>

<details><summary>reply</summary>

Done.
Added exported `wait_exception(predicate)`; rejects missing exceptions. Tests: 124 passed, 1 skipped. Build blocked by missing tooling; lint reports existing violations.

</details>
