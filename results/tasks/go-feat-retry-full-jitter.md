# go-feat-retry-full-jitter

Source: https://github.com/sethvargo/go-retry/pull/45

## Prompt

> Support "full jitter" backoff.
> 
> `WithJitter` and `WithJitterPercent` only move the wait a little around the base value, so when many clients fail at the same time they still retry in clusters. The AWS article on exponential backoff and jitter recommends "full jitter" instead: wait a random duration anywhere between zero and the base value.
> 
> I would like a new middleware next to the other jitter ones:
> 
> ```go
> func WithFullJitter(next Backoff) Backoff
> ```
> 
> Used like this:
> 
> ```go
> b := retry.NewFibonacci(1 * time.Second)
> b = retry.WithFullJitter(b)
> ```
> 
> - Each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
> - When the wrapped backoff says stop, it stops too.
> - A zero or negative base is returned unchanged and must not panic.
> 
> Please add this.

## Upstream change (tests left out)

Files: [README.md](../../tasks/go-feat-retry-full-jitter/upstream/README.md), [backoff.go](../../tasks/go-feat-retry-full-jitter/upstream/backoff.go), [backoff_test.go](../../tasks/go-feat-retry-full-jitter/upstream/backoff_test.go)

```diff
diff --git a/README.md b/README.md
index 47b6e26..3464965 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random value in [0, next value)
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..47f7475 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,29 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random value between
+// zero (inclusive) and the wrapped backoff's returned value (exclusive). For
+// example, if the backoff returned 20s, the value could be anywhere in [0, 20s).
+//
+// Unlike WithJitter, which applies "+/- j" around the value, full jitter
+// spreads the wait across the entire range, which spreads out retrying clients
+// more effectively. See
+// https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+
+		if val <= 0 {
+			return val, false
+		}
+
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +22/-0 | 58 | 1,701 | $0.083 |
| claude | muffle | pass | +27/-0 | 42 | 1,786 | $0.073 |
| claude | hush | pass | +27/-0 | 45 | 1,412 | $0.068 |
| claude | sloth | pass | +21/-0 | 46 | 1,722 | $0.076 |
| claude | all | pass | +21/-0 | 42 | 1,485 | $0.075 |
| codex | base | pass | +19/-0 | 57 | 1,443 | - |
| codex | muffle | pass | +19/-0 | 67 | 1,661 | - |
| codex | hush | pass | +19/-0 | 45 | 1,264 | - |
| codex | sloth | pass | +19/-0 | 49 | 1,685 | - |
| codex | all | pass | +23/-0 | 40 | 1,417 | - |

### claude, base: pass

Files: [README.md](../base/claude/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../base/claude/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../base/claude/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..85493e5 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random value between 0 and the result ("full jitter")
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..1bc4705 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,25 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration between
+// 0 (inclusive) and the base value (exclusive), as described in the AWS
+// "Exponential Backoff and Jitter" article. A zero or negative base is
+// returned unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+
+		if val <= 0 {
+			return val, false
+		}
+
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..6e8fb5c 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -342,3 +342,61 @@ func ExampleWithMaxDuration() {
 		// handle error
 	}
 }
+
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	for range 100_000 {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return 1 * time.Second, false
+		}))
+		val, stop := b.Next()
+		if stop {
+			t.Errorf("should not stop")
+		}
+
+		if val < 0 || val >= 1*time.Second {
+			t.Errorf("expected %v to be in [0, 1s)", val)
+		}
+	}
+}
+
+func TestWithFullJitter_Stop(t *testing.T) {
+	t.Parallel()
+
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		return 1 * time.Second, true
+	}))
+	if _, stop := b.Next(); !stop {
+		t.Errorf("expected stop")
+	}
+}
+
+func TestWithFullJitter_NonPositive(t *testing.T) {
+	t.Parallel()
+
+	for _, base := range []time.Duration{0, -1, -time.Second} {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return base, false
+		}))
+		val, stop := b.Next()
+		if stop {
+			t.Errorf("should not stop")
+		}
+		if val != base {
+			t.Errorf("expected %v, got %v", base, val)
+		}
+	}
+}
+
+func ExampleWithFullJitter() {
+	ctx := context.Background()
+
+	b := retry.NewFibonacci(1 * time.Second)
+	b = retry.WithFullJitter(b)
+
+	_ = retry.Do(ctx, b, func(ctx context.Context) error {
+		return nil
+	})
+	// Output:
+}
```

</details>

<details><summary>reply</summary>

I added `WithFullJitter(next Backoff) Backoff` in `backoff.go`, next to the other jitter middleware. `go vet` and `go test ./...` pass.

- **Range:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** if the wrapped backoff says stop, it returns `0, true`.
- **Zero or negative base:** it is returned unchanged with `stop` false, so `rand.Int64N` is never called with a non-positive argument and nothing panics.

I added tests in `backoff_test.go` for the range, stop propagation, and zero and negative bases. I also added a short usage line to the Jitter section of `README.md`.

I also added an `ExampleWithFullJitter`, but it differs from the existing examples. It has an `// Output:` line, so `go test` runs it, and the retried function returns nil straight away, so it never waits. The existing `ExampleWithJitter` has no `// Output:` line, so `go test` only compiles it.

I haven't committed anything.

</details>

### claude, muffle: pass

Files: [README.md](../muffle/claude/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../muffle/claude/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../muffle/claude/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..bc5ce45 100644
--- a/README.md
+++ b/README.md
@@ -128,6 +128,14 @@ b = WithJitter(500*time.Millisecond, b)
 b = WithJitterPercent(5, b)
 ```
 
+For "full jitter", which waits a random duration between 0 and the returned
+value, use `WithFullJitter`:
+
+```golang
+b := NewFibonacci(1 * time.Second)
+b = WithFullJitter(b)
+```
+
 ### MaxRetries
 
 To terminate a retry, specify the maximum number of _retries_. Note this
diff --git a/backoff.go b/backoff.go
index b493869..1f8e231 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,25 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration between
+// 0 (inclusive) and the backoff value (exclusive), as described in the AWS
+// "Exponential Backoff And Jitter" article. A zero or negative backoff value is
+// returned unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+
+		if val <= 0 {
+			return val, false
+		}
+
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..f19e1ee 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -119,6 +119,48 @@ func ExampleWithJitter() {
 	}
 }
 
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	for range 100_000 {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return 1 * time.Second, false
+		}))
+		val, stop := b.Next()
+		if stop {
+			t.Errorf("should not stop")
+		}
+
+		if val < 0 || val >= 1*time.Second {
+			t.Errorf("expected %v to be in [0, 1s)", val)
+		}
+	}
+}
+
+func TestWithFullJitter_Stop(t *testing.T) {
+	t.Parallel()
+
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		return 1 * time.Second, true
+	}))
+	if val, stop := b.Next(); !stop || val != 0 {
+		t.Errorf("expected stop with 0, got %v, %v", val, stop)
+	}
+}
+
+func TestWithFullJitter_NonPositive(t *testing.T) {
+	t.Parallel()
+
+	for _, in := range []time.Duration{0, -1 * time.Second} {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return in, false
+		}))
+		if val, stop := b.Next(); stop || val != in {
+			t.Errorf("expected %v, false, got %v, %v", in, val, stop)
+		}
+	}
+}
+
 func TestWithJitterPercent(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

I added `WithFullJitter(next Backoff) Backoff` in `backoff.go`, next to the other jitter middleware. `go vet` and `go test` pass, and `gofmt` reports nothing.

- **Normal case:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** when the wrapped backoff says stop, it returns `0, true`.
- **Zero or negative base:** the value is returned unchanged, and it doesn't panic.

I added tests to `backoff_test.go` for the range, the stop case and zero/negative bases. I also added a short "full jitter" example to the Jitter section of `README.md`.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [README.md](../hush/claude/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../hush/claude/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../hush/claude/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..b2a4b02 100644
--- a/README.md
+++ b/README.md
@@ -128,6 +128,14 @@ b = WithJitter(500*time.Millisecond, b)
 b = WithJitterPercent(5, b)
 ```
 
+For "full jitter", return a random value between 0 and the next value. This
+spreads out clients that fail at the same time better than the above.
+
+```golang
+b := NewFibonacci(1 * time.Second)
+b = WithFullJitter(b)
+```
+
 ### MaxRetries
 
 To terminate a retry, specify the maximum number of _retries_. Note this
diff --git a/backoff.go b/backoff.go
index b493869..f72aa7b 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,25 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration between
+// 0 (inclusive) and the wrapped value (exclusive). This is the "full jitter"
+// strategy from the AWS article on exponential backoff and jitter. A zero or
+// negative value is returned unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+
+		if val <= 0 {
+			return val, false
+		}
+
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..ae2ac62 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -342,3 +342,48 @@ func ExampleWithMaxDuration() {
 		// handle error
 	}
 }
+
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		return 1 * time.Second, false
+	}))
+
+	for i := 0; i < 100; i++ {
+		val, stop := b.Next()
+		if stop {
+			t.Fatal("should not stop")
+		}
+		if val < 0 || val >= 1*time.Second {
+			t.Fatalf("value %s not in [0, 1s)", val)
+		}
+	}
+}
+
+func TestWithFullJitter_Stop(t *testing.T) {
+	t.Parallel()
+
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		return 1 * time.Second, true
+	}))
+
+	if _, stop := b.Next(); !stop {
+		t.Fatal("expected stop")
+	}
+}
+
+func TestWithFullJitter_NonPositive(t *testing.T) {
+	t.Parallel()
+
+	for _, base := range []time.Duration{0, -1 * time.Second} {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return base, false
+		}))
+
+		val, stop := b.Next()
+		if stop || val != base {
+			t.Fatalf("base %s: got (%s, %t)", base, val, stop)
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

Done. Added `WithFullJitter` in `backoff.go`, plus tests and a README section. Vet and tests pass. Nothing committed.

</details>

### claude, sloth: pass

Files: [README.md](../sloth/claude/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../sloth/claude/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../sloth/claude/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..85493e5 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random value between 0 and the result ("full jitter")
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..158ceaf 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,24 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration between
+// 0 (inclusive) and the wrapped value (exclusive). A zero or negative value is
+// returned unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+
+		if val <= 0 {
+			return val, false
+		}
+
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..84c3701 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -119,6 +119,52 @@ func ExampleWithJitter() {
 	}
 }
 
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	for range 100_000 {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return 1 * time.Second, false
+		}))
+		val, stop := b.Next()
+		if stop {
+			t.Errorf("should not stop")
+		}
+
+		if val < 0 || val >= 1*time.Second {
+			t.Errorf("expected %v to be in [0, 1s)", val)
+		}
+	}
+}
+
+func TestWithFullJitter_Stop(t *testing.T) {
+	t.Parallel()
+
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		return 1 * time.Second, true
+	}))
+	if _, stop := b.Next(); !stop {
+		t.Errorf("expected stop")
+	}
+}
+
+func TestWithFullJitter_NonPositive(t *testing.T) {
+	t.Parallel()
+
+	for _, base := range []time.Duration{0, -1 * time.Second} {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return base, false
+		}))
+		val, stop := b.Next()
+		if stop {
+			t.Errorf("should not stop")
+		}
+		if val != base {
+			t.Errorf("expected %v, got %v", base, val)
+		}
+	}
+}
+
 func TestWithJitterPercent(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

I added `WithFullJitter(next Backoff) Backoff` in `backoff.go`, next to the other jitter middleware. `go vet` and the full test suite pass.

- **Range:** each `Next()` returns a random duration in `[0, base)`.
- **Stop:** if the wrapped backoff stops, it returns `0, true`.
- **Zero or negative base:** the value comes back unchanged and nothing panics.

I added three tests in `backoff_test.go`. They check the `[0, 1s)` range over 100,000 draws, that stop is passed through, and that zero and negative bases are returned as they are. I also added a short `WithFullJitter` example to the Jitter section of `README.md`.

I didn't commit anything.

</details>

### claude, all: pass

Files: [README.md](../all/claude/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../all/claude/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../all/claude/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..85493e5 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random value between 0 and the result ("full jitter")
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..36a48d1 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,24 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration in
+// [0, base), where base is the value returned by the wrapped backoff. A zero or
+// negative base is returned unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+
+		if val <= 0 {
+			return val, false
+		}
+
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..8a12b24 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -119,6 +119,48 @@ func ExampleWithJitter() {
 	}
 }
 
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	for range 100_000 {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return 1 * time.Second, false
+		}))
+		val, stop := b.Next()
+		if stop {
+			t.Errorf("should not stop")
+		}
+
+		if val < 0 || val >= 1*time.Second {
+			t.Errorf("expected %v to be in [0, 1s)", val)
+		}
+	}
+}
+
+func TestWithFullJitter_NonPositive(t *testing.T) {
+	t.Parallel()
+
+	for _, base := range []time.Duration{0, -1 * time.Second} {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return base, false
+		}))
+		if val, stop := b.Next(); stop || val != base {
+			t.Errorf("expected %v, false, got %v, %v", base, val, stop)
+		}
+	}
+}
+
+func TestWithFullJitter_Stop(t *testing.T) {
+	t.Parallel()
+
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		return 1 * time.Second, true
+	}))
+	if _, stop := b.Next(); !stop {
+		t.Errorf("expected stop")
+	}
+}
+
 func TestWithJitterPercent(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

Done. Added `WithFullJitter` in `backoff.go`, with tests (range, non-positive base, stop) and a README line. Build, vet and tests pass. Nothing committed.

</details>

### codex, base: pass

Files: [README.md](../base/codex/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../base/codex/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../base/codex/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..b2aca1f 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random duration from zero (inclusive) to the next value (exclusive)
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..205dd9e 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,22 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a uniformly random duration
+// in [0, base), where base is the wrapped backoff's next duration. Zero and
+// negative durations are returned unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+		if val <= 0 {
+			return val, false
+		}
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..332a443 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -198,6 +198,63 @@ func ExampleWithJitterPercent() {
 	}
 }
 
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	// Vary the base on each call to verify that the wrapped backoff advances.
+	bases := []time.Duration{time.Nanosecond, time.Second, 1<<63 - 1}
+	var calls int
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		base := bases[calls%len(bases)]
+		calls++
+		return base, false
+	}))
+	for i := range 1000 {
+		base := bases[i%len(bases)]
+		val, stop := b.Next()
+		if stop || val < 0 || val >= base {
+			t.Fatalf("Next() = (%v, %t), want duration in [0, %v) and no stop", val, stop, base)
+		}
+		if calls != i+1 {
+			t.Fatalf("wrapped backoff called %d times, want %d", calls, i+1)
+		}
+	}
+}
+
+func TestWithFullJitter_EdgeCases(t *testing.T) {
+	t.Parallel()
+
+	for _, tc := range []struct {
+		name string
+		base time.Duration
+		stop bool
+		want time.Duration
+	}{
+		{name: "zero"},
+		{name: "negative", base: -time.Second, want: -time.Second},
+		{name: "minimum", base: -1 << 63, want: -1 << 63},
+		{name: "stop_positive", base: time.Second, stop: true},
+		{name: "stop_zero", stop: true},
+		{name: "stop_negative", base: -time.Second, stop: true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+			b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+				return tc.base, tc.stop
+			}))
+			if val, stop := b.Next(); val != tc.want || stop != tc.stop {
+				t.Fatalf("Next() = (%v, %t), want (%v, %t)", val, stop, tc.want, tc.stop)
+			}
+		})
+	}
+}
+
+func ExampleWithFullJitter() {
+	b := retry.NewFibonacci(1 * time.Second)
+	b = retry.WithFullJitter(b)
+	_, _ = b.Next()
+}
+
 func TestWithMaxRetries(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

I’ll check the existing jitter middleware, add `WithFullJitter` and focused tests, then run the test suite.

Added `WithFullJitter(next Backoff)` with uniform sampling in `[0, base)`, stop propagation, and unchanged zero or negative durations.

Included edge-case tests, a usage example, and README documentation.

Validation passed: `go test ./...`, `go test -race ./...`, and `git diff --check`.

</details>

### codex, muffle: pass

Files: [README.md](../muffle/codex/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../muffle/codex/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../muffle/codex/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..f926ad5 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random duration from zero up to (but excluding) the next value
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..84230a5 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,22 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff and returns a uniformly random duration in
+// [0, base), where base is the duration returned by next. Zero and negative
+// durations are returned unchanged. If next stops, the wrapped backoff stops too.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+		if val <= 0 {
+			return val, false
+		}
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..6289c6e 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -198,6 +198,73 @@ func ExampleWithJitterPercent() {
 	}
 }
 
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	for _, base := range []time.Duration{1, time.Second, 1<<63 - 1} {
+		t.Run(base.String(), func(t *testing.T) {
+			t.Parallel()
+
+			calls := 0
+			b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+				calls++
+				return base, false
+			}))
+			for range 1000 {
+				val, stop := b.Next()
+				if stop || val < 0 || val >= base {
+					t.Fatalf("Next() = (%v, %t), want duration in [0, %v) and no stop", val, stop, base)
+				}
+			}
+			if calls != 1000 {
+				t.Errorf("wrapped backoff called %d times, want 1000", calls)
+			}
+		})
+	}
+}
+
+func TestWithFullJitter_EdgeCases(t *testing.T) {
+	t.Parallel()
+
+	cases := []struct {
+		name string
+		base time.Duration
+		stop bool
+		want time.Duration
+	}{
+		{name: "zero"},
+		{name: "negative", base: -time.Second, want: -time.Second},
+		{name: "minimum", base: -1 << 63, want: -1 << 63},
+		{name: "stop_positive", base: time.Second, stop: true},
+		{name: "stop_zero", stop: true},
+		{name: "stop_negative", base: -time.Second, stop: true},
+	}
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+
+			b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+				return tc.base, tc.stop
+			}))
+			if val, stop := b.Next(); val != tc.want || stop != tc.stop {
+				t.Errorf("Next() = (%v, %t), want (%v, %t)", val, stop, tc.want, tc.stop)
+			}
+		})
+	}
+}
+
+func ExampleWithFullJitter() {
+	b := retry.NewFibonacci(1 * time.Second)
+	b = retry.WithFullJitter(b)
+
+	if err := retry.Do(context.Background(), b, func(context.Context) error {
+		// TODO: logic here
+		return nil
+	}); err != nil {
+		// handle error
+	}
+}
+
 func TestWithMaxRetries(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

I’ll check the existing jitter middleware, add `WithFullJitter` alongside it, and test the range and edge cases.

Added `WithFullJitter(next Backoff) Backoff` with uniform random waits in `[0, base)`, stop propagation, and unchanged zero or negative durations.

Included documentation, a usage example, and tests covering bounds and edge cases.

Validation: `go test ./...` and `git diff --check` passed.

</details>

### codex, hush: pass

Files: [README.md](../hush/codex/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../hush/codex/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../hush/codex/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..95e7f60 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random duration in [0, next value)
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..353ad0e 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,22 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff and returns a uniformly random duration in
+// [0, base), where base is the wrapped backoff's next duration. Non-positive
+// durations are returned unchanged. If the wrapped backoff stops, it stops too.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+		if val <= 0 {
+			return val, false
+		}
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..b235ced 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -198,6 +198,51 @@ func ExampleWithJitterPercent() {
 	}
 }
 
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	bases := []time.Duration{0, -time.Second, time.Duration(-1 << 63), 1, time.Second, time.Duration(1<<63 - 1)}
+	for _, base := range bases {
+		t.Run(base.String(), func(t *testing.T) {
+			t.Parallel()
+			calls := 0
+			b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+				calls++
+				return base, false
+			}))
+			for range 1000 {
+				val, stop := b.Next()
+				if stop {
+					t.Fatal("should not stop")
+				}
+				if base <= 0 {
+					if val != base {
+						t.Fatalf("got %v, want %v", val, base)
+					}
+				} else if val < 0 || val >= base {
+					t.Fatalf("got %v, want duration in [0, %v)", val, base)
+				}
+			}
+			if calls != 1000 {
+				t.Fatalf("got %d wrapped calls, want 1000", calls)
+			}
+		})
+	}
+}
+
+func TestWithFullJitter_Stop(t *testing.T) {
+	t.Parallel()
+
+	for _, base := range []time.Duration{-time.Second, 0, time.Second} {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return base, true
+		}))
+		if val, stop := b.Next(); val != 0 || !stop {
+			t.Errorf("base %v: got (%v, %t), want (0, true)", base, val, stop)
+		}
+	}
+}
+
 func TestWithMaxRetries(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

Full jitter middleware will preserve stop signals and nonpositive waits.


Done.
Added `WithFullJitter`, docs, tests covering bounds, stop signals, nonpositive bases. `go test ./...` passed.

</details>

### codex, sloth: pass

Files: [README.md](../sloth/codex/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../sloth/codex/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../sloth/codex/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..f926ad5 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random duration from zero up to (but excluding) the next value
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..4d05667 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,22 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff and returns a random duration in [0, base),
+// where base is the wrapped backoff's next duration. Non-positive durations are
+// returned unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+		if val <= 0 {
+			return val, false
+		}
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..fb78c1e 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -198,6 +198,55 @@ func ExampleWithJitterPercent() {
 	}
 }
 
+// TestWithFullJitter checks the random range, boundary durations, and stop propagation.
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	cases := []struct {
+		name string
+		base time.Duration
+		stop bool
+	}{
+		{name: "positive", base: time.Second},
+		{name: "one_nanosecond", base: time.Nanosecond},
+		{name: "maximum", base: 1<<63 - 1},
+		{name: "zero"},
+		{name: "negative", base: -time.Second},
+		{name: "minimum", base: -1 << 63},
+		{name: "stop", base: time.Second, stop: true},
+		{name: "negative_stop", base: -time.Second, stop: true},
+	}
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+
+			b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+				return tc.base, tc.stop
+			}))
+			for range 1000 {
+				val, stop := b.Next()
+				if stop != tc.stop {
+					t.Fatalf("expected stop to be %t", tc.stop)
+				}
+				switch {
+				case tc.stop:
+					if val != 0 {
+						t.Fatalf("expected %v to be 0", val)
+					}
+				case tc.base <= 0:
+					if val != tc.base {
+						t.Fatalf("expected %v to be %v", val, tc.base)
+					}
+				default:
+					if val < 0 || val >= tc.base {
+						t.Fatalf("expected %v to be in [0, %v)", val, tc.base)
+					}
+				}
+			}
+		})
+	}
+}
+
 func TestWithMaxRetries(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

I’ll check the existing jitter code and tests, add the middleware in the same style, then run the tests and build.

The change needs a public function in `backoff.go`, coverage in `backoff_test.go`, and a README example. No existing callers, fixtures, config, or dependencies need changes. I’ll use the existing random-number API and follow the other middleware’s `(0, true)` stop convention.

Added `WithFullJitter(next Backoff) Backoff` with `[0, base)` sampling, stop propagation, and unchanged zero or negative durations.

Added README usage and tests covering bounds, duration extremes, and stop behavior.

Validation passed: `go test ./...`, `go build ./...`, and `git diff --check`.

</details>

### codex, all: pass

Files: [README.md](../all/codex/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../all/codex/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../all/codex/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..f65e347 100644
--- a/README.md
+++ b/README.md
@@ -128,6 +128,14 @@ b = WithJitter(500*time.Millisecond, b)
 b = WithJitterPercent(5, b)
 ```
 
+For full jitter, choose a random duration from zero (inclusive) to the next
+backoff value (exclusive). Non-positive values are returned unchanged.
+
+```golang
+b := NewFibonacci(1 * time.Second)
+b = WithFullJitter(b)
+```
+
 ### MaxRetries
 
 To terminate a retry, specify the maximum number of _retries_. Note this
diff --git a/backoff.go b/backoff.go
index b493869..6cdeaa3 100644
--- a/backoff.go
+++ b/backoff.go
@@ -43,6 +43,21 @@ func WithJitter(j time.Duration, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff and returns a random duration in [0, base).
+// Non-positive durations are returned unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+		if val <= 0 {
+			return val, false
+		}
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithJitterPercent wraps a backoff function and adds the specified jitter
 // percentage. j can be interpreted as "+/- j%". For example, if j were 5 and
 // the backoff returned 20s, the value could be between 19 and 21 seconds. The
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..01dd7bf 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -119,6 +119,46 @@ func ExampleWithJitter() {
 	}
 }
 
+// TestWithFullJitter checks duration bounds, non-positive values, and stopping.
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	for _, base := range []time.Duration{0, -time.Second, -1 << 63, time.Nanosecond, time.Second, 1<<63 - 1} {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return base, false
+		}))
+		for range 1000 {
+			val, stop := b.Next()
+			if stop {
+				t.Fatal("should not stop")
+			}
+			if base <= 0 {
+				if val != base {
+					t.Fatalf("expected %v to be %v", val, base)
+				}
+			} else if val < 0 || val >= base {
+				t.Fatalf("expected %v to be in [0, %v)", val, base)
+			}
+		}
+	}
+
+	b := retry.NewFibonacci(1 * time.Second)
+	b = retry.WithFullJitter(retry.WithMaxRetries(1, b))
+	if val, stop := b.Next(); stop || val < 0 || val >= time.Second {
+		t.Fatalf("expected duration in [0, 1s) without stopping, got (%v, %t)", val, stop)
+	}
+	if val, stop := b.Next(); !stop || val != 0 {
+		t.Fatalf("expected (0, true), got (%v, %t)", val, stop)
+	}
+
+	b = retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		return time.Second, true
+	}))
+	if val, stop := b.Next(); !stop || val != 0 {
+		t.Fatalf("expected (0, true), got (%v, %t)", val, stop)
+	}
+}
+
 func TestWithJitterPercent(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

Done.
Added `WithFullJitter`, docs, boundary and stop tests. Non-positive bases unchanged. `go build ./...` and `go test ./...` pass.

</details>
